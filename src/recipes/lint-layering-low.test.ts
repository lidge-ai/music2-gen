import { test } from "node:test";
import assert from "node:assert/strict";
import { buildTimeline, validateSong } from "../song/index.ts";
import type { Song } from "../song/index.ts";
import { createGeometry } from "./lint-geometry.tool.ts";
import { lowLayeringRules } from "./lint-layering-low.tool.ts";

function findings(tracks: Song["tracks"], repeats = 1, bars = 1) {
  const song = validateSong({ version: 1, bpm: 120, tracks,
    sections: [{ id: "a", bars }], arrangement: [{ section: "a", repeats }] });
  return lowLayeringRules(createGeometry(song, buildTimeline(song)));
}
const has = (rows: ReturnType<typeof findings>, id: string) => rows.filter((row) => row.id === `generic/${id}`);

test("L1 fires at 25% per occurrence and keeps repeat identity", () => {
  const tracks: Song["tracks"] = [
    { id: "a", kind: "notes", instrument: "bass", pattern: "46 ~ ~ ~" },
    { id: "b", kind: "notes", instrument: "keys", mono: true, pattern: "46 ~ ~ ~" },
  ];
  const exact = has(findings(tracks, 2), "low_end_overlap");
  assert.deepEqual(exact.map((row) => row.path), ["arrangement.0", "arrangement.1"]);
  assert.match(String(exact[0]?.observed), /share 0\.2500/);
  tracks[1]!.mono = false; tracks[1]!.gate = 0.9996;
  assert.equal(has(findings(tracks), "low_end_overlap").length, 0);
});

test("L1 pitch, gain, velocity and distinct-track boundaries", () => {
  const tracks: Song["tracks"] = [
    { id: "a", kind: "notes", instrument: "bass", pattern: "46 ~ ~ ~" },
    { id: "b", kind: "notes", instrument: "keys", mono: true, pattern: "46 ~ ~ ~" },
  ];
  tracks[1]!.pattern = "47 ~ ~ ~";
  assert.equal(has(findings(tracks), "low_end_overlap").length, 0);
  tracks[1]!.pattern = "46 ~ ~ ~"; tracks[1]!.gain = -24;
  assert.equal(has(findings(tracks), "low_end_overlap").length, 0);
  tracks[1]!.gain = -23.99;
  assert.equal(has(findings(tracks), "low_end_overlap").length, 1);
  tracks[1]!.velocity = 0;
  assert.equal(has(findings(tracks), "low_end_overlap").length, 0);
  assert.equal(has(findings([{ id: "a", kind: "notes", instrument: "keys", mono: false, pattern: "[46,46] ~ ~ ~" }]), "low_end_overlap").length, 0);
  assert.equal(has(findings([
    { id: "a", kind: "notes", instrument: "bass", pattern: "46 ~ ~ ~" },
    { id: "b", kind: "notes", instrument: "bass", pattern: "46 ~ ~ ~" },
    { id: "c", kind: "notes", instrument: "bass", pattern: "46 ~ ~ ~" },
  ]), "low_end_overlap").length, 1, "triple overlap is unioned once");
});

test("L1 clamps mono at the next same-track onset and excludes touching endpoints", () => {
  const tracks: Song["tracks"] = [
    { id: "a", kind: "notes", instrument: "bass", pattern: "46 45 ~ ~" },
    { id: "b", kind: "notes", instrument: "bass", pattern: "~ 46 ~ ~" },
  ];
  assert.equal(has(findings(tracks), "low_end_overlap").length, 1);
  tracks[0]!.pattern = "46 ~ ~ ~";
  assert.equal(has(findings(tracks), "low_end_overlap").length, 0);
});

test("L3 pan and low-note fraction use strict and inclusive bounds", () => {
  const bass: Song["tracks"] = [{ id: "bass", kind: "notes", instrument: "bass", pan: 0.1, pattern: "60" }];
  assert.equal(has(findings(bass), "low_pan").length, 0);
  bass[0]!.pan = -0.1001;
  assert.equal(has(findings(bass), "low_pan").length, 1);
  const keys: Song["tracks"] = [{ id: "keys", kind: "notes", instrument: "keys", pan: 0.2, pattern: "46 60 60 60" }];
  assert.equal(has(findings(keys), "low_pan").length, 1);
  keys[0]!.pattern = "46 60 60 60 60";
  assert.equal(has(findings(keys), "low_pan").length, 0);
  keys[0]!.pattern = Array.from({ length: 25 }, (_, i) => i < 6 ? "46" : "60").join(" ");
  assert.equal(has(findings(keys), "low_pan").length, 0, "6/25 is 24%");
});

test("L6 checks validated MIDI 22, while 23 and drums pass", () => {
  assert.equal(has(findings([{ id: "a", kind: "notes", instrument: "bass", pattern: "22" }]), "sub_floor").length, 1);
  assert.equal(has(findings([{ id: "a", kind: "notes", instrument: "bass", pattern: "23" }]), "sub_floor").length, 0);
  assert.equal(has(findings([{ id: "d", kind: "drums", instrument: "drums", pattern: "bd" }]), "sub_floor").length, 0);
});
