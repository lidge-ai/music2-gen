import assert from "node:assert/strict";
import test from "node:test";
import { validateSong } from "../../song/index.ts";
import type { VoiceContext, VoiceEvent } from "../render.schema.ts";
import { padVoice } from "./pad.tool.ts";

const rate = 44100;
const track = validateSong({ version: 1, bpm: 120,
  tracks: [{ id: "pad", kind: "notes", instrument: "pad" }],
  sections: [{ id: "a", bars: 1 }], arrangement: [{ section: "a" }] }).tracks[0]!;
const defaults = Object.fromEntries(Object.entries(padVoice.params).map(([name, spec]) => [name, spec.default]));
function note(midi = 48): VoiceEvent {
  return { midi, sample: null, velocity: 1, startFrame: 0, gateFrames: rate, stopFrame: rate * 2, eventIndex: 0, seed: 1 };
}
function render(events: VoiceEvent[], overrides: Record<string, number> = {}): Float32Array {
  const ctx: VoiceContext = { sampleRate: rate, frames: rate * 2, track, events };
  return padVoice.render(ctx, { ...defaults, ...overrides });
}
function rms(audio: Float32Array, start: number, end: number): number {
  let sum = 0;
  for (let i = start; i < end; i++) sum += audio[i]! ** 2;
  return Math.sqrt(sum / (end - start));
}

void test("slow attack grows from 20-50 ms to 300-400 ms", () => {
  const audio = render([note()]);
  assert.ok(rms(audio, 882, 2205) < rms(audio, 13230, 17640));
});

void test("detuned oscillators differ from unison and chord voices sum", () => {
  assert.notDeepEqual(render([note()], { detuneCents: 0 }).subarray(0, 4000),
    render([note()], { detuneCents: 11 }).subarray(0, 4000));
  const a = render([note(48)]), b = render([note(52)]);
  const chord = render([note(48), note(52)]);
  for (let i = 0; i < 10000; i++) assert.ok(Math.abs(chord[i]! - a[i]! - b[i]!) < 1e-7);
});

void test("pad release reaches near zero after its gate", () => {
  const audio = render([note()]);
  assert.ok(rms(audio, 1.8 * rate, 1.9 * rate) < rms(audio, 0.8 * rate, 0.9 * rate) * 0.002);
});
