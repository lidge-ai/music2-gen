import test from "node:test";
import assert from "node:assert/strict";
import type { VoiceContext } from "../render.schema.ts";
import { kalimbaVoice } from "./kalimba.tool.ts";

function render(rate: number, ratio: number): Float32Array {
  const frames = rate;
  return kalimbaVoice.render({ sampleRate: rate, frames,
    track: { id: "k", kind: "notes", instrument: "kalimba", params: {} } as VoiceContext["track"],
    events: [{ midi: 57, sample: null, velocity: 0.8, startFrame: 0, gateFrames: frames,
      stopFrame: frames, eventIndex: 0, seed: 22 }] }, { decayScale: 1, overtoneRatio: ratio });
}
function line(x: Float32Array, rate: number, hz: number, begin: number): number {
  const start = Math.floor(begin * rate), length = Math.floor(0.12 * rate);
  let re = 0, im = 0;
  for (let i = 0; i < length; i++) {
    re += x[start + i]! * Math.cos(2 * Math.PI * hz * i / rate);
    im += x[start + i]! * Math.sin(2 * Math.PI * hz * i / rate);
  }
  return Math.hypot(re, im) / length;
}
test("kalimba overtone moves with parameter and fades faster than fundamental", () => {
  for (const rate of [44100, 48000]) {
    const low = render(rate, 5.9), high = render(rate, 6.8);
    assert.deepEqual(low, render(rate, 5.9));
    assert.ok(line(low, rate, 220 * 5.9, 0.02) > line(low, rate, 220 * 6.8, 0.02) * 4);
    assert.ok(line(high, rate, 220 * 6.8, 0.02) > line(high, rate, 220 * 5.9, 0.02) * 4);
    assert.ok(line(low, rate, 220 * 5.9, 0.5) < line(low, rate, 220, 0.5) * 0.01);
  }
});
