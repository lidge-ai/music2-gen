import { test } from "node:test";
import assert from "node:assert/strict";
import type { StereoBuffer } from "../audio-io/buffer.schema.ts";
import { mulberry32 } from "../shared/prng.tool.ts";
import { detectOnsets } from "./onsets.tool.ts";

const RATE = 44100;

function clickTrain(): StereoBuffer {
  const length = Math.round(2.2 * RATE);
  const left = new Float32Array(length);
  const right = new Float32Array(length);
  const random = mulberry32(260928);
  const noisePeak = 0.01 * Math.sqrt(3); // Uniform noise at -40 dBFS RMS.
  for (let i = 0; i < length; i++) {
    const value = (2 * random() - 1) * noisePeak;
    left[i] = value;
    right[i] = value;
  }
  for (let i = 0; i < 16; i++) {
    const position = Math.round((0.1 + i * 0.125) * RATE);
    left[position] = 0.9;
    right[position] = 0.9;
  }
  return { sampleRate: RATE, left, right, sourceChannels: 2 };
}

test("16 seeded clicks yield exactly 16 onsets within five milliseconds", () => {
  const audio = clickTrain();
  const onsets = detectOnsets(audio);
  assert.equal(onsets.length, 16, JSON.stringify(onsets));
  for (let i = 0; i < 16; i++) {
    const expected = Math.round((0.1 + i * 0.125) * RATE);
    assert.ok(Math.abs(onsets[i]! - expected) <= Math.round(0.005 * RATE),
      `click ${i}: ${onsets[i]} vs ${expected}`);
  }
  assert.deepEqual(detectOnsets(audio), onsets);
});

test("steady sine has no repeated onset after its attack", () => {
  const length = RATE;
  const left = new Float32Array(length);
  const right = new Float32Array(length);
  const attack = Math.round(0.1 * RATE);
  for (let i = attack; i < length; i++) {
    left[i] = Math.sin(2 * Math.PI * 440 * (i - attack) / RATE) * 0.5;
    right[i] = left[i]!;
  }
  const onsets = detectOnsets({ sampleRate: RATE, left, right, sourceChannels: 2 });
  assert.ok(onsets.every((frame) => frame <= attack + Math.round(0.01 * RATE)), JSON.stringify(onsets));
});

test("50 ms minimum gap keeps only one of two clicks 30 ms apart", () => {
  const left = new Float32Array(RATE);
  const right = new Float32Array(RATE);
  left[Math.round(0.1 * RATE)] = 0.9;
  left[Math.round(0.13 * RATE)] = 0.9;
  right.set(left);
  const onsets = detectOnsets({ sampleRate: RATE, left, right, sourceChannels: 2 }, { minGapMs: 50 });
  assert.equal(onsets.length, 1, JSON.stringify(onsets));
});

test("silence and invalid controls", () => {
  const silence: StereoBuffer = { sampleRate: RATE, left: new Float32Array(2000),
    right: new Float32Array(2000), sourceChannels: 2 };
  assert.deepEqual(detectOnsets(silence), []);
  assert.throws(() => detectOnsets(silence, { sensitivity: 1.1 }), { code: "E_INPUT" });
  assert.throws(() => detectOnsets(silence, { minGapMs: 0 }), { code: "E_INPUT" });
});
