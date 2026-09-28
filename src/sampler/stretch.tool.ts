import type { StereoBuffer } from "../audio-io/buffer.schema.ts";
import { validateStereo } from "../audio-io/buffer.tool.ts";
import { Music2Error } from "../shared/index.ts";
import { fft, hann } from "./fft.tool.ts";

export interface StretchOptions {
  method?: "wsola" | "pv";
  /** [input frame, output frame] pairs, with both coordinates strictly increasing. */
  anchors?: readonly (readonly [number, number])[];
  warnings?: string[];
}

const MAX_FRAMES = 1 << 24; // Output and float64 overlap buffers stay under 512 MiB combined.
const WSOLA_SIZE = 2048;
const PV_SIZE = 4096;
const HOP = 1024;

function warpPosition(output: number, anchors: readonly (readonly [number, number])[]): number {
  let segment = 0;
  while (segment + 2 < anchors.length && output > anchors[segment + 1]![1]) segment++;
  const [in0, out0] = anchors[segment]!;
  const [in1, out1] = anchors[segment + 1]!;
  return in0 + (output - out0) * (in1 - in0) / (out1 - out0);
}

function monoAt(src: StereoBuffer, index: number): number {
  return index < 0 || index >= src.left.length ? 0 : (src.left[index]! + src.right[index]!) * 0.5;
}

function at(src: StereoBuffer, channel: 0 | 1, index: number): number {
  return index < 0 || index >= src.left.length ? 0 : (channel === 0 ? src.left[index] : src.right[index])!;
}

function outputBuffer(src: StereoBuffer, length: number): StereoBuffer {
  return {
    sampleRate: src.sampleRate,
    sourceChannels: src.sourceChannels,
    left: new Float32Array(length),
    right: new Float32Array(length),
  };
}

function normalize(out: StereoBuffer, weights: Float64Array, sums: readonly [Float64Array, Float64Array]): void {
  for (let i = 0; i < weights.length; i++) {
    const divisor = weights[i]! < 1e-3 ? 1 : weights[i]!;
    const left = sums[0][i]! / divisor;
    const right = sums[1][i]! / divisor;
    if (!Number.isFinite(left) || !Number.isFinite(right)) throw new Music2Error("E_RENDER", "nonfinite stretched audio");
    out.left[i] = left;
    out.right[i] = right;
  }
}

function correlate(src: StereoBuffer, previous: number, candidate: number, stride: number): number {
  let dot = 0;
  let aa = 0;
  let bb = 0;
  for (let offset = 0; offset < HOP; offset += stride) {
    const a = monoAt(src, previous + offset);
    const b = monoAt(src, candidate - HOP + offset);
    dot += a * b;
    aa += a * a;
    bb += b * b;
  }
  return dot / Math.sqrt(aa * bb + 1e-30);
}

function wsola(src: StereoBuffer, out: StereoBuffer, anchors: readonly (readonly [number, number])[]): void {
  const window = hann(WSOLA_SIZE);
  const sums: [Float64Array, Float64Array] = [new Float64Array(out.left.length), new Float64Array(out.left.length)];
  const weights = new Float64Array(out.left.length);
  let previous = 0;
  for (let synthesis = 0, frame = 0; synthesis < out.left.length + WSOLA_SIZE / 2; synthesis += HOP, frame++) {
    const target = Math.round(warpPosition(synthesis, anchors));
    let analysis = target;
    if (frame > 0) {
      let bestScore = -Infinity;
      let bestDistance = Infinity;
      // Coarse positions are four input frames apart; decimated scoring bounds work.
      for (let shift = -HOP; shift <= HOP; shift += 4) {
        const candidate = target + shift;
        const score = correlate(src, previous, candidate, 8);
        const distance = Math.abs(shift);
        if (score > bestScore + 1e-6 || (Math.abs(score - bestScore) <= 1e-6 && distance < bestDistance)) {
          bestScore = score; bestDistance = distance; analysis = candidate;
        }
      }
      let fineScore = -Infinity;
      let fineDistance = Infinity;
      const coarse = analysis;
      for (let candidate = coarse - 3; candidate <= coarse + 3; candidate++) {
        const score = correlate(src, previous, candidate, 1);
        const distance = Math.abs(candidate - target);
        if (score > fineScore + 1e-9 || (Math.abs(score - fineScore) <= 1e-9 && distance < fineDistance)) {
          fineScore = score; fineDistance = distance; analysis = candidate;
        }
      }
    }
    for (let n = 0; n < WSOLA_SIZE; n++) {
      const output = synthesis + n - WSOLA_SIZE / 2;
      if (output < 0 || output >= out.left.length) continue;
      const input = analysis + n - WSOLA_SIZE / 2;
      const weight = window[n]!;
      sums[0][output] = sums[0][output]! + at(src, 0, input) * weight;
      sums[1][output] = sums[1][output]! + at(src, 1, input) * weight;
      weights[output] = weights[output]! + weight;
    }
    previous = analysis;
  }
  normalize(out, weights, sums);
}

