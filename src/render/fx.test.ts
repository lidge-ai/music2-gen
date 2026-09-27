import assert from "node:assert/strict";
import test from "node:test";
import { createStereo } from "../audio-io/index.ts";
import { Music2Error } from "../shared/index.ts";
import { applyDelay, applyReverb, duckEnvelope } from "./fx.tool.ts";

void test("reverb is wet only, rate-scaled, stereo spread, and tail-truncated", () => {
  const send = createStereo(44100, 1700);
  send.left[0] = 1; send.right[0] = 1;
  const wet = applyReverb(send);
  assert.equal(wet.left[0], 0);
  assert.equal(wet.left[1421], 0);
  assert.notEqual(wet.left[1422], 0);
  assert.notEqual(wet.left[1557], 0);
  assert.equal(wet.right[1422], 0);
  assert.notEqual(wet.right[1445], 0);
  assert.equal(wet.left.length, send.left.length);
  const faster = createStereo(88200, 3300);
  faster.left[0] = 1;
  const scaled = applyReverb(faster);
  assert.equal(scaled.left[2843], 0);
  assert.notEqual(scaled.left[2844], 0);
});

void test("delay starts at rounded dotted-eighth frame and alternates channels", () => {
  const send = createStereo(48000, 3 * 15429 + 1);
  send.left[0] = 1;
  const wet = applyDelay(send, 140);
  assert.equal(wet.left[0], 0);
  assert.equal(wet.right[15428], 0);
  assert.equal(wet.right[15429], 1);
  assert.ok(Math.abs((wet.left[2 * 15429] ?? 0) - 0.35) < 1e-7);
  assert.ok(Math.abs((wet.right[3 * 15429] ?? 0) - 0.1225) < 1e-7);
  assert.equal(wet.left.length, send.left.length);
  assert.throws(() => applyDelay(send, 0), (error: unknown) => error instanceof Music2Error && error.code === "E_RENDER");
});

void test("duck trigger depresses exact onset, deduplicates, and recovers", () => {
  const frames = 44101;
  const duck = duckEnvelope(frames, [100, 100], 44100, 0.5);
  assert.equal(duck[99], 1);
  assert.equal(duck[100], 0.5);
  assert.ok((duck[44100] ?? 0) > 0.99);
  assert.deepEqual(duckEnvelope(3, [], 44100, 0.5), new Float32Array([1, 1, 1]));
  assert.deepEqual(duckEnvelope(3, [1], 44100, 0.5, 0), new Float32Array([1, 0.5, 1]));
});
