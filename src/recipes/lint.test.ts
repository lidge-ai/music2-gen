import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Music2Error, packageRoot } from "../shared/index.ts";
import { lintSong } from "./lint.tool.ts";

const fixture = (name: string): unknown => JSON.parse(readFileSync(join(packageRoot(), "examples", name), "utf8")) as unknown;
const base = () => ({ version: 1 as const, bpm: 140, genre: "drill_uk", key: "C minor", swing: .5, tracks: [
  { id: "kick", kind: "drums", instrument: "drums", swing: false, pattern: "bd ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~" },
  { id: "snare", kind: "drums", instrument: "drums", swing: false, pattern: "~ ~ ~ ~ ~ ~ ~ ~ sd ~ ~ ~ ~ ~ ~ ~" },
  { id: "hats", kind: "drums", instrument: "drums", swing: false, pattern: "hh ~ hh ~ hh ~ hh ~ hh ~ hh ~ hh ~ hh ~" },
  { id: "bass", kind: "notes", instrument: "808", mono: true, swing: false, pattern: "c2 ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~" }],
  sections: [{ id: "hook", bars: 4, role: "hook", patterns: {} as Record<string, string | null> }], arrangement: [{ section: "hook" }] });
const ids = (song: unknown, options?: { genre?: string }): string[] => lintSong(song, options).results.map((result) => result.id);

test("layering findings are wired, sorted, and carry actionable fields", () => {
  const report = lintSong({ version: 1, bpm: 120, genre: "house", tracks: [
    { id: "drums", kind: "drums", instrument: "drums", pattern: "bd ~ ~ ~" },
    { id: "bass", kind: "notes", instrument: "bass", pan: 0.2, pattern: "22 ~ ~ ~" },
    { id: "keys", kind: "notes", instrument: "keys", mono: false, gate: 1, pattern: "[40,41] ~ ~ ~" },
    { id: "lead", kind: "notes", instrument: "lead", pattern: "47 ~ ~ ~" },
  ], sections: [{ id: "groove", bars: 2, role: "groove" }], arrangement: [{ section: "groove" }] });
  const layering = report.results.filter((row) => ["low_end_overlap", "low_chord_spacing", "low_pan",
    "kick_bass_unducked", "register_collision", "sub_floor"].includes(row.id.split("/")[1]!));
  assert.deepEqual(layering.map((row) => row.id), ["generic/kick_bass_unducked", "generic/low_chord_spacing",
    "generic/low_end_overlap", "generic/low_pan", "generic/register_collision", "generic/sub_floor"]);
  for (const row of layering) {
    assert.equal(row.severity, "warning");
    assert.ok(row.path && String(row.observed) && String(row.expected) && row.fix);
  }
  assert.equal(report.warnings, report.results.filter((row) => row.severity === "warning").length);
});

test("drill example has zero UK drill warnings and wrong-genre names tempo/backbeat", () => {
  const drill = lintSong(fixture("drill-140.song.json"));
  assert.deepEqual(drill.results.filter((result) => result.id.startsWith("drill_uk/")), []);
  const wrong = lintSong(fixture("wrong-genre.song.json"));
  assert.ok(ids(fixture("wrong-genre.song.json")).includes("drill_uk/1"));
  assert.ok(wrong.results.some((result) => result.id === "drill_uk/2"));
  assert.ok(ids(fixture("wrong-genre.song.json"), { genre: "house" }).every((id) => !id.startsWith("drill_uk/")));
});

test("UK drill moving snare: step 13 counts only without a step-5 backbeat", () => {
  const moving = base();
  moving.tracks[1]!.pattern = "<[~ ~ ~ ~ ~ ~ ~ ~ sd ~ ~ ~ ~ ~ ~ ~] [~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ sd ~ ~ ~]>";
  assert.ok(!ids(moving).includes("drill_uk/2"));
  const backbeat = base();
  backbeat.tracks[1]!.pattern = "~ ~ ~ ~ sd ~ ~ ~ ~ ~ ~ ~ sd ~ ~ ~";
  assert.ok(ids(backbeat).includes("drill_uk/2"));
});

