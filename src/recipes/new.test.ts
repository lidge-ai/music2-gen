import { test } from "node:test";
import assert from "node:assert/strict";
import { Music2Error } from "../shared/index.ts";
import { buildTimeline, validateSong } from "../song/index.ts";
import { newSong, transposePattern } from "./new.tool.ts";
import { getRecipe } from "./recipes.tool.ts";

test("recipe defaults return an authoring song", () => {
  const song = newSong({ genre: "drill_uk" });
  assert.equal(song.bpm, 140);
  assert.equal(song.key, "C minor");
  assert.equal(song.seed, 1);
  assert.deepEqual(validateSong(song).tracks[0]?.pattern, song.tracks[0]?.pattern);
});

test("D minor transposes C2 to D2 while preserving drums, suffixes and timing", () => {
  const source = newSong({ genre: "drill_uk", seed: 7 });
  const shifted = newSong({ genre: "drill_uk", key: "D minor", seed: 7 });
  assert.equal(shifted.tracks.find((track) => track.id === "bass")?.pattern?.split(" ")[0], "d2");
  assert.equal(shifted.tracks.find((track) => track.id === "snare")?.pattern,
    source.tracks.find((track) => track.id === "snare")?.pattern);
  const a = buildTimeline(validateSong(source));
  const b = buildTimeline(validateSong(shifted));
  assert.deepEqual(a.events.map((event) => [event.track, event.time]), b.events.map((event) => [event.track, event.time]));
});

test("F minor to E minor chooses minus one semitone", () => {
  const song = newSong({ genre: "drill_ny", key: "E minor" });
  assert.equal(song.tracks.find((track) => track.id === "bass")?.pattern?.split(" ")[0], "e2");
});

test("AST span replacement preserves grouping and suffixes; MIDI range is enforced", () => {
  assert.equal(transposePattern("[c4 60]*2 ~ <e4|g4>", 2), "[d4 62]*2 ~ <f#4|a4>");
  assert.throws(() => transposePattern("127", 1),
    (error: unknown) => error instanceof Music2Error && error.code === "E_INPUT");
  assert.throws(() => transposePattern("0", -1),
    (error: unknown) => error instanceof Music2Error && error.code === "E_INPUT");
});

test("same inputs are deterministic and do not mutate stored cards", () => {
  const options = { genre: "house" as const, key: "B minor", seed: 123, bpm: 125, title: "Example" };
  const before = getRecipe("house");
  assert.deepEqual(newSong(options), newSong(options));
  assert.deepEqual(getRecipe("house"), before);
});

test("invalid BPM, key mode, seed and title reject as input errors", () => {
  const cases = [
    { genre: "drill_uk" as const, bpm: 124 },
    { genre: "drill_uk" as const, bpm: 140.5 },
    { genre: "drill_uk" as const, key: "D major" },
    { genre: "drill_uk" as const, key: "H minor" },
    { genre: "drill_uk" as const, seed: -1 },
    { genre: "drill_uk" as const, seed: 0x100000000 },
    { genre: "drill_uk" as const, title: "x".repeat(121) },
  ];
  for (const options of cases) assert.throws(() => newSong(options),
    (error: unknown) => error instanceof Music2Error && error.code === "E_INPUT" && error.exit === 2);
});
