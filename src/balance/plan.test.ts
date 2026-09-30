import assert from "node:assert/strict";
import test from "node:test";
import { validateSong } from "../song/index.ts";
import type { ResolvedSong } from "../song/index.ts";
import type { BalanceRow } from "./balance.schema.ts";
import { planChanges, targetId, validateTargets } from "./plan.tool.ts";

function fixture(): { song: ResolvedSong; rows: BalanceRow[] } {
  const song = validateSong({ version: 1, seed: 1, bpm: 120,
    tracks: [
      { id: "kick", kind: "drums", instrument: "drums", pattern: "bd*4", gain: -6 },
      { id: "bass", kind: "notes", instrument: "bass", pattern: "c3*4", gain: -12,
        layers: [{ id: "copy", instrument: "bass", gain: -3 }] },
    ], sections: [{ id: "drop", bars: 1 }], arrangement: [{ section: "drop" }] });
  const rows: BalanceRow[] = [
    { id: "kick", kind: "track", track: "kick", rmsDb: -14, peakDb: -6, activeRatio: 1 },
    { id: "bass", kind: "track", track: "bass", rmsDb: -24, peakDb: -12, activeRatio: 1 },
    { id: "bass.main", kind: "main", track: "bass", rmsDb: -10, peakDb: -2, activeRatio: 1 },
    { id: "bass.copy", kind: "layer", track: "bass", layer: "copy", rmsDb: -13, peakDb: -5, activeRatio: 1 },
  ];
  return { song, rows };
}

test("targetId distinguishes track and layer targets; validation keeps the last duplicate", () => {
  const { song } = fixture();
  assert.equal(targetId({ track: "bass", db: -20 }), "bass");
  assert.equal(targetId({ track: "bass", layer: "copy", db: -6 }), "bass.copy");
  assert.deepEqual(validateTargets(song, [
    { track: "bass", db: -20 }, { track: "bass", layer: "copy", db: -6 }, { track: "bass", db: -18 },
  ], {}), [{ track: "bass", db: -18 }, { track: "bass", layer: "copy", db: -6 }]);
});

test("validation rejects unknown ids, writable main/reference, nonfinite dB and invalid maxStep", () => {
  const { song } = fixture();
  for (const target of [{ track: "unknown", db: -10 }, { track: "bass", layer: "unknown", db: -6 },
    { track: "bass", layer: "main", db: -6 }, { track: "bass", db: Number.NaN },
    { track: "bass", db: Number.POSITIVE_INFINITY }])
    assert.throws(() => validateTargets(song, [target], {}), { code: "E_INPUT" });
  assert.throws(() => validateTargets(song, [], { reference: "unknown" }), { code: "E_INPUT" });
  assert.throws(() => validateTargets(song, [{ track: "kick", db: 0 }], { reference: "kick" }), { code: "E_INPUT" });
  for (const maxStep of [-1, Number.NaN, Number.POSITIVE_INFINITY])
    assert.throws(() => validateTargets(song, [], { maxStep }), { code: "E_INPUT" });
  assert.deepEqual(validateTargets(song, [], { maxStep: 0 }), []);
});

test("absolute track targets clamp adjustment symmetrically and do not mutate inputs", () => {
  const { song, rows } = fixture(), originalSong = structuredClone(song), originalRows = structuredClone(rows);
  const up = planChanges(song, rows, [{ track: "bass", db: 0 }]);
  assert.deepEqual(up.changes, [{ track: "bass", path: "$.tracks[1].gain", before: -12, after: 0 }]);
  assert.equal(up.rows[1]!.targetDb, 0); assert.equal(up.rows[1]!.deltaDb, 12);
  assert.equal(up.rows[1]!.applied, false);
  const down = planChanges(song, rows, [{ track: "bass", db: -50 }], { maxStep: 4 });
  assert.equal(down.changes[0]!.after, -16); assert.equal(down.rows[1]!.deltaDb, -4);
  assert.deepEqual(song, originalSong); assert.deepEqual(rows, originalRows);
});

test("deltaDb is the actual adjustment after final gain limits, not the requested step", () => {
  const { song, rows } = fixture();
  song.tracks[1]!.gain = 10;
  const up = planChanges(song, rows, [{ track: "bass", db: 0 }], { maxStep: 8 });
  assert.equal(up.changes[0]!.after, 12); assert.equal(up.rows[1]!.deltaDb, 2);
  song.tracks[1]!.gain = -58;
  const down = planChanges(song, rows, [{ track: "bass", db: -50 }], { maxStep: 8 });
  assert.equal(down.changes[0]!.after, -60); assert.equal(down.rows[1]!.deltaDb, -2);
  song.tracks[1]!.layers![0]!.gain = -59;
  const layer = planChanges(song, rows, [{ track: "bass", layer: "copy", db: -20 }]);
  assert.equal(layer.changes[0]!.after, -60); assert.equal(layer.rows[3]!.deltaDb, -1);
});

