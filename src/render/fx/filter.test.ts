import assert from "node:assert/strict";
import test from "node:test";
import type { StereoBuffer } from "../../audio-io/index.ts";
import { processFilter } from "./filter.tool.ts";

const base = { mode: "lowpass" as const, cutoffHz: 1000, q: Math.SQRT1_2, lfoRateHz: 0, lfoDepthOct: 0, mix: 1 };

test("mix zero preserves samples exactly", () => {
  const left = Float32Array.from([1, -.5, .25]); const right = left.slice();
  const buffer: StereoBuffer = { sampleRate: 48000, left, right, sourceChannels: 2 };
  processFilter(buffer, { ...base, mix: 0 }, { sampleRate: 48000, bpm: 120 });
  assert.deepEqual([...left], [1, -.5, .25]);
});

test("static LP attenuates above cutoff; LFO quadrature decorrelates channels", () => {
  const rate = 48000; const length = rate;
  const input = Float32Array.from({ length }, (_, i) => .1 * Math.sin(2 * Math.PI * 8000 * i / rate));
  const staticBuffer: StereoBuffer = { sampleRate: rate, left: input.slice(), right: input.slice(), sourceChannels: 2 };
  processFilter(staticBuffer, base, { sampleRate: rate, bpm: 120 });
  let original = 0; let filtered = 0;
  for (let i = rate / 2; i < rate; i++) { original += input[i]! ** 2; filtered += staticBuffer.left[i]! ** 2; }
  assert.ok(10 * Math.log10(filtered / original) < -30);
  const modulated: StereoBuffer = { sampleRate: rate, left: input.slice(), right: input.slice(), sourceChannels: 2 };
  processFilter(modulated, { ...base, lfoRateHz: 2, lfoDepthOct: 2 }, { sampleRate: rate, bpm: 120 });
  assert.ok(modulated.left.some((value, i) => Math.abs(value - modulated.right[i]!) > 1e-5));
  assert.ok(modulated.left.every(Number.isFinite) && modulated.right.every(Number.isFinite));
});