function wrapPhase(phase: number): number {
  return phase - 2 * Math.PI * Math.round(phase / (2 * Math.PI));
}

function spectrum(src: StereoBuffer, channel: 0 | 1, center: number, window: Float64Array):
  { re: Float64Array; im: Float64Array; magnitude: Float64Array; phase: Float64Array } {
  const n = window.length;
  const re = new Float64Array(n);
  const im = new Float64Array(n);
  for (let j = 0; j < n; j++) re[j] = at(src, channel, center + j - n / 2) * window[j]!;
  fft(re, im);
  const magnitude = new Float64Array(n / 2 + 1);
  const phase = new Float64Array(n / 2 + 1);
  for (let k = 0; k <= n / 2; k++) {
    magnitude[k] = Math.hypot(re[k]!, im[k]!);
    phase[k] = Math.atan2(im[k]!, re[k]!);
  }
  return { re, im, magnitude, phase };
}

function peakOwners(magnitudes: Float64Array): Int32Array {
  const count = magnitudes.length;
  const peaks: number[] = [];
  for (let k = 2; k < count - 2; k++) {
    const value = magnitudes[k]!;
    if (value > magnitudes[k - 2]! && value > magnitudes[k - 1]! &&
        value > magnitudes[k + 1]! && value > magnitudes[k + 2]!) peaks.push(k);
  }
  const owners = new Int32Array(count);
  if (peaks.length === 0) {
    for (let k = 0; k < count; k++) owners[k] = k;
    return owners;
  }
  let peakIndex = 0;
  for (let k = 0; k < count; k++) {
    while (peakIndex + 1 < peaks.length && k >= Math.ceil((peaks[peakIndex]! + peaks[peakIndex + 1]!) / 2)) peakIndex++;
    owners[k] = peaks[peakIndex]!;
  }
  return owners;
}

