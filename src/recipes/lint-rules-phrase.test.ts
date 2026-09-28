import { test } from "node:test";
import assert from "node:assert/strict";
import { buildTimeline, validateSong } from "../song/index.ts";
import { createGeometry } from "./lint-geometry.tool.ts";
import { motifIn, muteChange } from "./lint-rules-phrase.tool.ts";

test("repeated melody is a motif and an intro mute changes the arrangement", () => {
  const song = validateSong({ version: 1, bpm: 120, tracks: [
    { id: "melody", kind: "notes", instrument: "bell", pattern: "c4 ~ e4 ~" },
    { id: "kick", kind: "drums", instrument: "drums", pattern: "bd ~ sd ~" }],
    sections: [{ id: "intro", bars: 1, role: "intro", patterns: { melody: null } }, { id: "hook", bars: 4, role: "hook" }],
    arrangement: [{ section: "intro" }, { section: "hook" }] });
  const g = createGeometry(song, buildTimeline(song));
  assert.ok(motifIn(g, [1, 2, 3, 4], [2], ["melody"]));
  assert.ok(muteChange(g));
});
