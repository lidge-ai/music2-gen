import assert from "node:assert/strict";
import { test } from "node:test";
import type { StereoBuffer } from "../../audio-io/index.ts";
import { processCrush } from "./crush.tool.ts";

test("four-bit midtread quantization holds each capture exactly four frames", () => {
  const left = Float32Array.from([0.5, 0, 0, 0, 0, 0]);
  const right = new Float32Array(6);
  const audio: StereoBuffer = { sampleRate: 8000, left, right, sourceChannels: 2 };
  processCrush(audio, { bits: 4, downsample: 4, mix: 1 }, { sampleRate: 8000, bpm: 120 });
  for (let i = 0; i < 4; i++) assert.ok(Math.abs(left[i]! - 4 / 7) < 1e-7);
  assert.equal(left[4], 0);
  assert.equal(left[5], 0);
});
