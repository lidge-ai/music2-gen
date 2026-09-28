import assert from "node:assert/strict";
import { test } from "node:test";
import type { StereoBuffer } from "../../audio-io/index.ts";
import { processChorus } from "./chorus.tool.ts";

function impulse(frames: number, rate = 8000): StereoBuffer {
  const left = new Float32Array(frames);
  const right = new Float32Array(frames);
  left[0] = right[0] = 1;
  return { sampleRate: rate, left, right, sourceChannels: 2 };
}

test("fixed delay returns impulse at its exact sample and mix zero is bitwise bypass", () => {
  const params = { rateHz: 0.35, depthMs: 0, baseMs: 5, feedback: 0, mix: 1 };
  const audio = impulse(100);
  processChorus(audio, params, { sampleRate: 8000, bpm: 120 });
  assert.equal(audio.left[0], 0);
  assert.equal(audio.left[40], 1);
  assert.equal(audio.right[40], 1);
  const bypass = impulse(100);
  processChorus(bypass, { ...params, mix: 0 }, { sampleRate: 8000, bpm: 120 });
  assert.equal(bypass.left[0], 1);
});

test("quadrature modulation decorrelates stereo and bounded feedback remains finite", () => {
  const audio = impulse(8000);
  processChorus(audio, { rateHz: 1, depthMs: 4, baseMs: 8, feedback: 0.8, mix: 1 }, { sampleRate: 8000, bpm: 120 });
  assert.notDeepEqual(audio.left, audio.right);
  assert.ok(audio.left.every(Number.isFinite));
  assert.ok(audio.right.every(Number.isFinite));
});
