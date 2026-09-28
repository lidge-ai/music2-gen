import assert from "node:assert/strict";
import test from "node:test";
import { createHash } from "node:crypto";
import { validateSong } from "../../song/index.ts";
import type { VoiceContext, VoiceEvent } from "../render.schema.ts";
import { bassVoice } from "./bass.tool.ts";

const rate = 44100;
const defaults = { wave: 0, cutoffHz: 600, resonance: .15, releaseMs: 80 };

function context(events: VoiceEvent[], frames = rate): VoiceContext {
  const track = validateSong({ version: 1, bpm: 120,
    tracks: [{ id: "bass", kind: "notes", instrument: "bass", pattern: "c3" }],
    sections: [{ id: "one", bars: 1 }], arrangement: [{ section: "one" }] }).tracks[0]!;
  return { sampleRate: rate, frames, track, events };
}

function event(midi: number, startFrame: number, stopFrame: number, velocity = 1): VoiceEvent {
  return { midi, sample: null, velocity, startFrame, gateFrames: stopFrame - startFrame,
    stopFrame, eventIndex: 0, seed: 1 };
}

function rms(audio: Float32Array, from: number, to: number): number {
  let energy = 0;
  for (let i = from; i < to; i++) energy += (audio[i] ?? 0) ** 2;
  return Math.sqrt(energy / (to - from));
}

void test("saw and square produce distinct finite waveforms", () => {
  const ctx = context([event(48, 0, rate)]);
  const saw = bassVoice.render(ctx, defaults);
  const square = bassVoice.render(ctx, { ...defaults, wave: 1 });
  assert.notDeepEqual(saw, square);
  assert.ok(saw.every(Number.isFinite));
  assert.ok(square.every(Number.isFinite));
  assert.deepEqual(bassVoice.render(ctx, defaults), saw);
});

void test("200 Hz lowpass attenuates 4 kHz note relative to 4 kHz cutoff", () => {
  const ctx = context([event(108, 0, rate / 2)]);
  const low = bassVoice.render(ctx, { ...defaults, cutoffHz: 200 });
  const high = bassVoice.render(ctx, { ...defaults, cutoffHz: 4000 });
  assert.ok(rms(low, rate / 10, rate / 3) < rms(high, rate / 10, rate / 3) * .35);
});

void test("next onset ends previous note even when its slot overlaps", () => {
  const split = rate / 2;
  const audio = bassVoice.render(context([
    event(48, 0, rate), event(55, split, rate, 0),
  ]), defaults);
  assert.ok(audio.slice(0, split).some((value) => Math.abs(value) > .1));
  assert.ok(audio.slice(split).every((value) => value === 0));
});

void test("gate release decays and writes remain inside the allocated buffer", () => {
  const note = event(48, 0, rate);
  note.gateFrames = Math.round(.1 * rate);
  const audio = bassVoice.render(context([note]), defaults);
  assert.ok(rms(audio, rate / 3, rate / 2) < rms(audio, rate / 20, rate / 10) * .001);
  const clipped = bassVoice.render(context([event(48, rate - 100, rate + 100)], rate), defaults);
  assert.equal(clipped.length, rate);
  assert.ok(clipped.slice(0, rate - 100).every((value) => value === 0));
  assert.ok(clipped.slice(rate - 100).some((value) => value !== 0));
});

void test("maximum resonance remains finite and bounded", () => {
  const audio = bassVoice.render(context([event(60, 0, rate)]),
    { ...defaults, cutoffHz: 8000, resonance: .9 });
  assert.ok(audio.every(Number.isFinite));
  assert.ok(audio.every((value) => Math.abs(value) <= 2));
});

void test("legacy bass PCM digest and enhanced mono cutoff semantics", () => {
  const ctx = context([{ ...event(57, 0, rate, 0.8), gateFrames: 11025, seed: 123 }]);
  const old = bassVoice.render(ctx, defaults);
  assert.equal(createHash("sha256").update(Buffer.from(old.buffer)).digest("hex"),
    "5deaec02a7cd35a90d3bde8f763a20a2edee789625aa1bfbc13f78b31c43d7c3");
  const enhanced = { ...ctx, track: { ...ctx.track, params: { unison: 3 } } };
  const params = { ...defaults, unison: 3, detuneCents: 15, filterEnvAmount: 0.5, filterEnvDecayMs: 500 };
  const audio = bassVoice.render(enhanced, params);
  assert.ok(audio.every(Number.isFinite));
  const split = rate / 2;
  const cut = bassVoice.render({ ...enhanced, events: [event(48, 0, rate), event(55, split, rate, 0)] }, params);
  assert.ok(cut.slice(split).every((value) => value === 0));
});

void test("enhanced bass remains finite at maximum controls and MIDI", () => {
  const ctx = context([event(127, 0, rate)]);
  const audio = bassVoice.render({ ...ctx, track: { ...ctx.track, params: { unison: 9 } } },
    { ...defaults, cutoffHz: 8000, resonance: 0.9, unison: 9, detuneCents: 50,
      filterEnvAmount: 1, filterEnvDecayMs: 20 });
  assert.ok(audio.every(Number.isFinite));
});
