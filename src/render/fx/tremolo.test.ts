import assert from "node:assert/strict";
import { test } from "node:test";
import type { StereoBuffer } from "../../audio-io/index.ts";
import { processTremolo } from "./tremolo.tool.ts";

test("zero depth bypasses; full-depth one-Hz sine covers 0..1 with mean 0.5", () => {
  const left = new Float32Array(8000).fill(1);
  const right = new Float32Array(8000).fill(1);
  const audio: StereoBuffer = { sampleRate: 8000, left, right, sourceChannels: 2 };
  const params = { rateHz: 1, depth: 0, phaseDegrees: 90, mix: 1 };
  processTremolo(audio, params, { sampleRate: 8000, bpm: 120 });
  assert.equal(left[0], 1);
  processTremolo(audio, { ...params, depth: 1 }, { sampleRate: 8000, bpm: 120 });
  assert.ok(Math.abs(Math.min(...left)) < 1e-6);
  assert.ok(Math.abs(Math.max(...left) - 1) < 1e-6);
  assert.ok(Math.abs(left.reduce((a, b) => a + b, 0) / left.length - 0.5) < 1e-5);
  assert.ok(Math.abs(right[0]! - 1) < 1e-6);
});
