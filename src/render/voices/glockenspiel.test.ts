import test from "node:test";
import assert from "node:assert/strict";
import type { VoiceContext } from "../render.schema.ts";
import { glockenspielVoice } from "./glockenspiel.tool.ts";

function render(rate: number, midi: number): Float32Array {
  const frames = rate * 2;
  return glockenspielVoice.render({ sampleRate: rate, frames,
    track: { id: "g", kind: "notes", instrument: "glockenspiel", params: {} } as VoiceContext["track"],
    events: [{ midi, sample: null, velocity: 1, startFrame: 0, gateFrames: frames,
      stopFrame: frames, eventIndex: 0, seed: 1 }] }, { decayScale: 1, strike: 0.5 });
}
function line(x: Float32Array, rate: number, hz: number, begin = 0.1): number {
  const start = Math.floor(begin * rate), length = Math.floor(0.3 * rate);
  let re = 0, im = 0;
  for (let i = 0; i < length; i++) {
    re += x[start + i]! * Math.cos(2 * Math.PI * hz * i / rate);
    im += x[start + i]! * Math.sin(2 * Math.PI * hz * i / rate);
  }
  return Math.hypot(re, im) / length;
}
test("glockenspiel modal ratios, decay and high MIDI bounds", () => {
  for (const rate of [44100, 48000]) {
    const x = render(rate, 57);
    assert.deepEqual(x, render(rate, 57));
    assert.ok(line(x, rate, 220 * 2.71) > 0.005);
    assert.ok(line(x, rate, 220 * 5.15) > 0.002);
    assert.ok(line(x, rate, 220 * 5.15, 1.1) < line(x, rate, 220 * 5.15, 0.1));
    const high = render(rate, 127);
    const f0 = 440 * 2 ** ((127 - 69) / 12);
    const foldedSecond = Math.abs(rate - 2.71 * f0);
    assert.ok(line(high, rate, foldedSecond, 0.1) < 0.0001);
    assert.ok(high.every(Number.isFinite));
    assert.ok(high.every(value => Math.abs(value) <= 1));
  }
});
