import { test } from "node:test";
import assert from "node:assert/strict";
import { buildTimeline, validateSong } from "../song/index.ts";
import type { Song } from "../song/index.ts";
import { createGeometry } from "./lint-geometry.tool.ts";
import { isBassInstrument, isBedInstrument, isFocalInstrument, melodyTrackIds } from "./lint-roles.tool.ts";
import { lintSong } from "./lint.tool.ts";

const drums: Song["tracks"] = [
  { id: "kick", kind: "drums", instrument: "drums", pattern: "bd ~ ~ ~ ~ ~ bd ~ ~ ~ bd ~ ~ ~ ~ ~" },
  { id: "snare", kind: "drums", instrument: "drums", pattern: "~ ~ ~ ~ ~ ~ ~ ~ cp ~ ~ ~ ~ ~ ~ ~" },
];
const sub: Song["tracks"][number] = { id: "sub", kind: "notes", instrument: "808", gain: -6, pattern: "<[g1@6 g1@4 bb1@6] [eb2@6 eb2@6 f2@4]>" };
const guitar: Song["tracks"][number] = { id: "guitar", kind: "notes", instrument: "guitar", gain: -8,
  pattern: "<[g3 ~ d4 ~ bb3 ~ d4 g4 ~ ~ a4 ~ bb4 ~ a4 ~] [eb3 ~ bb3 ~ g3 ~ bb3 eb4 ~ ~ f4 ~ g4 ~ f4 ~]>" };
const bell: Song["tracks"][number] = { id: "bell", kind: "notes", instrument: "bell", gain: -12, pattern: "~ ~ ~ ~ ~ ~ ~ ~ d6 ~ eb6 ~ d6 ~ ~ ~" };
const drill = (tracks: Song["tracks"]) => ({ version: 1 as const, genre: "drill_ny", bpm: 142, key: "G minor", seed: 1, tracks,
  sections: [{ id: "hook", bars: 4, role: "hook" as const }], arrangement: [{ section: "hook" }] });
const geometry = (tracks: Song["tracks"]) => { const song = validateSong(drill(tracks)); return createGeometry(song, buildTimeline(song)); };
const ids = (song: unknown): string[] => lintSong(song).results.map((result) => result.id);

test("voice roles classify focal, bed and bass instruments", () => {
  assert.ok(isFocalInstrument("bell") && isFocalInstrument("lib:grand-piano"));
  assert.ok(isBedInstrument("strings") && isBedInstrument("organ") && isBedInstrument("lib:strings"));
  assert.ok(isBassInstrument("bass") && isBassInstrument("808") && !isBassInstrument("guitar"));
});

test("drill_ny/6 no longer depends on track order (issue #1 repro 1)", () => {
  const guitarFirst = ids(drill([...drums, sub, guitar, bell]));
  const bellFirst = ids(drill([...drums, sub, bell, guitar]));
  assert.ok(!guitarFirst.includes("drill_ny/6"));
  assert.deepEqual(guitarFirst, bellFirst);
});

test("beds and instrument bass tracks never count as the melody", () => {
  const strings: Song["tracks"][number] = { id: "strings", kind: "notes", instrument: "strings", pattern: "[g3,bb3,d4]" };
  const bass: Song["tracks"][number] = { id: "low", kind: "notes", instrument: "bass", mono: true, pattern: "g1 ~ g1 ~" };
  assert.deepEqual(melodyTrackIds(geometry([...drums, strings, bass, bell])), ["bell"]);
});

test("without a focal voice any non-bed notes track qualifies; user samples join the focal set", () => {
  const saw: Song["tracks"][number] = { id: "saw", kind: "notes", instrument: "supersaw", pattern: "g4 ~ bb4 ~" };
  const pad: Song["tracks"][number] = { id: "pad", kind: "notes", instrument: "pad", pattern: "[g3,bb3,d4]" };
  assert.deepEqual(melodyTrackIds(geometry([...drums, pad, saw])), ["saw"]);
  assert.deepEqual(melodyTrackIds(geometry([...drums, pad])), []);
});

test("drill_ny/5 counts 808 moves inside each hook only (issue #1 repro 2)", () => {
  const song = { version: 1, genre: "drill_ny", bpm: 142, key: "G minor", seed: 1, tracks: [...drums,
    { id: "sub", kind: "notes", instrument: "808", pattern: "g1 ~ ~ ~ ~ ~ g1 ~ ~ ~ g1 ~ ~ ~ ~ ~" },
    { ...bell, gain: -10, pattern: "~ ~ ~ ~ ~ ~ ~ ~ d5 ~ eb5 ~ d5 ~ ~ ~" }],
    sections: [{ id: "hook1", bars: 4, role: "hook" }, { id: "verse", bars: 4, role: "verse", patterns: { bell: null } },
      { id: "hook2", bars: 4, role: "hook", patterns: { sub: "c2 ~ ~ ~ ~ ~ c2 ~ ~ ~ c2 ~ ~ ~ ~ ~" } }],
    arrangement: [{ section: "hook1" }, { section: "verse" }, { section: "hook2" }] };
  const found = lintSong(song).results.find((result) => result.id === "drill_ny/5");
  assert.equal(found?.observed, 0);
});
