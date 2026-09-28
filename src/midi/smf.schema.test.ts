import assert from "node:assert/strict";
import test from "node:test";
import { assertWritableSmf, type SmfFile, type SmfEvent } from "./smf.schema.ts";

function file(events: SmfEvent[] = []): SmfFile {
  return { format: 1, ppq: 960, tracks: [{ events, endTick: 3840, sourceIndex: 0 }], warnings: [] };
}

test("empty track is a valid writable SMF", () => assert.doesNotThrow(() => assertWritableSmf(file())));

test("writer schema rejects unsupported format, division, and track count", () => {
  for (const bad of [{ ...file(), format: 0 }, { ...file(), ppq: 96 }, { ...file(), tracks: [] }]) {
    assert.throws(() => assertWritableSmf(bad as SmfFile), { code: "E_INPUT" });
  }
});

test("writer schema rejects invalid channel data, tick, and explicit EOT", () => {
  const valid: SmfEvent = { tick: 0, kind: "noteOn", channel: 0, key: 60, velocity: 100 };
  for (const event of [
    { ...valid, channel: 16 }, { ...valid, key: 128 }, { ...valid, velocity: -1 },
    { ...valid, tick: -1 }, { ...valid, tick: Number.MAX_SAFE_INTEGER + 1 },
    { tick: 0, kind: "meta", type: 0x2f, data: new Uint8Array() },
    { tick: 0, kind: "meta", type: 0x51, data: new Uint8Array(2) },
    { tick: 0, kind: "sysex", status: 0xf1, data: new Uint8Array() },
  ]) assert.throws(() => assertWritableSmf(file([event as SmfEvent])), { code: "E_INPUT" });
  assert.throws(() => assertWritableSmf(file([{ tick: 0, kind: "meta", type: 1, data: [] as unknown as Uint8Array }])), { code: "E_INPUT" });
});
