import assert from "node:assert/strict";
import test from "node:test";
import { validateSong } from "../../song/index.ts";
import type { VoiceEvent } from "../render.schema.ts";
import { supersawVoice } from "./supersaw.tool.ts";
import { padVoice } from "./pad.tool.ts";

const rate = 44100;
const track = validateSong({ version: 1, bpm: 120,
  tracks: [{ id: "supersaw", kind: "notes", instrument: "supersaw" }],
  sections: [{ id: "a", bars: 1 }], arrangement: [{ section: "a" }] }).tracks[0]!;
const defaults = Object.fromEntries(Object.entries(supersawVoice.params).map(([name, spec]) => [name, spec.default]));
function note(midi: number, seed: number): VoiceEvent {
  return { midi, sample: null, velocity: 0.8, startFrame: 0, gateFrames: rate / 4,
    stopFrame: rate, eventIndex: 0, seed };
}
function render(events: VoiceEvent[], params = defaults): Float32Array {
  return supersawVoice.render({ sampleRate: rate, frames: rate, track, events }, params);
}
function rms(audio: Float32Array, from: number, to: number): number {
  let energy = 0;
  for (let i = from; i < to; i++) energy += audio[i]! ** 2;
  return Math.sqrt(energy / (to - from));
}

void test("same seed repeats, different seed changes phases, chord voices sum", () => {
  const a = render([note(57, 1)]), b = render([note(64, 2)]);
  assert.deepEqual(render([note(57, 1)]), a);
  assert.notDeepEqual(render([note(57, 3)]), a);
  const chord = render([note(57, 1), note(64, 2)]);
  for (let i = 0; i < rate; i++) assert.ok(Math.abs(chord[i]! - a[i]! - b[i]!) < 1e-7);
});

void test("filter sweep, attack and release remain finite at extreme settings", () => {
  const params = { ...defaults, unison: 9, detuneCents: 50, cutoffHz: 80,
    resonance: 0.9, filterEnvAmount: 1, filterEnvDecayMs: 20, attackMs: 0, releaseMs: 5 };
  const audio = render([note(127, 4)], params);
  assert.ok(audio.every(Number.isFinite));
  assert.ok(rms(audio, 30000, 40000) < rms(audio, 1000, 5000) * 0.01);
  assert.notDeepEqual(audio.subarray(0, 1000), render([note(127, 4)], { ...params, filterEnvAmount: 0 }).subarray(0, 1000));
});

void test("default sustained level is comparable to pad", () => {
  const held = { ...note(57, 123), gateFrames: rate };
  const saw = render([held]);
  const padParams = Object.fromEntries(Object.entries(padVoice.params).map(([name, spec]) => [name, spec.default]));
  const pad = padVoice.render({ sampleRate: rate, frames: rate,
    track: { ...track, instrument: "pad", params: {} }, events: [held] }, padParams);
  const ratio = rms(saw, 0.6 * rate, 0.9 * rate) / rms(pad, 0.6 * rate, 0.9 * rate);
  assert.ok(ratio > 0.5 && ratio < 2);
});
