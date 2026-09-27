import type { StereoBuffer } from "../audio-io/buffer.schema.ts";
import { Music2Error } from "../shared/index.ts";
import type { KeyCandidate, KeyEstimate } from "./analysis.schema.ts";
import { hann, realSpectrum } from "./fft.tool.ts";

const FFT_SIZE = 8192;
const HOP = 2048;
/** Chroma floor: below 100 Hz a driven 808 dominates the pitch-class profile (wp4 evidence: 40 Hz gave C major on the C minor drill, 100 Hz gives C minor). */
const MIN_HZ = 100;
const MAX_HZ = 5000;
const PITCH_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"] as const;
const KK_MAJOR = [6.35,2.23,3.48,2.33,4.38,4.09,2.52,5.19,2.39,3.66,2.29,2.88] as const;
const KK_MINOR = [6.33,2.68,3.52,5.38,2.60,3.53,2.54,4.75,3.98,2.69,3.34,3.17] as const;
const TEMPERLEY_MAJOR = [5,2,3.5,2,4.5,4,2,4.5,2,3.5,1.5,4] as const;
const TEMPERLEY_MINOR = [5,2,3.5,4.5,2,4,2,4.5,3.5,2,1.5,4] as const;

function pearson(chroma: readonly number[], profile: readonly number[], tonic: number): number {
  const meanChroma = chroma.reduce((sum, value) => sum + value, 0) / 12;
  const meanProfile = profile.reduce((sum, value) => sum + value, 0) / 12;
  let numerator = 0;
  let chromaVariance = 0;
  let profileVariance = 0;
  for (let pitch = 0; pitch < 12; pitch++) {
    const a = chroma[pitch]! - meanChroma;
    const b = profile[(pitch - tonic + 12) % 12]! - meanProfile;
    numerator += a * b;
    chromaVariance += a * a;
    profileVariance += b * b;
  }
  const denominator = Math.sqrt(chromaVariance * profileVariance);
  return denominator > 0 ? numerator / denominator : 0;
}

function hasFundamental(magnitudes: Float64Array, peakBin: number, divisor: 2 | 3 | 4 | 5): boolean {
  const target = peakBin / divisor;
  const bin = Math.round(target);
  let nearby = 0;
  for (let k = Math.max(1, bin - 1); k <= bin + 1; k++) nearby = Math.max(nearby, magnitudes[k] ?? 0);
  return nearby >= magnitudes[peakBin]! * 0.15;
}

/** Estimate tonal pitch class from PCM alone; metadata is never consulted. */
export function estimateKey(pcm: StereoBuffer): KeyEstimate {
  const { left, right, sampleRate, sourceChannels } = pcm;
  if (!Number.isFinite(sampleRate) || sampleRate <= 4000 ||
      !(left instanceof Float32Array) || !(right instanceof Float32Array) ||
      left.length === 0 || left.length !== right.length ||
      (sourceChannels !== 1 && sourceChannels !== 2)) {
    throw new Music2Error("E_INPUT", "invalid PCM for key estimation");
  }
  const mono = new Float32Array(left.length);
  for (let i = 0; i < left.length; i++) {
    const l = left[i]!;
    const r = right[i]!;
    if (!Number.isFinite(l) || !Number.isFinite(r)) throw new Music2Error("E_INPUT", "nonfinite PCM sample");
    mono[i] = sourceChannels === 1 ? l : (l + r) / 2;
  }

  const chroma = new Array<number>(12).fill(0);
  const binHz = sampleRate / FFT_SIZE;
  const firstBin = Math.max(1, Math.ceil(MIN_HZ / binHz));
  const lastBin = Math.min(FFT_SIZE / 2, Math.floor(Math.min(MAX_HZ, sampleRate / 2) / binHz));
  const scratch = {
    re: new Float64Array(FFT_SIZE), im: new Float64Array(FFT_SIZE),
    out: new Float64Array(FFT_SIZE / 2 + 1),
  };
  const window = hann(FFT_SIZE);
  let tonalFrames = 0;
  let frameCount = 0;
  for (let offset = 0; offset < mono.length; offset += HOP) {
    frameCount++;
    const magnitudes = realSpectrum(mono, offset, FFT_SIZE, window, scratch);
    let maximum = 0;
    for (let k = firstBin; k <= lastBin; k++) maximum = Math.max(maximum, magnitudes[k]!);
    if (maximum < 1e-8) continue;
    const frame = new Float64Array(12);
    let frameTotal = 0;
    for (let k = firstBin + 1; k < lastBin; k++) {
      const magnitude = magnitudes[k]!;
      if (magnitude < maximum * 0.005 || magnitude <= magnitudes[k - 1]! ||
          magnitude < magnitudes[k + 1]!) continue;
      // Hann peaks span adjacent bins; compare with the shoulder two bins away.
      const neighbor = Math.max(magnitudes[k - 2]!, magnitudes[k + 2]!);
      if (neighbor > 0 && magnitude / neighbor < 1.5) continue;
      const frequency = k * binHz;
      const midi = Math.round(69 + 12 * Math.log2(frequency / 440));
      const pitchClass = ((midi % 12) + 12) % 12;
      let weight = magnitude / Math.sqrt(frequency);
      if (hasFundamental(magnitudes, k, 2)) weight *= 0.25;
      else if (hasFundamental(magnitudes, k, 3)) weight *= 0.2;
      // Driven 808s and saws put strong 4th/5th harmonics on the octave and the major third (C2 -> E4).
      else if (hasFundamental(magnitudes, k, 4)) weight *= 0.25;
      else if (hasFundamental(magnitudes, k, 5)) weight *= 0.15;
      frame[pitchClass] = frame[pitchClass]! + weight;
      frameTotal += weight;
    }
    if (frameTotal <= 0) continue;
    tonalFrames++;
    for (let pitch = 0; pitch < 12; pitch++) chroma[pitch] = chroma[pitch]! + frame[pitch]! / frameTotal;
  }
  if (tonalFrames === 0) return { key: null, confidence: 0, candidates: [], chroma };
  for (let pitch = 0; pitch < 12; pitch++) chroma[pitch] = chroma[pitch]! / tonalFrames;

  const candidates: KeyCandidate[] = [];
  for (let tonic = 0; tonic < 12; tonic++) {
    candidates.push({ key: `${PITCH_NAMES[tonic]} major`, kkScore: pearson(chroma, KK_MAJOR, tonic),
      temperleyScore: pearson(chroma, TEMPERLEY_MAJOR, tonic) });
    candidates.push({ key: `${PITCH_NAMES[tonic]} minor`, kkScore: pearson(chroma, KK_MINOR, tonic),
      temperleyScore: pearson(chroma, TEMPERLEY_MINOR, tonic) });
  }
  candidates.sort((a, b) => b.kkScore - a.kkScore || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
  const top = candidates.slice(0, 3);
  const occupied = chroma.filter((value) => value >= 0.03).length;
  const gap = top[0]!.kkScore - top[1]!.kkScore;
  return {
    key: occupied >= 3 ? top[0]!.key : null,
    confidence: occupied >= 3 ? Math.min(1, Math.max(0, gap / 0.2)) * tonalFrames / frameCount : 0,
    candidates: top, chroma,
  };
}
