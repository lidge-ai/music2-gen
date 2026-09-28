import assert from "node:assert/strict";
import test from "node:test";
import { createBiquadState, designBiquad, processBiquadSample } from "./biquad.tool.ts";

function responseDb(kind: Parameters<typeof designBiquad>[0], hz: number, probe: number, gainDb = 0): number {
  const c = designBiquad(kind, hz, 48000, Math.SQRT1_2, gainDb);
  const w = 2 * Math.PI * probe / 48000;
  const re = (c.b0 + c.b1 * Math.cos(w) + c.b2 * Math.cos(2 * w));
  const im = -(c.b1 * Math.sin(w) + c.b2 * Math.sin(2 * w));
  const ar = 1 + c.a1 * Math.cos(w) + c.a2 * Math.cos(2 * w);
  const ai = -(c.a1 * Math.sin(w) + c.a2 * Math.sin(2 * w));
  return 10 * Math.log10((re * re + im * im) / (ar * ar + ai * ai));
}

test("RBJ Butterworth cutoff, bandpass center and shelf plateau", () => {
  for (const kind of ["lowpass", "highpass"] as const) {
    assert.ok(Math.abs(responseDb(kind, 1000, 1000) + 3.0103) < .05);
  }
  assert.ok(Math.abs(responseDb("bandpass", 1000, 1000)) < .05);
  assert.ok(Math.abs(responseDb("peak", 1000, 1000, 6) - 6) < .05);
  assert.ok(Math.abs(responseDb("lowshelf", 1000, 50, 6) - 6) < .1);
  assert.ok(Math.abs(responseDb("highshelf", 1000, 18000, 6) - 6) < .1);
});

test("matched boost and cut reconstruct an impulse", () => {
  const plus = designBiquad("peak", 1000, 48000, .7, 6);
  const minus = designBiquad("peak", 1000, 48000, .7, -6);
  const a = createBiquadState(); const b = createBiquadState();
  for (let i = 0; i < 4096; i++) {
    const output = processBiquadSample(processBiquadSample(i === 0 ? 1 : 0, plus, a), minus, b);
    assert.ok(Math.abs(output - (i === 0 ? 1 : 0)) < 2e-4);
  }
});
