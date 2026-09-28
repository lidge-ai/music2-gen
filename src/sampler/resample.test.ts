import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { test } from "node:test";
import type { StereoBuffer } from "../audio-io/buffer.schema.ts";
import { Music2Error } from "../shared/index.ts";
import { resample } from "./resample.tool.ts";

function stereo(left: Float32Array, right = left): StereoBuffer {
  return { sampleRate: 48000, left, right, sourceChannels: left === right ? 1 : 2 };
}

function tone(hz: number, frames = 48000): StereoBuffer {
  return stereo(Float32Array.from({ length: frames }, (_, i) => Math.sin(2 * Math.PI * hz * i / 48000)));
}

function rms(samples: Float32Array, from: number, to: number): number {
  let energy = 0;
  for (let i = from; i < to; i++) energy += samples[i]! ** 2;
  return Math.sqrt(energy / (to - from));
}

function frequency(samples: Float32Array, rate: number): number {
  const crossings: number[] = [];
  for (let i = 4096; i < samples.length - 4096; i++) {
    const a = samples[i - 1]!;
    const b = samples[i]!;
    if (a < 0 && b >= 0) crossings.push(i - 1 - a / (b - a));
  }
  return (crossings.length - 1) * rate / (crossings[crossings.length - 1]! - crossings[0]!);
}

test("identity is an exact copy, and source buffers are not aliased", () => {
  const source = stereo(Float32Array.from([0.1, -0.3, 0.7]), Float32Array.from([0.6, 0.4, -0.2]));
  for (const mode of ["sinc", "hq", "hermite", "linear"] as const) {
    const result = resample(source, 1, { mode });
    assert.deepEqual(result.left, source.left);
    assert.deepEqual(result.right, source.right);
    assert.notEqual(result.left, source.left);
  }
  assert.equal(resample(stereo(new Float32Array()), 1.25).left.length, 0);
});

test("noninteger ratio uses the specified exact length and stereo positions", () => {
  const source = stereo(Float32Array.from({ length: 1000 }, (_, i) => i / 1000),
    Float32Array.from({ length: 1000 }, (_, i) => -i / 1000));
  const result = resample(source, 1.25, { mode: "linear" });
  assert.equal(result.left.length, 800);
  assert.equal(result.right.length, 800);
  assert.ok(Math.abs(result.left[1]! - 0.00125) < 1e-8);
  assert.ok(Math.abs(result.right[1]! + 0.00125) < 1e-8);
  assert.equal(resample(source, 1.25, { mode: "linear", start: 1, frames: 2 }).left.length, 2);
});

test("linear and Hermite reproduce integer positions; a read callback can wrap loops", () => {
  const source = stereo(Float32Array.from([1, 2, 3, 4]));
  for (const mode of ["linear", "hermite"] as const) {
    const result = resample(source, 1, { mode, start: 1, frames: 2 });
    assert.deepEqual([...result.left], [2, 3]);
  }
  const looped = resample(source, 1, {
    mode: "linear", start: 3, frames: 4,
    read: (_channel, index) => source.left[((index % 4) + 4) % 4]!,
  });
  assert.deepEqual([...looped.left], [4, 1, 2, 3]);
  const edge = resample(source, 0.5, { mode: "linear", start: 3, frames: 3 });
  assert.deepEqual([...edge.left], [4, 2, 0]);
});

test("sinc shifts pitch and suppresses a tone beyond the output Nyquist", () => {
  const ratio = 2 ** (7.3 / 12);
  const source = tone(1000);
  const shifted = resample(source, ratio);
  const measured = frequency(shifted.left, source.sampleRate);
  assert.ok(Math.abs(1200 * Math.log2(measured / (1000 * ratio))) < 0.5);
  const alias = resample(tone(15000), 2);
  assert.ok(rms(alias.left, 4096, alias.left.length - 4096) < 10 ** (-90 / 20));
});

test("5 kHz noninteger pitch has no spur above -100 dBc", () => {
  const ratio = 2 ** (7.3 / 12);
  const output = resample(tone(5000), ratio).left;
  const omega = 2 * Math.PI * 5000 * ratio / 48000;
  let ss = 0; let cc = 0; let sc = 0; let ys = 0; let yc = 0;
  const from = 4096;
  const to = output.length - 4096;
  for (let i = from; i < to; i++) {
    const s = Math.sin(omega * i);
    const c = Math.cos(omega * i);
    ss += s * s; cc += c * c; sc += s * c;
    ys += output[i]! * s; yc += output[i]! * c;
  }
  const determinant = ss * cc - sc * sc;
  const a = (ys * cc - yc * sc) / determinant;
  const b = (yc * ss - ys * sc) / determinant;
  let residual = 0;
  let signal = 0;
  for (let i = from; i < to; i++) {
    const fitted = a * Math.sin(omega * i) + b * Math.cos(omega * i);
    residual += (output[i]! - fitted) ** 2;
    signal += fitted ** 2;
  }
  assert.ok(10 * Math.log10(residual / signal) <= -100);
});

test("default sinc retains 10 kHz passband and Hermite stays above -0.5 dB", () => {
  const source = tone(10000);
  const ratio = 2 ** (0.1 / 12);
  const reference = rms(source.left, 4096, source.left.length - 4096);
  const sinc = resample(source, ratio);
  const hermite = resample(source, ratio, { mode: "hermite" });
  const gain = (samples: Float32Array): number => 20 * Math.log10(rms(samples, 4096, samples.length - 4096) / reference);
  assert.ok(Math.abs(gain(sinc.left)) < 0.01);
  assert.ok(gain(hermite.left) >= -0.5);
});

test("repeated resampling yields identical bytes and malformed inputs fail", () => {
  const source = tone(5000, 12000);
  const first = resample(source, 2 ** (7.3 / 12));
  const second = resample(source, 2 ** (7.3 / 12));
  const hash = (samples: Float32Array): string => createHash("sha256")
    .update(Buffer.from(samples.buffer, samples.byteOffset, samples.byteLength)).digest("hex");
  assert.equal(hash(first.left), hash(second.left));
  assert.throws(() => resample(source, 0), (error: unknown) => error instanceof Music2Error && error.code === "E_RENDER");
  assert.throws(() => resample(source, 1, { frames: 1.5 }), (error: unknown) => error instanceof Music2Error && error.code === "E_CAPABILITY");
});
