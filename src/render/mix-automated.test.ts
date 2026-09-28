import assert from "node:assert/strict";
import test from "node:test";
import { createStereo } from "../audio-io/index.ts";
import { mixAutomated, prepareTrackCurves, sendActive } from "./mix-automated.tool.ts";

function buses(frames: number) {
  return { master: createStereo(44100, frames), reverb: createStereo(44100, frames), delay: createStereo(44100, frames) };
}

test("automated gain and pan use the documented equal-power law and dry stem accounting", () => {
  const track = { id: "a", gain: -12, pan: 0, sends: { reverb: 0, delay: 0 }, automation: [
    { target: "gain", points: [{ tick: 0, value: -6, curve: "hold" as const }] },
    { target: "pan", points: [{ tick: 0, value: -1, curve: "hold" as const }] },
  ] };
  const controls = prepareTrackCurves(track, 2, 44100, 120);
  const out = buses(2); const stem = createStereo(44100, 2);
  mixAutomated(out, Float32Array.of(1, 1), 0, 2, track, controls, null, stem);
  assert.ok(Math.abs(out.master.left[0]! - Math.SQRT2 * 10 ** (-6 / 20)) < 2e-7);
  assert.equal(out.master.right[0], 0);
  assert.deepEqual(stem.left, out.master.left);
  assert.deepEqual(stem.right, out.master.right);
});

test("zero static send becomes active when its lane rises, and crop controls share full origin", () => {
  const track = { id: "a", gain: 0, pan: 0, sends: { reverb: 0, delay: 0 }, automation: [
    { target: "send.reverb", points: [{ tick: 0, value: 0, curve: "hold" as const },
      { tick: 960, value: .5, curve: "hold" as const }] },
  ] };
  assert.equal(sendActive(track, "reverb"), true);
  assert.equal(sendActive(track, "delay"), false);
  const frames = 22060;
  const controls = prepareTrackCurves(track, frames, 44100, 120);
  const full = buses(frames);
  mixAutomated(full, new Float32Array(frames).fill(1), 0, frames, track, controls, null, null);
  const crop = buses(10);
  mixAutomated(crop, new Float32Array(frames).fill(1), 22050, 10, track, controls, null, null);
  assert.deepEqual(crop.reverb.left, full.reverb.left.subarray(22050, 22060));
  assert.equal(full.reverb.left[0], 0);
  assert.ok(full.reverb.left[22059]! > 0);
});
