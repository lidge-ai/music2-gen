import { test } from "node:test";
import assert from "node:assert/strict";
import { lintSong } from "./lint.tool.ts";

test("house four-kick threshold passes 9/10 and fails 8/10", () => {
  const song = { version: 1, bpm: 124, genre: "house", tracks: [
    { id: "kick", kind: "drums", instrument: "drums", pattern: "bd ~ ~ ~ bd ~ ~ ~ bd ~ ~ ~ bd ~ ~ ~" },
    { id: "snare", kind: "drums", instrument: "drums", pattern: "~ ~ ~ ~ cp ~ ~ ~ ~ ~ ~ ~ cp ~ ~ ~" }],
    sections: [{ id: "groove", bars: 10, role: "groove", patterns: {} as Record<string,string> }], arrangement: [{ section: "groove" }] };
  // A one-bar override changes every bar, so use ten one-bar sections to target exactly one or two misses.
  song.sections = Array.from({ length: 10 }, (_, i) => ({ id: `g${i}`, bars: 1, role: "groove", patterns: { kick: i === 0 ? "bd ~ ~ ~ bd ~ ~ ~ bd ~ ~ ~ ~ ~ ~ ~" : song.tracks[0]!.pattern } }));
  song.arrangement = song.sections.map((section) => ({ section: section.id }));
  assert.ok(!lintSong(song).results.some((r) => r.id === "house/2"));
  song.sections[1]!.patterns.kick = song.sections[0]!.patterns.kick!;
  assert.ok(lintSong(song).results.some((r) => r.id === "house/2"));
});
