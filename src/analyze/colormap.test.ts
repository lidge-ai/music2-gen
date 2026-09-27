import assert from "node:assert/strict";
import test from "node:test";
import { INFERNO_RGB } from "./colormap.ts";

test("published Inferno lookup anchors and lightness progression", () => {
  assert.equal(INFERNO_RGB.length, 768);
  assert.deepEqual(INFERNO_RGB.slice(0, 3), [0, 0, 4]);
  assert.deepEqual(INFERNO_RGB.slice(-3), [252, 255, 164]);
  let last = -1;
  for (let i = 0; i < 256; i++) {
    const rgb = INFERNO_RGB.slice(i * 3, i * 3 + 3);
    assert.ok(rgb.every((v) => Number.isInteger(v) && v >= 0 && v <= 255));
    const lightness = rgb[0]! * 0.2126 + rgb[1]! * 0.7152 + rgb[2]! * 0.0722;
    assert.ok(lightness >= last - 0.5, `luminance at ${i}`);
    last = lightness;
  }
});
