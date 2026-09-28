import assert from "node:assert/strict";
import test from "node:test";
import { createSvfState, designSvf, processSvfSample } from "./svf.tool.ts";

test("TPT lowpass reaches Butterworth cutoff within 0.1 dB", () => {
  const state = createSvfState(); const c = designSvf(1000, Math.SQRT1_2, 48000);
  let inputEnergy = 0; let outputEnergy = 0;
  for (let i = 0; i < 48000; i++) {
    const input = Math.sin(2 * Math.PI * i / 48);
    const output = processSvfSample(input, c, state, "lowpass");
    if (i >= 24000) { inputEnergy += input * input; outputEnergy += output * output; }
  }
  assert.ok(Math.abs(10 * Math.log10(outputEnergy / inputEnergy) + 3.0103) < .1);
});

test("high-Q cutoff sweep stays finite and its tail decays", () => {
  const state = createSvfState(); let tailStart = 0; let tailEnd = 0;
  for (let i = 0; i < 96000; i++) {
    const phase = i / 48000;
    const cutoff = phase < 1 ? 50 * (360 ** (phase < .5 ? 2 * phase : 2 - 2 * phase)) : 50;
    const c = designSvf(cutoff, 12, 48000);
    const output = processSvfSample(i < 48000 ? .1 * Math.sin(i * .23) : 0, c, state, "lowpass");
    assert.ok(Number.isFinite(output) && Math.abs(output) < 10);
    if (i >= 48000 && i < 49000) tailStart += output * output;
    if (i >= 95000) tailEnd += output * output;
  }
  assert.ok(tailEnd < tailStart);
});
