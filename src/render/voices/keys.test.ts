import assert from "node:assert/strict";
import test from "node:test";
import { validateSong } from "../../song/index.ts";
import type { VoiceContext, VoiceEvent } from "../render.schema.ts";
import { keysVoice } from "./keys.tool.ts";

const rate = 44100;
const track = validateSong({ version: 1, bpm: 120,
  tracks: [{ id: "keys", kind: "notes", instrument: "keys" }],
  sections: [{ id: "a", bars: 1 }], arrangement: [{ section: "a" }] }).tracks[0]!;
const defaults = Object.fromEntries(Object.entries(keysVoice.params).map(([name, spec]) => [name, spec.default]));
function note(midi = 60, velocity = 1): VoiceEvent {
  return { midi, sample: null, velocity, startFrame: 0, gateFrames: 4410, stopFrame: rate, eventIndex: 0, seed: 1 };
}
function render(events: VoiceEvent[], overrides: Record<string, number> = {}): Float32Array {
  const ctx: VoiceContext = { sampleRate: rate, frames: rate, track, events };
  return keysVoice.render(ctx, { ...defaults, ...overrides });
}
function rms(audio: Float32Array, start: number, end: number): number {
  let sum = 0;
  for (let i = start; i < end; i++) sum += audio[i]! ** 2;
  return Math.sqrt(sum / (end - start));
}

void test("half velocity lowers FM keys RMS", () => {
  assert.ok(rms(render([note(60, 0.5)]), 1000, 4000) < rms(render([note()]), 1000, 4000));
});

void test("keys attack and release follow the gate", () => {
  const audio = render([note()]);
  assert.ok(rms(audio, 0, 200) < rms(audio, 1000, 2000));
  assert.ok(rms(audio, 4410 + 9702, 4410 + 10702) < rms(audio, 3000, 4000) * 0.02);
});

void test("chord equals ordered voice sum", () => {
  const a = render([note(60)]);
  const b = render([note(64)]);
  const chord = render([note(60), note(64)]);
  for (let i = 0; i < rate; i++) assert.ok(Math.abs(chord[i]! - a[i]! - b[i]!) < 1e-7);
});
