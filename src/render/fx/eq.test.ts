import assert from "node:assert/strict";
import test from "node:test";
import type { StereoBuffer } from "../../audio-io/index.ts";
import { processEq } from "./eq.tool.ts";

test("all 0 dB stages are exact bypass", () => {
  const left = Float32Array.from([.25, -.4, .123, 0]);
  const right = Float32Array.from([-.1, .8, 0, .3]);
  const buffer: StereoBuffer = { sampleRate: 48000, left, right, sourceChannels: 2 };
  processEq(buffer, { lowGainDb: 0, lowHz: 120, midGainDb: 0, midHz: 1000, midQ: .7,
    highGainDb: 0, highHz: 8000 }, { sampleRate: 48000, bpm: 120 });
  assert.deepEqual([...left], [...Float32Array.from([.25, -.4, .123, 0])]);
  assert.deepEqual([...right], [...Float32Array.from([-.1, .8, 0, .3])]);
});

test("mid boost raises a 1 kHz sine by 6 dB", () => {
  const rate = 48000; const length = rate;
  const left = Float32Array.from({ length }, (_, i) => .1 * Math.sin(2 * Math.PI * 1000 * i / rate));
  const buffer: StereoBuffer = { sampleRate: rate, left, right: left.slice(), sourceChannels: 2 };
  processEq(buffer, { lowGainDb: 0, lowHz: 120, midGainDb: 6, midHz: 1000, midQ: .7,
    highGainDb: 0, highHz: 8000 }, { sampleRate: rate, bpm: 120 });
  let energy = 0;
  for (let i = rate / 2; i < rate; i++) energy += left[i]! ** 2;
  assert.ok(Math.abs(10 * Math.log10(energy / ((rate / 2) * .1 * .1 / 2)) - 6) < .05);
});
