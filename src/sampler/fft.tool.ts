import { Music2Error } from "../shared/index.ts";

const twiddleCache = new Map<number, { cosine: Float64Array; sine: Float64Array }>();

function twiddles(n: number): { cosine: Float64Array; sine: Float64Array } {
  let cached = twiddleCache.get(n);
  if (cached) return cached;
  const cosine = new Float64Array(n / 2);
  const sine = new Float64Array(n / 2);
  for (let k = 0; k < n / 2; k++) {
    cosine[k] = Math.cos(2 * Math.PI * k / n);
    sine[k] = Math.sin(2 * Math.PI * k / n);
  }
  cached = { cosine, sine };
  twiddleCache.set(n, cached);
  return cached;
}

/** In-place complex radix-2 transform. Forward uses a negative exponent. */
export function fft(re: Float64Array, im: Float64Array, inverse = false): void {
  const n = re.length;
  if (n < 256 || n > 4096 || (n & (n - 1)) !== 0 || im.length !== n) {
    throw new Music2Error("E_INTERNAL", "sampler FFT requires equal power-of-two arrays of length 256..4096");
  }
  for (let i = 0; i < n; i++) {
    if (!Number.isFinite(re[i]) || !Number.isFinite(im[i])) {
      throw new Music2Error("E_INTERNAL", "sampler FFT input must be finite");
    }
  }

  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    while ((j & bit) !== 0) { j ^= bit; bit >>= 1; }
    j ^= bit;
    if (i < j) {
      const real = re[i]!; re[i] = re[j]!; re[j] = real;
      const imag = im[i]!; im[i] = im[j]!; im[j] = imag;
    }
  }

  const { cosine, sine } = twiddles(n);
  for (let width = 2; width <= n; width *= 2) {
    const half = width / 2;
    const step = n / width;
    for (let base = 0; base < n; base += width) {
      for (let k = 0; k < half; k++) {
        const a = base + k;
        const b = a + half;
        const cos = cosine[k * step]!;
        const sin = sine[k * step]! * (inverse ? 1 : -1);
        const real = re[b]! * cos - im[b]! * sin;
        const imag = re[b]! * sin + im[b]! * cos;
        re[b] = re[a]! - real;
        im[b] = im[a]! - imag;
        re[a] = re[a]! + real;
        im[a] = im[a]! + imag;
      }
    }
  }
  if (inverse) {
    for (let i = 0; i < n; i++) { re[i] = re[i]! / n; im[i] = im[i]! / n; }
  }
}

/** Periodic Hann, sin²(pi*n/N), shared by sampler STFT consumers. */
export function hann(length: number): Float64Array {
  if (!Number.isInteger(length) || length < 256 || length > 4096 || (length & (length - 1)) !== 0) {
    throw new Music2Error("E_INTERNAL", "sampler Hann length must be a power of two in 256..4096");
  }
  const window = new Float64Array(length);
  for (let i = 0; i < length; i++) window[i] = Math.sin(Math.PI * i / length) ** 2;
  return window;
}
