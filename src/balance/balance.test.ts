import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import type { TestContext } from "node:test";
import { buildTimeline, validateSong } from "../song/index.ts";
import type { Song } from "../song/index.ts";
import { applyChanges, balanceSong, measureSong, planChanges, resolveWindow } from "./balance.tool.ts";
import { parseTarget } from "./balance.schema.ts";
import type { BalanceReport, BalanceRow } from "./balance.schema.ts";

function fixture(layered = false): Song {
  return { version: 1, seed: 17, bpm: 120, sampleRate: 44100, tailSeconds: 0,
    tracks: [{ id: "ref", kind: "notes", instrument: "bass", pattern: "c3 c3 c3 c3", gain: -6 },
      { id: "bass", kind: "notes", instrument: "bass", pattern: "c3 c3 c3 c3", gain: -12,
        ...(layered ? { layers: [{ id: "copy", instrument: "bass", gain: -3 }] } : {}) },
      { id: "other", kind: "notes", instrument: "bass", pattern: "c3 c3 c3 c3", gain: -6,
        ...(layered ? { layers: [{ id: "copy", instrument: "bass", gain: -9 }] } : {}) }],
    sections: [{ id: "intro", bars: 1, patterns: { bass: null, other: null } }, { id: "drop", bars: 1 }],
    arrangement: [{ section: "intro" }, { section: "drop", repeats: 2 }] };
}
async function setup(t: TestContext, raw = fixture()): Promise<{ path: string; source: string; dir: string }> {
  const dir = await mkdtemp(join(tmpdir(), "music2-balance-"));
  const path = join(dir, "song.json"), source = JSON.stringify(raw);
  await writeFile(path, source);
  t.after(async () => { await rm(dir, { recursive: true, force: true }); });
  return { path, source, dir };
}
function row(rows: BalanceRow[], id: string): BalanceRow { return rows.find((item) => item.id === id)!; }
function close(actual: number, expected: number, tolerance = 0.5): void {
  assert.ok(Math.abs(actual - expected) < tolerance, `${actual} differs from ${expected}`);
}
function relative(report: BalanceReport, id: string, reference: string): number {
  return row(report.after!, id).rmsDb! - row(report.after!, reference).rmsDb!;
}

test("target syntax and read-only .main", () => {
  assert.deepEqual(parseTarget("bass=-14"), { track: "bass", db: -14 });
  assert.deepEqual(parseTarget("bass.copy=-.5"), { track: "bass", layer: "copy", db: -0.5 });
  for (const text of ["bass", "bass=NaN", "bass=Infinity", "bass.main=-2", "bass.x.y=1", "bass=1e999", "=2"])
    assert.throws(() => parseTarget(text), { code: "E_INPUT" });
});

test("window uses 0-based half-open bars and 1-based arrangement placements", () => {
  const song = validateSong(fixture()), timeline = buildTimeline(song);
  assert.deepEqual(resolveWindow(song, timeline, {}), { startBar: 0, endBar: 3 });
  assert.deepEqual(resolveWindow(song, timeline, { section: "drop" }),
    { startBar: 1, endBar: 2, section: "drop", occurrence: 1 });
  assert.deepEqual(resolveWindow(song, timeline, { section: "drop", occurrence: 2 }),
    { startBar: 2, endBar: 3, section: "drop", occurrence: 2 });
  assert.deepEqual(resolveWindow(song, timeline, { bars: "1:3" }), { startBar: 1, endBar: 3 });
  for (const opts of [{ section: "no" }, { section: "drop", occurrence: 3 }, { occurrence: 1 },
    { section: "drop", bars: "0:1" }, { section: "drop", occurrence: 0 }, { section: "drop", occurrence: 1.5 },
    { bars: "-1:1" }, { bars: "1:1" }, { bars: "0:4" }, { bars: "1:2.5" }, { bars: "9007199254740992:9007199254740993" }])
    assert.throws(() => resolveWindow(song, timeline, opts), { code: "E_INPUT" });
  assert.throws(() => resolveWindow({ ...song, loop: true }, timeline, {}), { code: "E_INPUT" });
});

