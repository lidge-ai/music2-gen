import assert from "node:assert/strict";
import { test } from "node:test";
import type { StereoBuffer } from "../../audio-io/index.ts";
import { processPhaser } from "./phaser.tool.ts";

test("phaser is bypassed at zero mix; quadrature creates different wet channels", () => {
  const left = new Float32Array(16000);
  const right = new Float32Array(16000);
  left[0] = right[0] = 1;
  const audio: StereoBuffer = { sampleRate: 8000, left, right, sourceChannels: 2 };
  const params = { rateHz: 0.5, depth: 1, stages: 4, feedback: 0.8, mix: 0 };
  processPhaser(audio, params, { sampleRate: 8000, bpm: 120 });
  assert.equal(left[0], 1);
  processPhaser(audio, { ...params, mix: 0.5 }, { sampleRate: 8000, bpm: 120 });
  assert.notDeepEqual(left, right);
  assert.ok(left.every(Number.isFinite));
  assert.ok(right.every(Number.isFinite));
});

test("four-stage dry/wet interference makes a spectral notch", () => {
  function rmsAt(hz: number): number {
    const rate = 48000;
    const left = new Float32Array(rate);
    const right = new Float32Array(rate);
    for (let i = 0; i < rate; i++) left[i] = right[i] = Math.sin(2 * Math.PI * hz * i / rate);
    processPhaser({ sampleRate: rate, left, right, sourceChannels: 2 },
      { rateHz: 0.3, depth: 0, stages: 4, feedback: 0, mix: 0.5 }, { sampleRate: rate, bpm: 120 });
    let power = 0;
    for (let i = rate / 2; i < rate; i++) power += left[i]! ** 2;
    return Math.sqrt(power / (rate / 2));
  }
  assert.ok(rmsAt(400) < 0.1);
  assert.ok(rmsAt(1000) > 0.65);
});

test("odd phaser stage counts round up to the next even count", () => {
  const rate = 8000;
  const render = (stages: number): StereoBuffer => {
    const left = new Float32Array(rate);
    left[0] = 1;
    const right = left.slice();
    const audio: StereoBuffer = { sampleRate: rate, left, right, sourceChannels: 2 };
    processPhaser(audio, { rateHz: 0.3, depth: 0.7, stages, feedback: 0.2, mix: 0.5 }, { sampleRate: rate, bpm: 120 });
    return audio;
  };
  for (const odd of [3, 5, 11]) {
    const rounded = render(odd);
    const even = render(odd + 1);
    assert.deepEqual(rounded.left, even.left);
    assert.deepEqual(rounded.right, even.right);
  }
});
