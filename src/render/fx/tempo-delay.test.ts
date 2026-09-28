import assert from "node:assert/strict";
import { test } from "node:test";
import type { StereoBuffer } from "../../audio-io/index.ts";
import { processDelay, renderDelayBus } from "./tempo-delay.tool.ts";

function impulse(frames: number, rate = 8000): StereoBuffer {
  const left = new Float32Array(frames);
  left[0] = 1;
  return { sampleRate: rate, left, right: new Float32Array(frames), sourceChannels: 2 };
}

const params = { time: "1/8" as const, feedback: 0.5, pingPong: true,
  lowCutHz: 20, highCutHz: 18000, mix: 1 };

test("ping-pong bus is wet only: left impulse appears right first and alternates", () => {
  const send = impulse(7000);
  const wet = renderDelayBus(send, params, { sampleRate: 8000, bpm: 120 });
  assert.equal(wet.left[0], 0);
  assert.equal(wet.right[0], 0);
  assert.equal(wet.right[2000], 1);
  assert.equal(wet.left[2000], 0);
  assert.ok(wet.left[4000]! > 0);
  assert.equal(wet.right[4000], 0);
});

test("straight insert has dry plus delayed copy at exact tempo position", () => {
  const audio = impulse(3000);
  processDelay(audio, { ...params, pingPong: false, feedback: 0, mix: 0.25 }, { sampleRate: 8000, bpm: 120 });
  assert.equal(audio.left[0], 0.75);
  assert.equal(audio.left[2000], 0.25);
  assert.equal(audio.right[2000], 0);
});

test("feedback low-pass attenuates high-frequency repeats while leaving first echo direct", () => {
  const rate = 8000;
  const length = 4000;
  const send: StereoBuffer = { sampleRate: rate, left: new Float32Array(length),
    right: new Float32Array(length), sourceChannels: 2 };
  for (let i = 0; i < 1000; i++) send.left[i] = i % 2 === 0 ? 1 : -1;
  const wet = renderDelayBus(send, { ...params, time: "1/16", pingPong: false,
    lowCutHz: 20, highCutHz: 1000 }, { sampleRate: rate, bpm: 120 });
  let first = 0;
  let second = 0;
  for (let i = 0; i < 1000; i++) {
    first += Math.abs(wet.left[1000 + i]!);
    second += Math.abs(wet.left[2000 + i]!);
  }
  assert.equal(first, 1000);
  assert.ok(second < 200);
});
