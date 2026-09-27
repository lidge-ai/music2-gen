import assert from "node:assert/strict";
import test from "node:test";
import { validateSong } from "../../song/index.ts";
import type { VoiceContext, VoiceEvent } from "../render.schema.ts";
import { bellVoice } from "./bell.tool.ts";

const rate = 44100;
const track = validateSong({ version: 1, bpm: 120,
  tracks: [{ id: "bell", kind: "notes", instrument: "bell" }],
  sections: [{ id: "a", bars: 1 }], arrangement: [{ section: "a" }] }).tracks[0]!;
const defaults = Object.fromEntries(Object.entries(bellVoice.params).map(([name, spec]) => [name, spec.default]));
function note(midi = 72, startFrame = 0): VoiceEvent {
  return { midi, sample: null, velocity: 1, startFrame, gateFrames: rate, stopFrame: rate * 2, eventIndex: 0, seed: 1 };
}
function render(events: VoiceEvent[], overrides: Record<string, number> = {}): Float32Array {
  const ctx: VoiceContext = { sampleRate: rate, frames: rate * 2, track, events };
  return bellVoice.render(ctx, { ...defaults, ...overrides });
}
function rms(audio: Float32Array, start: number, end: number): number {
  let sum = 0;
  for (let i = start; i < end; i++) sum += audio[i]! ** 2;
  return Math.sqrt(sum / (end - start));
}

void test("zero-index C5 has a 523 Hz carrier", () => {
  const audio = render([note()], { index: 0 });
  let crossings = 0;
  for (let i = 1; i < rate / 10; i++) if (audio[i - 1]! <= 0 && audio[i]! > 0) crossings++;
  assert.ok(crossings >= 51 && crossings <= 53, `crossings=${crossings}`);
});

void test("simultaneous notes add in event order", () => {
  const first = render([note(72)]);
  const second = render([note(76)]);
  const chord = render([note(72), note(76)]);
  for (let i = 0; i < chord.length; i++) assert.ok(Math.abs(chord[i]! - first[i]! - second[i]!) < 1e-7);
});

void test("bell decays, obeys stopFrame, and keeps a single note below mix headroom", () => {
  const event = { ...note(), stopFrame: rate + 1 };
  const audio = render([event]);
  assert.ok(rms(audio, rate, rate + 1000) < rms(audio, 0, 4410));
  assert.equal(audio[rate + 1], 0);
  assert.ok(Math.max(...audio.subarray(0, 4410)) < 0.6);
});
