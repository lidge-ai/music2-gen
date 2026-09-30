import assert from "node:assert/strict";
import test from "node:test";
import { gunzipSync } from "node:zlib";
import type { ProjectIR, ProjectNoteTrack } from "../project/index.ts";
import { buildProject } from "../project/index.ts";
import { buildTimeline, validateSong } from "../song/index.ts";
import { planAls } from "./als.tool.ts";
import { readOwnXml } from "./als/xml-reader.test.ts";

const project = { version: 1, ppq: 960, title: "A & B", seed: 1, sampleRate: 48000,
  tempo: [{ tick: 0, bpm: 120 }], meter: [{ tick: 0, numerator: 4, denominator: 4 }],
  markers: [{ tick: 0, lengthTicks: 3840, name: `A & <B> "C" 'D'`, section: "a", role: null, ordinal: 0, occurrence: 0 }],
  tracks: [{ id: "lead", type: "notes", instrument: { kind: "voice", id: "piano", params: {} }, notes: [
    { tick: 960, lengthTicks: 480, pitch: 60, sample: null, velocity: 100 / 127,
      eventIndex: 0, source: "list", errorTicks: 0 }], gainDb: 0, pan: 0, sends: { reverb: 0, delay: 0 },
    automation: [], inserts: [], duck: null }], buses: { reverb: null, delay: null },
  master: { gainDb: 0, ceilingDb: -1, targetLufs: null, inserts: [] },
  quantization: { events: 0, inexact: 0, maxErrorTicks: 0 },
} as unknown as ProjectIR;
const audio = { left: new Float32Array(96000), right: new Float32Array(96000), sampleRate: 48000 as const, sourceChannels: 2 as const };
test("ALS surfaces layer flattening warnings in editable and frozen modes", () => {
  const song = validateSong({ version: 1, bpm: 120, sampleRate: 48000, tailSeconds: 0,
    tracks: [{ id: "lead", kind: "notes", instrument: "piano", pattern: "c4",
      layers: [{ id: "double", instrument: "lead", transpose: 12 }] }],
    sections: [{ id: "a", bars: 1 }], arrangement: [{ section: "a" }] });
  const ir = buildProject(song, buildTimeline(song));
  for (const content of ["midi", "audio", "both"] as const) {
    const captured = content === "midi" ? null : { stems: [{ trackId: "lead", audio }],
      returns: { reverb: null, delay: null } };
    const plan = planAls(ir, captured, { content, bits: 24 });
    assert.equal(plan.warnings.filter((warning) => warning === "LAYERS_FLATTENED:lead:1").length, 1);
  }
});
test("MIDI ALS warns once per plugin-bearing track", () => {
  const withPlugins = { ...project, tracks: [{ ...project.tracks[0]!,
    plugins: [{ id: "softclip", params: { drive: 0.5 } }] }] } as ProjectIR;
  const midi = planAls(withPlugins, null, { content: "midi", bits: 24 });
  assert.equal(midi.warnings.filter((warning) => warning === "PLUGIN_NOT_PORTABLE:lead").length, 1);
  const both = planAls(withPlugins, { stems: [{ trackId: "lead", audio }],
    returns: { reverb: null, delay: null } }, { content: "both", bits: 24 });
  assert.equal(both.warnings.includes("PLUGIN_NOT_PORTABLE:lead"), false);
});
test("ALS plan is deterministic, portable and marks every result experimental", () => {
  const first = planAls(project, null, { content: "midi", bits: 24 });
  const second = planAls(project, null, { content: "midi", bits: 24 });
  assert.deepEqual(first.files, second.files);
  assert.equal(first.data.experimental, true);
  assert.match(first.warnings[0]!, /^ALS_EXPERIMENTAL:/);
  assert.equal(first.files.length, 1);
  const xml = gunzipSync((first.files[0] as { bytes: Uint8Array }).bytes).toString("utf8");
  assert.match(xml, /Name Value="A &amp; &lt;B&gt; &quot;C&quot; &apos;D&apos;"/);
  assert.ok(!xml.includes("/tmp/"));
  const parsed = readOwnXml(xml);
  const nodes: typeof parsed[] = [];
  const walk = (node: typeof parsed): void => { nodes.push(node); node.children.forEach(walk); };
  walk(parsed);
  assert.equal(nodes.find((node) => node.tag === "Locator")?.children.find((node) => node.tag === "Name")?.attrs.Value,
    `A & <B> "C" 'D'`);
  const targets = new Set(nodes.filter((node) => node.tag === "AutomationTarget").map((node) => node.attrs.Id));
  for (const node of nodes.filter((item) => item.tag === "PointeeId")) assert.ok(targets.has(node.attrs.Value));
  const next = Number(nodes.find((node) => node.tag === "NextPointeeId")?.attrs.Value);
  assert.ok(next > Math.max(...nodes.flatMap((node) => node.attrs.Id ? [Number(node.attrs.Id)] : [])));
});
test("both includes aligned frozen WAV descriptor and a muted source track", () => {
  const result = planAls(project, { stems: [{ trackId: "lead", audio }], returns: { reverb: null, delay: null } },
    { content: "both", bits: 16 });
  assert.deepEqual(result.data.samples, ["Samples/Imported/track-lead.wav"]);
  assert.equal(result.data.tracks, 2);
  assert.equal(result.files[0]!.path, "Samples/Imported/track-lead.wav");
  assert.equal(result.files[1]!.path, "a-b.als");
  const xml = gunzipSync((result.files[1] as { bytes: Uint8Array }).bytes).toString("utf8");
  assert.match(xml, /<MidiTrack Id="/);
  assert.match(xml, /<AudioTrack Id="/);
  assert.match(xml, /RelativePath Value="Samples\/Imported\/track-lead.wav"/);
});
test("future tempo map and missing rendered stem fail explicitly", () => {
  assert.throws(() => planAls({ ...project, tempo: [...project.tempo, { tick: 960, bpm: 100 }] }, null,
    { content: "midi", bits: 24 }), { code: "E_CAPABILITY" });
  assert.throws(() => planAls(project, { stems: [], returns: { reverb: null, delay: null } },
    { content: "audio", bits: 24 }), { code: "E_RENDER" });
});
test("600 hold points reserve local event IDs below the global range", () => {
  const points = Array.from({ length: 600 }, (_, index) =>
    ({ tick: index * 960, value: index % 2 ? -3 : 0, curve: "hold" as const }));
  const automated = { ...project, tracks: [{ ...project.tracks[0]!, automation: [
    { target: "gain", points },
  ] }] } as ProjectIR;
  const result = planAls(automated, null, { content: "midi", bits: 24 });
  const xml = gunzipSync((result.files[0] as { bytes: Uint8Array }).bytes).toString("utf8");
  const parsed = readOwnXml(xml);
  const nodes: typeof parsed[] = [];
  const walk = (node: typeof parsed): void => { nodes.push(node); node.children.forEach(walk); };
  walk(parsed);
  const next = Number(nodes.find((node) => node.tag === "NextPointeeId")?.attrs.Value);
  const localTags = new Set(["Locator", "KeyTrack", "FloatEvent", "EnumEvent", "AutomationEnvelope"]);
  const locals = nodes.filter((node) => localTags.has(node.tag) && node.attrs.Id !== undefined)
    .map((node) => Number(node.attrs.Id));
  const globals = nodes.filter((node) => !localTags.has(node.tag) && node.attrs.Id !== undefined)
    .map((node) => Number(node.attrs.Id));
  assert.equal(Math.max(...locals), 1199);
  assert.ok(Math.min(...globals) > Math.max(...locals));
  assert.ok(Math.max(...globals) < next);
  assert.equal(new Set(globals).size, globals.length);
});
test("ALS rejects oversized XML before building the set", () => {
  const repeated = Array(20_000).fill((project.tracks[0] as ProjectNoteTrack).notes[0]);
  const huge = { ...project, tracks: Array.from({ length: 16 }, (_, index) =>
    ({ ...project.tracks[0]!, id: `lead${index}`, notes: repeated })) } as ProjectIR;
  assert.throws(() => planAls(huge, null, { content: "midi", bits: 24 }), { code: "E_CAPABILITY" });
});
