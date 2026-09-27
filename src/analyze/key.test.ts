import { test } from "node:test";
import assert from "node:assert/strict";
import type { StereoBuffer } from "../audio-io/buffer.schema.ts";
import { estimateKey } from "./key.tool.ts";

function tones(sampleRate: number, frequencies: readonly number[], channels: 1 | 2 = 2): StereoBuffer {
  const frames = Math.round(sampleRate * 0.5);
  const left = new Float32Array(frames);
  for (let i = 0; i < frames; i++) {
    for (const frequency of frequencies) left[i] = left[i]! + 0.5 / frequencies.length * Math.sin(2 * Math.PI * frequency * i / sampleRate);
  }
  return { sampleRate, left, right: channels === 1 ? new Float32Array(frames) : left.slice(), sourceChannels: channels };
}

for (const sampleRate of [44100, 48000]) {
  test(`C minor triad and octave doubles at ${sampleRate} Hz`, () => {
    const frequencies = [261.625565, 311.126984, 391.995436, 523.251131, 622.253968, 783.990872];
    const result = estimateKey(tones(sampleRate, frequencies));
    assert.equal(result.key, "C minor");
    assert.equal(result.candidates[0]?.key, "C minor");
    assert.ok(result.candidates[0].kkScore > result.candidates[1]!.kkScore);
    assert.ok(result.confidence > 0);
    assert.equal(result.chroma.length, 12);
    assert.ok(Math.abs(result.chroma.reduce((a, b) => a + b, 0) - 1) < 1e-9);
    for (const candidate of result.candidates) assert.ok(Number.isFinite(candidate.temperleyScore));
  });
}

test("a single C sine retains diagnostic candidates without claiming a key", () => {
  const result = estimateKey(tones(44100, [261.625565]));
  assert.equal(result.key, null);
  assert.equal(result.confidence, 0);
  assert.equal(result.candidates.length, 3);
});

test("silence has no key candidates", () => {
  const result = estimateKey(tones(44100, []));
  assert.equal(result.key, null);
  assert.equal(result.confidence, 0);
  assert.deepEqual(result.candidates, []);
  assert.deepEqual(result.chroma, new Array<number>(12).fill(0));
});

test("mono and stereo-duplicated audio have equal chroma", () => {
  const audio = tones(44100, [261.625565, 311.126984, 391.995436]);
  const mono = estimateKey({ ...audio, right: new Float32Array(audio.left.length), sourceChannels: 1 });
  const stereo = estimateKey(audio);
  for (let i = 0; i < 12; i++) assert.ok(Math.abs(mono.chroma[i]! - stereo.chroma[i]!) < 1e-6);
});