test("window measurement yields tracks six dB apart and excludes release tail", async (t) => {
  const { path } = await setup(t), song = validateSong(fixture());
  const window = resolveWindow(song, buildTimeline(song), { bars: "1:2" });
  const measured = await measureSong(song, path, window);
  close(row(measured.rows, "ref").rmsDb! - row(measured.rows, "bass").rmsDb!, 6, 0.01);
  const tailed = await measureSong({ ...song, tailSeconds: 2 }, path, window);
  for (const [i, level] of measured.rows.entries()) {
    close(tailed.rows[i]!.rmsDb!, level.rmsDb!, 1e-6);
    assert.equal(tailed.rows[i]!.activeRatio, level.activeRatio);
  }
});

test("absolute apply preserves fields, reports after, and second apply moves under 0.5 dB", async (t) => {
  const raw = fixture(), { path, source, dir } = await setup(t, raw);
  const before = await balanceSong(path, { bars: "1:2", targets: [] });
  const target = row(before.rows, "bass").rmsDb! + 4;
  const preview = await balanceSong(path, { bars: "1:2", targets: [{ track: "bass", db: target }] });
  assert.equal(await readFile(path, "utf8"), source); assert.equal(row(preview.rows, "bass").applied, false);
  const report = await balanceSong(path, { bars: "1:2", targets: [{ track: "bass", db: target }], apply: true });
  close(row(report.after!, "bass").rmsDb!, target);
  assert.equal(row(report.rows, "bass").applied, true); close(report.changes[0]!.after, -8, 0.01);
  const changed = JSON.parse(await readFile(path, "utf8")) as Song;
  assert.deepEqual(changed, { ...raw, tracks: raw.tracks.map((track) => track.id === "bass" ? { ...track, gain: report.changes[0]!.after } : track) });
  assert.ok((await readFile(path, "utf8")).endsWith("\n"));
  const second = await balanceSong(path, { bars: "1:2", targets: [{ track: "bass", db: target }], apply: true });
  assert.ok(second.changes.every((change) => Math.abs(change.after - change.before) < 0.5));
  assert.deepEqual(await readdir(dir), ["song.json"]);
});

test("two relative track targets land within 0.5 dB and reference is read-only", async (t) => {
  const { path } = await setup(t);
  const options = { section: "drop", reference: "ref", targets: [{ track: "bass", db: -2 }, { track: "other", db: -8 }], apply: true };
  const report = await balanceSong(path, options);
  close(relative(report, "bass", "ref"), -2); close(relative(report, "other", "ref"), -8);
  assert.ok(report.changes.every((change) => change.track !== "ref"));
  await assert.rejects(balanceSong(path, { ...options, targets: [{ track: "ref", db: 0 }] }), { code: "E_INPUT" });
  const second = await balanceSong(path, options);
  assert.ok(second.changes.every((change) => Math.abs(change.after - change.before) < 0.5));
});

test("layer gains use their own main; repeated layer ids and simultaneous parent target", async (t) => {
  const raw = fixture(true), { path } = await setup(t, raw);
  const options = { bars: "1:2", reference: "ref", targets: [
    { track: "bass", layer: "copy", db: -7 }, { track: "other", layer: "copy", db: -4 }, { track: "bass", db: -2 }], apply: true };
  const preview = await balanceSong(path, { ...options, apply: false });
  const report = await balanceSong(path, options);
  assert.deepEqual(report.changes, preview.changes);
  assert.deepEqual(report.rows.map((row) => row.id), ["ref", "bass", "bass.main", "bass.copy", "other", "other.main", "other.copy"]);
  close(relative(report, "bass.copy", "bass.main"), -7); close(relative(report, "other.copy", "other.main"), -4);
  close(relative(report, "bass", "ref"), -2);
  close(report.changes[0]!.before, -3); close(report.changes[0]!.after, -7, 0.01);
  const second = await balanceSong(path, options);
  assert.ok(second.changes.every((change) => Math.abs(change.after - change.before) < 0.5));
});

