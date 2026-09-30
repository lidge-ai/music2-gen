import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { buildTimeline, validateSong } from "../song/index.ts";
import type { Song } from "../song/index.ts";
import { createGeometry } from "./lint-geometry.tool.ts";
import { thinPeakLayerRules } from "./lint-layers.tool.ts";
import { lintSong } from "./lint.tool.ts";

const ROOT = fileURLToPath(new URL("../../", import.meta.url));
const bass: Song["tracks"][number] = {
  id: "low", kind: "notes", instrument: "bass", pattern: "a1 ~ e2 ~", mono: true, gain: -12,
};
function source(tracks: Song["tracks"] = [{ ...bass }]): Song {
  return { version: 1, bpm: 124, seed: 12401, tracks,
    sections: [{ id: "drop", bars: 1, role: "groove" }], arrangement: [{ section: "drop" }] };
}
function findings(input: Song) {
  const song = validateSong(input);
  return thinPeakLayerRules(createGeometry(song, buildTimeline(song)));
}

test("unlayered bass in a groove gets one info without full rhythm bars", () => {
  const song = validateSong(source());
  const g = createGeometry(song, buildTimeline(song));
  assert.deepEqual(g.full, []);
  const rows = thinPeakLayerRules(g);
  assert.equal(rows.length, 1);
  assert.deepEqual({ ...rows[0], fix: undefined }, {
    id: "generic/thin_peak_layers", severity: "info", path: "tracks[0]",
    observed: "no layers in drop", expected: ">=1 layer", fix: undefined,
  });
  assert.match(rows[0]!.fix, /track.*layers/);
  assert.deepEqual(lintSong(source()).results, rows);
});

test("an existing stack suppresses info while empty layers remain unlayered", () => {
  assert.deepEqual(findings(source([{ ...bass, layers: [{ id: "mid", instrument: "bass", transpose: 12 }] }])), []);
  assert.equal(findings(source([{ ...bass, layers: [] }])).length, 1);
});

test("no hook or groove placement means no thin-layer infos", () => {
  const song = source();
  song.sections[0]!.role = "verse";
  song.sections.push({ id: "unused", bars: 1, role: "hook" });
  assert.deepEqual(findings(song), []);
});

test("muted peak overrides and zero-velocity events do not count as audible", () => {
  const muted = source();
  muted.sections[0]!.patterns = { low: null };
  assert.deepEqual(findings(muted), []);
  assert.deepEqual(findings(source([{ id: "low", kind: "notes", instrument: "bass", mono: true,
    notes: [{ start: 0, length: 1, pitch: 33, velocity: 0 }] }])), []);
});

test("one info lists unique audible peak ids in arrangement order", () => {
  const song = source();
  song.sections = [{ id: "second", bars: 1, role: "hook" }, { id: "first", bars: 1, role: "groove" },
    { id: "quiet", bars: 1, role: "hook", patterns: { low: null } }];
  song.arrangement = [{ section: "first" }, { section: "second" }, { section: "first" }, { section: "quiet" }];
  assert.equal(findings(song).length, 1);
  assert.equal(findings(song)[0]!.observed, "no layers in first, second");
});

test("kick/backbeat roles come from audible peak atoms, not ids or non-peak events", () => {
  const song = source([
    { id: "kit", kind: "drums", instrument: "drums", pattern: "bd sd cp" },
    { id: "kick", kind: "drums", instrument: "drums", pattern: "hh*4" },
    { id: "fx", kind: "drums", instrument: "sfx", pattern: "bd sd cp" },
    { id: "snare", kind: "drums", instrument: "drums", pattern: "sd", velocity: 0 },
    { id: "outside", kind: "drums", instrument: "drums", pattern: "bd" },
  ]);
  song.sections[0]!.patterns = { outside: "hh" };
  song.sections.push({ id: "intro", bars: 1, role: "intro" });
  song.arrangement.unshift({ section: "intro" });
  assert.deepEqual(findings(song).map((row) => row.path), ["tracks[0]"]);
});