test("track targets are relative to the reference track level", () => {
  const { song, rows } = fixture();
  const result = planChanges(song, rows, [{ track: "bass", db: -2 }], { reference: "kick" });
  assert.equal(result.rows[1]!.targetDb, -16); assert.equal(result.rows[1]!.deltaDb, 8);
  assert.deepEqual(result.changes, [{ track: "bass", path: "$.tracks[1].gain", before: -12, after: -4 }]);
  assert.equal(result.rows[0]!.deltaDb, undefined); assert.deepEqual(result.warnings, []);
});

test("layer targets use their own main, independently of the track/reference levels", () => {
  const { song, rows } = fixture();
  const result = planChanges(song, rows, [{ track: "bass", layer: "copy", db: -8 }], { reference: "kick" });
  assert.equal(result.rows[3]!.targetDb, -18); assert.equal(result.rows[3]!.deltaDb, -5);
  assert.deepEqual(result.changes, [{ track: "bass", layer: "copy", path: "$.tracks[1].layers[0].gain", before: -3, after: -8 }]);
  assert.equal(result.rows[1]!.deltaDb, undefined);
});

test("gain automation skips only the track edit and leaves layers editable", () => {
  const { song, rows } = fixture();
  song.tracks[1]!.automation = [{ target: "gain", points: [{ tick: 0, value: -12, curve: "hold" }] }];
  const result = planChanges(song, rows, [{ track: "bass", db: -18 }, { track: "bass", layer: "copy", db: -8 }]);
  assert.equal(result.rows[1]!.skipped, "gain automation"); assert.equal(result.rows[1]!.applied, false);
  assert.equal(result.rows[1]!.deltaDb, undefined);
  assert.equal(result.changes.length, 1); assert.equal(result.changes[0]!.layer, "copy");
  assert.deepEqual(result.warnings, ["bass: gain automation"]);
});

test("silent targets and silent/missing main skip changes with warnings", () => {
  const { song, rows } = fixture();
  rows[1]!.rmsDb = null;
  const track = planChanges(song, rows, [{ track: "bass", db: -18 }]);
  assert.deepEqual(track.changes, []); assert.equal(track.rows[1]!.skipped, "silent in window");
  assert.deepEqual(track.warnings, ["bass: silent in window"]);
  rows[3]!.rmsDb = null;
  const layer = planChanges(song, rows, [{ track: "bass", layer: "copy", db: -8 }]);
  assert.equal(layer.rows[3]!.skipped, "silent in window"); assert.deepEqual(layer.changes, []);
  rows[3]!.rmsDb = -13; rows[2]!.rmsDb = null;
  for (const input of [rows, rows.filter((row) => row.kind !== "main")]) {
    const result = planChanges(song, input, [{ track: "bass", layer: "copy", db: -8 }]);
    assert.deepEqual(result.changes, []);
    assert.equal(result.rows.find((row) => row.kind === "layer")!.skipped, "main silent in window");
    assert.deepEqual(result.warnings, ["bass.copy: main silent in window"]);
  }
});

test("silent or unmeasured reference and unmeasured targets return E_INPUT", () => {
  const { song, rows } = fixture();
  rows[0]!.rmsDb = null;
  assert.throws(() => planChanges(song, rows, [{ track: "bass", db: -2 }], { reference: "kick" }), { code: "E_INPUT" });
  assert.throws(() => planChanges(song, rows.slice(1), [], { reference: "kick" }), { code: "E_INPUT" });
  assert.throws(() => planChanges(song, [], [{ track: "bass", db: -18 }]), { code: "E_INPUT" });
});

test("zero maxStep, exact levels and tiny numeric residue produce no changes", () => {
  const { song, rows } = fixture();
  for (const [db, options] of [[0, { maxStep: 0 }], [-24, {}], [-24 + 1e-8, {}]] as const) {
    const result = planChanges(song, rows, [{ track: "bass", db }], options);
    assert.deepEqual(result.changes, []); assert.equal(result.rows[1]!.deltaDb, 0);
    assert.equal(result.rows[1]!.applied, false);
  }
});
