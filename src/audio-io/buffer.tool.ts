import { Music2Error } from "../shared/index.ts";
import type { StereoBuffer } from "./buffer.schema.ts";

const OVERSAMPLE = 8;
const TAPS = 32;
const HALF = TAPS / 2;
const coefficientCache = new Map<number, Float64Array[]>();

export function validateSampleRate(sampleRate: number, code: "E_INPUT" | "E_RENDER" = "E_RENDER"): void {
  if (!Number.isInteger(sampleRate) || sampleRate < 8000 || sampleRate > 192000) {
    throw new Music2Error(code, "sample rate must be an integer from 8000 to 192000", { details: { sampleRate } });
  }
}

export function validateStereo(audio: StereoBuffer): void {
  validateSampleRate(audio.sampleRate);
  if (!(audio.left instanceof Float32Array) || !(audio.right instanceof Float32Array) || audio.left.length !== audio.right.length ||
      (audio.sourceChannels !== 1 && audio.sourceChannels !== 2)) {
    throw new Music2Error("E_RENDER", "invalid stereo buffer", { details: { leftFrames: audio.left.length, rightFrames: audio.right.length } });
  }
  for (let i = 0; i < audio.left.length; i++) {
    if (!Number.isFinite(audio.left[i]) || !Number.isFinite(audio.right[i])) {
      throw new Music2Error("E_RENDER", "nonfinite audio sample", { details: { frame: i } });
    }
  }
}

export function createStereo(sampleRate: number, frames: number): StereoBuffer {
  validateSampleRate(sampleRate);
  if (!Number.isSafeInteger(frames) || frames < 0) {
    throw new Music2Error("E_RENDER", "frame count must be a nonnegative safe integer", { details: { frames } });
  }
  return { sampleRate, left: new Float32Array(frames), right: new Float32Array(frames), sourceChannels: 2 };
}

export function peakLinear(audio: StereoBuffer): number {
  validateStereo(audio);
  let peak = 0;
  for (let i = 0; i < audio.left.length; i++) {
    peak = Math.max(peak, Math.abs(audio.left[i] ?? 0), Math.abs(audio.right[i] ?? 0));
  }
  return peak;
}

function coefficients(rate: number): Float64Array[] {
  let phases = coefficientCache.get(rate);
  if (phases) return phases;
  phases = [];
  for (let phase = 1; phase < OVERSAMPLE; phase++) {
    const taps = new Float64Array(TAPS);
    let sum = 0;
    for (let j = 0; j < TAPS; j++) {
      const x = j - (HALF - 1) - phase / OVERSAMPLE;
      const sinc = x === 0 ? 1 : Math.sin(Math.PI * x) / (Math.PI * x);
      const hann = 0.5 - 0.5 * Math.cos(2 * Math.PI * j / (TAPS - 1));
      taps[j] = sinc * hann;
      sum += taps[j] ?? 0;
    }
    for (let j = 0; j < TAPS; j++) taps[j] = (taps[j] ?? 0) / sum;
    phases.push(taps);
  }
  coefficientCache.set(rate, phases);
  return phases;
}

/** The limiter and final meter share this 8x, 32-tap Hann-windowed sinc estimator. */
export function truePeakLinearOf(channel: Float32Array, rate: number): number {
  validateSampleRate(rate);
  let peak = 0;
  for (let i = 0; i < channel.length; i++) {
    const sample = channel[i] ?? 0;
    if (!Number.isFinite(sample)) throw new Music2Error("E_RENDER", "nonfinite audio sample", { details: { frame: i } });
    peak = Math.max(peak, Math.abs(sample));
  }
  if (channel.length < 2 || peak === 0) return peak;
  const phases = coefficients(rate);
  for (let i = 0; i < channel.length - 1; i++) {
    for (const taps of phases) {
      let value = 0;
      for (let j = 0; j < TAPS; j++) {
        const index = i + j - (HALF - 1);
        const sample = index < 0 || index >= channel.length ? 0 : (channel[index] ?? 0);
        value += sample * (taps[j] ?? 0);
      }
      peak = Math.max(peak, Math.abs(value));
    }
  }
  return peak;
}

export function truePeakLinear(audio: StereoBuffer): number {
  validateStereo(audio);
  return Math.max(truePeakLinearOf(audio.left, audio.sampleRate), truePeakLinearOf(audio.right, audio.sampleRate));
}

export function resampleLinear(input: Float32Array, fromRate: number, toRate: number): Float32Array {
  validateSampleRate(fromRate);
  validateSampleRate(toRate);
  const length = Math.round(input.length * toRate / fromRate);
  if (!Number.isSafeInteger(length) || length < 0) throw new Music2Error("E_RENDER", "resampled frame count is too large");
  const output = new Float32Array(length);
  for (let i = 0; i < input.length; i++) {
    if (!Number.isFinite(input[i])) throw new Music2Error("E_RENDER", "nonfinite audio sample", { details: { frame: i } });
  }
  if (input.length === 0) return output;
  for (let i = 0; i < length; i++) {
    const position = Math.min(i * fromRate / toRate, input.length - 1);
    const first = Math.floor(position);
    const fraction = position - first;
    const left = input[first] ?? 0;
    output[i] = left + ((input[Math.min(first + 1, input.length - 1)] ?? left) - left) * fraction;
  }
  return output;
}
