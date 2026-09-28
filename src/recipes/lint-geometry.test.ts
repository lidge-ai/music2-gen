import { test } from "node:test";
import assert from "node:assert/strict";
import { buildTimeline, validateSong } from "../song/index.ts";
import { at, contiguousRuns, createGeometry, fourKick, isBackbeat, isHat, isKick, snare9, transitions } from "./lint-geometry.tool.ts";

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

test("only declared kit tracks with parsed samples supply rhythm roles", () => {
  const song = validateSong({ version: 1, bpm: 120,
    tracks: [
      { id: "fx", kind: "drums", instrument: "sfx", pattern: "bd sd hh" },
      { id: "drum", kind: "drums", instrument: "drums", pattern: "bd sd hh" },
      { id: "custom", kind: "drums", instrument: "kit:custom", pattern: "bd sd hh" },
    ], sections: [{ id: "hook", bars: 1, role: "hook" }], arrangement: [{ section: "hook" }] });
  const timeline = buildTimeline(song);
  const g = createGeometry(song, timeline);
  const roles = [isKick, isBackbeat, isHat];
  for (const id of ["fx", "drum", "custom"]) {
    const events = timeline.events.filter((event) => event.track === id);
    assert.deepEqual(roles.map((role, index) => role(g, events[index]!)),
      id === "fx" ? [false, false, false] : [true, true, true]);
  }
  assert.deepEqual(g.full, [0]);
  song.tracks[1]!.kind = "notes";
  assert.equal(isKick(g, timeline.events.find((event) => event.track === "drum")!), false);
  timeline.events.find((event) => event.track === "custom")!.sample = null;
  assert.equal(isKick(g, timeline.events.find((event) => event.track === "custom")!), false);
});

test("SFX track IDs cannot create full-drum bars", () => {
  const song = validateSong({ version: 1, bpm: 120,
    tracks: [{ id: "kick", kind: "drums", instrument: "sfx", pattern: "bd sd hh" },
      { id: "snare", kind: "drums", instrument: "sfx", pattern: "sd" }],
    sections: [{ id: "hook", bars: 1, role: "hook" }], arrangement: [{ section: "hook" }] });
  assert.deepEqual(createGeometry(song, buildTimeline(song)).full, []);
});

test("list drum activity follows events in each repeated placement", () => {
  const song = validateSong({ version: 1, bpm: 120,
    tracks: [
      { id: "kick", kind: "drums", instrument: "drums", notes: [
        { start: 8, length: .25, sample: "bd" }] },
      { id: "snare", kind: "drums", instrument: "drums", pattern: "sd" },
    ], sections: [{ id: "hook", bars: 2, role: "hook" }], arrangement: [{ section: "hook", repeats: 3 }] });
  const geometry = createGeometry(song, buildTimeline(song));
  assert.deepEqual(geometry.full, [2, 3]);
});

test("contiguous runs split bar indexes at gaps", () => {
  assert.deepEqual(contiguousRuns([5, 0, 4, 1]), [[0, 1], [4, 5]]);
  assert.deepEqual(contiguousRuns([]), []);
});

test("808 transitions reset between non-adjacent full-drum runs", () => {
  const drums = { id: "drums", kind: "drums" as const, instrument: "drums", pattern: "bd ~ ~ ~ ~ ~ ~ ~ sd ~ ~ ~ ~ ~ ~ ~" };
  const song = validateSong({ version: 1, bpm: 140, tracks: [drums,
    { id: "sub", kind: "notes", instrument: "808", mono: true, pattern: "g1 ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~" }],
    sections: [{ id: "a", bars: 2, role: "hook" }, { id: "gap", bars: 2, role: "intro", patterns: { drums: null } },
      { id: "b", bars: 2, role: "hook", patterns: { sub: "c2 ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~" } }],
    arrangement: [{ section: "a" }, { section: "gap" }, { section: "b" }] });
  const g = createGeometry(song, buildTimeline(song));
  assert.deepEqual(contiguousRuns(g.full), [[0, 1], [4, 5]]);
  assert.equal(transitions(g, contiguousRuns(g.full)), 0);
  assert.equal(transitions(g, [g.full]), 1);
});
