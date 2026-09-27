import type { StereoBuffer } from "../audio-io/buffer.schema.ts";
import { resampleLinear } from "../audio-io/buffer.tool.ts";
import type { TempoCandidate, TempoEstimate } from "./analysis.schema.ts";
import { hann, realSpectrum } from "./fft.tool.ts";

const RATE = 44100;
const FFT_SIZE = 2048;
const HOP = 441;
const FRAME_RATE = RATE / HOP;
const MIN_BPM = 50;
const MAX_BPM = 220;
const NO_TEMPO: TempoEstimate = { bpm: null, confidence: 0, candidates: [], beatsSeconds: [], downbeatsSeconds: [] };

type Peak = { bpm: number; score: number; relation: TempoCandidate["relation"] };
type Envelopes = { onset: Float64Array; hats: Float64Array; low: Float64Array };

function percentile95(values: Float64Array): number {
  const ordered = Array.from(values).sort((a, b) => a - b);
  return ordered[Math.floor((ordered.length - 1) * .95)] ?? 0;
}

function normalize(raw: Float64Array): Float64Array {
  const out = new Float64Array(raw.length);
  const radius = 50;
  const prefix = new Float64Array(raw.length + 1);
  for (let i = 0; i < raw.length; i++) prefix[i + 1] = prefix[i]! + raw[i]!;
  for (let i = 0; i < raw.length; i++) {
    const start = Math.max(0, i - radius);
    const end = Math.min(raw.length, i + radius + 1);
    out[i] = Math.max(0, raw[i]! - (prefix[end]! - prefix[start]!) / (end - start));
  }
  const scale = percentile95(out);
  if (scale > 1e-9) for (let i = 0; i < out.length; i++) out[i] = Math.min(4, out[i]! / scale);
  return out;
}

function envelopes(pcm: StereoBuffer): Envelopes {
  const mono = new Float32Array(pcm.left.length);
  for (let i = 0; i < mono.length; i++) mono[i] = pcm.sourceChannels === 1 ? pcm.left[i]! : (pcm.left[i]! + pcm.right[i]!) / 2;
  const samples = pcm.sampleRate === RATE ? mono : resampleLinear(mono, pcm.sampleRate, RATE);
  const frameCount = Math.max(1, Math.ceil(samples.length / HOP));
  const raw = new Float64Array(frameCount);
  const hats = new Float64Array(frameCount);
  const low = new Float64Array(frameCount);
  const previous = new Float64Array(FFT_SIZE / 2 + 1);
  const scratch = { re: new Float64Array(FFT_SIZE), im: new Float64Array(FFT_SIZE), out: new Float64Array(FFT_SIZE / 2 + 1) };
  const window = hann(FFT_SIZE);
  const firstBin = Math.ceil(40 * FFT_SIZE / RATE);
  const lastBin = Math.floor(10000 * FFT_SIZE / RATE);
  const hatBin = Math.ceil(4000 * FFT_SIZE / RATE);
  const lowFirst = Math.ceil(20 * FFT_SIZE / RATE);
  const lowLast = Math.floor(180 * FFT_SIZE / RATE);
  for (let frame = 0; frame < frameCount; frame++) {
    const spectrum = realSpectrum(samples, frame * HOP, FFT_SIZE, window, scratch);
    if (frame === 0) {
      for (let k = 0; k < previous.length; k++) previous[k] = Math.log1p(100 * spectrum[k]! / (FFT_SIZE / 2));
      continue;
    }
    for (let k = lowFirst; k <= lastBin; k++) {
      const current = Math.log1p(100 * spectrum[k]! / (FFT_SIZE / 2));
      const delta = Math.max(0, current - previous[k]!);
      if (k >= firstBin) raw[frame] = raw[frame]! + delta;
      if (k >= hatBin) hats[frame] = hats[frame]! + delta;
      if (k <= lowLast) low[frame] = low[frame]! + delta;
      previous[k] = current;
    }
    raw[frame] = raw[frame]! / (lastBin - firstBin + 1);
    hats[frame] = hats[frame]! / (lastBin - hatBin + 1);
    low[frame] = low[frame]! / (lowLast - lowFirst + 1);
  }
  if (percentile95(raw) < 1e-4) return { onset: new Float64Array(frameCount), hats: new Float64Array(frameCount), low: new Float64Array(frameCount) };
  return { onset: normalize(raw), hats: normalize(hats), low: normalize(low) };
}

function autocorrelation(onset: Float64Array): Float64Array {
  const scores = new Float64Array(Math.ceil(60 * FRAME_RATE / MIN_BPM) + 1);
  const minLag = Math.ceil(60 * FRAME_RATE / MAX_BPM);
  for (let lag = minLag; lag < scores.length; lag++) {
    let dot = 0, a = 0, b = 0;
    for (let i = lag; i < onset.length; i++) {
      const current = onset[i]!;
      const past = onset[i - lag]!;
      dot += current * past; a += current * current; b += past * past;
    }
    if (a === 0 || b === 0) continue;
    const ellis = Math.exp(-.5 * (Math.log2((lag / FRAME_RATE) / .5) / 1.4) ** 2);
    scores[lag] = dot / Math.sqrt(a * b) * ellis;
  }
  return scores;
}

