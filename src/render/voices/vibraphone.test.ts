import test from "node:test";
import assert from "node:assert/strict";
import type { VoiceContext } from "../render.schema.ts";
import { vibraphoneVoice } from "./vibraphone.tool.ts";

function render(rate: number, tremoloHz: number): Float32Array {
  const frames = 2 * rate;
  return vibraphoneVoice.render({ sampleRate: rate, frames,
    track: { id: "v", kind: "notes", instrument: "vibraphone", params: {} } as VoiceContext["track"],
    events: [{ midi: 57, sample: null, velocity: 0.8, startFrame: 0, gateFrames: frames,
      stopFrame: frames, eventIndex: 0, seed: 1 }] }, { decayScale: 1, tremoloHz });
}
function line(x: Float32Array, rate: number, hz: number): number {
  const start = Math.floor(rate * 0.2), length = rate;
  let re = 0, im = 0;
  for (let i = 0; i < length; i++) {
    re += x[start + i]! * Math.cos(2 * Math.PI * hz * i / rate);
    im += x[start + i]! * Math.sin(2 * Math.PI * hz * i / rate);
  }
  return Math.hypot(re, im) / length;
}
test("vibraphone second mode and motor sidebands", () => {
  for (const rate of [44100, 48000]) {
    const dry = render(rate, 0), wet = render(rate, 4);
    assert.deepEqual(dry, render(rate, 0));
    assert.ok(line(dry, rate, 880) > 0.005);
    assert.ok(line(wet, rate, 216) > 2 * line(dry, rate, 216));
    assert.ok(line(wet, rate, 224) > 2 * line(dry, rate, 224));
    assert.deepEqual(render(rate, 1), render(rate, 2));
  }
});
