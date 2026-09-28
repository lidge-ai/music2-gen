import assert from "node:assert/strict";
import test from "node:test";
import { validateSong } from "../song/index.ts";
import type { SmfFile, SmfTrack } from "./smf.schema.ts";
import { smfToSong } from "./to-song.tool.ts";
import { readSmf } from "./read.tool.ts";

const bytes = (hex: string): Uint8Array => Uint8Array.from(hex.trim().split(/\s+/).map((value) => parseInt(value, 16)));
const readerFixture = bytes(`4D 54 68 64 00 00 00 06 00 00 00 01 00 60
  4D 54 72 6B 00 00 00 11
  00 90 3C 64 60 3C 00 00 40 64 60 40 00 00 FF 2F 00`);
const meta = (tick: number, type: number, ...data: number[]) => ({ tick, kind: "meta" as const, type, data: Uint8Array.of(...data) });
function file(events: SmfTrack["events"], endTick = 7680): SmfFile {
  return { format: 0, ppq: 960, tracks: [{ events, endTick, sourceIndex: 0 }], warnings: [] };
}

test("format-0 running status and velocity-zero offs scale PPQ 96 to Song beats", () => {
  const converted = smfToSong(readSmf(readerFixture));
  assert.equal(converted.song.bpm, 120);
  assert.deepEqual(converted.song.tracks[0]!.notes, [
    { start: 0, length: 1, pitch: 60, velocity: 100 / 127 },
    { start: 1, length: 1, pitch: 64, velocity: 100 / 127 },
  ]);
  assert.equal(converted.bars, 1);
  validateSong(converted.song);
});

test("FIFO pairing, channel split, hanging notes and static CC clamps", () => {
  const source = file([
    { tick: 0, kind: "cc", channel: 0, controller: 7, value: 3 },
    { tick: 0, kind: "cc", channel: 0, controller: 10, value: 0 },
    { tick: 0, kind: "noteOn", channel: 0, key: 60, velocity: 100 },
    { tick: 240, kind: "noteOn", channel: 0, key: 60, velocity: 90 },
    { tick: 480, kind: "noteOff", channel: 0, key: 60, velocity: 64 },
    { tick: 0, kind: "noteOn", channel: 9, key: 36, velocity: 127 },
    { tick: 960, kind: "noteOff", channel: 9, key: 36, velocity: 64 },
  ], 1920);
  const converted = smfToSong(source);
  assert.equal(converted.song.tracks.length, 2);
  assert.deepEqual(converted.song.tracks[0]!.notes, [
    { start: 0, length: 0.5, pitch: 60, velocity: 100 / 127 },
    { start: 0.25, length: 1.75, pitch: 60, velocity: 90 / 127 },
  ]);
  assert.deepEqual(converted.song.tracks[1]!.notes, [{ start: 0, length: 1, sample: "bd", velocity: 1 }]);
  assert.equal(converted.song.tracks[0]!.gain, -60);
  assert.equal(converted.song.tracks[0]!.pan, -1);
  assert.ok(converted.warnings.includes("MIDI_CC_CLAMPED:track_1.7@0=3"));
  assert.ok(converted.warnings.includes("MIDI_CC_CLAMPED:track_1.10@0=0"));
  assert.ok(converted.warnings.some((w) => w.startsWith("UNTERMINATED_NOTE:")));
  validateSong(converted.song);
});

test("CC7/CC10 changes import as hold lanes, same-tick last value wins and clamps warn", () => {
  const converted = smfToSong(file([
    { tick: 0, kind: "cc", channel: 0, controller: 7, value: 64 },
    { tick: 0, kind: "cc", channel: 0, controller: 10, value: 64 },
    { tick: 960, kind: "cc", channel: 0, controller: 7, value: 3 },
    { tick: 960, kind: "cc", channel: 0, controller: 7, value: 127 },
    { tick: 960, kind: "cc", channel: 0, controller: 10, value: 0 },
  ], 3840));
  const lanes = converted.song.tracks[0]!.automation!;
  assert.deepEqual(lanes.map((lane) => [lane.target, lane.points.length]), [["gain", 2], ["pan", 2]]);
  assert.equal(lanes[0]!.points[0]!.value, 40 * Math.log10(64 / 127));
  assert.deepEqual(lanes[0]!.points[1], { at: 1, value: 0, curve: "hold" });
  assert.deepEqual(lanes[1]!.points[1], { at: 1, value: -1, curve: "hold" });
  assert.ok(converted.warnings.includes("MIDI_CC_CLAMPED:track_1.10@960=0"));
  assert.ok(!converted.warnings.some((warning) => warning.startsWith("CC_AUTOMATION_DROPPED")));
  validateSong(converted.song);
});