function lagScore(scores: Float64Array, bpm: number): number {
  const lag = 60 * FRAME_RATE / bpm;
  const floor = Math.floor(lag);
  const fraction = lag - floor;
  return (scores[floor] ?? 0) * (1 - fraction) + (scores[floor + 1] ?? 0) * fraction;
}

function peaks(scores: Float64Array): Peak[] {
  const found: Peak[] = [];
  for (let lag = 1; lag < scores.length - 1; lag++) {
    const score = scores[lag]!;
    if (score <= 0 || score < scores[lag - 1]! || score < scores[lag + 1]!) continue;
    const left = scores[lag - 1]!, right = scores[lag + 1]!;
    const curvature = left - 2 * score + right;
    const offset = curvature < 0 ? Math.max(-.5, Math.min(.5, .5 * (left - right) / curvature)) : 0;
    const bpm = 60 * FRAME_RATE / (lag + offset);
    if (bpm >= MIN_BPM && bpm <= MAX_BPM) found.push({ bpm, score, relation: "primary" });
  }
  found.sort((a, b) => b.score - a.score || a.bpm - b.bpm);
  const primary = found.slice(0, 12);
  const all = [...primary];
  for (const candidate of primary) {
    for (const [factor, relation] of [[.5, "half"], [2, "double"]] as const) {
      const bpm = candidate.bpm * factor;
      if (bpm < MIN_BPM || bpm > MAX_BPM || all.some((item) => Math.abs(item.bpm - bpm) < 1.5)) continue;
      all.push({ bpm, score: lagScore(scores, bpm), relation });
    }
  }
  return all;
}

function sample(envelope: Float64Array, position: number): number {
  if (position < 0 || position >= envelope.length) return 0;
  const i = Math.floor(position), fraction = position - i;
  return envelope[i]! * (1 - fraction) + (envelope[i + 1] ?? envelope[i]!) * fraction;
}

function bestPhase(onset: Float64Array, bpm: number): { phase: number; concentration: number } {
  const period = 60 * FRAME_RATE / bpm;
  let best = -1, phase = 0;
  for (let trial = 0; trial < Math.ceil(period); trial++) {
    let total = 0;
    for (let pos = trial; pos < onset.length; pos += period) total += sample(onset, pos);
    if (total > best) { best = total; phase = trial; }
  }
  const before = sample(onset, Math.max(0, phase - 1));
  const center = sample(onset, phase);
  const after = sample(onset, phase + 1);
  const denominator = before - 2 * center + after;
  if (denominator < 0) phase = Math.max(0, phase + Math.max(-.5, Math.min(.5, .5 * (before - after) / denominator)));
  let energy = 0;
  for (const value of onset) energy += value;
  return { phase: phase / FRAME_RATE, concentration: energy > 0 ? Math.min(1, Math.max(0, best / energy * 2)) : 0 };
}

function localPeaks(envelope: Float64Array, threshold: number): { frame: number; strength: number }[] {
  let maximum = 0;
  for (const value of envelope) maximum = Math.max(maximum, value);
  const peaks: { frame: number; strength: number }[] = [];
  if (maximum <= 0) return peaks;
  for (let i = 1; i < envelope.length - 1; i++) {
    const value = envelope[i]!;
    if (value >= maximum * threshold && value >= envelope[i - 1]! && value > envelope[i + 1]!) peaks.push({ frame: i, strength: value });
  }
  return peaks;
}

function nearPeak(peaks: { frame: number; strength: number }[], frame: number): number {
  let best = 0;
  for (const peak of peaks) if (Math.abs(peak.frame - frame) <= 2) best = Math.max(best, peak.strength);
  return best;
}

function texture(hats: Float64Array, bpm: number, phase: number): { occ16: number; off32: number } {
  const peaks = localPeaks(hats, .3);
  const step = 60 * FRAME_RATE / bpm / 4;
  const base = phase * FRAME_RATE;
  let occupied = 0, points = 0, oddEnergy = 0, totalEnergy = 0;
  for (let grid = base; grid < hats.length; grid += step) {
    occupied += nearPeak(peaks, grid) > 0 ? 1 : 0;
    points++;
  }
  for (const peak of peaks) {
    totalEnergy += peak.strength;
    const position = (peak.frame - base) / (step / 2);
    const nearest = Math.round(position);
    if (nearest % 2 !== 0 && Math.abs(position - nearest) <= 2 / (step / 2)) oddEnergy += peak.strength;
  }
  return { occ16: points > 0 ? occupied / points : 0, off32: totalEnergy > 0 ? oddEnergy / totalEnergy : 0 };
}

