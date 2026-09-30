import assert from "node:assert/strict";
import test from "node:test";
import { createStereo } from "../audio-io/index.ts";
import { gatedLevel } from "./measure.tool.ts";

test("gated RMS excludes silence and retains whole-window peaks", () => {
  const audio = createStereo(8000, 8000);
  audio.left.fill(0.25, 4000); audio.right.fill(0.25, 4000);
  const level = gatedLevel(audio);
  assert.ok(Math.abs(level.rmsDb! - 20 * Math.log10(0.25)) < 1e-8);
  assert.equal(level.peakDb, 20 * Math.log10(0.25));
  assert.equal(level.activeRatio, 0.5);
  assert.deepEqual(gatedLevel(audio, 0, 4000), { rmsDb: null, peakDb: null, activeRatio: 0 });
  assert.equal(gatedLevel(audio, 4000).activeRatio, 1);
});

test("stereo mean square and partial blocks are frame weighted", () => {
  const audio = createStereo(8000, 1000);
  audio.left.fill(0.5, 400, 800); audio.right.fill(0.25, 400, 800);
  audio.left.fill(0.1, 800); audio.right.fill(0.1, 800);
  const result = gatedLevel(audio);
  const expected = 10 * Math.log10((50 * (0.25 + 0.0625) / 2 + 25 * 0.01) / 75);
  assert.ok(Math.abs(result.rmsDb! - expected) < 1e-6);
  assert.equal(result.activeRatio, 75 / 125);
  assert.equal(result.peakDb, 20 * Math.log10(0.5));
});

test("sub-gate audio has null RMS, measured peak and zero active ratio", () => {
  const audio = createStereo(8000, 50); audio.left.fill(0.0001); audio.right.fill(0.0001);
  const result = gatedLevel(audio);
  assert.equal(result.rmsDb, null); assert.equal(result.activeRatio, 0);
  assert.ok(Math.abs(result.peakDb! + 80) < 1e-5);
  assert.deepEqual(gatedLevel(audio, 0, 0), { rmsDb: null, peakDb: null, activeRatio: 0 });
});

test("measurement rejects invalid bounds and nonfinite audio", () => {
  const audio = createStereo(8000, 10);
  for (const [start, end] of [[-1, 10], [0, 11], [1, 0], [0.5, 10]])
    assert.throws(() => gatedLevel(audio, start, end), { code: "E_INPUT" });
  audio.left[1] = Number.NaN;
  assert.throws(() => gatedLevel(audio), { code: "E_RENDER" });
});
