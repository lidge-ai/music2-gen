import assert from "node:assert/strict";
import test from "node:test";
import { createStereo } from "../../audio-io/index.ts";
import { Music2Error } from "../../shared/index.ts";
import { processTapeStop } from "./tapestop.tool.ts";

const rate = 8000;
const context = { sampleRate: rate, bpm: 120, secondsPerBar: 2 };

test("tapestop follows a monotone quadratic read, independently per channel", () => {
  const audio = createStereo(rate, rate * 2);
  for (let i = 0; i < audio.left.length; i++) audio.left[i] = i / rate;
  processTapeStop(audio, { startBar: 1, beats: 2 }, context);
  assert.equal(audio.left[0], 0);
  assert.ok(Math.abs(audio.left[1]! - 1 / rate) < 1e-10);
  assert.equal(audio.right.every((value) => value === 0), true);
  for (let i = 1; i < 7000; i++) assert.ok(audio.left[i]! >= audio.left[i - 1]!);
  const earlyStep = audio.left[101]! - audio.left[100]!;
  const lateStep = audio.left[6001]! - audio.left[6000]!;
  assert.ok(earlyStep > 0.9 / rate);
  assert.ok(lateStep > 0 && lateStep < 0.1 / rate);
  assert.equal(audio.left[rate], 0);
  assert.ok(audio.left.subarray(rate).every((value) => value === 0));
  assert.ok(audio.left.every(Number.isFinite));
});

test("the final 15 ms fades a held value continuously to zero", () => {
  const audio = createStereo(rate, rate);
  audio.left.fill(1);
  processTapeStop(audio, { startBar: 1, beats: 2 }, context);
  assert.equal(audio.left[rate - 121], 1);
  assert.ok(audio.left[rate - 60]! > 0.45 && audio.left[rate - 60]! < 0.55);
  assert.ok(audio.left[rate - 1]! > 0 && audio.left[rate - 1]! < 0.01);
});

test("variable-speed playback lowers sine pitch and terminal fade reaches silence", () => {
  const audio = createStereo(rate, rate * 2);
  for (let i = 0; i < audio.left.length; i++) audio.left[i] = Math.sin(2 * Math.PI * 400 * i / rate);
  processTapeStop(audio, { startBar: 1, beats: 2 }, context);
  const crossings = (from: number, to: number): number => {
    let count = 0;
    for (let i = from + 1; i < to; i++) if (audio.left[i - 1]! <= 0 && audio.left[i]! > 0) count++;
    return count;
  };
  assert.ok(crossings(400, 1200) > 25);
  assert.ok(crossings(5200, 6000) < 8);
  assert.ok(Math.abs(audio.left[7999]!) < 0.01);
  assert.equal(audio.left[8000], 0);
  assert.ok(audio.left.subarray(8000).every((sample) => sample === 0));
});

test("absolute meter start, offset windows, and missing meter context", () => {
  const before = createStereo(rate, rate);
  before.left.fill(0.4); before.right.fill(-0.2);
  const originalLeft = before.left.slice();
  const originalRight = before.right.slice();
  processTapeStop(before, { startBar: 3, beats: 0.25 },
    { ...context, secondsPerBar: 1.5, startSeconds: 1.5 });
  assert.deepEqual(before.left, originalLeft);
  assert.deepEqual(before.right, originalRight);
  const active = createStereo(rate, rate * 4);
  active.left.fill(1);
  processTapeStop(active, { startBar: 3, beats: 0.25 }, { ...context, secondsPerBar: 1.5 });
  assert.equal(active.left[3 * rate - 1], 1);
  assert.equal(active.left[3 * rate], 1);
  assert.equal(active.left[3 * rate + rate / 8], 0);
  const after = createStereo(rate, rate);
  after.left.fill(1); after.right.fill(-1);
  processTapeStop(after, { startBar: 1, beats: 0.25 }, { ...context, startSeconds: 1 });
  assert.ok(after.left.every((value) => value === 0));
  assert.ok(after.right.every((value) => value === 0));
  assert.throws(() => processTapeStop(after, { startBar: 1, beats: 2 }, { sampleRate: rate, bpm: 120 }),
    (error: unknown) => error instanceof Music2Error && error.code === "E_RENDER");
});
