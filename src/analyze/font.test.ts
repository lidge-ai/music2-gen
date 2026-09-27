import assert from "node:assert/strict";
import test from "node:test";
import { drawText } from "./font.tool.ts";

test("C4 uses expected 5x7 glyph pixels", () => {
  const rgb = new Uint8Array(12 * 7 * 3);
  drawText(rgb, 12, 7, 0, 0, "C4", [255, 9, 1]);
  const at = (x: number, y: number): number => rgb[(y * 12 + x) * 3]!;
  assert.equal(at(1, 0), 255); assert.equal(at(0, 0), 0);
  assert.equal(at(9, 0), 255); assert.equal(at(9, 3), 255);
});

test("unknown glyph is blank and lowercase equals uppercase", () => {
  const a = new Uint8Array(18 * 7 * 3);
  const b = new Uint8Array(18 * 7 * 3);
  drawText(a, 18, 7, 0, 0, "c?4", [2, 3, 4]);
  drawText(b, 18, 7, 0, 0, "C?4", [2, 3, 4]);
  assert.deepEqual(a, b);
  assert.ok(a.subarray(6 * 3, 11 * 3).every((v) => v === 0));
});

test("negative and right-edge coordinates clip", () => {
  const rgb = new Uint8Array(12 * 7 * 3);
  drawText(rgb, 12, 7, -3, 0, "C4", [255, 0, 0]);
  drawText(rgb, 12, 7, 10, 0, "C4", [255, 0, 0]);
  assert.equal(rgb.length, 252);
  assert.ok(rgb.some((v) => v === 255));
});
