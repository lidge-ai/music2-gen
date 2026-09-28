import assert from "node:assert/strict";
import test from "node:test";
import { performance } from "node:perf_hooks";
import { buildTimeline, validateSong } from "../song/index.ts";
import { buildProject } from "./build.tool.ts";

const basic = (tracks: object[], extras: Record<string, unknown> = {}) => ({
  version: 1, title: "IR fixture", bpm: 120, seed: 13, key: "C minor", tracks,
  sections: [{ id: "hook", role: "hook", bars: 1 }], arrangement: [{ section: "hook", repeats: 2 }],
  ...extras,
});

test("markers, list notes, clips and sorted de-duplicated samples are stable", () => {
  const song = validateSong(basic([
    { id: "lead", kind: "notes", instrument: "piano", notes: [{ start: 2, length: 1.5, pitch: 64 }] },
    { id: "kit", kind: "drums", instrument: "kit:assets/kit.json", notes: [{ start: 0, length: 1, sample: "bd:1" }] },
    { id: "sampled", kind: "notes", instrument: "sfz:assets/keys.sfz", notes: [{ start: 0, length: 1, pitch: 60 }] },
  ], { audioTracks: [{ id: "vox", clips: [
    { file: "audio/z.wav", start: 0, length: 1 }, { file: "audio/a.wav", start: 1, length: 1 },
    { file: "audio/z.wav", start: 2, length: 1 },
  ] }] }));
  const timeline = buildTimeline(song);
  const ir = buildProject(song, timeline);
  assert.deepEqual(ir.markers.map(({ tick, lengthTicks, name, occurrence }) =>
    [tick, lengthTicks, name, occurrence]), [[0, 3840, "hook", 0], [3840, 3840, "hook (2)", 1]]);
  assert.equal(ir.lengthTicks, 7680);
  assert.deepEqual(ir.key, { tonic: "C", mode: "minor" });
  assert.deepEqual(ir.samples, [
    { role: "clip", ref: "audio/a.wav" }, { role: "clip", ref: "audio/z.wav" },
    { role: "kit", ref: "assets/kit.json" }, { role: "sfz", ref: "assets/keys.sfz" },
  ]);
  assert.deepEqual(ir.tracks.map((track) => [track.id, track.index]),
    [["lead", 0], ["kit", 1], ["sampled", 2], ["vox", 3]]);
  const lead = ir.tracks[0];
  assert.ok(lead?.type === "notes");
  assert.deepEqual(lead.notes[0], { tick: 1920, lengthTicks: 1440, pitch: 64, sample: null,
    velocity: 0.8, eventIndex: 0, source: "list", errorTicks: 0 });
  const audio = ir.tracks[3];
  assert.ok(audio?.type === "audio");
  assert.deepEqual(audio.clips.map((clip) => clip.sample), [1, 0, 1]);
  assert.equal(JSON.stringify(buildProject(song, timeline)), JSON.stringify(ir));
});

test("pattern fractions and swing use two rounding steps and count inexact projection", () => {
  const plain = validateSong(basic([{ id: "lead", kind: "notes", instrument: "piano", pattern: "c4*7" }]));
  const projected = buildProject(plain, buildTimeline(plain));
  const track = projected.tracks[0];
  assert.ok(track?.type === "notes");
  assert.equal(track.notes[1]?.tick, 549);
  assert.ok((track.notes[1]?.errorTicks ?? 0) > 0);
  assert.equal(projected.quantization.events, 14);
  assert.ok(projected.quantization.inexact >= 1);
  const swung = validateSong(basic([{ id: "hats", kind: "drums", instrument: "drums", pattern: "hh*16", swing: true }],
    { swing: 0.58 }));
  const swungIr = buildProject(swung, buildTimeline(swung));
  const hats = swungIr.tracks[0];
  assert.ok(hats?.type === "drums");
  assert.equal(hats.notes[1]?.tick, 278);
  assert.ok(swungIr.quantization.maxErrorTicks >= 0.4);
});

