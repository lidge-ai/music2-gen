import { test } from "node:test";
import assert from "node:assert/strict";
import { buildTimeline, validateSong } from "../song/index.ts";
import type { Song, TimedEvent } from "../song/index.ts";
import { createGeometry } from "./lint-geometry.tool.ts";
import { harmonyLayeringRules } from "./lint-layering-harmony.tool.ts";

function findings(tracks: Song["tracks"], bars = 2) {
  const song = validateSong({ version: 1, bpm: 120, tracks,
    sections: [{ id: "part", bars }], arrangement: [{ section: "part" }] });
  return harmonyLayeringRules(createGeometry(song, buildTimeline(song)));
}
const has = (rows: ReturnType<typeof findings>, id: string) => rows.filter((row) => row.id === `generic/${id}`);

test("L2 exact lower-MIDI floors for every simple interval", () => {
  const floors = [52, 51, 48, 46, 46, 47, 34, 43, 41, 41, 41];
  for (let interval = 1; interval <= 11; interval++) {
    const floor = floors[interval - 1]!;
    const rows = (lower: number) => findings([{ id: "keys", kind: "notes", instrument: "keys", mono: false,
      pattern: `[${lower},${lower + interval}]` }]);
    assert.equal(has(rows(floor - 1), "low_chord_spacing").length, 1, `interval ${interval} below`);
    assert.equal(has(rows(floor), "low_chord_spacing").length, 0, `interval ${interval} at floor`);
  }
});

test("L2 excludes octaves, sequential notes and bass/808, and reports once per track", () => {
  assert.equal(has(findings([{ id: "a", kind: "notes", instrument: "keys", mono: false, pattern: "[40,52]" }]), "low_chord_spacing").length, 0);
  assert.equal(has(findings([{ id: "a", kind: "notes", instrument: "keys", mono: false, pattern: "40 41" }]), "low_chord_spacing").length, 0);
  for (const instrument of ["bass", "808"]) assert.equal(has(findings([{ id: "a", kind: "notes", instrument, mono: false, pattern: "[40,41]" }]), "low_chord_spacing").length, 0);
  assert.equal(has(findings([{ id: "a", kind: "notes", instrument: "keys", mono: false, pattern: "[40,41,42]" }]), "low_chord_spacing").length, 1);
});

test("L5 median distance, shared eighth slots, and focal exclusions", () => {
  const tracks: Song["tracks"] = [
    { id: "a", kind: "notes", instrument: "lead", pattern: "60 60 60 60" },
    { id: "b", kind: "notes", instrument: "bell", pattern: "67 67 67 67" },
  ];
  assert.equal(has(findings(tracks), "register_collision").length, 1);
  tracks[1]!.pattern = "68 68 68 68";
  assert.equal(has(findings(tracks), "register_collision").length, 0);
  tracks[1]!.pattern = "67 67 67 67";
  assert.equal(has(findings(tracks, 1), "register_collision").length, 0);
  tracks[1]!.instrument = "pad";
  assert.equal(has(findings(tracks), "register_collision").length, 0);
});

test("L5 new focal instruments collide with a lead on shared onsets", () => {
  for (const instrument of ["piano", "epiano", "guitar", "flute", "brass", "marimba",
    "vibraphone", "glockenspiel", "kalimba"]) {
    const tracks: Song["tracks"] = [
      { id: "lead", kind: "notes", instrument: "lead", pattern: "60 60 60 60" },
      { id: "other", kind: "notes", instrument, pattern: "67 67 67 67" },
    ];
    assert.equal(has(findings(tracks), "register_collision").length, 1, instrument);

    tracks[1]!.pattern = "68 68 68 68";
    assert.equal(has(findings(tracks), "register_collision").length, 0, `${instrument}: 8 semitones`);

    tracks[0]!.pattern = "60 ~ 60 ~";
    tracks[1]!.pattern = "~ 67 ~ 67";
    assert.equal(has(findings(tracks), "register_collision").length, 0, `${instrument}: staggered onsets`);
  }
});

test("L5 strings, choir, and organ remain bed voices", () => {
  for (const instrument of ["strings", "choir", "organ"]) {
    const tracks: Song["tracks"] = [
      { id: "lead", kind: "notes", instrument: "lead", pattern: "60 60 60 60" },
      { id: "bed", kind: "notes", instrument, pattern: "60 60 60 60" },
    ];
    assert.equal(has(findings(tracks), "register_collision").length, 0, instrument);
  }
});

test("L5 75% shared slots fires and 74% skips", () => {
  const song = validateSong({ version: 1, bpm: 120, tracks: [
    { id: "a", kind: "notes", instrument: "lead", pattern: "60" },
    { id: "b", kind: "notes", instrument: "keys", pattern: "67" },
  ], sections: [{ id: "part", bars: 40 }], arrangement: [{ section: "part" }] });
  const timeline = buildTimeline(song);
  const a = timeline.events.find((event) => event.track === "a")!;
  const b = timeline.events.find((event) => event.track === "b")!;
  const row = (event: TimedEvent, slot: number): TimedEvent => ({ ...event, time: slot * 0.25, bar: Math.floor(slot / 8) });
  const check = (shared: number) => {
    timeline.events = [...Array.from({ length: 100 }, (_, i) => row(a, i)),
      ...Array.from({ length: 100 }, (_, i) => row(b, i < shared ? i : i + 52))]
      .sort((x, y) => x.time - y.time || x.trackIndex - y.trackIndex);
    return has(harmonyLayeringRules(createGeometry(song, timeline)), "register_collision").length;
  };
  assert.equal(check(75), 1);
  assert.equal(check(74), 0);
});

test("L5 compares unique 16th onsets, so a 16th stagger clears the collision (issue #1 repro 4)", () => {
  const song = validateSong({ version: 1, bpm: 142, tracks: [
    { id: "guitar", kind: "notes", instrument: "guitar", pattern: "<[g3 ~ d4 ~ bb3 ~ d4 g4 ~ ~ a4 ~ bb4 ~ a4 ~] [eb3 ~ bb3 ~ g3 ~ bb3 eb4 ~ ~ f4 ~ g4 ~ f4 ~]>" },
    { id: "brass", kind: "notes", instrument: "brass", mono: false, pattern: "<[~ [g3,bb3,d4] ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~] [~ [eb3,g3,bb3] ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~]>" },
  ], sections: [{ id: "hook", bars: 4 }], arrangement: [{ section: "hook" }] });
  const rows = has(harmonyLayeringRules(createGeometry(song, buildTimeline(song))), "register_collision");
  assert.equal(rows.length, 0);
  const aligned = validateSong({ version: 1, bpm: 142, tracks: [
    { id: "guitar", kind: "notes", instrument: "guitar", pattern: "g3 ~ d4 ~ bb3 ~ d4 g4 ~ ~ a4 ~ bb4 ~ a4 ~" },
    { id: "brass", kind: "notes", instrument: "brass", mono: false, pattern: "[g3,bb3,d4] ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~" },
  ], sections: [{ id: "hook", bars: 4 }], arrangement: [{ section: "hook" }] });
  const hit = has(harmonyLayeringRules(createGeometry(aligned, buildTimeline(aligned))), "register_collision");
  assert.equal(hit.length, 1);
  assert.match(String(hit[0]!.observed), /shared 16th onsets 4\/4/);
});
