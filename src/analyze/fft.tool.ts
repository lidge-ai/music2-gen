import { Music2Error } from "../shared/index.ts";
import type { ComplexSpectrum } from "./analysis.schema.ts";

const twiddleCache = new Map<number, { cos: Float64Array; sin: Float64Array }>();
const windowCache = new Map<number, Float64Array>();

function assertSize(size: number): void {
  if (!Number.isInteger(size) || size < 2 || size > 32768 || (size & (size - 1)) !== 0) {
    throw new Music2Error("E_INPUT", `FFT size must be a power of two in 2..32768, got ${size}`);
  }
}

function twiddles(size: number): { cos: Float64Array; sin: Float64Array } {
  let t = twiddleCache.get(size);
  if (!t) {
    const cos = new Float64Array(size / 2);
    const sin = new Float64Array(size / 2);
    for (let k = 0; k < size / 2; k++) {
      cos[k] = Math.cos((2 * Math.PI * k) / size);
      sin[k] = -Math.sin((2 * Math.PI * k) / size);
    }
    t = { cos, sin };
    twiddleCache.set(size, t);
  }
  return t;
}

/** Periodic Hann window: 0.5 - 0.5 cos(2 pi n / size). Cached; do not mutate the result. */
export function hann(size: number): Float64Array {
  let w = windowCache.get(size);
  if (!w) {
    w = new Float64Array(size);
    for (let n = 0; n < size; n++) w[n] = 0.5 - 0.5 * Math.cos((2 * Math.PI * n) / size);
    windowCache.set(size, w);
  }
  return w;
}

/** In-place iterative radix-2 complex FFT (forward, negative exponent, unscaled). */
export function fftInPlace(re: Float64Array, im: Float64Array): void {
  const size = re.length;
  assertSize(size);
  if (im.length !== size) throw new Music2Error("E_INPUT", "FFT real and imaginary lengths differ");
  for (let i = 1, j = 0; i < size; i++) {
    let bit = size >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      const tr = re[i]!; re[i] = re[j]!; re[j] = tr;
      const ti = im[i]!; im[i] = im[j]!; im[j] = ti;
    }
  }
  const { cos, sin } = twiddles(size);
  for (let len = 2; len <= size; len <<= 1) {
    const half = len >> 1;
    const step = size / len;
    for (let start = 0; start < size; start += len) {
      for (let k = 0; k < half; k++) {
        const c = cos[k * step]!;
        const s = sin[k * step]!;
        const a = start + k;
        const b = a + half;
        const vr = re[b]! * c - im[b]! * s;
        const vi = re[b]! * s + im[b]! * c;
        const ur = re[a]!;
        const ui = im[a]!;
        re[a] = ur + vr; im[a] = ui + vi;
        re[b] = ur - vr; im[b] = ui - vi;
      }
    }
  }
}

/** Copying FFT. */
export function fft(real: Float64Array, imag?: Float64Array): ComplexSpectrum {
  const re = Float64Array.from(real);
  const im = imag ? Float64Array.from(imag) : new Float64Array(real.length);
  for (let i = 0; i < re.length; i++) {
    if (!Number.isFinite(re[i]!) || !Number.isFinite(im[i]!)) throw new Music2Error("E_INPUT", "FFT input must be finite");
  }
  fftInPlace(re, im);
  return { real: re, imag: im };
}

/**
 * Magnitudes of bins 0..size/2 of a windowed frame starting at offset (zero-padded past the end).
 * Pass reusable buffers via scratch to avoid allocation in STFT loops.
 */
export function realSpectrum(
  samples: Float32Array, offset: number, size: number, window?: Float64Array,
  scratch?: { re: Float64Array; im: Float64Array; out: Float64Array },
): Float64Array {
  assertSize(size);
  if (!Number.isInteger(offset) || offset < 0) throw new Music2Error("E_INPUT", "spectrum offset must be a nonnegative integer");
  const re = scratch?.re ?? new Float64Array(size);
  const im = scratch?.im ?? new Float64Array(size);
  const out = scratch?.out ?? new Float64Array(size / 2 + 1);
  for (let i = 0; i < size; i++) {
    const idx = offset + i;
    const v = idx < samples.length ? samples[idx]! : 0;
    if (!Number.isFinite(v)) throw new Music2Error("E_INPUT", "spectrum input must be finite");
    re[i] = window ? v * window[i]! : v;
    im[i] = 0;
  }
  fftInPlace(re, im);
  for (let k = 0; k <= size / 2; k++) out[k] = Math.hypot(re[k]!, im[k]!);
  return out;
}
