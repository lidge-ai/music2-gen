import assert from "node:assert/strict";
import test from "node:test";
import { performance } from "node:perf_hooks";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { packageRoot } from "../shared/index.ts";
import { buildTimeline, validateSong } from "../song/index.ts";
import { buildProject } from "./build.tool.ts";

const basic = (tracks: object[], extras: Record<string, unknown> = {}) => ({
  version: 1, title: "IR fixture", bpm: 120, seed: 13, key: "C minor", tracks,
  sections: [{ id: "hook", role: "hook", bars: 1 }], arrangement: [{ section: "hook", repeats: 2 }],
  ...extras,
});

test("published song-format JSON examples validate and the layered example projects warnings", () => {
  const docs = readFileSync(join(packageRoot(), "docs/song-format.md"), "utf8");
  const examples = [...docs.matchAll(/```json\n([\s\S]*?)\n```/g)];
  assert.ok(examples.length >= 2);
  let layered = 0;
  for (const example of examples) {
    const song = validateSong(JSON.parse(example[1]!) as unknown);
    const ir = buildProject(song, buildTimeline(song));
    if (song.tracks.some((track) => track.layers?.length)) {
      layered++;
      assert.deepEqual(ir.warnings, ["LAYERS_FLATTENED:bass:2", "LAYERS_FLATTENED:kick:1"]);
    }
  }
  assert.equal(layered, 1);
});

test("ProjectIR warns once per layered track and retains only main instruments and notes", () => {
  const tracks = [
    { id: "bass", kind: "notes", instrument: "bass", pattern: "c2 e2",
      layers: [{ id: "sub", instrument: "lead", transpose: -12, params: { wave: 2 } },
        { id: "growl", instrument: "supersaw", transpose: 12 }] },
    { id: "kick", kind: "drums", instrument: "drums", pattern: "bd sd",
      layers: [{ id: "kit", instrument: "drums", only: ["bd"] }] },
    { id: "plain", kind: "notes", instrument: "piano", pattern: "c4", layers: [] },
  ];
  const song = validateSong(basic(tracks));
  const ir = buildProject(song, buildTimeline(song));
  const legacy = validateSong(basic(tracks.map((track) =>
    Object.fromEntries(Object.entries(track).filter(([key]) => key !== "layers")))));
  const plain = buildProject(legacy, buildTimeline(legacy));
  assert.deepEqual(ir.warnings, ["LAYERS_FLATTENED:bass:2", "LAYERS_FLATTENED:kick:1"]);
  assert.deepEqual(ir.tracks, plain.tracks);
  assert.deepEqual(ir.samples, plain.samples);
  assert.equal(ir.tracks.length, 3);
  assert.equal(Object.hasOwn(plain, "warnings"), false);
  const empty = validateSong(basic(tracks.map((track) => ({ ...track, layers: [] }))));
  assert.deepEqual(buildProject(empty, buildTimeline(empty)), plain);
});

test("ProjectIR preserves only declared plugin fields and omits the key from legacy tracks", () => {
  const song = validateSong(basic([
    { id: "plain", kind: "notes", instrument: "piano", pattern: "c4" },
    { id: "empty", kind: "notes", instrument: "piano", pattern: "e4", plugins: [] },
    { id: "effect", kind: "notes", instrument: "piano", pattern: "g4",
      plugins: [{ id: "softclip", params: { wet: true, drive: 0.5, label: "warm" } }] },
  ]));
  const ir = buildProject(song, buildTimeline(song));
  assert.equal(Object.hasOwn(ir.tracks[0]!, "plugins"), false);
  assert.deepEqual(ir.tracks[1]!.plugins, []);
  assert.deepEqual(ir.tracks[2]!.plugins, [{ id: "softclip", params: { drive: 0.5, label: "warm", wet: true } }]);
  assert.equal(Object.hasOwn(ir, "warnings"), false);
});

test("ProjectIR retains library identity without a song-relative sample path", () => {
  const song = validateSong(basic([{ id: "piano", kind: "notes", instrument: "lib:grand-piano", pattern: "c4" }]));
  const ir = buildProject(song, buildTimeline(song));
  assert.equal(ir.tracks[0]?.type, "notes");
  assert.deepEqual(ir.tracks[0]?.type === "notes" ? ir.tracks[0].instrument : null,
    { kind: "lib", id: "grand-piano" });
  assert.deepEqual(ir.samples, []);
});

test("ProjectIR replaces an absolute resolved plugin ref with its basename and records a warning", () => {
  const song = validateSong(basic([{ id: "lead", kind: "notes", instrument: "piano", pattern: "c4" }]));
  const plugin = { id: "softclip", format: "vst3", ref: "/private/tmp/SoftClip.vst3",
    params: { drive: 0.5 } };
  song.tracks[0]!.plugins = [plugin];
  const ir = buildProject(song, buildTimeline(song));
  assert.deepEqual(ir.tracks[0]!.plugins, [{ id: "softclip", format: "vst3", ref: "SoftClip.vst3",
    params: { drive: 0.5 } }]);
  assert.deepEqual(ir.warnings, ["PLUGIN_REF_BASENAME:lead:softclip"]);
  assert.equal(JSON.stringify(ir).includes("/private/tmp"), false);
  plugin.ref = "C:\\Plugins\\SoftClip.vst3";
  const windowsIr = buildProject(song, buildTimeline(song));
  assert.equal(windowsIr.tracks[0]!.plugins?.[0]?.ref, "SoftClip.vst3");
  assert.deepEqual(windowsIr.warnings, ["PLUGIN_REF_BASENAME:lead:softclip"]);
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

test("user identity remains filesystem-free and does not become a song-relative sample", () => {
  const song = validateSong({ version: 1, bpm: 120, tracks: [
    { id: "melody", kind: "notes", instrument: "user:unimported", pattern: "c4" },
    { id: "kit", kind: "drums", instrument: "user:unimported-kit", pattern: "bd" }],
    sections: [{ id: "one", bars: 1 }], arrangement: [{ section: "one" }] });
  const ir = buildProject(song, buildTimeline(song));
  assert.deepEqual(ir.tracks.map((track) => track.type === "audio" ? null : track.instrument), [
    { kind: "user", id: "unimported" }, { kind: "user", id: "unimported-kit" }]);
  assert.deepEqual(ir.samples, []);
});
