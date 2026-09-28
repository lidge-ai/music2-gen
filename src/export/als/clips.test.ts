import assert from "node:assert/strict";
import test from "node:test";
import type { ProjectNoteTrack } from "../../project/index.ts";
import { serialize } from "../xml.tool.ts";
import { buildAudioClip, buildMidiClips } from "./clips.tool.ts";
import { createAlsIds } from "./skeleton.tool.ts";

const meter = { tick: 0, numerator: 4, denominator: 4 } as const;
const base = { id: "lead", index: 0, type: "notes", instrument: { kind: "voice", id: "piano", params: {} },
  mono: false, gainDb: 0, pan: 0, sends: { reverb: 0, delay: 0 }, inserts: [], duck: null,
  automation: [], notes: [] } as ProjectNoteTrack;
const marker = { tick: 0, lengthTicks: 3840, name: "hook", section: "hook", role: null, ordinal: 0, occurrence: 0 };
test("section MIDI clips use local beats and keep boundary-crossing notes once", () => {
  const notes = [{ tick: 960, lengthTicks: 480, pitch: 60, sample: null, velocity: 100 / 127,
    eventIndex: 0, source: "list" as const, errorTicks: 0 },
    { tick: 3839, lengthTicks: 100, pitch: 64, sample: null, velocity: 1, eventIndex: 1, source: "list" as const, errorTicks: 0 }];
  const result = buildMidiClips({ ...base, notes }, [marker, { ...marker, tick: 3840, name: "hook (2)", occurrence: 1 }], meter, createAlsIds(1000));
  assert.equal(result.clips.length, 1);
  const xml = serialize(result.clips[0]!);
  assert.match(xml, /Time="1" Duration="0.5" Velocity="100"/);
  assert.match(xml, /CurrentEnd Value="4.103125"/);
  assert.match(xml, /NoteIdGenerator>[\s\S]*NextId Value="3"/);
  assert.equal((xml.match(/MidiNoteEvent/g) ?? []).length, 2);
});
test("frozen WAV clip carries portable path, frame duration and warp endpoints", () => {
  const xml = serialize(buildAudioClip("Samples/Imported/track-lead.wav", 96000, 48000, 24, 120, createAlsIds(1000)));
  assert.match(xml, /DefaultDuration Value="96000"/);
  assert.match(xml, /DefaultSampleRate Value="48000"/);
  assert.match(xml, /CurrentEnd Value="4"/);
  assert.match(xml, /SecTime="2" BeatTime="4"/);
  assert.match(xml, /RelativePath Value="Samples\/Imported\/track-lead.wav"/);
  assert.match(xml, /OriginalFileSize Value="576044"/);
});
