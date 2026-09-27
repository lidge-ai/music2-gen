import assert from "node:assert/strict";
import test from "node:test";
import type { StereoBuffer } from "../audio-io/index.ts";
import { loopSeam } from "./loop-seam.tool.ts";

const rate = 8000;
const window = 400;
function tone(hz: number, amplitude: number, index: number): number {
  return amplitude * Math.sin(2 * Math.PI * hz * index / rate);
}
function audio(first: (i: number) => number, last = first): StereoBuffer {
  const left = new Float32Array(rate);
  for (let i = 0; i < window; i++) {
    left[i] = first(i);
    left[left.length - window + i] = last(i);
  }
  return { sampleRate: rate, left, right: Float32Array.from(left), sourceChannels: 2 };
}

test("matched periodic ends and silence have no seam flag", () => {
  const periodic = loopSeam(audio((i) => tone(100, .05, i)));
  assert.equal(periodic.threshold, null);
  assert.ok(periodic.metrics.jumpFs < .1);
  assert.equal(periodic.metrics.rmsStepDb, 0);
  const silent = loopSeam(audio(() => 0));
  assert.equal(silent.threshold, null);
  assert.equal(silent.metrics.rmsStepDb, 0);
  assert.deepEqual(silent.metrics.bandStepDb, { low: 0, mid: 0, high: 0 });
});

test("sample jump, RMS step, and spectral step activate independently", () => {
  const jump = audio(() => 0);
  jump.left[0] = .11; jump.right[0] = .11;
  assert.equal(loopSeam(jump).threshold, .1);
  const rms = loopSeam(audio((i) => tone(100, .05, i), (i) => tone(100, .05 * 10 ** (4 / 20), i)));
  assert.equal(rms.threshold, 3);
  assert.ok(rms.metrics.rmsStepDb! > 3.9);
  const spectral = loopSeam(audio((i) => tone(100, .05, i) + tone(1000, .01, i),
    (i) => tone(100, .05, i) + tone(1000, .01 * 10 ** (7 / 20), i)));
  assert.equal(spectral.threshold, 6);
  assert.ok(spectral.metrics.bandStepDb.mid! > 6.9);
  assert.ok(spectral.metrics.rmsStepDb! < 3);
});

test("exact .1 FS, 3 dB, and 6 dB boundaries pass", () => {
  const jump = audio(() => 0);
  jump.left[0] = .1; jump.right[0] = .1;
  jump.left[rate - window] = .1; jump.right[rate - window] = .1;
  assert.equal(loopSeam(jump).threshold, null);
  assert.equal(loopSeam(audio((i) => tone(100, .05, i),
    (i) => tone(100, .05 * 10 ** (3 / 20), i))).threshold, null);
  assert.equal(loopSeam(audio((i) => tone(100, .05, i) + tone(1000, .01, i),
    (i) => tone(100, .05, i) + tone(1000, .01 * 10 ** (6 / 20), i))).threshold, null);
});

test("one silent side uses JSON-safe null for an unbounded step", () => {
  const result = loopSeam(audio(() => 0, (i) => tone(100, .05, i)));
  assert.equal(result.threshold, 3);
  assert.equal(result.metrics.rmsStepDb, null);
  assert.equal(result.metrics.rmsFirstDbfs, null);
  assert.doesNotThrow(() => JSON.stringify(result));
});