function gridScore(hats: Float64Array, bpm: number, phase: number): number {
  const peaks = localPeaks(hats, .2);
  const step = 60 * FRAME_RATE / bpm / 4;
  let energy = 0, score = 0;
  for (const peak of peaks) energy += peak.strength;
  for (let index = 0, position = phase * FRAME_RATE; position < hats.length; index++, position += step) {
    const nearby = nearPeak(peaks, position);
    const weight = index % 4 === 0 ? 1 : index % 2 === 0 ? .65 : .35;
    score += nearby > 0 ? weight * nearby : -.15 * weight;
  }
  return energy > 0 ? Math.max(0, score / energy) : 0;
}

function beatsAndDownbeats(onset: Float64Array, low: Float64Array, bpm: number, meter: number, duration: number):
  { beats: number[]; downbeats: number[]; phaseConfidence: number } {
  const { phase, concentration } = bestPhase(onset, bpm);
  const beats: number[] = [];
  const period = 60 / bpm;
  for (let t = phase; t < duration; t += period) beats.push(t);
  const phaseScores = new Float64Array(meter);
  for (let i = 0; i < beats.length; i++) phaseScores[i % meter] = phaseScores[i % meter]! + sample(low, beats[i]! * FRAME_RATE);
  let best = 0;
  for (let i = 1; i < meter; i++) if (phaseScores[i]! > phaseScores[best]!) best = i;
  const tied = phaseScores.every((value) => Math.abs(value - phaseScores[best]!) < 1e-9);
  return { beats, downbeats: beats.filter((_, i) => i % meter === best), phaseConfidence: tied ? 0 : concentration };
}

/** Estimate pulse from PCM only; no song metadata enters this path. */
export function estimateTempo(pcm: StereoBuffer, meterNumerator = 4): TempoEstimate {
  if (pcm.left.length === 0) return { ...NO_TEMPO };
  const { onset, hats, low } = envelopes(pcm);
  const scores = autocorrelation(onset);
  const possible = peaks(scores);
  if (possible.length === 0 || possible[0]!.score < .025) return { ...NO_TEMPO };
  const eligible = possible.filter((candidate) => candidate.bpm >= 69 && candidate.bpm <= 180);
  const pool = eligible.length > 0 ? eligible : possible;
  pool.sort((a, b) => b.score - a.score || b.bpm - a.bpm);
  let chosen = pool[0]!;
  const octave = possible.find((candidate) => Math.abs(candidate.bpm - chosen.bpm * 2) <= 2);
  if (chosen.bpm < 90 && octave) {
    const phase = bestPhase(onset, chosen.bpm).phase;
    const finer = texture(hats, chosen.bpm, phase);
    const slowGrid = gridScore(hats, chosen.bpm, phase);
    const fastGrid = gridScore(hats, octave.bpm, phase);
    // A strong independent subdivision grid can resolve a syncopated pattern even
    // when its double-time autocorrelation has no local maximum.
    if (finer.occ16 > .6 || finer.off32 >= .10) {
      if (fastGrid >= slowGrid + .03 || (octave.score >= .85 * chosen.score && fastGrid >= slowGrid - .03)) {
        chosen = octave;
      }
    }
  }
  const half = possible.find((candidate) => Math.abs(candidate.bpm * 2 - chosen.bpm) < 2);
  if (half && half.bpm < 90 && half.score >= .85 * chosen.score) {
    const phase = bestPhase(onset, half.bpm).phase;
    const finer = texture(hats, half.bpm, phase);
    // Straight eighths alone do not justify turning a backbeat into double time.
    if (finer.occ16 <= .6 && finer.off32 < .10) chosen = half;
  }
  const bestScore = Math.max(...possible.map((candidate) => candidate.score));
  const candidateScores = possible.map((candidate) => {
    const octavePair = Math.abs(candidate.bpm * 2 - chosen.bpm) < 2 || Math.abs(candidate.bpm - chosen.bpm * 2) < 2;
    const selection = candidate === chosen ? 1 : octavePair ? .999999 : Math.min(.999998, candidate.score / bestScore);
    return { ...candidate, selection };
  });
  candidateScores.sort((a, b) => b.selection - a.selection || a.bpm - b.bpm);
  const candidates: TempoCandidate[] = candidateScores.map(({ bpm, selection, relation }) =>
    ({ bpm: Math.round(bpm * 100) / 100, score: Math.max(0, Math.min(1, selection)), relation }));
  const duration = pcm.left.length / pcm.sampleRate;
  const { beats, downbeats, phaseConfidence } = beatsAndDownbeats(onset, low, chosen.bpm, meterNumerator, duration);
  const runner = possible.filter((candidate) => Math.abs(candidate.bpm - chosen.bpm) > 2)
    .sort((a, b) => b.score - a.score)[0];
  const gap = Math.max(0, (chosen.score - (runner?.score ?? 0)) / Math.max(chosen.score, 1e-9));
  const confidence = phaseConfidence === 0 ? 0 : Math.max(0, Math.min(1, .5 * gap + .5 * phaseConfidence));
  return { bpm: Math.round(chosen.bpm * 100) / 100, confidence, candidates, beatsSeconds: beats, downbeatsSeconds: downbeats };
}
