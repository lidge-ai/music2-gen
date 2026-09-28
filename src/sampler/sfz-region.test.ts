import { test } from "node:test";
import assert from "node:assert/strict";
import { mulberry32 } from "../shared/prng.tool.ts";
import { selectSfzRegions } from "./sfz-region.tool.ts";
import type { SfzEvent, SfzRegion, SfzSelectionState } from "./sfz.schema.ts";

function region(patch: Partial<SfzRegion> = {}): SfzRegion {
  return { sample: "*sine", source: { file: "bank.sfz", line: 1 },
    control: { defaultPath: "", noteOffset: 0, octaveOffset: 0 }, key: [0, 127], velocity: [1, 127],
    pitchKeycenter: 60, pitchKeytrack: 100, tune: 0, transpose: 0, volume: 0, amplitude: 100, pan: 0,
    offset: 0, end: null, loopMode: null, loopStart: null, loopEnd: null, trigger: "attack",
    ampeg: { delay: 0, start: 0, attack: 0, hold: 0, decay: 0, sustain: 100, release: 0.001 },
    ampVeltrack: 100, ampVelcurve: new Map(), group: 0, offBy: 0, offMode: "fast", rtDecay: 0,
    seqLength: 1, seqPosition: 1, lorand: 0, hirand: 1, ...patch };
}
function state(): SfzSelectionState { return { counters: new Map(), heldKeys: new Set(), active: [] }; }
function event(index: number, velocity = 1, midi = 60): SfzEvent {
  return { midi, velocity, startFrame: index * 100, gateFrames: 50, stopFrame: 1000, eventIndex: index, seed: index + 3 };
}

test("inclusive key and velocity, layering, and one shared random draw", () => {
  const regions = [region({ key: [60, 60], velocity: [64, 64] }), region({ key: [60, 60], velocity: [64, 64] })];
  const chosen = selectSfzRegions({ regions, warnings: [] }, event(0, 64 / 127), state());
  assert.deepEqual(chosen, regions);
  assert.equal(selectSfzRegions({ regions, warnings: [] }, event(0, 63 / 127), state()).length, 0);
  assert.equal(selectSfzRegions({ regions, warnings: [] }, event(0, 64 / 127, 61), state()).length, 0);
  const r = mulberry32(17)();
  const quarters = [0, 1, 2, 3].map((n) => region({ lorand: n / 4, hirand: (n + 1) / 4 }));
  const result = selectSfzRegions({ regions: quarters, warnings: [] }, { ...event(0), seed: 17 }, state());
  assert.equal(result[0], quarters[Math.floor(r * 4)]);
});

test("round robin counts once for each key and sequence length", () => {
  const regions = [1, 2, 3].map((seqPosition) => region({ seqLength: 3, seqPosition }));
  const run = state();
  const played = Array.from({ length: 7 }, (_, i) => {
    const picked = selectSfzRegions({ regions, warnings: [] }, event(i), run)[0];
    selectSfzRegions({ regions, warnings: [] }, { ...event(i), velocity: 0, startFrame: i * 100 + 50 }, run);
    return regions.indexOf(picked!) + 1;
  });
  assert.deepEqual(played, [1, 2, 3, 1, 2, 3, 1]);
  assert.equal(run.counters.get("60:3"), 2);
});

test("release round robin reuses its own note-on position without advancing the sequence", () => {
  const attacks = [1, 2, 3].map((seqPosition) => region({ seqLength: 3, seqPosition }));
  const releases = [1, 2, 3].map((seqPosition) => region({ trigger: "release", seqLength: 3, seqPosition }));
  const regions = [...attacks, ...releases];
  const run = state();
  for (let i = 0; i < 4; i++) {
    assert.deepEqual(selectSfzRegions({ regions, warnings: [] }, event(i), run), [attacks[i % 3]]);
    assert.deepEqual(selectSfzRegions({ regions, warnings: [] },
      { ...event(i), velocity: 0, startFrame: i * 100 + 50 }, run), [releases[i % 3]]);
  }
  assert.equal(run.counters.get("60:3"), 2);
});

test("first, legato, release velocity, and group choke", () => {
  const regions = [region({ trigger: "first", offBy: 8 }), region({ trigger: "legato" }),
    region({ trigger: "release", group: 8, rtDecay: 20 })];
  const run = state();
  assert.deepEqual(selectSfzRegions({ regions, warnings: [] }, event(0, 0.5), run), [regions[0]]);
  assert.deepEqual(selectSfzRegions({ regions, warnings: [] }, event(1, 0.8, 61), run), [regions[1]]);
  assert.deepEqual(selectSfzRegions({ regions, warnings: [] }, { ...event(0), velocity: 0, startFrame: 150 }, run), [regions[2]]);
  assert.equal(run.active[0]?.fastOffFrame, 150);
  assert.equal(run.active[2]?.velocity, 64);
  assert.equal(run.active[2]?.heldFrames, 150);
  assert.equal(run.heldKeys.has(60), false);
});

test("overlapping same-key notes release only their own voices", () => {
  const regions = [region()];
  const run = state();
  selectSfzRegions({ regions, warnings: [] }, event(0), run);
  selectSfzRegions({ regions, warnings: [] }, event(1), run);
  selectSfzRegions({ regions, warnings: [] }, { ...event(0), velocity: 0, startFrame: 125 }, run);
  assert.equal(run.active[0]?.releaseFrame, 125);
  assert.equal(run.active[1]?.releaseFrame, null);
  assert.equal(run.heldKeys.has(60), true);
});

test("normal group choke marks a one-shot voice for envelope release", () => {
  const regions = [region({ loopMode: "one_shot", offBy: 4, offMode: "normal" }),
    region({ key: [61, 61], group: 4 })];
  const run = state();
  selectSfzRegions({ regions, warnings: [] }, event(0, 1, 60), run);
  selectSfzRegions({ regions, warnings: [] }, event(1, 1, 61), run);
  assert.equal(run.active[0]?.releaseFrame, 100);
  assert.equal(run.active[0]?.choked, true);
});
