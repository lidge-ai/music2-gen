import assert from "node:assert/strict";
import { test } from "node:test";
import { Music2Error } from "../shared/index.ts";
import { fft, hann } from "./fft.tool.ts";

const N = 256;

test("impulse and DC preserve natural bin ordering", () => {
  const impulse = new Float64Array(N);
  impulse[0] = 1;
  const imaginary = new Float64Array(N);
  fft(impulse, imaginary);
  for (let k = 0; k < N; k++) {
    assert.equal(impulse[k], 1);
    assert.ok(Math.abs(imaginary[k]!) < 1e-12);
  }

  const dc = new Float64Array(N).fill(0.25);
  fft(dc, new Float64Array(N));
  assert.ok(Math.abs(dc[0]! - 64) < 1e-12);
  for (let k = 1; k < N; k++) assert.ok(Math.abs(dc[k]!) < 1e-12);
});

test("a bin-aligned sine has only positive and negative frequency bins", () => {
  const real = Float64Array.from({ length: N }, (_, i) => Math.sin(2 * Math.PI * 13 * i / N));
  const imaginary = new Float64Array(N);
  fft(real, imaginary);
  for (let k = 0; k < N; k++) {
    const magnitude = Math.hypot(real[k]!, imaginary[k]!);
    assert.ok(Math.abs(magnitude - (k === 13 || k === N - 13 ? N / 2 : 0)) < 1e-10);
  }
  assert.ok(imaginary[13]! < 0);
  assert.ok(imaginary[N - 13]! > 0);
});

test("inverse reconstructs arbitrary complex input within 1e-10", () => {
  const real = Float64Array.from({ length: 4096 }, (_, i) => Math.sin(i * 0.17) + i / 4096);
  const imaginary = Float64Array.from({ length: 4096 }, (_, i) => Math.cos(i * 0.23));
  const originalReal = real.slice();
  const originalImaginary = imaginary.slice();
  fft(real, imaginary);
  fft(real, imaginary, true);
  for (let i = 0; i < real.length; i++) {
    assert.ok(Math.abs(real[i]! - originalReal[i]!) < 1e-10);
    assert.ok(Math.abs(imaginary[i]! - originalImaginary[i]!) < 1e-10);
  }
});

test("periodic Hann and invalid transform shapes", () => {
  const window = hann(N);
  assert.equal(window[0], 0);
  assert.equal(window[N / 2], 1);
  assert.ok(Math.abs(window[N / 4]! - 0.5) < 1e-15);
  assert.ok(Math.abs(window[N - 1]! - window[1]!) < 1e-15);
  for (const [real, imag] of [
    [new Float64Array(255), new Float64Array(255)],
    [new Float64Array(512), new Float64Array(256)],
    [new Float64Array(8192), new Float64Array(8192)],
    [Float64Array.from({ length: N }, (_, i) => i === 2 ? Infinity : 0), new Float64Array(N)],
  ]) {
    assert.throws(() => fft(real!, imag!), (error: unknown) => error instanceof Music2Error && error.code === "E_INTERNAL");
  }
  assert.throws(() => hann(300), (error: unknown) => error instanceof Music2Error && error.code === "E_INTERNAL");
});
