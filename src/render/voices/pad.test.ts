import assert from "node:assert/strict";
import test from "node:test";
import { createHash } from "node:crypto";
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

void test("legacy pad PCM digest and explicit unison branch", () => {
  const event = { ...note(57), velocity: 0.8, gateFrames: 11025, stopFrame: rate, seed: 123 };
  const ctx: VoiceContext = { sampleRate: rate, frames: rate, track, events: [event] };
  const old = padVoice.render(ctx, defaults);
  assert.equal(createHash("sha256").update(Buffer.from(old.buffer)).digest("hex"),
    "36216e86ab00c7b33b2785b495736f20ee6c055f75fa5aac5876c60f99e2f99e");
  const params = { ...defaults, unison: 5, filterEnvAmount: 0.5, filterEnvDecayMs: 500 };
  const enhanced = padVoice.render({ ...ctx, track: { ...track, params: { unison: 5 } } }, params);
  assert.notDeepEqual(enhanced, old);
  assert.ok(enhanced.every(Number.isFinite));
});

void test("enhanced pad remains finite at maximum controls and MIDI", () => {
  const ctx: VoiceContext = { sampleRate: rate, frames: rate,
    track: { ...track, params: { unison: 9 } }, events: [note(127)] };
  const audio = padVoice.render(ctx, { ...defaults, unison: 9, detuneCents: 50,
    cutoffHz: 12000, filterEnvAmount: 1, filterEnvDecayMs: 20 });
  assert.ok(audio.every(Number.isFinite));
});