function vocoder(src: StereoBuffer, out: StereoBuffer, anchors: readonly (readonly [number, number])[]): void {
  const n = PV_SIZE;
  const window = hann(n);
  const sums: [Float64Array, Float64Array] = [new Float64Array(out.left.length), new Float64Array(out.left.length)];
  const weights = new Float64Array(out.left.length);
  const previous = [new Float64Array(n / 2 + 1), new Float64Array(n / 2 + 1)];
  const propagated = [new Float64Array(n / 2 + 1), new Float64Array(n / 2 + 1)];
  let previousCenter = 0;

  for (let synthesis = 0, frame = 0; synthesis < out.left.length + n / 2; synthesis += HOP, frame++) {
    const center = Math.round(warpPosition(synthesis, anchors));
    const spectra = [spectrum(src, 0, center, window), spectrum(src, 1, center, window)];
    const peakStrength = new Float64Array(n / 2 + 1);
    for (let k = 0; k <= n / 2; k++) peakStrength[k] = spectra[0]!.magnitude[k]! + spectra[1]!.magnitude[k]!;
    const owner = peakOwners(peakStrength);
    const analysisHop = Math.max(1, center - previousCenter);

    for (let channel: 0 | 1 = 0; channel <= 1; channel = (channel + 1) as 0 | 1) {
      const spec = spectra[channel]!;
      const outputRe = new Float64Array(n);
      const outputIm = new Float64Array(n);
      for (let k = 0; k <= n / 2; k++) {
        const omega = 2 * Math.PI * k / n;
        if (frame === 0) propagated[channel]![k] = spec.phase[k]!;
        else {
          const residual = wrapPhase(spec.phase[k]! - previous[channel]![k]! - omega * analysisHop);
          propagated[channel]![k] = propagated[channel]![k]! + omega * HOP + residual * HOP / analysisHop;
        }
        previous[channel]![k] = spec.phase[k]!;
      }
      for (let k = 0; k <= n / 2; k++) {
        const peak = owner[k]!;
        const phase = propagated[channel]![peak]! + wrapPhase(spec.phase[k]! - spec.phase[peak]!);
        outputRe[k] = spec.magnitude[k]! * Math.cos(phase);
        outputIm[k] = k === 0 || k === n / 2 ? 0 : spec.magnitude[k]! * Math.sin(phase);
        if (k > 0 && k < n / 2) {
          outputRe[n - k] = outputRe[k]!;
          outputIm[n - k] = -outputIm[k]!;
        }
      }
      fft(outputRe, outputIm, true);
      for (let j = 0; j < n; j++) {
        const output = synthesis + j - n / 2;
        if (output < 0 || output >= out.left.length) continue;
        sums[channel][output] = sums[channel][output]! + outputRe[j]! * window[j]!;
      }
    }
    for (let j = 0; j < n; j++) {
      const output = synthesis + j - n / 2;
      if (output >= 0 && output < out.left.length) weights[output] = weights[output]! + window[j]! ** 2;
    }
    previousCenter = center;
  }
  normalize(out, weights, sums);
}

/** alpha = output duration / input duration; values above one lengthen audio. */
export function timeStretch(src: StereoBuffer, alpha: number, opts: StretchOptions = {}): StereoBuffer {
  validateStereo(src);
  if (!Number.isFinite(alpha) || alpha < 0.25 || alpha > 4) {
    throw new Music2Error("E_INPUT", "stretch factor must be in 0.25..4");
  }
  const inputLength = src.left.length;
  if (inputLength === 0 && !opts.anchors) return outputBuffer(src, 0);
  const anchors = opts.anchors ?? [[0, 0], [inputLength, Math.ceil(alpha * inputLength)]];
  if (anchors.length < 2 || anchors[0]![0] !== 0 || anchors[0]![1] !== 0 ||
      anchors[anchors.length - 1]![0] !== inputLength) {
    throw new Music2Error("E_INPUT", "stretch anchors must span the source from [0,0]");
  }
  for (let i = 1; i < anchors.length; i++) {
    const [input, output] = anchors[i]!;
    if (!Number.isSafeInteger(input) || !Number.isSafeInteger(output) ||
        input <= anchors[i - 1]![0] || output <= anchors[i - 1]![1]) {
      throw new Music2Error("E_INPUT", "stretch anchors must increase in both coordinates");
    }
  }
  const length = anchors[anchors.length - 1]![1];
  if (length > MAX_FRAMES) throw new Music2Error("E_CAPABILITY", "stretched audio exceeds the frame limit");
  const method = opts.method ?? "wsola";
  if (method !== "wsola" && method !== "pv") throw new Music2Error("E_INPUT", "unknown stretch method");
  const durationRatio = length / inputLength;
  if (durationRatio < 0.5 || durationRatio > 2) {
    opts.warnings?.push("stretch factor outside the quality-guaranteed 0.5..2 range");
  }
  const out = outputBuffer(src, length);
  if (length === 0 || (alpha === 1 && !opts.anchors)) {
    out.left.set(src.left); out.right.set(src.right);
    return out;
  }
  if (method === "wsola") wsola(src, out, anchors);
  else vocoder(src, out, anchors);
  return out;
}