test("layer-only apply changes just the selected layer gain", async (t) => {
  const raw = fixture(true), { path } = await setup(t, raw);
  const report = await balanceSong(path, { section: "drop", targets: [{ track: "bass", layer: "copy", db: -9 }], apply: true });
  assert.equal(report.changes.length, 1); assert.equal(report.changes[0]!.path, "$.tracks[1].layers[0].gain");
  raw.tracks[1]!.layers![0]!.gain = report.changes[0]!.after;
  assert.deepEqual(JSON.parse(await readFile(path, "utf8")), raw);
});

test("gain automation skips track but leaves its layer editable in a nonzero window", async (t) => {
  const raw = fixture(true);
  raw.tracks[1]!.automation = [{ target: "gain", points: [{ at: 0, value: -12 }, { at: 12, value: -12 }] }];
  const { path } = await setup(t, raw);
  const report = await balanceSong(path, { bars: "1:2", targets: [
    { track: "bass", db: -10 }, { track: "bass", layer: "copy", db: -9 }], apply: true });
  assert.equal(row(report.rows, "bass").skipped, "gain automation");
  assert.equal(report.changes.length, 1); assert.equal(report.changes[0]!.layer, "copy");
  assert.equal((JSON.parse(await readFile(path, "utf8")) as Song).tracks[1]!.gain, -12);
  close(relative(report, "bass.copy", "bass.main"), -9);
});

test("silent target and silent reference rules", async (t) => {
  const { path, source } = await setup(t, fixture(true));
  const report = await balanceSong(path, { section: "intro", targets: [{ track: "bass", db: -10 }], apply: true });
  assert.equal(row(report.rows, "bass").skipped, "silent in window"); assert.equal(report.changes.length, 0);
  assert.equal(await readFile(path, "utf8"), source);
  await assert.rejects(balanceSong(path, { section: "intro", targets: [], reference: "bass" }), { code: "E_INPUT" });
});

test("silent main skips an audible layer and preserves bytes and mtime", async (t) => {
  const raw = fixture(true);
  raw.tracks[1]!.instrument = "organ";
  raw.tracks[1]!.params = { d16: 0, d513: 0, d8: 0 };
  raw.tracks[1]!.velocity = 0.1;
  // All drawbars off: the main key click is below the gate while the bass layer is audible.
  const { path, source } = await setup(t, raw), before = await stat(path);
  const report = await balanceSong(path, { bars: "1:2", targets: [{ track: "bass", layer: "copy", db: -9 }], apply: true });
  assert.equal(row(report.rows, "bass.main").rmsDb, null);
  assert.notEqual(row(report.rows, "bass.copy").rmsDb, null);
  assert.equal(row(report.rows, "bass.copy").skipped, "main silent in window");
  assert.ok(report.warnings.some((warning) => warning.includes("main silent in window")));
  assert.equal(await readFile(path, "utf8"), source); assert.equal((await stat(path)).mtimeMs, before.mtimeMs);
});

test("maxStep negative or nonfinite rejected, zero no rewrite, actual gain and step clamping", async (t) => {
  const { path, source } = await setup(t), before = await stat(path);
  for (const maxStep of [-1, Number.NaN, Number.POSITIVE_INFINITY])
    await assert.rejects(balanceSong(path, { targets: [{ track: "bass", db: -1 }], maxStep }), { code: "E_INPUT" });
  const report = await balanceSong(path, { section: "drop", targets: [{ track: "bass", db: 1 }], maxStep: 0, apply: true });
  assert.equal(report.changes.length, 0); assert.equal(row(report.rows, "bass").deltaDb, 0);
  assert.equal(await readFile(path, "utf8"), source); assert.equal((await stat(path)).mtimeMs, before.mtimeMs);
  const song = validateSong(fixture()), rows = (await measureSong(song, path, resolveWindow(song, buildTimeline(song), { section: "drop" }))).rows;
  const planned = planChanges(song, rows, [{ track: "bass", db: 50 }], { maxStep: 2 });
  assert.equal(planned.changes[0]!.after, -10); assert.equal(row(planned.rows, "bass").deltaDb, 2);
  const upper = planChanges(song, rows, [{ track: "bass", db: 50 }], { maxStep: 100 });
  assert.equal(upper.changes[0]!.after, 12); assert.equal(row(upper.rows, "bass").deltaDb, 24);
  const lower = planChanges(song, rows, [{ track: "bass", db: -100 }], { maxStep: 100 });
  assert.equal(lower.changes[0]!.after, -60); assert.equal(row(lower.rows, "bass").deltaDb, -48);
});

