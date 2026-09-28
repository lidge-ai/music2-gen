import assert from "node:assert/strict";
import test from "node:test";
import { readSmf } from "./read.tool.ts";

test("running-status CC7/CC10 retains ordered repeated values at a tick", () => {
  const bytes = Uint8Array.from([0x4d,0x54,0x68,0x64,0,0,0,6,0,0,0,1,3,0xc0,
    0x4d,0x54,0x72,0x6b,0,0,0,18,
    0,0xb0,7,64, 0,10,64, 0,7,127, 0x87,0x40,10,1, 0,0xff,0x2f,0]);
  assert.deepEqual(readSmf(bytes).tracks[0]!.events.filter((event) => event.kind === "cc"), [
    { tick: 0, kind: "cc", channel: 0, controller: 7, value: 64 },
    { tick: 0, kind: "cc", channel: 0, controller: 10, value: 64 },
    { tick: 0, kind: "cc", channel: 0, controller: 7, value: 127 },
    { tick: 960, kind: "cc", channel: 0, controller: 10, value: 1 },
  ]);
});

function bytes(hex: string): Uint8Array { return Uint8Array.from(hex.trim().split(/\s+/).map((part) => parseInt(part, 16))); }

const f5 = bytes(`4D 54 68 64 00 00 00 06 00 00 00 01 00 60
  4D 54 72 6B 00 00 00 11 00 90 3C 64 60 3C 00 00 40 64 60 40 00 00 FF 2F 00`);
const empty = bytes("4D 54 68 64 00 00 00 06 00 00 00 01 03 C0 4D 54 72 6B 00 00 00 04 00 FF 2F 00");

test("reader-only PPQ-96 fixture handles running status and velocity-zero offs", () => {
  const file = readSmf(f5);
  assert.equal(file.format, 0);
  assert.equal(file.ppq, 96);
  assert.equal(file.tracks[0]!.endTick, 192);
  assert.deepEqual(file.tracks[0]!.events, [
    { tick: 0, kind: "noteOn", channel: 0, key: 60, velocity: 100 },
    { tick: 96, kind: "noteOff", channel: 0, key: 60, velocity: 0 },
    { tick: 96, kind: "noteOn", channel: 0, key: 64, velocity: 100 },
    { tick: 192, kind: "noteOff", channel: 0, key: 64, velocity: 0 },
  ]);
});

test("official 81-byte format-0 vector decodes channel events and ticks", () => {
  const official = bytes(`4D 54 68 64 00 00 00 06 00 00 00 01 00 60
    4D 54 72 6B 00 00 00 3B
    00 FF 58 04 04 02 18 08 00 FF 51 03 07 A1 20
    00 C0 05 00 C1 2E 00 C2 46 00 92 30 60 00 3C 60
    60 91 43 40 60 90 4C 20 81 40 82 30 40 00 3C 40
    00 81 43 40 00 80 4C 40 00 FF 2F 00`);
  assert.equal(official.length, 81);
  const file = readSmf(official);
  assert.deepEqual(file.tracks[0]!.events.map((event) => event.tick), [0, 0, 0, 0, 0, 0, 0, 96, 192, 384, 384, 384, 384]);
  assert.equal(file.tracks[0]!.endTick, 384);
});

test("extended header and unknown chunks are skipped", () => {
  const extended = bytes(`4D 54 68 64 00 00 00 08 00 00 00 01 03 C0 AB CD
    58 58 58 58 00 00 00 02 00 00 4D 54 72 6B 00 00 00 04 00 FF 2F 00`);
  assert.deepEqual(readSmf(extended).tracks[0]!.events, []);
});

test("format-1 conductor and music chunks retain metadata and track indices", () => {
  const fixture = bytes(`4D 54 68 64 00 00 00 06 00 01 00 02 03 C0
    4D 54 72 6B 00 00 00 19 00 FF 03 01 54 00 FF 58 04 04 02 18 08
    00 FF 51 03 07 A1 20 9E 00 FF 2F 00
    4D 54 72 6B 00 00 00 2E 00 FF 03 01 70
    00 FF 01 0C 6D 75 73 69 63 32 3A 70 69 61 6E 6F
    00 C0 00 00 B0 07 7F 00 B0 0A 40 00 90 3C 66
    87 40 80 3C 40 96 40 FF 2F 00`);
  const file = readSmf(fixture);
  assert.deepEqual(file.tracks.map((track) => [track.sourceIndex, track.endTick]), [[0, 3840], [1, 3840]]);
  assert.deepEqual(file.tracks[1]!.events.slice(-2), [
    { tick: 0, kind: "noteOn", channel: 0, key: 60, velocity: 102 },
    { tick: 960, kind: "noteOff", channel: 0, key: 60, velocity: 64 },
  ]);
});

test("independent format-1 tempo-change and marker vector preserves absolute ticks", () => {
  const f2 = bytes(`4D 54 68 64 00 00 00 06 00 01 00 02 03 C0
    4D 54 72 6B 00 00 00 3C
    00 FF 03 04 44 65 6D 6F 00 FF 58 04 04 02 18 08
    00 FF 59 02 00 00 00 FF 51 03 07 A1 20
    00 FF 06 05 49 6E 74 72 6F
    9E 00 FF 06 05 56 65 72 73 65 00 FF 51 03 06 8A 1B
    9E 00 FF 2F 00
    4D 54 72 6B 00 00 00 2B
    00 FF 03 04 42 61 73 73 00 C0 21 00 B0 07 64 00 B0 0A 40
    00 90 24 64 87 40 80 24 40 96 40 90 2B 5A 83 60 80 2B 40
    9A 20 FF 2F 00`);
  assert.equal(f2.length, 133);
  const file = readSmf(f2);
  assert.deepEqual(file.tracks.map((track) => track.endTick), [7680, 7680]);
  assert.deepEqual(file.tracks[0]!.events.filter((event) => event.kind === "meta" && event.type === 6)
    .map((event) => event.tick), [0, 3840]);
  assert.deepEqual(file.tracks[1]!.events.filter((event) => event.kind === "noteOn" || event.kind === "noteOff")
    .map((event) => event.tick), [0, 960, 3840, 4320]);
});

