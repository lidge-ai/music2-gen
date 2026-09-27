import assert from "node:assert/strict";
import test from "node:test";
import { drawText, measureText, wrapText } from "./font.tool.ts";

test("C4 uses expected 5x7 glyph pixels", () => {
  const rgb = new Uint8Array(12 * 7 * 3);
  drawText(rgb, 12, 7, 0, 0, "C4", [255, 9, 1]);
  const at = (x: number, y: number): number => rgb[(y * 12 + x) * 3]!;
  assert.equal(at(1, 0), 255); assert.equal(at(0, 0), 0);
  assert.equal(at(9, 0), 255); assert.equal(at(9, 3), 255);
});

test("unknown glyph is a hollow box and lowercase equals uppercase", () => {
  const a = new Uint8Array(18 * 7 * 3);
  const b = new Uint8Array(18 * 7 * 3);
  drawText(a, 18, 7, 0, 0, "c?4", [2, 3, 4]);
  drawText(b, 18, 7, 0, 0, "C?4", [2, 3, 4]);
  assert.deepEqual(a, b);
  const at = (x: number, y: number): number => a[(y * 18 + x) * 3]!;
  assert.equal(at(6, 0), 2); assert.equal(at(8, 3), 0); assert.equal(at(10, 6), 2);
});

test("scaled glyphs, punctuation, measurement and wrapping", () => {
  const rgb = new Uint8Array(120 * 30 * 3);
  drawText(rgb, 120, 30, 0, 0, "A()+|%=><?,", [7, 8, 9], 3);
  const at = (x: number, y: number): number => rgb[(y * 120 + x) * 3]!;
  assert.equal(at(3, 0), 7); assert.equal(at(5, 2), 7); assert.equal(at(0, 0), 0);
  assert.equal(measureText("B05", 3), 51);
  const lines = wrapText("A VERY LONG TITLE WITH 123456789012345678901234", 376, 3);
  assert.ok(lines.length > 1);
  assert.ok(lines.every((part) => measureText(part, 3) <= 376));
  for (const mark of ["(", ")", "|", "%", "+", "=", ">", "<", ","]) {
    const glyph = new Uint8Array(5 * 7 * 3);
    drawText(glyph, 5, 7, 0, 0, mark, [7, 8, 9]);
    assert.ok(glyph.some((value) => value === 7), mark);
  }
});

test("negative and right-edge coordinates clip", () => {
  const rgb = new Uint8Array(12 * 7 * 3);
  drawText(rgb, 12, 7, -3, 0, "C4", [255, 0, 0]);
  drawText(rgb, 12, 7, 10, 0, "C4", [255, 0, 0]);
  assert.equal(rgb.length, 252);
  assert.ok(rgb.some((v) => v === 255));
});
