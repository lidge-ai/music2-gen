import assert from "node:assert/strict";
import test from "node:test";
import { buildProject } from "../project/index.ts";
import { buildTimeline, validateSong } from "../song/index.ts";
import type { ProjectIR, ProjectNoteTrack } from "../project/index.ts";
import { projectToSmf } from "./from-project.tool.ts";
import { writeSmf } from "./write.tool.ts";

function project(): ProjectIR {
  const song = validateSong({ version: 1, title: "T", bpm: 120, tracks: [{ id: "p", kind: "notes",
    instrument: "piano", notes: [{ start: 0, length: 1, pitch: 60, velocity: 0.8 }] }],
    sections: [{ id: "hook", bars: 1 }], arrangement: [{ section: "hook" }] });
  return buildProject(song, buildTimeline(song));
}
const events = (ir: ProjectIR) => projectToSmf(ir).file.tracks[1]!.events;

test("projection writes placement marker, identity, static CC and exact note ticks", () => {
  const result = projectToSmf(project());
  assert.equal(result.file.format, 1);
  assert.equal(result.file.ppq, 960);
  assert.equal(result.file.tracks.length, 2);
  assert.equal(result.file.tracks[0]!.endTick, 3840);
  assert.deepEqual(result.file.tracks[0]!.events.filter((e) => e.kind === "meta" && e.type === 6)
    .map((e) => e.kind === "meta" ? String.fromCharCode(...e.data) : ""), ["hook"]);
  assert.deepEqual(events(project()).filter((e) => e.kind === "noteOn" || e.kind === "noteOff"), [
    { tick: 0, kind: "noteOn", channel: 0, key: 60, velocity: 102 },
    { tick: 960, kind: "noteOff", channel: 0, key: 60, velocity: 64 },
  ]);
  assert.deepEqual(events(project()).filter((e) => e.kind === "cc"), [
    { tick: 0, kind: "cc", channel: 0, controller: 7, value: 127 },
    { tick: 0, kind: "cc", channel: 0, controller: 10, value: 64 },
  ]);
  assert.equal(result.notes, 1);
  assert.equal(result.channels.p, 1);
  assert.ok(writeSmf(result.file).length > 101); // one required FF 06 placement marker
});

test("unrepresentable key and non-MIDI lanes warn while gain/pan curves emit CCs", () => {
  const ir = project();
  ir.key = { tonic: "Fb", mode: "major" };
  ir.quantization = { events: 3, inexact: 1, maxErrorTicks: 0.4 };
  const track = ir.tracks[0] as ProjectNoteTrack;
  track.gainDb = -12;
  track.automation = [
    { target: "gain", points: [{ tick: 960, value: -6, curve: "linear" }, { tick: 1920, value: 0, curve: "linear" }] },
    { target: "pan", points: [{ tick: 480, value: -1, curve: "linear" }, { tick: 960, value: 1, curve: "linear" }] },
    { target: "send.reverb", points: [{ tick: 0, value: 0.5, curve: "hold" }] },
  ];
  const result = projectToSmf(ir);
  assert.ok(!result.file.tracks[0]!.events.some((e) => e.kind === "meta" && e.type === 0x59));
  assert.ok(result.warnings.includes("KEY_SIGNATURE_OMITTED:Fb major"));
  assert.ok(result.warnings.includes("QUANTIZED_PATTERN_EVENTS: inexact=1, maxErrorTicks=0.4"));
  assert.deepEqual(result.warnings.filter((w) => w.startsWith("MIDI_AUTOMATION_OMITTED:")), [
    "MIDI_AUTOMATION_OMITTED:p.send.reverb",
  ]);
  const cc = result.file.tracks[1]!.events.filter((e) => e.kind === "cc");
  assert.deepEqual(cc.filter((e) => e.tick === 0), [
    { tick: 0, kind: "cc", channel: 0, controller: 7, value: 90 },
    { tick: 0, kind: "cc", channel: 0, controller: 10, value: 1 },
  ]);
  assert.ok(cc.some((e) => e.kind === "cc" && e.tick === 1920 && e.controller === 7 && e.value === 127));
  assert.ok(cc.some((e) => e.kind === "cc" && e.tick === 960 && e.controller === 10 && e.value === 127));
  assert.equal(track.gainDb, -12);
});

