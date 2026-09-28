import assert from "node:assert/strict";
import test from "node:test";
import type { ProjectIR } from "../../project/index.ts";
import { serialize } from "../xml.tool.ts";
import { createAlsIds } from "./skeleton.tool.ts";
import { buildAlsTracks } from "./tracks.tool.ts";

const audio = { left: new Float32Array(96000), right: new Float32Array(96000), sampleRate: 48000 as const, sourceChannels: 2 as const };
const project = { ppq: 960, seed: 1, sampleRate: 48000, tempo: [{ tick: 0, bpm: 120 }],
  meter: [{ tick: 0, numerator: 4, denominator: 4 }], markers: [],
  buses: { reverb: { kind: "reverb" }, delay: { kind: "delay" } },
  tracks: [{ id: "lead", type: "notes", instrument: { kind: "voice", id: "piano", params: {} },
    notes: [], gainDb: 0, pan: 0, sends: { reverb: 0.2, delay: 0.3 }, automation: [], inserts: [], duck: null }],
} as unknown as ProjectIR;
test("both mutes editable MIDI while frozen and wet return tracks play once", () => {
  const result = buildAlsTracks(project, "both", { stems: [{ trackId: "lead", audio }],
    returns: { reverb: audio, delay: audio } }, 24, createAlsIds(1000));
  assert.deepEqual(result.nodes.map((node) => node.tag),
    ["MidiTrack", "AudioTrack", "AudioTrack", "AudioTrack", "ReturnTrack", "ReturnTrack"]);
  assert.equal(result.regular, 4);
  const midi = serialize(result.nodes[0]!); const frozen = serialize(result.nodes[1]!);
  assert.match(midi, /<Speaker>[\s\S]*Manual Value="0"/);
  assert.match(frozen, /<Speaker>[\s\S]*Manual Value="1"/);
  assert.equal(result.samples.length, 3);
});

test("mixer clamps excessive source gain and records unsupported lanes", () => {
  const loud = { ...project, tracks: [{ ...project.tracks[0]!, gainDb: 12, automation: [
    { target: "send.reverb", points: [{ tick: 0, value: 0.5, curve: "hold" as const }] },
  ] }] } as ProjectIR;
  const result = buildAlsTracks(loud, "midi", null, 24, createAlsIds(1000));
  assert.ok(result.warnings.includes("ALS_GAIN_CLAMPED:lead"));
  assert.ok(result.warnings.includes("ALS_AUTOMATION_OMITTED:lead.send.reverb:1"));
  assert.match(serialize(result.nodes[0]!), /Manual Value="1.99526238"/);
});
