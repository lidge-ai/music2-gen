import type { StereoBuffer } from "../audio-io/buffer.schema.ts";
import { validateStereo } from "../audio-io/buffer.tool.ts";
import { Music2Error } from "../shared/errors.tool.ts";
import { fft, hann } from "./fft.tool.ts";

export interface OnsetOptions {
  sensitivity?: number;
  minGapMs?: number;
  /** Internal slice cap: the leading region uses one of maxSlices slots. */
  maxOnsets?: number;
}

interface Candidate { frame: number; score: number }

const FFT_SIZE = 2048;
const PEAK_RADIUS = 3;
const PREVIOUS_MEAN_FRAMES = 9;
const FOLLOWING_MEAN_FRAMES = 3;

function options(input: OnsetOptions): { sensitivity: number; minGapMs: number; maxOnsets: number } {
  const sensitivity = input.sensitivity ?? 0.5;
  const minGapMs = input.minGapMs ?? 50;
  const maxOnsets = input.maxOnsets ?? Number.MAX_SAFE_INTEGER;
  if (!Number.isFinite(sensitivity) || sensitivity < 0 || sensitivity > 1) {
    throw new Music2Error("E_INPUT", "sensitivity must be in 0..1");
  }
  if (!Number.isFinite(minGapMs) || minGapMs < 1 || minGapMs > 1000) {
    throw new Music2Error("E_INPUT", "minGapMs must be in 1..1000");
  }
  if (!Number.isSafeInteger(maxOnsets) || maxOnsets < 0) {
    throw new Music2Error("E_INPUT", "maxOnsets must be a nonnegative integer");
  }
  return { sensitivity, minGapMs, maxOnsets };
}

/** Positive linear-magnitude spectral flux at a 100 Hz analysis rate. */
function spectralFlux(mono: Float64Array, hop: number): Float64Array {
  const count = Math.floor((mono.length - 1) / hop) + 1;
  const flux = new Float64Array(count);
  const window = hann(FFT_SIZE);
  const re = new Float64Array(FFT_SIZE);
  const im = new Float64Array(FFT_SIZE);
  const previous = new Float64Array(FFT_SIZE / 2 + 1);
  for (let n = 0; n < count; n++) {
    const start = n * hop - FFT_SIZE / 2;
    im.fill(0);
    for (let i = 0; i < FFT_SIZE; i++) {
      const frame = start + i;
      re[i] = (frame >= 0 && frame < mono.length ? mono[frame]! : 0) * window[i]!;
    }
    fft(re, im);
    let sum = 0;
    for (let k = 0; k <= FFT_SIZE / 2; k++) {
      const magnitude = Math.hypot(re[k]!, im[k]!);
      sum += Math.max(0, magnitude - previous[k]!);
      previous[k] = magnitude;
    }
    flux[n] = sum;
  }
  return flux;
}

function normalized(flux: Float64Array): Float64Array {
  let mean = 0;
  for (const value of flux) mean += value;
  mean /= flux.length;
  let variance = 0;
  for (const value of flux) variance += (value - mean) ** 2;
  variance /= flux.length;
  if (variance === 0) return new Float64Array(flux.length);
  const sd = Math.sqrt(variance);
  return Float64Array.from(flux, (value) => (value - mean) / sd);
}

function peakCandidates(values: Float64Array, delta: number): Candidate[] {
  const candidates: Candidate[] = [];
  for (let n = 0; n < values.length; n++) {
    const value = values[n]!;
    if (value <= 0) continue;
    let maximum = true;
    for (let j = Math.max(0, n - PEAK_RADIUS); j <= Math.min(values.length - 1, n + PEAK_RADIUS); j++) {
      if (j !== n && (values[j]! > value || (j < n && values[j] === value))) { maximum = false; break; }
    }
    if (!maximum) continue;
    let localMean = 0;
    let count = 0;
    for (let j = Math.max(0, n - PREVIOUS_MEAN_FRAMES);
      j <= Math.min(values.length - 1, n + FOLLOWING_MEAN_FRAMES); j++) {
      if (j === n) continue;
      localMean += values[j]!;
      count++;
    }
    localMean = count === 0 ? 0 : localMean / count;
    if (value > localMean + delta) candidates.push({ frame: n, score: value - localMean });
  }
  return candidates;
}

/** Find the first significant rise within the analysis hop. A noise minimum is not an onset. */
function refine(mono: Float64Array, center: number, hop: number): number {
  const first = Math.max(0, center - hop);
  const last = Math.min(mono.length - 1, center + hop);
  let peak = 0;
  for (let frame = first; frame <= last; frame++) {
    peak = Math.max(peak, Math.abs(mono[frame]!));
  }
  const threshold = peak * 0.2;
  for (let frame = first; frame <= last; frame++) {
    if (Math.abs(mono[frame]!) >= threshold) return frame;
  }
  return first;
}

function significantRise(mono: Float64Array, frame: number, sampleRate: number): boolean {
  const width = Math.max(1, Math.round(sampleRate * 0.005));
  let before = 0;
  let after = 0;
  let peak = 0;
  for (let i = Math.max(0, frame - width); i < frame; i++) before += mono[i]! ** 2;
  for (let i = frame; i < Math.min(mono.length, frame + width); i++) {
    after += mono[i]! ** 2;
    peak = Math.max(peak, Math.abs(mono[i]!));
  }
  const baseline = Math.sqrt(before / width);
  return Math.sqrt(after / width) > baseline * 1.3 || peak > baseline * 4;
}

/** Sample positions in ascending time order. Competing peaks keep the higher score, then the earlier frame. */
export function detectOnsets(audio: StereoBuffer, input: OnsetOptions = {}): number[] {
  validateStereo(audio);
  const { sensitivity, minGapMs, maxOnsets } = options(input);
  const length = audio.left.length;
  if (length === 0 || maxOnsets === 0) return [];
  const hop = Math.round(audio.sampleRate / 100);
  const mono = new Float64Array(length);
  for (let i = 0; i < length; i++) {
    mono[i] = (audio.left[i]! + audio.right[i]!) / 2;
  }
  const values = normalized(spectralFlux(mono, hop));
  if (values.every((value) => value === 0)) return [];
  const delta = 1 - 0.9 * sensitivity;
  const candidates = peakCandidates(values, delta).map(({ frame, score }) => ({
    frame: refine(mono, frame * hop + Math.floor(hop / 2), hop), score,
  })).filter((candidate) => significantRise(mono, candidate.frame, audio.sampleRate));
  const minGap = Math.round(minGapMs * audio.sampleRate / 1000);
  candidates.sort((a, b) => b.score - a.score || a.frame - b.frame);
  const selected: Candidate[] = [];
  for (const candidate of candidates) {
    if (candidate.frame === 0 || candidate.frame >= length) continue;
    if (selected.every((other) => Math.abs(candidate.frame - other.frame) >= minGap)) {
      selected.push(candidate);
      if (selected.length === maxOnsets) break;
    }
  }
  selected.sort((a, b) => a.frame - b.frame);
  return selected.map((candidate) => candidate.frame);
}