test("hold gain step emits only endpoints and duplicate tick keeps the effective value", () => {
  const ir = project();
  const track = ir.tracks[0] as ProjectNoteTrack;
  track.automation = [{ target: "gain", points: [
    { tick: 0, value: -12, curve: "hold" }, { tick: 960, value: -12, curve: "linear" },
    { tick: 960, value: 0, curve: "hold" },
  ] }];
  const cc7 = events(ir).filter((e): e is Extract<typeof e, { kind: "cc" }> => e.kind === "cc" && e.controller === 7);
  assert.deepEqual(cc7.map((e) => [e.tick, e.value]), [[0, 64], [960, 127]]);
});

test("same-pitch overlaps clip and channel allocation reuses the first pitched channel", () => {
  const ir = project();
  const base = ir.tracks[0] as ProjectNoteTrack;
  base.notes = [base.notes[0]!, { ...base.notes[0]!, tick: 960, eventIndex: 1 }];
  base.notes[0]!.lengthTicks = 1200;
  const clipped = projectToSmf(ir);
  assert.equal(clipped.dropped.overlapTruncated, 1);
  assert.deepEqual(clipped.file.tracks[1]!.events.filter((e) => e.kind === "noteOff").map((e) => e.tick), [960, 1920]);
  ir.tracks = Array.from({ length: 16 }, (_, i) => ({ ...base, id: `p${i}`, index: i, notes: [] }));
  const allocated = projectToSmf(ir);
  assert.equal(allocated.channels.p0, 1);
  assert.equal(allocated.channels.p15, 1);
  assert.ok(allocated.warnings.includes("CHANNEL_REUSED:p15"));
  assert.ok(allocated.warnings.includes("DAW_CHANNEL_MERGE:p15"));
});

test("drums and SFX use channel 10, with private notes and shared-mix warning", () => {
  const ir = project();
  const base = ir.tracks[0] as ProjectNoteTrack;
  const drum = { ...base, id: "drum_a", type: "drums" as const,
    instrument: { kind: "voice" as const, id: "drums", params: {} },
    notes: [{ ...base.notes[0]!, pitch: null, sample: { name: "bd", index: 0 } },
      { ...base.notes[0]!, pitch: null, sample: { name: "tom", index: 3 }, tick: 960, eventIndex: 1 }] };
  const second = { ...drum, id: "drum_b", gainDb: -6,
    notes: [{ ...base.notes[0]!, pitch: null, sample: { name: "hh", index: 1 } }] };
  const effects = { ...drum, id: "fx", instrument: { kind: "voice" as const, id: "sfx", params: {} },
    notes: [{ ...base.notes[0]!, pitch: null, sample: { name: "riser", index: 1 } }] };
  ir.tracks = [drum, second, effects];
  const result = projectToSmf(ir);
  assert.deepEqual(result.channels, { drum_a: 10, drum_b: 10, fx: 10 });
  assert.deepEqual(result.file.tracks[1]!.events.filter((e) => e.kind === "noteOn").map((e) => "key" in e ? e.key : -1), [36, 50]);
  assert.deepEqual(result.file.tracks[2]!.events.filter((e) => e.kind === "noteOn").map((e) => "key" in e ? e.key : -1), [42]);
  assert.deepEqual(result.file.tracks[3]!.events.filter((e) => e.kind === "noteOn").map((e) => "key" in e ? e.key : -1), [84]);
  assert.ok(result.warnings.includes("DRUM_MIX_LOSS:drum_b"));
  assert.ok(result.warnings.includes("SFX_PRIVATE_NOTES:fx"));
  assert.equal(result.dropped.drumVariantsDropped, 2);
});

