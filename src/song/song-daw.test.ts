import assert from "node:assert/strict";
import test from "node:test";
import { Music2Error } from "../shared/index.ts";
import { parseTarget } from "./song-daw.schema.ts";
import { validateSong } from "./song.schema.ts";

const base = () => ({ version: 1, bpm: 120, tracks: [{ id: "lead", kind: "notes", instrument: "piano", notes: [
  { start: 0, length: 1.5, pitch: "e4", velocity: 0.9 }, { start: 2, length: 0.5, pitch: 64 },
] }], sections: [{ id: "a", bars: 1 }], arrangement: [{ section: "a" }] });
function issues(input: unknown): { path: string; message: string }[] {
  try { validateSong(input); assert.fail("expected E_SCHEMA"); }
  catch (error) {
    assert.ok(error instanceof Music2Error); assert.equal(error.code, "E_SCHEMA");
    return error.details?.["issues"] as { path: string; message: string }[];
  }
}
function has(input: unknown, path: string, message?: string): void {
  assert.ok(issues(input).some((issue) => issue.path === path && (message === undefined || issue.message === message)), path);
}

void test("note list resolves ticks, transpose, velocity and absent fields", () => {
  const song = validateSong(base());
  assert.equal(song.tracks[0]?.notes?.[0]?.tick, 0);
  assert.equal(song.tracks[0]?.notes?.[0]?.lengthTicks, 1440);
  assert.equal(song.tracks[0]?.notes?.[0]?.pitch, 64);
  assert.equal(song.tracks[0]?.notes?.[1]?.velocity, 0.8);
  assert.equal("automation" in song.tracks[0], false);
  assert.equal("audioTracks" in song, false);
  assert.deepEqual(validateSong({ ...base(), audioTracks: [] }).audioTracks, []);
  const short = base(); short.tracks[0]!.notes[0]!.length = 0.001;
  assert.equal(validateSong(short).tracks[0]?.notes?.[0]?.lengthTicks, 1);
});

void test("note source, kind and resolved-start boundaries use exact issue paths", () => {
  const raw = base();
  has({ ...raw, tracks: [{ ...raw.tracks[0], pattern: "" }] }, "$.tracks[0].notes", "notes and pattern are exclusive");
  has({ ...raw, sections: [{ id: "a", bars: 1, patterns: { lead: "c4" } }] }, "$.sections[0].patterns.lead", "track uses notes");
  has({ ...raw, sections: [{ id: "a", bars: 1, patterns: { lead: null } }] }, "$.sections[0].patterns.lead", "track uses notes");
  has({ ...raw, tracks: [{ ...raw.tracks[0], velocity: "0.8" }] }, "$.tracks[0].velocity", "velocity pattern requires pattern");
  has({ ...raw, tracks: [{ ...raw.tracks[0], swing: true }] }, "$.tracks[0].swing", "swing does not apply to notes");
  has({ ...raw, tracks: [{ ...raw.tracks[0], notes: [{ start: 3.9999, length: 1, pitch: 60 }] }] },
    "$.tracks[0].notes[0].start", "starts after song end (3.9999 beats)");
  assert.equal(validateSong({ ...raw, tracks: [{ ...raw.tracks[0], notes: [{ start: 3.9994, length: 0.001, pitch: 60 }] }] }).tracks[0]?.notes?.[0]?.tick, 3839);
  has({ ...raw, tracks: [{ ...raw.tracks[0], notes: [{ start: 0, length: 1, sample: "bd" }] }] }, "$.tracks[0].notes[0].sample");
  has({ ...raw, tracks: [{ ...raw.tracks[0], transpose: 24, notes: [{ start: 0, length: 1, pitch: 120 }] }] }, "$.tracks[0].notes[0].pitch");
});