test("75% step-9 boundary and muted intro exclusion", () => {
  const song = base();
  song.sections = Array.from({ length: 4 }, (_, i) => ({ id: `s${i}`, bars: 1, role: "hook", patterns: { snare: i === 0 ? "~" : song.tracks[1]!.pattern } }));
  song.arrangement = song.sections.map((section) => ({ section: section.id }));
  assert.ok(!ids(song).includes("drill_uk/2"));
  song.sections[1]!.patterns.snare = "~";
  assert.ok(ids(song).includes("drill_uk/2"));
  const intro = { ...base(), sections: [{ id: "intro", bars: 2, role: "intro", patterns: { snare: null } }, { id: "hook", bars: 2, role: "hook", patterns: {} }], arrangement: [{ section: "intro" }, { section: "hook" }] };
  assert.ok(!ids(intro).includes("drill_uk/2"));
});

test("zero eligible bars omit fraction checks", () => {
  const song = base(); song.sections = [{ id: "intro", bars: 1, role: "intro", patterns: {} }]; song.arrangement = [{ section: "intro" }];
  assert.ok(!ids(song).includes("drill_uk/2"));
  assert.ok(!ids(song).includes("drill_uk/3"));
});

test("SFX cannot satisfy house groove while drums and kit tracks retain it", () => {
  const song = { version: 1 as const, bpm: 124, genre: "house",
    tracks: [{ id: "fx", kind: "drums" as const, instrument: "sfx", pattern: "bd*4" }],
    sections: [{ id: "groove", bars: 1, role: "groove" }], arrangement: [{ section: "groove" }] };
  assert.ok(ids(song).includes("house/2"));
  for (const instrument of ["drums", "kit:custom"]) {
    const withKit = { ...song, tracks: [...song.tracks,
      { id: "kick", kind: "drums" as const, instrument, pattern: "bd*4" }] };
    assert.ok(!ids(withKit).includes("house/2"));
  }
});

test("parse-only result retains path/offset and other schema error still throws", () => {
  const song = base(); song.tracks[0]!.pattern = "[bd";
  const report = lintSong(song);
  assert.equal(report.barsChecked, 0); assert.equal(report.errors, 1);
  assert.equal(report.results[0]?.id, "generic/pattern_parse");
  assert.equal(report.results[0]?.path, "$.tracks[0].pattern");
  assert.match(String(report.results[0]?.observed), /offset/);
  song.bpm = 500;
  assert.throws(() => lintSong(song), (error: unknown) => error instanceof Music2Error && error.code === "E_SCHEMA" && error.exit === 2);
});

test("generic key, empty track, polyphony, clipping and unknown genre", () => {
  const song = base(); song.genre = "unlisted";
  song.tracks[3]!.pattern = "[c2,e2]";
  song.tracks.push({ id: "empty", kind: "notes", instrument: "bass", swing: false, pattern: "~" });
  const found = ids(song);
  for (const id of ["generic/unknown_genre", "generic/out_of_key", "generic/808_polyphony", "generic/empty_track", "generic/clipping_risk"]) assert.ok(found.includes(id), id);
  assert.throws(() => lintSong(song, { genre: "unlisted" }), (error: unknown) => error instanceof Music2Error && error.code === "E_NOT_FOUND");
});

test("lofi 70% backbeat threshold passes seven bars and fails six", () => {
  const song = base(); song.genre = "lofi_hiphop"; song.bpm = 75;
  song.tracks[1]!.pattern = "~ ~ ~ ~ sd ~ ~ ~ ~ ~ ~ ~ sd ~ ~ ~";
  song.sections = Array.from({ length: 10 }, (_, i) => ({ id: `s${i}`, bars: 1, role: "groove", patterns: { snare: i < 7 ? song.tracks[1]!.pattern : "~" } }));
  song.arrangement = song.sections.map((section) => ({ section: section.id }));
  assert.ok(!ids(song).includes("lofi_hiphop/2"));
  song.sections[6]!.patterns.snare = "~";
  assert.ok(ids(song).includes("lofi_hiphop/2"));
});