test("mono clips to the next tick and keeps eventIndex from full Timeline", () => {
  const song = validateSong(basic([{ id: "bass", kind: "notes", instrument: "bass", mono: true,
    notes: [{ start: 0, length: 4, pitch: 48 }, { start: 1, length: 4, pitch: 50 }] }]));
  const ir = buildProject(song, buildTimeline(song));
  const bass = ir.tracks[0];
  assert.ok(bass?.type === "notes");
  assert.deepEqual(bass.notes.map((note) => [note.tick, note.lengthTicks, note.eventIndex]),
    [[0, 960, 0], [960, 3840, 1]]);
  assert.equal(ir.quantization.events, 0);
});

test("mono drops an earlier distinct onset when both quantize to one tick", () => {
  const song = validateSong(basic([{ id: "bass", kind: "notes", instrument: "bass", mono: true, pattern: "c2" }]));
  const timeline = buildTimeline(song);
  const first = timeline.events[0]!;
  timeline.events = [first, { ...first, cycleBegin: "1/10000", time: 0.0002, order: 1 }];
  const ir = buildProject(song, timeline);
  const bass = ir.tracks[0];
  assert.ok(bass?.type === "notes");
  assert.deepEqual(bass.notes.map((note) => [note.tick, note.eventIndex]), [[0, 1]]);
  assert.equal(ir.quantization.events, 2);
  assert.ok(ir.quantization.inexact >= 1);
});

test("same-tick mono chord notes clip to the next later tick", () => {
  const song = validateSong(basic([{ id: "bass", kind: "notes", instrument: "bass", mono: true,
    notes: [{ start: 0, length: 4, pitch: 48 }, { start: 0, length: 4, pitch: 52 },
      { start: 1, length: 1, pitch: 55 }] }]));
  const bass = buildProject(song, buildTimeline(song)).tracks[0];
  assert.ok(bass?.type === "notes");
  assert.deepEqual(bass.notes.map((note) => note.lengthTicks), [960, 960, 960]);
});

test("10k list events project within the documented budget", () => {
  const notes = Array.from({ length: 10_000 }, (_, i) => ({ start: i / 1000, length: 0.001, pitch: 60 }));
  const song = validateSong(basic([{ id: "lead", kind: "notes", instrument: "piano", notes }],
    { sections: [{ id: "hook", bars: 3 }], arrangement: [{ section: "hook" }] }));
  const timeline = buildTimeline(song);
  const start = performance.now();
  const ir = buildProject(song, timeline);
  const elapsed = performance.now() - start;
  assert.equal(ir.tracks[0]?.type === "notes" ? ir.tracks[0].notes.length : 0, 10_000);
  assert.ok(elapsed < 1000, `10k ProjectIR build took ${elapsed.toFixed(1)} ms`);
});

void test("same-tick list notes keep resolved pitch and velocity pairs in ProjectIR", () => {
  const raw = {
    version: 1, bpm: 120, tracks: [{ id: "lead", kind: "notes", instrument: "piano",
      notes: [{ start: 0, length: 1, pitch: 100, velocity: 0.1 }, { start: 0, length: 1, pitch: 60, velocity: 0.2 },
        { start: 0, length: 1, pitch: 60, velocity: 0.3 }] }],
    sections: [{ id: "a", bars: 1 }], arrangement: [{ section: "a" }],
  };
  const song = validateSong(raw);
  const notes = buildProject(song, buildTimeline(song)).tracks[0]!;
  assert.ok("notes" in notes);
  assert.deepEqual(notes.notes.map((note) => [note.pitch, note.velocity]), [[60, 0.2], [60, 0.3], [100, 0.1]]);
});
test("a send lane decides bus presence in place of the static send level", () => {
  const lane = (values: number[]) => values.map((value, at) => ({ at, value }));
  const song = validateSong(basic([
    { id: "lead", kind: "notes", instrument: "piano", sends: { reverb: 0, delay: 0.4 },
      notes: [{ start: 0, length: 1, pitch: 60 }],
      automation: [{ target: "send.reverb", points: lane([0, 0.5]) }, { target: "send.delay", points: lane([0, 0]) }] },
  ]));
  const ir = buildProject(song, buildTimeline(song));
  assert.equal(ir.buses.reverb?.kind, "reverb");
  assert.equal(ir.buses.delay, null);
});