void test("audio clips enforce resolved length, end, overlap, stretch and IDs", () => {
  const raw = { ...base(), audioTracks: [{ id: "vox", clips: [{ file: "audio/v.wav", start: 0, length: 1 }] }] };
  const resolved = validateSong(raw);
  assert.deepEqual(resolved.audioTracks?.[0]?.clips[0], { tick: 0, lengthTicks: 960, file: "audio/v.wav", offsetSeconds: 0,
    gainDb: 0, pitchSemitones: 0, stretch: { mode: "none" }, fadeInSeconds: 0.002, fadeOutSeconds: 0.002 });
  has({ ...raw, audioTracks: [{ id: "lead", clips: raw.audioTracks[0]!.clips }] }, "$.audioTracks[0].id", "duplicate track id");
  has({ ...raw, audioTracks: [{ id: "vox", clips: [{ file: "v.wav", start: 0, length: 0.0001 }] }] },
    "$.audioTracks[0].clips[0].length", "length rounds to zero ticks");
  assert.equal(validateSong({ ...raw, audioTracks: [{ id: "vox", clips: [{ file: "v.wav", start: 0, length: 0.0006 }] }] }).audioTracks?.[0]?.clips[0]?.lengthTicks, 1);
  has({ ...raw, audioTracks: [{ id: "vox", clips: [{ file: "v.wav", start: 4, length: 1 }] }] }, "$.audioTracks[0].clips[0].start");
  assert.equal(validateSong({ ...raw, audioTracks: [{ id: "vox", clips: [{ file: "v.wav", start: 3.9994, length: 1 }] }] }).audioTracks?.[0]?.clips[0]?.tick, 3839);
  has({ ...raw, audioTracks: [{ id: "vox", clips: [{ file: "v.wav", start: 3.9999, length: 1 }] }] },
    "$.audioTracks[0].clips[0].start", "starts after song end (3.9999 beats)");
  has({ ...raw, audioTracks: [{ id: "vox", clips: [{ file: "v.wav", start: 0, length: 1 }, { file: "w.wav", start: 0.5, length: 1 }] }] },
    "$.audioTracks[0].clips[1]", "overlaps clip 0");
  assert.deepEqual(validateSong({ ...raw, audioTracks: [{ id: "vox", clips: [
    { file: "v.wav", start: 0, length: 1 }, { file: "w.wav", start: 1, length: 1 },
  ] }] }).audioTracks?.[0]?.clips.map((clip) => clip.tick), [0, 960]);
  has({ ...raw, bpm: 240, audioTracks: [{ id: "vox", clips: [{ file: "v.wav", start: 0, length: 1, stretch: { mode: "tempo", sourceBpm: 40 } }] }] },
    "$.audioTracks[0].clips[0].stretch", "stretch ratio outside 0.25..4");
  has({ ...raw, audioTracks: [{ id: "vox", clips: [{ file: "../v.wav", start: 0, length: 1 }] }] }, "$.audioTracks[0].clips[0].file");
  has({ ...raw, audioTracks: [{ id: "vox", clips: [{ file: "v.wav", start: 0, length: 1, stretch: { mode: "fit" } }] }] },
    "$.audioTracks[0].clips[0].stretch", "invalid stretch mode fields");
});

void test("automation grammar, target ranges and tick collision", () => {
  const raw = base();
  assert.deepEqual(parseTarget("fx.0.cutoffHz"), { kind: "fx", index: 0, param: "cutoffHz" });
  assert.deepEqual(parseTarget("send.delay"), { kind: "send", bus: "delay" });
  const lane = (target: string, points: { at: number; value: number }[]) => ({ target, points });
  has({ ...raw, tracks: [{ ...raw.tracks[0], automation: [lane("gain", [{ at: 0, value: 13 }])] }] }, "$.tracks[0].automation[0].points[0].value");
  has({ ...raw, tracks: [{ ...raw.tracks[0], automation: [lane("gain", [{ at: 0, value: 0 }, { at: 0.0001, value: 1 }])] }] },
    "$.tracks[0].automation[0].points[1].at", "distinct beats round to same tick");
  has({ ...raw, tracks: [{ ...raw.tracks[0], automation: [lane("gain", [{ at: 4.01, value: 0 }])] }] },
    "$.tracks[0].automation[0].points[0].at", "after song end");
  has({ ...raw, tracks: [{ ...raw.tracks[0], automation: [lane("fx.0.cutoffHz", [{ at: 0, value: 1000 }])] }] },
    "$.tracks[0].automation[0].target", "unknown insert");
  const step = validateSong({ ...raw, tracks: [{ ...raw.tracks[0], automation: [lane("gain", [{ at: 0, value: 0 }, { at: 0, value: 1 }, { at: 4, value: 2 }])] }] });
  assert.deepEqual(step.tracks[0]?.automation?.[0]?.points.map((point) => point.tick), [0, 0, 3840]);
});