test("controller fixture decodes bend LSB-first, CC, and channel pressure", () => {
  const f4 = bytes(`4D 54 68 64 00 00 00 06 00 00 00 01 03 C0
    4D 54 72 6B 00 00 00 2F
    00 E0 00 40 00 B0 01 40 00 B0 21 00 00 B0 4A 40
    81 70 E0 7F 7F 81 70 E0 00 00 00 D0 64
    81 70 B0 40 7F 81 70 B0 40 00 00 E0 00 40
    00 FF 2F 00`);
  assert.equal(f4.length, 69);
  const events = readSmf(f4).tracks[0]!.events;
  assert.deepEqual(events.filter((event) => event.kind === "pitchBend"), [
    { tick: 0, kind: "pitchBend", channel: 0, value14: 8192 },
    { tick: 240, kind: "pitchBend", channel: 0, value14: 16383 },
    { tick: 480, kind: "pitchBend", channel: 0, value14: 0 },
    { tick: 960, kind: "pitchBend", channel: 0, value14: 8192 },
  ]);
  assert.deepEqual(events.find((event) => event.kind === "channelPressure"),
    { tick: 480, kind: "channelPressure", channel: 0, value: 100 });
});

test("unknown meta and SysEx lengths remain bounded to their track", () => {
  const fixture = bytes(`4D 54 68 64 00 00 00 06 00 00 00 01 03 C0
    4D 54 72 6B 00 00 00 15
    00 FF 7E 02 AA BB 00 F0 03 01 02 F7 00 F7 02 7E 00 00 FF 2F 00`);
  const file = readSmf(fixture);
  assert.deepEqual(file.tracks[0]!.events.map((event) => event.kind), ["meta", "sysex", "sysex"]);
  const truncated = fixture.slice();
  truncated[30] = 0x20; // F0 declared length crosses the track's available event bytes.
  assert.throws(() => readSmf(truncated), { code: "E_PARSE" });
});

test("standard meta fields accept excess bytes and reject missing prefixes", () => {
  const extra = bytes(`4D 54 68 64 00 00 00 06 00 00 00 01 03 C0
    4D 54 72 6B 00 00 00 0C 00 FF 51 04 07 A1 20 7F 00 FF 2F 00`);
  assert.deepEqual(readSmf(extra).tracks[0]!.events[0],
    { tick: 0, kind: "meta", type: 0x51, data: bytes("07 A1 20") });
  const short = bytes(`4D 54 68 64 00 00 00 06 00 00 00 01 03 C0
    4D 54 72 6B 00 00 00 0A 00 FF 51 02 07 A1 00 FF 2F 00`);
  assert.throws(() => readSmf(short), { code: "E_PARSE" });
});

test("running status resets at track start and after meta", () => {
  const noStatus = bytes(`4D 54 68 64 00 00 00 06 00 00 00 01 03 C0 4D 54 72 6B 00 00 00 04 00 3C 64 00`);
  assert.throws(() => readSmf(noStatus), { code: "E_PARSE", details: { offset: 23, track: 0 } });
  const afterMeta = bytes(`4D 54 68 64 00 00 00 06 00 00 00 01 03 C0
    4D 54 72 6B 00 00 00 10 00 90 3C 64 00 FF 06 01 41 00 3C 00 00 FF 2F 00`);
  assert.throws(() => readSmf(afterMeta), { code: "E_PARSE" });
});

test("truncation, five-byte VLQ, EOT trailing bytes, and missing EOT", () => {
  const tooLong = empty.slice(); tooLong[21] = 5;
  assert.throws(() => readSmf(tooLong), { code: "E_PARSE" });
  const five = bytes(`4D 54 68 64 00 00 00 06 00 00 00 01 03 C0
    4D 54 72 6B 00 00 00 08 80 80 80 80 00 FF 2F 00`);
  assert.throws(() => readSmf(five), { code: "E_PARSE", details: { offset: 26, track: 0 } });
  const tail = bytes(`4D 54 68 64 00 00 00 06 00 00 00 01 03 C0
    4D 54 72 6B 00 00 00 05 00 FF 2F 00 00`);
  assert.throws(() => readSmf(tail), { code: "E_PARSE" });
  const missing = bytes(`4D 54 68 64 00 00 00 06 00 00 00 01 03 C0
    4D 54 72 6B 00 00 00 04 00 90 3C 40`);
  assert.deepEqual(readSmf(missing).warnings, ["MISSING_EOT:track=0"]);
});

test("size, format 2, SMPTE, and track count boundaries", () => {
  assert.throws(() => readSmf(new Uint8Array(16 * 1024 * 1024 + 1)), { code: "E_INPUT" });
  const format2 = empty.slice(); format2[9] = 2;
  assert.throws(() => readSmf(format2), { code: "E_CAPABILITY" });
  const smpte = empty.slice(); smpte[12] = 0xe7; smpte[13] = 0x28;
  assert.throws(() => readSmf(smpte), { code: "E_CAPABILITY" });
  const wrongCount = empty.slice(); wrongCount[11] = 2;
  assert.throws(() => readSmf(wrongCount), { code: "E_PARSE" });
});
