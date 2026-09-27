import { test } from "node:test";
import assert from "node:assert/strict";
import { fft, hann, realSpectrum } from "./fft.tool.ts";

test("impulse transforms to a flat spectrum", () => {
  const { real, imag } = fft(Float64Array.from([1, 0, 0, 0]));
  assert.deepEqual([...real], [1, 1, 1, 1]);
  for (const v of imag) assert.ok(Math.abs(v) < 1e-12);
});

test("8-point unit sine peaks only at bins 1 and 7", () => {
  const x = Float64Array.from({ length: 8 }, (_, n) => Math.sin((2 * Math.PI * n) / 8));
  const { real, imag } = fft(x);
  for (let k = 0; k < 8; k++) {
    const mag = Math.hypot(real[k]!, imag[k]!);
    if (k === 1 || k === 7) assert.ok(Math.abs(mag - 4) < 1e-12, String(mag));
    else assert.ok(mag < 1e-12, `bin ${k} ${mag}`);
  }
});

test("periodic hann", () => {
  assert.deepEqual([...hann(4)].map((v) => Math.round(v * 1e12) / 1e12), [0, 0.5, 1, 0.5]);
});

test("invalid sizes and inputs fail", () => {
  assert.throws(() => fft(new Float64Array(3)), /power of two/);
  assert.throws(() => fft(Float64Array.from([1, Number.NaN])), /finite/);
});

test("zero-padded tail frame keeps an impulse flat", () => {
  const mags = realSpectrum(Float32Array.from([0, 0, 0, 1]), 3, 4);
  assert.deepEqual([...mags], [1, 1, 1]);
});

test("large FFT matches a direct DFT bin", () => {
  const size = 1024;
  const x = Float64Array.from({ length: size }, (_, n) => Math.cos((2 * Math.PI * 37 * n) / size) + 0.25);
  const { real } = fft(x);
  assert.ok(Math.abs(real[37]! - size / 2) < 1e-7);
  assert.ok(Math.abs(real[0]! - size / 4) < 1e-7);
});
