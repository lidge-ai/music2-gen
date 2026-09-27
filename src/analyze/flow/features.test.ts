import assert from "node:assert/strict";
import test from "node:test";
import type { StereoBuffer } from "../../audio-io/buffer.schema.ts";
import { onsetEnvelopes } from "../tempo.tool.ts";
import { intervalFeatures } from "./features.tool.ts";
import { flowIntervals } from "./intervals.tool.ts";

test("four separated onsets and boundary ownership", () => {
  const rate = 48000;
  const left = new Float32Array(rate * 3);
  const onset = new Float64Array(300);
  for (const time of [.2, .7, 1.2, 1.7, 2]) onset[Math.round(time * 100)] = 1;
  const audio: StereoBuffer = { sampleRate: rate, left, right: left, sourceChannels: 1 };
  const grid = { ...flowIntervals(3), intervals: [
    { index: 0, startSeconds: 0, endSeconds: 2, barNumber: null, beatNumber: null },
    { index: 1, startSeconds: 2, endSeconds: 3, barNumber: null, beatNumber: null },
  ] };
  const features = intervalFeatures(audio, grid, onset, [null, null]);
  assert.equal(features[0]!.onsetCount, 4);
  assert.equal(features[0]!.onsetsPerSecond, 2);
  assert.equal(features[1]!.onsetCount, 1);
});

test("four PCM clicks measured through the shared 10 ms envelope count as two per second", () => {
  const sampleRate = 48000;
  const left = new Float32Array(sampleRate * 2);
  for (const time of [.2, .6, 1.1, 1.6]) left[Math.round(time * sampleRate)] = 1;
  const audio: StereoBuffer = { sampleRate, left, right: left, sourceChannels: 1 };
  const grid = { ...flowIntervals(2), intervals: [
    { index: 0, startSeconds: 0, endSeconds: 2, barNumber: null, beatNumber: null },
  ] };
  const measured = intervalFeatures(audio, grid, onsetEnvelopes(audio).onset, [null]);
  assert.equal(measured[0]!.onsetCount, 4);
  assert.equal(measured[0]!.onsetsPerSecond, 2);
});

test("pure tones have measured centroids and silence has zero vector", () => {
  const rate = 48000;
  for (const frequency of [1000, 8000]) {
    const left = Float32Array.from({ length: rate }, (_, frame) => .2 * Math.sin(2 * Math.PI * frequency * frame / rate));
    const audio: StereoBuffer = { sampleRate: rate, left, right: left, sourceChannels: 1 };
    const features = intervalFeatures(audio, flowIntervals(1), new Float64Array(100), [-20, -20]);
    assert.ok(Math.abs(features[0]!.centroidHz! - frequency) < 100, String(features[0]!.centroidHz));
    assert.equal(features[0]!.onsetCount, 0);
  }
  const zero = new Float32Array(rate);
  const silent = intervalFeatures({ sampleRate: rate, left: zero, right: zero, sourceChannels: 1 },
    flowIntervals(1), new Float64Array(100), [null, null]);
  assert.equal(silent[0]!.centroidHz, null);
  assert.equal(silent[0]!.silent, true);
  assert.deepEqual(Array.from(silent[0]!.vector), Array(20).fill(0));
});
