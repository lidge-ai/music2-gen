import test from "node:test";
import assert from "node:assert/strict";
import type { VoiceContext, VoiceSpec } from "../render.schema.ts";
import { marimbaVoice } from "./marimba.tool.ts";
import { vibraphoneVoice } from "./vibraphone.tool.ts";

function render(voice: VoiceSpec, rate: number, midi = 57, seed = 41): Float32Array {
  const frames = rate * 2;
  const ctx = { sampleRate: rate, frames,
    track: { id: "test", kind: "notes", instrument: voice.id, params: {} } as VoiceContext["track"],
    events: [{ midi, sample: null, velocity: 0.8, startFrame: 0, gateFrames: frames,
      stopFrame: frames, eventIndex: 0, seed }] };
  return voice.render(ctx, Object.fromEntries(Object.entries(voice.params).map(([k, v]) => [k, v.default])));
}
function line(audio: Float32Array, rate: number, hz: number, begin: number, duration: number): number {
  const start = Math.floor(begin * rate), length = Math.floor(duration * rate);
  let re = 0, im = 0;
  for (let i = 0; i < length; i++) {
    const window = 0.5 - 0.5 * Math.cos(2 * Math.PI * i / length);
    re += audio[start + i]! * window * Math.cos(2 * Math.PI * hz * i / rate);
    im += audio[start + i]! * window * Math.sin(2 * Math.PI * hz * i / rate);
  }
  return Math.hypot(re, im) / length;
}
function modalPeak(audio: Float32Array, rate: number, expected: number): number {
  let best = -1, frequency = 0;
  for (let hz = Math.floor(expected) - 20; hz <= expected + 20; hz++) {
    const energy = line(audio, rate, hz, 0.005, 0.08);
    if (energy > best) { best = energy; frequency = hz; }
  }
  return frequency;
}
function rms(audio: Float32Array, rate: number, begin: number): number {
  let sum = 0;
  for (let i = Math.floor(begin * rate); i < Math.floor((begin + 0.1) * rate); i++) sum += audio[i]! ** 2;
  return Math.sqrt(sum / Math.floor(0.1 * rate));
}
test("marimba modes, upper decay, and shorter tail than vibe at both rates", () => {
  for (const rate of [44100, 48000]) {
    const a = render(marimbaVoice, rate);
    const b = render(vibraphoneVoice, rate);
    assert.equal(a.length, rate * 2);
    assert.deepEqual(a, render(marimbaVoice, rate));
    assert.ok(Math.max(...a.subarray(0, 1000)) <= 1);
    for (const ratio of [1, 3.9, 9.23]) {
      assert.ok(line(a, rate, 220 * ratio, 0.005, 0.08) > 0.0003);
      assert.ok(Math.abs(modalPeak(a, rate, 220 * ratio) - 220 * ratio) <= 12.5);
    }
    const upperFall = line(a, rate, 220 * 3.9, 0.45, 0.2) / line(a, rate, 220 * 3.9, 0.02, 0.2);
    const baseFall = line(a, rate, 220, 0.45, 0.2) / line(a, rate, 220, 0.02, 0.2);
    assert.ok(upperFall < baseFall);
    assert.ok(rms(b, rate, 1) > 5 * rms(a, rate, 1));
  }
});
