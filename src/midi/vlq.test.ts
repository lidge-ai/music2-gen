import assert from "node:assert/strict";
import test from "node:test";
import { readVlq, writeVlq } from "./vlq.tool.ts";

function bytes(hex: string): Uint8Array { return Uint8Array.from(hex.split(" ").map((part) => parseInt(part, 16))); }

test("official twelve VLQ values and PPQ-960 boundaries", () => {
  const table: [number, string][] = [
    [0, "00"], [0x40, "40"], [0x7f, "7F"], [0x80, "81 00"],
    [0x2000, "C0 00"], [0x3fff, "FF 7F"], [0x4000, "81 80 00"],
    [0x100000, "C0 80 00"], [0x1fffff, "FF FF 7F"],
    [0x200000, "81 80 80 00"], [0x8000000, "C0 80 80 00"],
    [0x0fffffff, "FF FF FF 7F"], [240, "81 70"], [960, "87 40"], [3840, "9E 00"],
  ];
  for (const [value, hex] of table) {
    assert.deepEqual(writeVlq(value), bytes(hex));
    assert.deepEqual(readVlq(bytes(hex), 0, bytes(hex).length), { value, next: bytes(hex).length });
  }
});

test("VLQ rejects invalid input, truncation, and fifth byte", () => {
  for (const value of [-1, 0.5, 0x10000000, Number.NaN]) {
    assert.throws(() => writeVlq(value), { code: "E_INPUT" });
  }
  assert.throws(() => readVlq(bytes("81 00"), 0, 1), { code: "E_PARSE", details: { offset: 1 } });
  assert.throws(() => readVlq(bytes("80 80 80 80 00"), 0, 5), { code: "E_PARSE", details: { offset: 4 } });
});
