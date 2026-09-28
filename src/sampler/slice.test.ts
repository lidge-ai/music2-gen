import { test } from "node:test";
import assert from "node:assert/strict";
import type { StereoBuffer } from "../audio-io/buffer.schema.ts";
import { sliceRegions, sliceTransients } from "./slice.tool.ts";

function ramp(frames: number, sampleRate = 44100): StereoBuffer {
  const left = Float32Array.from({ length: frames }, (_, i) => (i % 97) / 97);
  const right = Float32Array.from({ length: frames }, (_, i) => -(i % 53) / 53);
  return { sampleRate, left, right, sourceChannels: 2 };
}

test("eight regions have exact floor boundaries and no-fade reconstruction", () => {
  const input = ramp(2 * 44100 + 3);
  const slices = sliceRegions(input, 8, { fadeOutMs: 0 });
  assert.equal(slices.length, 8);
  assert.deepEqual(slices.map(({ startSample, endSample }) => [startSample, endSample]),
    Array.from({ length: 8 }, (_, k) => [Math.floor(k * input.left.length / 8), Math.floor((k + 1) * input.left.length / 8)]));
  assert.deepEqual([...slices.flatMap((slice) => [...slice.audio.left])], [...input.left]);
  assert.deepEqual([...slices.flatMap((slice) => [...slice.audio.right])], [...input.right]);
  assert.deepEqual(slices.map((slice) => slice.name), Array.from({ length: 8 }, (_, i) => `slice-0${i}.wav`));
});

test("10 ms cosine fade ends at zero without changing the next slice start", () => {
  const input = ramp(44100);
  const slices = sliceRegions(input, 2);
  assert.equal(slices[0]!.audio.left.at(-1), 0);
  assert.equal(slices[0]!.audio.right.at(-1), 0);
  assert.equal(slices[1]!.audio.left[0], input.left[slices[1]!.startSample]);
  assert.equal(slices[1]!.audio.right[0], input.right[slices[1]!.startSample]);
  assert.equal(slices[0]!.audio.left[0], input.left[0]);
  assert.equal(slices[0]!.audio.left[100], input.left[100]);
});

test("128 hard cap uses stable names and indices", () => {
  const slices = sliceRegions(ramp(1280), 128, { fadeOutMs: 0 });
  assert.equal(slices[0]!.name, "slice-00.wav");
  assert.equal(slices[127]!.name, "slice-127.wav");
  assert.deepEqual(slices.map((slice) => slice.index), Array.from({ length: 128 }, (_, i) => i));
  assert.throws(() => sliceRegions(ramp(1280), 129), { code: "E_INPUT" });
});

test("transient slices are contiguous and obey the default 64 cap", () => {
  const sampleRate = 44100;
  const input: StereoBuffer = { sampleRate, left: new Float32Array(81 * 4410),
    right: new Float32Array(81 * 4410), sourceChannels: 2 };
  for (let i = 0; i < 80; i++) {
    input.left[(i + 1) * 4410] = 0.9;
    input.right[(i + 1) * 4410] = 0.9;
  }
  const slices = sliceTransients(input, { fadeOutMs: 0 });
  assert.equal(slices.length, 64);
  assert.equal(slices[0]!.startSample, 0);
  assert.equal(slices.at(-1)!.endSample, input.left.length);
  for (let i = 1; i < slices.length; i++) assert.equal(slices[i - 1]!.endSample, slices[i]!.startSample);
});

test("no transients produces one full-length slice", () => {
  const input = ramp(1000);
  input.left.fill(0);
  input.right.fill(0);
  const slices = sliceTransients(input, { fadeOutMs: 0 });
  assert.equal(slices.length, 1);
  assert.equal(slices[0]!.startSample, 0);
  assert.equal(slices[0]!.endSample, input.left.length);
  assert.deepEqual([...slices[0]!.audio.left], [...input.left]);
});
