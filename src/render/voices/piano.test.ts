import assert from "node:assert/strict";
import test from "node:test";
import { validateSong } from "../../song/index.ts";
import type { VoiceContext, VoiceEvent } from "../render.schema.ts";
import { pianoVoice } from "./piano.tool.ts";

const track = validateSong({ version: 1, bpm: 120,
  tracks: [{ id: "p", kind: "notes", instrument: "keys" }],
  sections: [{ id: "a", bars: 1 }], arrangement: [{ section: "a" }] }).tracks[0]!;
const defaults = Object.fromEntries(Object.entries(pianoVoice.params).map(([key, spec]) => [key, spec.default]));
function render(rate: number, velocity = 0.8, seed = 17, gate = 2,
  overrides: Record<string, number> = {}): Float32Array {
  const event: VoiceEvent = { midi: 57, sample: null, velocity, startFrame: 0,
    gateFrames: Math.round(gate * rate), stopFrame: Math.round(2.5 * rate), eventIndex: 0, seed };
  const ctx: VoiceContext = { sampleRate: rate, frames: Math.round(2.5 * rate), track, events: [event] };
  return pianoVoice.render(ctx, { ...defaults, ...overrides });
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
  void test(`piano omits partials above 0.45 Fs at ${rate} Hz`, () => {
    const midi = 127;
    const frequency = 440 * 2 ** ((midi - 69) / 12);
    const event: VoiceEvent = { midi, sample: null, velocity: 1, startFrame: 0,
      gateFrames: rate, stopFrame: rate, eventIndex: 0, seed: 17 };
    const audio = pianoVoice.render({ sampleRate: rate, frames: rate, track, events: [event] }, defaults);
    const from = Math.round(0.1 * rate);
    const count = Math.round(0.3 * rate);
    const foldedSecond = rate - 2 * frequency;
    assert.ok(power(audio, from, count, foldedSecond, rate) <
      power(audio, from, count, frequency, rate) * 0.0001);
    assert.ok(audio.every((sample) => Number.isFinite(sample) && Math.abs(sample) <= 1));
  });

  void test(`piano partial 8 follows stiff-string pitch at ${rate} Hz`, () => {
    const audio = render(rate, 0.8, 17, 2, { inharmonicity: 0.0004 });
    const expected = 8 * 220 * Math.sqrt(1 + 0.0004 * 64);
    const from = Math.round(0.15 * rate);
    const count = Math.round(0.5 * rate);
    let best = 0; let bestHz = 0;
    for (let hz = 1755; hz <= 1800; hz++) {
      const value = power(audio, from, count, hz, rate);
      if (value > best) { best = value; bestHz = hz; }
    }
    assert.ok(Math.abs(bestHz - expected) <= rate / count, `${bestHz} vs ${expected}`);
    assert.ok(bestHz > 1760 + 3);
  });

  void test(`piano upper partial fades sooner and high velocity brightens at ${rate} Hz`, () => {
    const loud = render(rate, 0.9);
    const soft = render(rate, 0.3);
    const highHz = 16 * 220 * Math.sqrt(1 + 0.0002 * 16 ** 2);
    const early = Math.round(0.1 * rate);
    const late = Math.round(1.1 * rate);
    const count = Math.round(0.25 * rate);
    const ratio = (x: Float32Array, at: number) =>
      power(x, at, count, highHz, rate) / power(x, at, count, 220, rate);
    assert.ok(ratio(loud, late) < ratio(loud, early) * 0.55);
    assert.ok(ratio(loud, early) > ratio(soft, early) * 1.1);
  });

  void test(`piano is deterministic, bounded, and releases within 400 ms at ${rate} Hz`, () => {
    const a = render(rate, 1, 17, 0.5, { releaseMs: 400 });
    const b = render(rate, 1, 17, 0.5, { releaseMs: 400 });
    const c = render(rate, 1, 18, 0.5, { releaseMs: 400 });
    const held = render(rate, 1, 17, 2, { releaseMs: 400 });
    assert.deepEqual(a, b);
    assert.notDeepEqual(a.subarray(0, 200), c.subarray(0, 200));
    assert.equal(a[Math.round(0.5 * rate)], held[Math.round(0.5 * rate)]);
    assert.equal(a.length, Math.round(2.5 * rate));
    assert.ok(a.every((sample) => Number.isFinite(sample) && Math.abs(sample) <= 1));
    assert.ok(rms(a, Math.round(0.88 * rate), Math.round(0.9 * rate)) <
      rms(a, Math.round(0.48 * rate), Math.round(0.5 * rate)) * 0.001);
  });
}
