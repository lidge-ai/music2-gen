import assert from "node:assert/strict";
import test from "node:test";
import { encodeRgbPng } from "../png.tool.ts";
import { createCanvas, fillRect, line, polyline, text } from "./canvas.tool.ts";

test("canvas fills every RGB byte and clips primitives", () => {
  const canvas = createCanvas(2, 2, [15, 23, 34]);
  assert.deepEqual(Array.from(canvas.rgb), [15, 23, 34, 15, 23, 34, 15, 23, 34, 15, 23, 34]);
  fillRect(canvas, -9, -9, 10, 10, [1, 2, 3]);
  line(canvas, -2, -2, 1, 1, [4, 5, 6]);
  assert.deepEqual(Array.from(canvas.rgb.slice(0, 3)), [4, 5, 6]);
  assert.deepEqual(Array.from(canvas.rgb.slice(9)), [4, 5, 6]);
});

test("identical drawing commands encode identical PNG bytes", () => {
  const render = (): Buffer => {
    const canvas = createCanvas(18, 14, [0, 0, 0]);
    polyline(canvas, [[0, 0], [17, 13]], [86, 180, 233]);
    text(canvas, 1, 2, "B", [241, 245, 249]);
    return encodeRgbPng(canvas.width, canvas.height, canvas.rgb);
  };
  assert.deepEqual(render(), render());
});
