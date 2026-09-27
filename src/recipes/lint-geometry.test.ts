import { test } from "node:test";
import assert from "node:assert/strict";
import { buildTimeline, validateSong } from "../song/index.ts";
import { at, createGeometry, fourKick, snare9 } from "./lint-geometry.tool.ts";

test("geometry uses unswung cycle positions and excludes a muted intro", () => {
  const song = validateSong({ version: 1, bpm: 140, swing: .65,
    tracks: [{ id: "drums", kind: "drums", instrument: "drums", pattern: "bd ~ ~ ~ bd ~ ~ ~ sd ~ ~ ~ bd ~ ~ ~", swing: true }],
    sections: [{ id: "intro", bars: 1, role: "intro", patterns: { drums: null } }, { id: "hook", bars: 1, role: "hook" }],
    arrangement: [{ section: "intro" }, { section: "hook" }] });
  const g = createGeometry(song, buildTimeline(song));
  assert.deepEqual(g.full, [1]);
  assert.ok(snare9(g, 1));
  assert.ok(!fourKick(g, 1));
  assert.ok(g.timeline.events.some((event) => at(8, event)));
});
