import assert from "node:assert/strict";
import test from "node:test";
import { validateSong } from "../../song/index.ts";
import type { VoiceContext, VoiceEvent } from "../render.schema.ts";
import { epianoVoice } from "./epiano.tool.ts";

const track = validateSong({ version: 1, bpm: 120,
  tracks: [{ id: "p", kind: "notes", instrument: "keys" }],
  sections: [{ id: "a", bars: 1 }], arrangement: [{ section: "a" }] }).tracks[0]!;
const defaults = Object.fromEntries(Object.entries(epianoVoice.params).map(([key, spec]) => [key, spec.default]));
function render(rate: number, overrides: Record<string, number> = {}, gate = 1): Float32Array {
  const event: VoiceEvent = { midi: 57, sample: null, velocity: 0.8, startFrame: 0,
    gateFrames: Math.round(gate * rate), stopFrame: Math.round(1.5 * rate), eventIndex: 0, seed: 7 };
  const ctx: VoiceContext = { sampleRate: rate, frames: Math.round(1.5 * rate), track, events: [event] };
  return epianoVoice.render(ctx, { ...defaults, ...overrides });
}
function power(x: Float32Array, from: number, count: number, hz: number, rate: number): number {
  let real = 0; let imaginary = 0;
  for (let i = 0; i < count; i++) {
    const phase = 2 * Math.PI * hz * i / rate;
    const window = 0.5 - 0.5 * Math.cos(2 * Math.PI * i / (count - 1));
    real += x[from + i]! * window * Math.cos(phase);
    imaginary += x[from + i]! * window * Math.sin(phase);
  }
  return real * real + imaginary * imaginary;
}
function rms(x: Float32Array, from: number, to: number): number {
  let sum = 0;
  for (let i = from; i < to; i++) sum += x[i]! ** 2;
  return Math.sqrt(sum / (to - from));
}

for (const rate of [44100, 48000]) {
  void test(`epiano high note suppresses out-of-band FM at ${rate} Hz`, () => {
    const ctx = { ...contextForHighNote(rate) };
    const defaultTone = epianoVoice.render(ctx, defaults);
    const pure = epianoVoice.render(ctx, { ...defaults, bodyIndex: 0, tineIndex: 0 });
    assert.deepEqual(defaultTone, pure);
    assert.ok(defaultTone.every((sample) => Number.isFinite(sample) && Math.abs(sample) <= 1));
  });

  void test(`epiano zero-index kernel is a decaying sine at ${rate} Hz`, () => {
    const audio = render(rate, { bodyIndex: 0, tineIndex: 0 });
    for (const age of [Math.round(0.1 * rate), Math.round(0.3 * rate), Math.round(0.7 * rate)]) {
      const expected = 0.52 * 0.8 * 1.25 * Math.exp(-Math.log(1000) * age / (3 * rate)) *
        Math.sin(2 * Math.PI * 220 * age / rate);
      assert.ok(Math.abs(audio[age]! - expected) < 1e-5);
    }
    assert.ok(power(audio, Math.round(0.1 * rate), Math.round(0.3 * rate), 440, rate) <
      power(audio, Math.round(0.1 * rate), Math.round(0.3 * rate), 220, rate) * 0.001);
  });

  void test(`epiano tine sideband recedes by half a second at ${rate} Hz`, () => {
    const tone = render(rate);
    const noTine = render(rate, { tineIndex: 0 });
    const count = Math.round(0.12 * rate);
    const early = Math.round(0.02 * rate);
    const late = Math.round(0.52 * rate);
    const high = (x: Float32Array, at: number) => power(x, at, count, 3300, rate);
    assert.ok(high(tone, early) > high(noTine, early) * 4);
    assert.ok(high(tone, late) < high(tone, early) * 0.01);
    assert.notDeepEqual(render(rate, { bodyIndex: 1 }), tone);
    assert.equal(render(rate, { tineIndex: 1.2 }).length, tone.length);
  });

  void test(`epiano key-off decays smoothly and output stays bounded at ${rate} Hz`, () => {
    const audio = render(rate, {}, 0.6);
    const held = render(rate, {}, 1);
    assert.deepEqual(audio, render(rate, {}, 0.6));
    assert.ok(audio.every((sample) => Number.isFinite(sample) && Math.abs(sample) <= 1));
    const off = Math.round(0.6 * rate);
    assert.equal(audio[off], held[off]);
    assert.ok(Math.abs(audio[off]! - audio[off - 1]!) < 0.1);
    assert.ok(rms(audio, Math.round(0.78 * rate), Math.round(0.8 * rate)) <
      rms(audio, off - Math.round(0.02 * rate), off) * 0.01);
  });
}

function contextForHighNote(rate: number): VoiceContext {
  const event: VoiceEvent = { midi: 127, sample: null, velocity: 0.8, startFrame: 0,
    gateFrames: rate, stopFrame: rate, eventIndex: 0, seed: 7 };
  return { sampleRate: rate, frames: rate, track, events: [event] };
}