test("exact target and measurement-only apply retain file bytes and mtime", async (t) => {
  const { path, source } = await setup(t), before = await stat(path);
  const measured = await balanceSong(path, { section: "drop", targets: [], apply: true });
  const report = await balanceSong(path, { section: "drop", targets: [{ track: "bass", db: row(measured.rows, "bass").rmsDb! }], apply: true });
  assert.equal(report.changes.length, 0); assert.equal(report.after, undefined);
  assert.equal(await readFile(path, "utf8"), source); assert.equal((await stat(path)).mtimeMs, before.mtimeMs);
});

test("unknown ids, main targets, invalid dB, audio targets and loops return E_INPUT", async (t) => {
  const { path } = await setup(t, fixture(true));
  for (const target of [{ track: "missing", db: 0 }, { track: "bass", layer: "missing", db: 0 },
    { track: "bass", layer: "main", db: 0 }, { track: "bass", db: Number.NaN }])
    await assert.rejects(balanceSong(path, { targets: [target] }), { code: "E_INPUT" });
  await assert.rejects(balanceSong(path, { targets: [], reference: "missing" }), { code: "E_INPUT" });
  const raw = fixture(); raw.loop = true; await writeFile(path, JSON.stringify(raw));
  await assert.rejects(balanceSong(path, { targets: [] }), { code: "E_INPUT" });
  const song = validateSong(fixture());
  song.audioTracks = [{ id: "audio", gain: 0, pan: 0, sends: { reverb: 0, delay: 0 }, fx: [], duck: null, clips: [] }];
  assert.throws(() => planChanges(song, [], [{ track: "audio", db: -10 }]), { code: "E_INPUT" });
});

test("later duplicate targets override earlier ones", async (t) => {
  const { path } = await setup(t);
  const report = await balanceSong(path, { section: "drop", reference: "ref", targets: [{ track: "bass", db: -3 }, { track: "bass", db: -9 }], apply: true });
  assert.equal(report.changes.length, 1); close(relative(report, "bass", "ref"), -9);
});

test("applyChanges edits specified gains only and uses two-space JSON plus newline", () => {
  const raw = fixture(true);
  const updated = applyChanges(JSON.stringify(raw), [{ track: "bass", layer: "copy", path: "$.tracks[1].layers[0].gain", before: -3, after: -7 }]);
  raw.tracks[1]!.layers![0]!.gain = -7;
  assert.equal(updated, JSON.stringify(raw, null, 2) + "\n");
});

test("render warnings survive measurement and apply reports", async (t) => {
  const raw = fixture(true);
  raw.tracks[1]!.pattern = "c8*4"; raw.tracks[1]!.layers![0]!.transpose = 36;
  const { path } = await setup(t, raw);
  const report = await balanceSong(path, { section: "drop", targets: [{ track: "bass", db: -40 }], apply: true });
  assert.ok(report.after);
  assert.ok(report.warnings.includes("LAYER_NOTES_DROPPED:bass.copy:4"));
  assert.equal(report.warnings.filter((warning) => warning.startsWith("LAYER_NOTES_DROPPED:")).length, 1);
});

test("measurement uses render validation and failed validation cannot rewrite source", async (t) => {
  const raw = fixture(); raw.tracks[1]!.params = { wave: 99 };
  const { path, source } = await setup(t, raw);
  await assert.rejects(balanceSong(path, { targets: [{ track: "bass", db: -30 }], apply: true }), { code: "E_SCHEMA" });
  assert.equal(await readFile(path, "utf8"), source);
});
