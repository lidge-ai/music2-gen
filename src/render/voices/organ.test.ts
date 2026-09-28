import assert from "node:assert/strict";
import test from "node:test";
import { validateSong } from "../../song/index.ts";
import type { VoiceContext, VoiceEvent } from "../render.schema.ts";
import { organVoice } from "./organ.tool.ts";
import { padVoice } from "./pad.tool.ts";

const track = validateSong({ version: 1, bpm: 120,
  tracks: [{ id: "p", kind: "notes", instrument: "keys" }],
  sections: [{ id: "a", bars: 1 }], arrangement: [{ section: "a" }] }).tracks[0]!;
const defaults = Object.fromEntries(Object.entries(organVoice.params).map(([key, spec]) => [key, spec.default]));
const padDefaults = Object.fromEntries(Object.entries(padVoice.params).map(([key, spec]) => [key, spec.default]));
const names = ["d16", "d513", "d8", "d4", "d223", "d2", "d135", "d113", "d1"];
const ratios = [0.5, 1.5, 1, 2, 3, 4, 5, 6, 8];
function context(rate: number, seed = 9, gate = 1): VoiceContext {
  const event: VoiceEvent = { midi: 57, sample: null, velocity: 0.8, startFrame: 0,
    gateFrames: Math.round(gate * rate), stopFrame: Math.round(2 * rate), eventIndex: 0, seed };
  return { sampleRate: rate, frames: 2 * rate, track, events: [event] };
}
function render(rate: number, overrides: Record<string, number> = {}, seed = 9, gate = 1): Float32Array {
  return organVoice.render(context(rate, seed, gate), { ...defaults, ...overrides });
}
function power(x: Float32Array, from: number, count: number, hz: number, rate: number): number {
  let real = 0; let imaginary = 0;
  for (let i = 0; i < count; i++) {
    const phase = 2 * Math.PI * hz * i / rate;
    real += x[from + i]! * Math.cos(phase);
    imaginary += x[from + i]! * Math.sin(phase);
  }
  return real * real + imaginary * imaginary;
}
function rms(x: Float32Array, from: number, to: number): number {
  let sum = 0;
  for (let i = from; i < to; i++) sum += x[i]! ** 2;
  return Math.sqrt(sum / (to - from));
}

for (const rate of [44100, 48000]) {
  void test(`organ omits footage above 0.45 Fs at ${rate} Hz`, () => {
    const ctx = context(rate);
    ctx.events[0]!.midi = 127;
    const baseline = organVoice.render(ctx, defaults);
    const withHighDrawbar = organVoice.render(ctx, { ...defaults, d4: 8, d223: 8, d1: 8 });
    assert.deepEqual(withHighDrawbar, baseline);
    assert.ok(baseline.every((sample) => Number.isFinite(sample) && Math.abs(sample) <= 1));
  });

  void test(`organ drawbars add their own footage lines at ${rate} Hz`, () => {
    const off = Object.fromEntries(names.map((name) => [name, 0]));
    const silent = render(rate, off);
    assert.ok(silent.subarray(Math.round(0.005 * rate)).every((sample) => sample === 0));
    const from = Math.round(0.2 * rate);
    const count = Math.round(0.2 * rate);
    for (let i = 0; i < names.length; i++) {
      const hz = 220 * ratios[i]!;
      const single = render(rate, { ...off, [names[i]!]: 8 });
      assert.ok(power(single, from, count, hz, rate) > power(silent, from, count, hz, rate) + 100);
      const other = i === 0 ? 220 : 110;
      assert.ok(power(single, from, count, hz, rate) > power(single, from, count, other, rate) * 5);
    }
  });

  void test(`organ sustain tracks pad RMS and falls after key-off at ${rate} Hz`, () => {
    const organ = render(rate);
    const held = render(rate, {}, 9, 1.5);
    const pad = padVoice.render(context(rate), padDefaults);
    const from = Math.round(0.5 * rate);
    const to = Math.round(0.8 * rate);
    const db = 20 * Math.log10(rms(organ, from, to) / rms(pad, from, to));
    assert.ok(Math.abs(db) <= 3, `organ/pad = ${db.toFixed(2)} dB`);
    assert.ok(Math.abs(20 * Math.log10(rms(organ, Math.round(0.2 * rate), Math.round(0.4 * rate)) /
      rms(organ, from, to))) < 0.25);
    assert.equal(organ[rate], held[rate]);
    assert.ok(rms(organ, Math.round(1.14 * rate), Math.round(1.15 * rate)) <
      rms(organ, from, to) * 0.001);
    assert.ok(organ.every((sample) => Number.isFinite(sample) && Math.abs(sample) <= 1));
  });

  void test(`organ click is seeded and stops by 5 ms at ${rate} Hz`, () => {
    const a = render(rate);
    const b = render(rate);
    const c = render(rate, {}, 10);
    assert.deepEqual(a, b);
    assert.notDeepEqual(a.subarray(0, Math.round(0.003 * rate)),
      c.subarray(0, Math.round(0.003 * rate)));
    assert.deepEqual(a.subarray(Math.round(0.005 * rate)),
      c.subarray(Math.round(0.005 * rate)));
    assert.equal(a.length, 2 * rate);
  });
}