test("snare and clap qualify without kick; both bass instruments qualify", () => {
  const song = source([
    { id: "snare", kind: "drums", instrument: "drums", pattern: "sd" },
    { id: "clap", kind: "drums", instrument: "drums", pattern: "cp" },
    bass, { ...bass, id: "sub", instrument: "808" },
  ]);
  assert.deepEqual(findings(song).map((row) => row.path), ["tracks[0]", "tracks[1]", "tracks[2]", "tracks[3]"]);
});

test("only the first melody candidate audible in any peak qualifies, including user notes", () => {
  const song = source([
    { id: "intro-lead", kind: "notes", instrument: "lead", pattern: "c5" },
    { id: "sample-lead", kind: "notes", instrument: "user:pitched", pattern: "c5" },
    { id: "second-lead", kind: "notes", instrument: "bell", pattern: "c6" },
    { id: "bed", kind: "notes", instrument: "pad", pattern: "c4" },
  ]);
  song.sections[0]!.patterns = { "intro-lead": null };
  song.sections.push({ id: "intro", bars: 1, role: "intro" });
  song.arrangement.unshift({ section: "intro" });
  assert.deepEqual(findings(song).map((row) => row.path), ["tracks[1]"]);
  song.tracks[1]!.layers = [{ id: "double", instrument: "lead", transpose: 12 }];
  assert.deepEqual(findings(song), []);
});

test("kit and user drums keep kick roles through strict CLI lint", (t) => {
  const directory = mkdtempSync(join(tmpdir(), "music2-thin-kit-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const home = join(directory, "home");
  for (const kit of [join(directory, "kit"), join(home, "instruments", "custom")]) {
    mkdirSync(kit, { recursive: true });
    writeFileSync(join(kit, "kit.json"), JSON.stringify({ version: 1, samples: { bd: ["bd.wav"], cp: ["cp.wav"] } }));
  }
  for (const instrument of ["kit:kit", "user:custom"]) {
    const song = source([{ id: "custom", kind: "drums", instrument, pattern: "bd", gain: -12 }]);
    const path = join(directory, "kit.song.json");
    writeFileSync(path, JSON.stringify(song));
    const run = spawnSync(process.execPath, [join(ROOT, "src/cli/index.ts"), "lint", path, "--strict", "--json"],
      { cwd: directory, encoding: "utf8", env: { ...process.env, MUSIC2_HOME: home, MUSIC2_JSON: "0" }, timeout: 90_000 });
    assert.ifError(run.error);
    assert.equal(run.status, 0, run.stdout + run.stderr);
    const body = JSON.parse(run.stdout) as { ok: boolean; data: ReturnType<typeof lintSong> };
    assert.equal(body.ok, true);
    assert.deepEqual([body.data.errors, body.data.warnings, body.data.infos], [0, 0, 1]);
    assert.equal(body.data.results[0]!.path, "tracks[0]");
  }
});

test("strict CLI exits zero with only bass layer infos and one JSON object", (t) => {
  const directory = mkdtempSync(join(tmpdir(), "music2-thin-strict-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const path = join(directory, "bass.song.json");
  writeFileSync(path, JSON.stringify(source()));
  const run = spawnSync(process.execPath, [join(ROOT, "src/cli/index.ts"), "lint", path, "--strict", "--json"],
    { cwd: ROOT, encoding: "utf8", env: { ...process.env, MUSIC2_HOME: directory, MUSIC2_JSON: "0" }, timeout: 90_000 });
  assert.ifError(run.error);
  assert.equal(run.status, 0, run.stdout + run.stderr);
  assert.equal(run.stderr, "");
  assert.equal(run.stdout.trim().split("\n").length, 1);
  const body = JSON.parse(run.stdout) as { ok: boolean; data: ReturnType<typeof lintSong> };
  assert.equal(body.ok, true);
  assert.deepEqual([body.data.errors, body.data.warnings, body.data.infos], [0, 0, 1]);
  assert.equal(body.data.results[0]!.id, "generic/thin_peak_layers");
});
