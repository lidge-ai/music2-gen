import assert from "node:assert/strict";
import test from "node:test";
import { createHash } from "node:crypto";
import { validateSong } from "../../song/index.ts";
import type { VoiceContext, VoiceEvent } from "../render.schema.ts";
import { leadVoice } from "./lead.tool.ts";

const rate = 44100;
function track(mono = false) {
  return validateSong({ version: 1, bpm: 120,
    tracks: [{ id: "lead", kind: "notes", instrument: "lead", mono }],
    sections: [{ id: "a", bars: 1 }], arrangement: [{ section: "a" }] }).tracks[0]!;
}
const defaults = Object.fromEntries(Object.entries(leadVoice.params).map(([name, spec]) => [name, spec.default]));
function note(midi = 69, startFrame = 0): VoiceEvent {
  return { midi, sample: null, velocity: 1, startFrame, gateFrames: rate / 5, stopFrame: rate, eventIndex: 0, seed: 1 };
}
function render(events: VoiceEvent[], overrides: Record<string, number> = {}, mono = false): Float32Array {
  const ctx: VoiceContext = { sampleRate: rate, frames: rate, track: track(mono), events };
  return leadVoice.render(ctx, { ...defaults, ...overrides });
}
function rms(audio: Float32Array, start: number, end: number): number {
  let sum = 0;
  for (let i = start; i < end; i++) sum += audio[i]! ** 2;
  return Math.sqrt(sum / (end - start));
}

void test("saw and square waves differ; zero vibrato has stable cycles", () => {
  const square = render([note()], { vibratoCents: 0, wave: 1 });
  const saw = render([note()], { vibratoCents: 0, wave: 0 });
  assert.notDeepEqual(square.subarray(1000, 2000), saw.subarray(1000, 2000));
  const cycles: number[] = [];
  for (let i = 4000; i < 7000; i++) if (saw[i - 1]! > 0 && saw[i]! < 0) cycles.push(i);
  for (let i = 1; i < cycles.length; i++) assert.ok(cycles[i]! - cycles[i - 1]! >= 100 && cycles[i]! - cycles[i - 1]! <= 101);
});

void test("triangle lead is finite and distinct in legacy and enhanced paths", () => {
  const triangle = render([note()], { wave: 2 });
  assert.ok(triangle.every(Number.isFinite));
  assert.notDeepEqual(triangle, render([note()], { wave: 1 }));
  const ctx: VoiceContext = { sampleRate: rate, frames: rate,
    track: { ...track(), params: { unison: 1, wave: 2 } }, events: [note()] };
  const enhanced = leadVoice.render(ctx, { ...defaults, wave: 2 });
  assert.ok(enhanced.every(Number.isFinite));
  assert.notDeepEqual(enhanced, triangle);
});

void test("vibrato starts after 80 ms", () => {
  const stable = render([note()], { vibratoCents: 0 });
  const moving = render([note()], { vibratoCents: 80 });
  assert.deepEqual(stable.subarray(0, 3528), moving.subarray(0, 3528));
  assert.notDeepEqual(stable.subarray(10000, 12000), moving.subarray(10000, 12000));
});

void test("lead releases after gate and mono cuts the previous note at next onset", () => {
  const solo = render([note()]);
  assert.ok(rms(solo, 18000, 19000) < rms(solo, 4000, 5000) * 0.02);
  const first = note(69), second = note(72, 5000);
  const mono = render([first, second], {}, true);
  const secondOnly = render([second], {}, true);
  assert.deepEqual(mono.subarray(5000, 6000), secondOnly.subarray(5000, 6000));
  const poly = render([first, second]);
  assert.notDeepEqual(poly.subarray(5000, 6000), secondOnly.subarray(5000, 6000));
});

void test("legacy lead PCM remains byte-identical; explicit new control selects new path", () => {
  const event = { ...note(57), velocity: 0.8, gateFrames: 11025, seed: 123 };
  const ctx: VoiceContext = { sampleRate: rate, frames: rate, track: track(), events: [event] };
  const old = leadVoice.render(ctx, defaults);
  assert.equal(createHash("sha256").update(Buffer.from(old.buffer)).digest("hex"),
    "364ca97994b09d65113e23f28d403817e1cb26356d4ac9b077df3ad0f3eb8d0d");
  const changed = leadVoice.render({ ...ctx, track: { ...ctx.track, params: { unison: 1 } } }, defaults);
  assert.notDeepEqual(changed, old);
  assert.deepEqual(changed, leadVoice.render({ ...ctx, track: { ...ctx.track, params: { unison: 1 } } }, defaults));
});

void test("enhanced lead remains finite at maximum controls and MIDI", () => {
  const ctx: VoiceContext = { sampleRate: rate, frames: rate,
    track: { ...track(), params: { unison: 9 } }, events: [note(127)] };
  const audio = leadVoice.render(ctx, { ...defaults, unison: 9, detuneCents: 50,
    filterEnvAmount: 1, filterEnvDecayMs: 20, vibratoCents: 100, vibratoHz: 12 });
  assert.ok(audio.every(Number.isFinite));
});