test("short-hat counts and 32nd roll majority have opposite threshold behavior", () => {
  const song = base();
  const roll = `hh ${Array(31).fill("~").join(" ")}`;
  song.sections = Array.from({ length: 4 }, (_, i) => ({ id: `s${i}`, bars: 1, role: "hook", patterns: { hats: i < 2 ? roll : song.tracks[2]!.pattern } }));
  song.arrangement = song.sections.map((section) => ({ section: section.id }));
  assert.ok(!ids(song).includes("drill_uk/4"));
  song.sections[1]!.patterns.hats = song.tracks[2]!.pattern;
  assert.ok(ids(song).includes("drill_uk/4"));
  song.genre = "boom_bap"; song.bpm = 90; song.swing = .58;
  song.tracks[2] = { ...song.tracks[2]!, swing: true };
  song.sections[1]!.patterns.hats = roll;
  assert.ok(!ids(song).includes("boom_bap/4"));
  song.sections[2]!.patterns.hats = roll;
  assert.ok(ids(song).includes("boom_bap/4"));
});

test("UK drill 808 transition threshold and generic scale check", () => {
  const song = base(); song.sections[0]!.bars = 8;
  assert.ok(ids(song).includes("drill_uk/6"));
  song.tracks[3]!.pattern = "c2 ~ ~ ~ eb2 ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~";
  assert.ok(!ids(song).includes("drill_uk/6"));
  song.tracks[3]!.pattern = "e2 ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~";
  assert.ok(ids(song).includes("drill_uk/7"));
});

test("Brooklyn hook and phrase checks detect absent 808, motif, and variation", () => {
  const song = base(); song.genre = "drill_ny"; song.bpm = 142;
  song.tracks.push({ id: "melody", kind: "notes", instrument: "bell", swing: false, pattern: "c5 ~ ~ ~" });
  song.sections[0]!.bars = 16;
  const found = ids(song);
  assert.ok(found.includes("drill_ny/5"));
  assert.ok(found.includes("drill_ny/7"));
  song.sections[0]!.patterns.bass = null;
  assert.ok(ids(song).includes("drill_ny/3"));
});

test("house outro and techno breakdown/density are section-aware", () => {
  const song = base(); song.genre = "house"; song.bpm = 124;
  song.tracks[0]!.pattern = "bd ~ ~ ~ bd ~ ~ ~ bd ~ ~ ~ bd ~ ~ ~";
  song.tracks[1]!.pattern = "~ ~ ~ ~ cp ~ ~ ~ ~ ~ ~ ~ cp ~ ~ ~";
  song.tracks[2]!.pattern = "~ ~ oh ~ ~ ~ oh ~ ~ ~ oh ~ ~ ~ oh ~";
  song.sections = [{ id: "groove", bars: 16, role: "groove", patterns: {} }, { id: "outro", bars: 4, role: "outro", patterns: {} }];
  song.arrangement = [{ section: "groove" }, { section: "outro" }];
  assert.ok(ids(song).includes("house/7"));
  song.sections[1]!.patterns.bass = null;
  assert.ok(!ids(song).includes("house/7"));
  song.genre = "techno"; song.bpm = 130;
  song.sections[1]!.role = "breakdown";
  song.sections[1]!.patterns.bass = song.tracks[3]!.pattern;
  assert.ok(ids(song).includes("techno/5"));
  assert.ok(ids(song).includes("techno/4"));
});

test("UK and Brooklyn drill report missing kick, 808, and hook motif by rule id", () => {
  const uk = base();
  uk.sections[0]!.bars = 8;
  uk.tracks[0]!.pattern = "~";
  uk.tracks[3]!.instrument = "bass";
  const ukIds = ids(uk);
  assert.ok(ukIds.includes("drill_uk/3"));
  assert.ok(ukIds.includes("drill_uk/5"));
  const ny = base(); ny.genre = "drill_ny"; ny.bpm = 142;
  ny.tracks[3]!.mono = false;
  ny.sections[0]!.patterns.bass = null;
  assert.ok(ids(ny).includes("drill_ny/4"));
  assert.ok(ids(ny).includes("drill_ny/6"));
});