test("explicit kit map wins and unused manifest names do not invalidate projection", () => {
  const ir = project();
  const base = ir.tracks[0] as ProjectNoteTrack;
  ir.tracks = [{ ...base, id: "kit", type: "drums", instrument: { kind: "kit", ref: "assets/kit" },
    notes: [{ ...base.notes[0]!, pitch: null, sample: { name: "clay", index: 0 } }] }];
  const result = projectToSmf(ir, { kitMaps: { kit: { kick: 36, clay: 62 } } });
  assert.deepEqual(result.file.tracks[1]!.events.filter((e) => e.kind === "noteOn").map((e) => "key" in e ? e.key : -1), [62]);
  assert.equal(result.notes, 1);
});

test("shared channel-10 same-key notes clip across different MTrks", () => {
  const ir = project();
  const base = ir.tracks[0] as ProjectNoteTrack;
  const first: ProjectNoteTrack = { ...base, id: "a", type: "drums",
    instrument: { kind: "voice", id: "drums", params: {} },
    notes: [{ ...base.notes[0]!, pitch: null, sample: { name: "bd", index: 0 }, lengthTicks: 1200 }] };
  const second: ProjectNoteTrack = { ...first, id: "b",
    notes: [{ ...first.notes[0]!, tick: 960, lengthTicks: 960 }] };
  ir.tracks = [first, second];
  const result = projectToSmf(ir);
  assert.equal(result.dropped.overlapTruncated, 1);
  assert.equal(result.file.tracks[1]!.events.find((e) => e.kind === "noteOff")?.tick, 960);
  assert.equal(result.notes, 2);
});

test("repeated section placements retain ordered marker names", () => {
  const song = validateSong({ version: 1, bpm: 120, tracks: [{ id: "p", kind: "notes", instrument: "piano", notes: [] }],
    sections: [{ id: "hook", bars: 1 }], arrangement: [{ section: "hook", repeats: 2 }] });
  const result = projectToSmf(buildProject(song, buildTimeline(song)));
  assert.deepEqual(result.file.tracks[0]!.events.filter((e) => e.kind === "meta" && e.type === 6)
    .map((e) => e.kind === "meta" ? [e.tick, String.fromCharCode(...e.data)] : []),
    [[0, "hook"], [3840, "hook (2)"]]);
  assert.equal(result.file.tracks[0]!.endTick, 7680);
});

test("user kit metadata preserves mappings and pitched-kit channels without reading manifests", () => {
  const ir = project();
  const track = ir.tracks[0] as ProjectNoteTrack;
  track.instrument = { kind: "user", id: "synthetic" };
  const options = { userInstruments: { synthetic: "kit" as const }, kitMaps: { p: { bd: 47 } } };
  assert.throws(() => projectToSmf(ir), { code: "E_CAPABILITY", message: "user instrument synthetic is not imported" });
  const pitched = projectToSmf(ir, options);
  assert.equal(pitched.channels.p, 10);
  assert.deepEqual(pitched.file.tracks[1]!.events.flatMap((event) => event.kind === "noteOn" ? [event.key] : []), [60]);
  assert.ok(pitched.warnings.includes("MIDI_SOUND_NOT_PORTABLE:p:user:synthetic"));
  track.type = "drums";
  track.notes[0] = { ...track.notes[0]!, pitch: null, sample: { name: "bd", index: 0 } };
  const drums = projectToSmf(ir, options);
  assert.deepEqual(drums.file.tracks[1]!.events.flatMap((event) => event.kind === "noteOn" ? [event.key] : []), [47]);
  assert.throws(() => projectToSmf(ir, { userInstruments: { synthetic: "sfz" } }), { code: "E_SCHEMA" });
});
