import { test } from "node:test";
import assert from "node:assert/strict";
import { buildTimeline, validateSong } from "../song/index.ts";
import type { Song, TimedEvent } from "../song/index.ts";
import { createGeometry } from "./lint-geometry.tool.ts";
import { rhythmLayeringRules } from "./lint-layering-rhythm.tool.ts";

function make(genre = "house", duck?: Song["tracks"][number]["duck"], bassPattern = "c2 ~ ~ ~", bars = 1) {
  const song = validateSong({ version: 1, bpm: 120, genre, tracks: [
    { id: "drums", kind: "drums", instrument: "drums", pattern: "bd ~ bd ~" },
    { id: "hats", kind: "drums", instrument: "drums", pattern: "hh ~ hh ~" },
    { id: "low", kind: "notes", instrument: "bass", pattern: bassPattern, ...(duck ? { duck } : {}) },
  ], sections: [{ id: "part", bars }], arrangement: [{ section: "part" }] });
  const timeline = buildTimeline(song);
  return { song, timeline, g: createGeometry(song, timeline) };
}
const count = (g: ReturnType<typeof make>["g"]) => rhythmLayeringRules(g).length;

test("L4 fires at 50% and ±30 ms, but not past the timing edge", () => {
  const { song, timeline } = make();
  const bass = timeline.events.find((event) => event.track === "low")!;
  bass.time = 0.03;
  assert.equal(count(createGeometry(song, timeline)), 1);
  bass.time = 0.0301;
  assert.equal(count(createGeometry(song, timeline)), 0);
  bass.time = -0.03;
  assert.equal(count(createGeometry(song, timeline)), 1);
});

test("L4 49 of 100 kick onsets skip", () => {
  const { song, timeline } = make("house", undefined, "c2 ~ ~ ~", 50);
  const kick = timeline.events.find((event) => event.track === "drums" && event.atom.name === "bd")!;
  const bass = timeline.events.find((event) => event.track === "low")!;
  const eventAt = (event: TimedEvent, i: number): TimedEvent => ({ ...event, time: i, duration: 0.1, bar: Math.floor(i / 2) });
  timeline.events = [...Array.from({ length: 100 }, (_, i) => eventAt(kick, i)),
    ...Array.from({ length: 49 }, (_, i) => eventAt(bass, i))].sort((a, b) => a.time - b.time || a.trackIndex - b.trackIndex);
  assert.equal(count(createGeometry(song, timeline)), 0);
  timeline.events.push(eventAt(bass, 49));
  timeline.events.sort((a, b) => a.time - b.time || a.trackIndex - b.trackIndex);
  assert.equal(count(createGeometry(song, timeline)), 1);
});

test("L4 needs a real bd source and duck amount at least 0.1", () => {
  assert.equal(count(make("house", { by: "drums", amount: 0.1 }).g), 0);
  assert.equal(count(make("house", { by: "drums", amount: 0 }).g), 1);
  assert.equal(count(make("house", { by: "drums", amount: 0.099 }).g), 1);
  assert.equal(count(make("house", { by: "hats", amount: 1 }).g), 1);
  const mixed = make("house", { by: "drums", amount: 0.1 });
  mixed.song.tracks[0]!.pattern = "bd hh bd hh";
  const mixedTimeline = buildTimeline(mixed.song);
  assert.equal(count(createGeometry(mixed.song, mixedTimeline)), 0);
  assert.equal(count(make("techno").g), 1);
  const empty = make();
  empty.timeline.events = empty.timeline.events.filter((event) => event.atom.name !== "bd");
  assert.equal(count(createGeometry(empty.song, empty.timeline)), 0);
});

test("L4 hip-hop genres are deliberately exempt", () => {
  for (const genre of ["trap", "drill_uk", "drill_ny", "boom_bap", "lofi_hiphop"])
    assert.equal(count(make(genre).g), 0, genre);
  const trap = make("trap");
  assert.equal(count(createGeometry(trap.song, trap.timeline, "house")), 1, "effective genre override controls L4");
});