test("6/8 rewrites to 3/4, aligned markers form sections, unaligned marker falls back", () => {
  const source = file([meta(0, 0x58, 6, 3, 24, 8), meta(0, 6, 65), meta(2880, 6, 66)], 5760);
  const aligned = smfToSong(source);
  assert.equal(aligned.song.meter.numerator, 3);
  assert.deepEqual(aligned.song.sections, [{ id: "a", bars: 1 }, { id: "b", bars: 1 }]);
  assert.ok(aligned.warnings.includes("METER_REWRITTEN"));
  const unaligned = smfToSong(file([meta(0, 6, 65), meta(1920, 6, 66)], 7680));
  assert.deepEqual(unaligned.song.sections, [{ id: "part_1", bars: 2 }]);
  assert.ok(unaligned.warnings.includes("MARKERS_NOT_SECTIONS"));
});

test("tempo changes and unrepresentable meter enforce capability in strict mode", () => {
  const source = file([meta(0, 0x51, 7, 0xa1, 0x20), meta(960, 0x51, 6, 0x8a, 0x1b)]);
  assert.ok(smfToSong(source).warnings.includes("TEMPO_CHANGE_DROPPED"));
  assert.throws(() => smfToSong(source, { strict: true }), { code: "E_CAPABILITY" });
  assert.throws(() => smfToSong(file([meta(0, 0x58, 5, 3, 24, 8)])), { code: "E_CAPABILITY" });
});

test("257 bars use one one-bar section and repeat chunks", () => {
  const result = smfToSong(file([], 257 * 3840));
  assert.deepEqual(result.song.sections, [{ id: "part_1", bars: 1 }]);
  assert.deepEqual(result.song.arrangement.map((entry) => entry.repeats), [64, 64, 64, 64, 1]);
  validateSong(result.song);
});

test("format-1 uses per-track identity, valid kit reverse map and channel grouping", () => {
  const bytes = (value: string): Uint8Array => Uint8Array.from(Buffer.from(value, "ascii"));
  const source: SmfFile = { format: 1, ppq: 960, warnings: [], tracks: [
    { sourceIndex: 0, endTick: 3840, events: [meta(0, 3, ...bytes("Title"))] },
    { sourceIndex: 1, endTick: 3840, events: [meta(0, 3, ...bytes("Clay Kit")), meta(0, 1, ...bytes("music2:kit:assets/kit")),
      { tick: 0, kind: "noteOn", channel: 9, key: 62, velocity: 100 },
      { tick: 960, kind: "noteOff", channel: 9, key: 62, velocity: 64 }] },
  ] };
  const identity = "kit:assets/kit";
  const withMap = smfToSong(source, { kitMaps: { [identity]: { 62: "clay" } } });
  assert.equal(withMap.song.title, "Title");
  assert.equal(withMap.song.tracks.length, 1);
  assert.equal(withMap.song.tracks[0]!.id, "clay_kit");
  assert.equal(withMap.song.tracks[0]!.instrument, identity);
  assert.deepEqual(withMap.song.tracks[0]!.notes, [{ start: 0, length: 1, sample: "clay", velocity: 100 / 127 }]);
  const fallback = smfToSong(source);
  assert.equal(fallback.song.tracks[0]!.instrument, "drums");
  assert.ok(fallback.warnings.includes("KIT_IDENTITY_DROPPED:clay_kit"));
  assert.ok(fallback.warnings.includes("UNKNOWN_DRUM_NOTE:clay_kit.62"));
});
