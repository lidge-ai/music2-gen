import assert from "node:assert/strict";
import test from "node:test";
import { writeSmf } from "./write.tool.ts";
import type { SmfFile } from "./smf.schema.ts";

function bytes(hex: string): Uint8Array { return Uint8Array.from(hex.trim().split(/\s+/).map((part) => parseInt(part, 16))); }

const tiny: SmfFile = {
  format: 1, ppq: 960, warnings: [], tracks: [
    { sourceIndex: 0, endTick: 3840, events: [
      { tick: 0, kind: "meta", type: 3, data: bytes("54") },
      { tick: 0, kind: "meta", type: 0x58, data: bytes("04 02 18 08") },
      { tick: 0, kind: "meta", type: 0x51, data: bytes("07 A1 20") },
    ] },
    { sourceIndex: 1, endTick: 3840, events: [
      { tick: 0, kind: "meta", type: 3, data: bytes("70") },
      { tick: 0, kind: "meta", type: 1, data: bytes("6D 75 73 69 63 32 3A 70 69 61 6E 6F") },
      { tick: 0, kind: "program", channel: 0, value: 0 },
      { tick: 0, kind: "cc", channel: 0, controller: 7, value: 127 },
      { tick: 0, kind: "cc", channel: 0, controller: 10, value: 64 },
      { tick: 0, kind: "noteOn", channel: 0, key: 60, velocity: 102 },
      { tick: 960, kind: "noteOff", channel: 0, key: 60, velocity: 64 },
    ] },
  ],
};

const exact = bytes(`
  4D 54 68 64 00 00 00 06 00 01 00 02 03 C0
  4D 54 72 6B 00 00 00 19
  00 FF 03 01 54
  00 FF 58 04 04 02 18 08
  00 FF 51 03 07 A1 20
  9E 00 FF 2F 00
  4D 54 72 6B 00 00 00 2E
  00 FF 03 01 70
  00 FF 01 0C 6D 75 73 69 63 32 3A 70 69 61 6E 6F
  00 C0 00
  00 B0 07 7F
  00 B0 0A 40
  00 90 3C 66
  87 40 80 3C 40
  96 40 FF 2F 00
`);

test("direct one-bar fixture is exactly 101 bytes with 0x19/0x2E payloads", () => {
  assert.equal(exact.length, 101);
  assert.deepEqual(writeSmf(tiny), exact);
  assert.deepEqual(writeSmf(tiny), writeSmf(tiny));
});

test("same-tick note off sorts before note on; CC sorts by controller", () => {
  const file: SmfFile = { format: 1, ppq: 960, warnings: [], tracks: [{ sourceIndex: 0, endTick: 960, events: [
    { tick: 960, kind: "noteOn", channel: 0, key: 60, velocity: 100 },
    { tick: 960, kind: "noteOff", channel: 0, key: 60, velocity: 64 },
    { tick: 0, kind: "cc", channel: 0, controller: 10, value: 64 },
    { tick: 0, kind: "cc", channel: 0, controller: 7, value: 127 },
  ] }] };
  assert.deepEqual(writeSmf(file), bytes(`4D 54 68 64 00 00 00 06 00 01 00 01 03 C0
    4D 54 72 6B 00 00 00 15 00 B0 07 7F 00 B0 0A 40 87 40 80 3C 40 00 90 3C 64 00 FF 2F 00`));
});

test("CC7/CC10 ticks write explicit Bn statuses and 960-tick delta VLQ", () => {
  const file: SmfFile = { format: 1, ppq: 960, warnings: [], tracks: [{ sourceIndex: 0, endTick: 960, events: [
    { tick: 0, kind: "cc", channel: 0, controller: 10, value: 64 },
    { tick: 0, kind: "cc", channel: 0, controller: 7, value: 64 },
    { tick: 960, kind: "cc", channel: 0, controller: 7, value: 127 },
    { tick: 960, kind: "cc", channel: 0, controller: 10, value: 1 },
  ] }] };
  assert.deepEqual(writeSmf(file).slice(22), bytes("00 B0 07 40 00 B0 0A 40 87 40 B0 07 7F 00 B0 0A 01 00 FF 2F 00"));
});

test("maximum VLQ EOT and out-of-range delta", () => {
  const file: SmfFile = { format: 1, ppq: 960, warnings: [], tracks: [{ sourceIndex: 0, endTick: 0x0fffffff, events: [] }] };
  assert.deepEqual(writeSmf(file).slice(-7), bytes("FF FF FF 7F FF 2F 00"));
  file.tracks[0]!.endTick++;
  assert.throws(() => writeSmf(file), { code: "E_INPUT" });
});

test("EOT extends to the last event when endTick is shorter", () => {
  const file: SmfFile = { format: 1, ppq: 960, warnings: [], tracks: [{ sourceIndex: 0, endTick: 0, events: [
    { tick: 960, kind: "noteOn", channel: 0, key: 60, velocity: 100 },
  ] }] };
  assert.deepEqual(writeSmf(file).slice(-9), bytes("87 40 90 3C 64 00 FF 2F 00"));
});

test("text metas replace Unicode with ASCII question marks and enforce 255 bytes", () => {
  const file: SmfFile = { format: 1, ppq: 960, warnings: [], tracks: [{ sourceIndex: 0, endTick: 0, events: [
    { tick: 0, kind: "meta", type: 3, data: new TextEncoder().encode("한A") },
  ] }] };
  assert.deepEqual(writeSmf(file).slice(-10), bytes("00 FF 03 02 3F 41 00 FF 2F 00"));
  file.tracks[0]!.events[0] = { tick: 0, kind: "meta", type: 3, data: new Uint8Array(256).fill(65) };
  assert.throws(() => writeSmf(file), { code: "E_INPUT" });
});
