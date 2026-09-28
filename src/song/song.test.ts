import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { packageRoot, Music2Error } from "../shared/index.ts";
import { SONG_JSON_SCHEMA, validateSong } from "./song.schema.ts";

const fixture = () => JSON.parse(readFileSync(join(packageRoot(), "examples/minimal.song.json"), "utf8")) as Record<string, unknown>;
const preSchema = join(packageRoot(), "tests/fixtures/daw-legacy/song.v1.pre.json");
function oldSchemaUnchanged(before: unknown, after: unknown, path = "$schema"): void {
  if (Array.isArray(before)) { assert.deepEqual(after, before, path); return; }
  if (typeof before === "object" && before !== null) {
    assert.ok(typeof after === "object" && after !== null && !Array.isArray(after), path);
    const previous = before as Record<string, unknown>;
    const current = after as Record<string, unknown>;
    if (!path.endsWith(".properties")) assert.deepEqual(Object.keys(current).sort(), Object.keys(previous).sort(), path);
    for (const [key, value] of Object.entries(previous)) oldSchemaUnchanged(value, current[key], `${path}.${key}`);
    return;
  }
  assert.deepEqual(after, before, path);
}
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

void test("pre-DAW JSON schema remains an exact subtree except added properties", { skip: !existsSync(preSchema) && "pre-DAW fixture owned by main lane" }, () => {
  oldSchemaUnchanged(JSON.parse(readFileSync(preSchema, "utf8")) as unknown, SONG_JSON_SCHEMA);
});

void test("resolved defaults fill every optional output field", () => {
  const song = validateSong({ version: 1, bpm: 120,
    tracks: [{ id: "kick", kind: "drums", instrument: "drums" }, { id: "bass", kind: "notes", instrument: "808" }],
    sections: [{ id: "a", bars: 1 }], arrangement: [{ section: "a" }] });
  assert.deepEqual({ title: song.title, genre: song.genre, meter: song.meter, key: song.key,
    seed: song.seed, swing: song.swing, sampleRate: song.sampleRate, tailSeconds: song.tailSeconds, master: song.master },
  { title: "untitled", genre: null, meter: { numerator: 4, denominator: 4 }, key: null,
    seed: 1, swing: 0.5, sampleRate: 44100, tailSeconds: 2,
    master: { gainDb: 0, ceilingDb: -1, targetLufs: null, fx: [] } });
  assert.deepEqual(song.tracks[0], { id: "kick", kind: "drums", instrument: "drums", pattern: null,
    velocity: 0.8, gain: 0, pan: 0, gate: 0.9, mono: false, glide: 0, transpose: 0,
    swing: false, sends: { reverb: 0, delay: 0 }, fx: [], duck: null, params: {} });
  assert.equal(song.tracks[1]?.mono, true);
  assert.deepEqual(song.sections[0], { id: "a", bars: 1, role: null, patterns: {} });
  assert.deepEqual(song.arrangement, [{ section: "a", repeats: 1 }]);
  assert.equal(song.loop, false);
  assert.equal(song.useCase, null);
});

void test("loop and use-case identity round-trip and reject invalid source types", () => {
  const source = { ...fixture(), loop: true, useCase: "game_loop" };
  const resolved = validateSong(source);
  assert.equal(resolved.loop, true);
  assert.equal(resolved.useCase, "game_loop");
  assert.ok(issues({ ...source, loop: "true" }).some((issue) => issue.path === "$.loop"));
  assert.ok(issues({ ...source, useCase: "unknown" }).some((issue) => issue.path === "$.useCase"));
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
    sampleRate: 48000, tailSeconds: 0, loop: true, useCase: "game_loop", master: { gainDb: 0, ceilingDb: -1, targetLufs: -14 } });
  assert.deepEqual(Object.keys(SONG_JSON_SCHEMA.properties).sort(), [...Object.keys(song), "fx", "audioTracks"].sort());
  assert.equal(validateSong(song).sampleRate, 48000);
});

void test("new optional fields are absent from legacy resolved JSON", () => {
  const song = validateSong(fixture());
  assert.equal("audioTracks" in song, false);
  for (const track of song.tracks) {
    assert.equal("notes" in track, false);
    assert.equal("automation" in track, false);
  }
  assert.ok("audioTracks" in SONG_JSON_SCHEMA.properties);
  assert.ok("notes" in SONG_JSON_SCHEMA.properties.tracks.items.properties);
});

void test("effect defaults resolve while absent buses stay on legacy path", () => {
  const raw = fixture();
  (raw["tracks"] as Record<string, unknown>[])[0]!["fx"] = [{ type: "drive", amount: 3 }];
  raw["master"] = { fx: [{ type: "width" }] };
  raw["fx"] = { reverb: { type: "hall", mix: 0.4 } };
  const resolved = validateSong(raw);
  assert.equal(resolved.tracks[0]?.fx?.[0]?.type, "drive");
  assert.equal((resolved.tracks[0]?.fx?.[0] as { mix: number }).mix, 1);
  assert.equal(resolved.fx?.reverb?.decaySeconds, 1.5);
  assert.equal(resolved.fx?.delay, null);
  assert.equal(resolved.master.fx[0]?.type, "width");
  assert.equal(validateSong(fixture()).fx, null);
});

void test("effect validation reports exact indexed paths", () => {
  const raw = fixture();
  (raw["tracks"] as Record<string, unknown>[])[0]!["fx"] = [{ type: "delay", feedback: 2 }];
  assert.ok(issues(raw).some((issue) => issue.path === "$.tracks[0].fx[0].feedback"));
  (raw["tracks"] as Record<string, unknown>[])[0]!["fx"] = [{ type: "eq", lowHz: 400, midHz: 300 }];
  assert.ok(issues(raw).some((issue) => issue.path === "$.tracks[0].fx[0].lowHz"));
  raw["fx"] = { reverb: { lowCutHz: 1000, highCutHz: 1000 } };
  assert.ok(issues(raw).some((issue) => issue.path === "$.fx.reverb.lowCutHz"));
  raw["master"] = { fx: [{ type: "chorus" }] };
  assert.ok(issues(raw).some((issue) => issue.path === "$.master.fx[0].type"));
});
