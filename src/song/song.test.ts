import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { packageRoot, Music2Error } from "../shared/index.ts";
import { SONG_JSON_SCHEMA, validateSong } from "./song.schema.ts";

const fixture = () => JSON.parse(readFileSync(join(packageRoot(), "examples/minimal.song.json"), "utf8")) as Record<string, unknown>;
function issues(input: unknown): { path: string; message: string }[] {
  try { validateSong(input); assert.fail("expected E_SCHEMA"); }
  catch (error) {
    assert.ok(error instanceof Music2Error);
    assert.equal(error.code, "E_SCHEMA");
    return error.details?.["issues"] as { path: string; message: string }[];
  }
}

void test("published schema bytes match the in-code draft 2020-12 contract", () => {
  assert.equal(readFileSync(join(packageRoot(), "schema/song.v1.json"), "utf8"), `${JSON.stringify(SONG_JSON_SCHEMA, null, 2)}\n`);
});

void test("resolved defaults fill every optional output field", () => {
  const song = validateSong({ version: 1, bpm: 120,
    tracks: [{ id: "kick", kind: "drums", instrument: "drums" }, { id: "bass", kind: "notes", instrument: "808" }],
    sections: [{ id: "a", bars: 1 }], arrangement: [{ section: "a" }] });
  assert.deepEqual({ title: song.title, genre: song.genre, meter: song.meter, key: song.key,
    seed: song.seed, swing: song.swing, sampleRate: song.sampleRate, tailSeconds: song.tailSeconds, master: song.master },
  { title: "untitled", genre: null, meter: { numerator: 4, denominator: 4 }, key: null,
    seed: 1, swing: 0.5, sampleRate: 44100, tailSeconds: 2,
    master: { gainDb: 0, ceilingDb: -1, targetLufs: null } });
  assert.deepEqual(song.tracks[0], { id: "kick", kind: "drums", instrument: "drums", pattern: null,
    velocity: 0.8, gain: 0, pan: 0, gate: 0.9, mono: false, glide: 0, transpose: 0,
    swing: false, sends: { reverb: 0, delay: 0 }, duck: null, params: {} });
  assert.equal(song.tracks[1]?.mono, true);
  assert.deepEqual(song.sections[0], { id: "a", bars: 1, role: null, patterns: {} });
  assert.deepEqual(song.arrangement, [{ section: "a", repeats: 1 }]);
});

void test("all schema issues are collected, including unknown keys at nested levels", () => {
  const song = fixture(); song["bpm"] = 3; song["foo"] = 1;
  const tracks = song["tracks"] as Record<string, unknown>[]; tracks[0]!["mystery"] = true;
  const paths = issues(song).map((issue) => issue.path);
  assert.ok(paths.includes("$.bpm"));
  assert.ok(paths.includes("$.foo"));
  assert.ok(paths.includes("$.tracks[0].mystery"));
});

void test("cross references include arrangement, section patterns and duck source", () => {
  const song = fixture();
  (song["arrangement"] as Record<string, unknown>[])[0]!["section"] = "missing";
  (song["sections"] as Record<string, unknown>[])[0]!["patterns"] = { ghost: "[bd" };
  (song["tracks"] as Record<string, unknown>[])[0]!["duck"] = { by: "drums", amount: 0.5 };
  const paths = issues(song).map((issue) => issue.path);
  assert.ok(paths.includes("$.arrangement[0].section"));
  assert.ok(paths.includes("$.sections[0].patterns.ghost"));
  assert.ok(issues(song).some((item) => item.path === "$.sections[0].patterns.ghost" && /offset/.test(item.message)));
  assert.ok(paths.includes("$.tracks[0].duck.by"));
});

void test("pattern syntax and atom errors carry their exact source path", () => {
  const song = fixture();
  const tracks = song["tracks"] as Record<string, unknown>[];
  tracks[0]!["pattern"] = "[bd";
  tracks[1]!["pattern"] = "c";
  const found = issues(song);
  assert.ok(found.some((item) => item.path === "$.tracks[0].pattern" && /offset/.test(item.message)));
  assert.ok(found.some((item) => item.path === "$.tracks[1].pattern" && /octave/.test(item.message)));
});

void test("drum patterns reject notes and note patterns reject drum names", () => {
  const song = fixture();
  const tracks = song["tracks"] as Record<string, unknown>[];
  tracks[0]!["pattern"] = "c4";
  tracks[1]!["pattern"] = "bd";
  const paths = issues(song).map((item) => item.path);
  assert.ok(paths.includes("$.tracks[0].pattern"));
  assert.ok(paths.includes("$.tracks[1].pattern"));
});

void test("each published top-level property is accepted by validation", () => {
  const song = fixture();
  Object.assign(song, { genre: "test", meter: { numerator: 4, denominator: 4 }, seed: 0, swing: 0.5,
    sampleRate: 48000, tailSeconds: 0, master: { gainDb: 0, ceilingDb: -1, targetLufs: -14 } });
  assert.deepEqual(Object.keys(SONG_JSON_SCHEMA.properties).sort(), Object.keys(song).sort());
  assert.equal(validateSong(song).sampleRate, 48000);
});
