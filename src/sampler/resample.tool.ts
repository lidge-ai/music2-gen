import type { StereoBuffer } from "../audio-io/buffer.schema.ts";
import { validateStereo } from "../audio-io/buffer.tool.ts";
import { Music2Error } from "../shared/index.ts";

export interface ResampleOptions {
  mode?: "sinc" | "hq" | "hermite" | "linear";
  start?: number;
  frames?: number;
  read?: (channel: 0 | 1, index: number) => number;
}

const PHASES = 512;
const MAX_FRAMES = 1 << 26; // 512 MiB of two float32 channels.

function bessel0(x: number): number {
  let sum = 1;
  let term = 1;
  for (let k = 1; k <= 24; k++) {
    term *= (x * x) / (4 * k * k);
    sum += term;
    if (term < sum * 1e-16) break;
  }
  return sum;
}

function sincTable(cutoff: number, crossings: number, beta: number): Float64Array {
  const table = new Float64Array(crossings * PHASES + 1);
  const normalizer = bessel0(beta);
  for (let i = 0; i < table.length; i++) {
    const x = i / PHASES;
    const sinc = x === 0 ? 1 : Math.sin(Math.PI * x) / (Math.PI * x);
    const radius = x / crossings;
    const window = bessel0(beta * Math.sqrt(Math.max(0, 1 - radius * radius))) / normalizer;
    table[i] = 2 * cutoff * sinc * window;
  }
  return table;
}

function interpolate(table: Float64Array, distance: number): number {
  const index = distance * PHASES;
  const whole = Math.floor(index);
  if (whole >= table.length - 1) return 0;
  const fraction = index - whole;
  return table[whole]! + (table[whole + 1]! - table[whole]!) * fraction;
}

function hermite(y0: number, y1: number, y2: number, y3: number, t: number): number {
  const a = -0.5 * y0 + 1.5 * y1 - 1.5 * y2 + 0.5 * y3;
  const b = y0 - 2.5 * y1 + 2 * y2 - 0.5 * y3;
  const c = -0.5 * y0 + 0.5 * y2;
  return ((a * t + b) * t + c) * t + y1;
}

/** ratio is input frames advanced per output frame, including pitch and rate conversion. */
export function resample(src: StereoBuffer, ratio: number, opts: ResampleOptions = {}): StereoBuffer {
  validateStereo(src);
  if (!Number.isFinite(ratio) || ratio <= 0 || !Number.isFinite(opts.start ?? 0) || (opts.start ?? 0) < 0) {
    throw new Music2Error("E_RENDER", "resample ratio must be positive and start must be nonnegative");
  }
  const start = opts.start ?? 0;
  const sourceLength = src.left.length;
  const frames = opts.frames ?? (start > sourceLength - 1 ? 0 : Math.floor((sourceLength - 1 - start) / ratio) + 1);
  if (!Number.isSafeInteger(frames) || frames < 0 || frames > MAX_FRAMES) {
    throw new Music2Error("E_CAPABILITY", "resampled audio exceeds the frame limit");
  }
  const left = new Float32Array(frames);
  const right = new Float32Array(frames);
  const output: StereoBuffer = { sampleRate: src.sampleRate, left, right, sourceChannels: src.sourceChannels };
  const mode = opts.mode ?? "sinc";
  if (mode !== "sinc" && mode !== "hq" && mode !== "hermite" && mode !== "linear") {
    throw new Music2Error("E_RENDER", "unknown resampling mode");
  }
  if (ratio === 1 && start === 0 && !opts.read) {
    left.set(src.left.subarray(0, frames));
    right.set(src.right.subarray(0, frames));
    return output;
  }

  const read = opts.read ?? ((channel: 0 | 1, index: number): number => {
    if (index < 0 || index >= sourceLength) return 0;
    return (channel === 0 ? src.left[index] : src.right[index])!;
  });
  const cutoff = 0.45 * Math.min(1, 1 / ratio);
  const crossings = mode === "hq" ? 32 : 16;
  const beta = mode === "hq" ? 0.1102 * (100 - 8.7) : 8.96;
  const halfWidth = crossings / (2 * cutoff);
  if ((mode === "sinc" || mode === "hq") && halfWidth > 4096) {
    throw new Music2Error("E_CAPABILITY", "resampling ratio needs too many filter taps");
  }
  const table = mode === "sinc" || mode === "hq" ? sincTable(cutoff, crossings, beta) : null;

  for (let out = 0; out < frames; out++) {
    const position = start + out * ratio;
    if (!Number.isFinite(position)) throw new Music2Error("E_RENDER", "nonfinite resample position");
    const base = Math.floor(position);
    const fraction = position - base;
    for (let channel: 0 | 1 = 0; channel <= 1; channel = (channel + 1) as 0 | 1) {
      let value = 0;
      if (mode === "linear") {
        const a = read(channel, base);
        value = a + (read(channel, base + 1) - a) * fraction;
      } else if (mode === "hermite") {
        value = hermite(read(channel, base - 1), read(channel, base), read(channel, base + 1), read(channel, base + 2), fraction);
      } else {
        const lo = Math.ceil(position - halfWidth);
        const hi = Math.floor(position + halfWidth);
        for (let input = lo; input <= hi; input++) {
          const distance = Math.abs(2 * cutoff * (position - input));
          value += read(channel, input) * interpolate(table!, distance);
        }
      }
      if (!Number.isFinite(value)) throw new Music2Error("E_RENDER", "nonfinite resampled audio");
      if (channel === 0) left[out] = value;
      else right[out] = value;
    }
  }
  return output;
}