test("trap reports hat, scale and 808 failures; adjacent verse can outrank hook", () => {
  const song = base(); song.genre = "trap";
  song.tracks[1]!.pattern = "~ ~ ~ ~ sd ~ ~ ~ ~ ~ ~ ~ sd ~ ~ ~";
  song.tracks[2]!.pattern = "~";
  song.tracks[3]!.pattern = "e2 ~ ~ ~";
  song.tracks[3]!.mono = false;
  song.tracks.push({ id: "melody", kind: "notes", instrument: "bell", swing: false, pattern: "c5 ~ ~ ~" });
  song.sections = [{ id: "verse", bars: 4, role: "verse", patterns: {} }, { id: "hook", bars: 4, role: "hook", patterns: { melody: null } }];
  song.arrangement = [{ section: "verse" }, { section: "hook" }];
  const found = ids(song);
  for (const id of ["trap/2", "trap/3", "trap/4", "trap/5", "trap/6", "trap/7"]) assert.ok(found.includes(id), id);
  assert.ok(!found.includes("generic/no_density_contrast"));
});

test("genre density findings suppress the matching generic warning only", () => {
  const song = base(); song.genre = "house"; song.bpm = 124;
  song.sections = [{ id: "breakdown", bars: 8, role: "breakdown", patterns: {} },
    { id: "groove", bars: 16, role: "groove", patterns: {} }];
  song.arrangement = [{ section: "breakdown" }, { section: "groove" }];
  const house = ids(song);
  assert.ok(house.includes("house/6"));
  // house/6 is an 8-bar phrase rule; a flat groove-vs-breakdown contrast is a separate cause and stays visible.
  assert.ok(house.includes("generic/no_density_contrast"));
  song.genre = "techno"; song.bpm = 130;
  const techno = ids(song);
  assert.ok(techno.includes("techno/5"));
  assert.ok(!techno.includes("generic/no_density_contrast"));
  assert.ok(techno.includes("generic/clipping_risk"));
});

test("boom-bap and lo-fi report swing, melody loop, and clipping proxies", () => {
  const song = base(); song.genre = "boom_bap"; song.bpm = 90;
  song.tracks[3]!.instrument = "bass";
  song.tracks[3]!.pattern = "e2 ~ ~ ~";
  song.tracks[2]!.pattern = "hh*32";
  song.sections[0]!.bars = 8;
  const boom = ids(song);
  for (const id of ["boom_bap/2", "boom_bap/3", "boom_bap/4", "boom_bap/5", "boom_bap/6", "boom_bap/7"]) assert.ok(boom.includes(id), id);
  song.genre = "lofi_hiphop"; song.bpm = 75;
  const lofi = ids(song);
  for (const id of ["lofi_hiphop/2", "lofi_hiphop/3", "lofi_hiphop/4", "lofi_hiphop/5", "lofi_hiphop/6"]) assert.ok(lofi.includes(id), id);
});

test("house reports offbeat, harmony, density and outro findings", () => {
  const song = base(); song.genre = "house"; song.bpm = 124;
  song.tracks[2]!.pattern = "~";
  song.tracks[3]!.instrument = "bass";
  song.tracks[3]!.pattern = "e2 ~ ~ ~";
  song.sections = [{ id: "groove", bars: 16, role: "groove", patterns: {} }, { id: "outro", bars: 4, role: "outro", patterns: {} }];
  song.arrangement = [{ section: "groove" }, { section: "outro" }];
  const found = ids(song);
  for (const id of ["house/2", "house/3", "house/4", "house/5", "house/6", "house/7"]) assert.ok(found.includes(id), id);
});

test("techno reports absent repeating bass, unchanged windows, breakdown and static risk", () => {
  const song = base(); song.genre = "techno"; song.bpm = 130;
  song.tracks[3]!.instrument = "bass";
  song.tracks[3]!.pattern = "<c2 d2 e2 f2>";
  song.sections = [{ id: "groove", bars: 16, role: "groove", patterns: {} }, { id: "breakdown", bars: 4, role: "breakdown", patterns: {} }];
  song.arrangement = [{ section: "groove" }, { section: "breakdown" }];
  const found = ids(song);
  for (const id of ["techno/2", "techno/3", "techno/4", "techno/5", "techno/6"]) assert.ok(found.includes(id), id);
});