void test("lane caps, steps, insert whitelist and audio target boundaries", () => {
  const raw = base();
  const point = { at: 0, value: 0 };
  const lane = { target: "gain", points: [point] };
  has({ ...raw, tracks: [{ ...raw.tracks[0], automation: Array.from({ length: 33 }, () => lane) }] },
    "$.tracks[0].automation", "at most 32 lanes");
  has({ ...raw, tracks: [{ ...raw.tracks[0], automation: [{ target: "gain", points: [point, point, point] }] }] },
    "$.tracks[0].automation[0].points[2].at", "at most two points at one beat");
  has({ ...raw, tracks: [{ ...raw.tracks[0], automation: [lane, lane] }] },
    "$.tracks[0].automation[1].target", "duplicate automation target");
  has({ ...raw, tracks: [{ ...raw.tracks[0], fx: [{ type: "filter" }], automation: [{ target: "fx.0.q", points: [point] }] }] },
    "$.tracks[0].automation[0].target", "parameter is not automatable");
  has({ ...raw, tracks: [{ ...raw.tracks[0], fx: [{ type: "filter" }], automation: [{ target: "fx.0.cutoffHz", points: [{ at: 0, value: 19 }] }] }] },
    "$.tracks[0].automation[0].points[0].value", "outside target range");
  has({ ...raw, audioTracks: [{ id: "vox", clips: [{ file: "v.wav", start: 0, length: 1 }],
    automation: [{ target: "param.cutoffHz", points: [point] }] }] }, "$.audioTracks[0].automation[0].target", "param target requires music track");
});

void test("sfz references, audio source paths and duck sources are validated without file reads", () => {
  const raw = base();
  assert.equal(validateSong({ ...raw, tracks: [{ ...raw.tracks[0], instrument: "sfz:instruments/keys.sfz" }] }).tracks[0]?.instrument,
    "sfz:instruments/keys.sfz");
  has({ ...raw, tracks: [{ ...raw.tracks[0], instrument: "sfz:../keys.sfz" }] }, "$.tracks[0].instrument");
  has({ ...raw, tracks: [{ ...raw.tracks[0], instrument: "sfz:/tmp/keys.sfz" }] }, "$.tracks[0].instrument");
  has({ ...raw, tracks: [{ ...raw.tracks[0], kind: "drums", instrument: "sfz:keys.sfz", notes: [{ start: 0, length: 1, sample: "bd" }] }] },
    "$.tracks[0].instrument");
  has({ ...raw, audioTracks: [{ id: "vox", clips: [{ file: "C:/v.wav", start: 0, length: 1 }] }] }, "$.audioTracks[0].clips[0].file");
  has({ ...raw, audioTracks: [{ id: "vox", duck: { by: "ghost", amount: 0.5 }, clips: [{ file: "v.wav", start: 0, length: 1 }] }] },
    "$.audioTracks[0].duck.by");
  has({ ...raw, audioTracks: [{ id: "vox", fx: [{ type: "eq", lowHz: 400, midHz: 300 }], clips: [{ file: "v.wav", start: 0, length: 1 }] }] },
    "$.audioTracks[0].fx[0].lowHz", "must be below midHz");
  has({ ...raw, tracks: [{ id: "lead", kind: "notes", instrument: "piano" }],
    audioTracks: [{ id: "vox", duck: { by: "lead", amount: 0.5 }, clips: [{ file: "v.wav", start: 0, length: 1 }] }] },
    "$.audioTracks[0].duck.by");
});

void test("clip positions overlap after rounding and fit stretch uses resolved ticks", () => {
  const raw = base();
  has({ ...raw, audioTracks: [{ id: "vox", clips: [
    { file: "a.wav", start: 0, length: 0.0006 }, { file: "b.wav", start: 0.0005, length: 1 },
  ] }] }, "$.audioTracks[0].clips[1]", "overlaps clip 0");
  has({ ...raw, audioTracks: [{ id: "vox", clips: [{ file: "a.wav", start: 0, length: 1,
    stretch: { mode: "fit", sourceSeconds: 20 } }] }] }, "$.audioTracks[0].clips[0].stretch", "stretch ratio outside 0.25..4");
  const song = validateSong({ ...raw, audioTracks: [{ id: "vox", clips: [{ file: "a.wav", start: 0, length: 1,
    stretch: { mode: "fit", sourceSeconds: 0.5 } }] }] });
  assert.deepEqual(song.audioTracks?.[0]?.clips[0]?.stretch, { mode: "fit", sourceSeconds: 0.5 });
});
