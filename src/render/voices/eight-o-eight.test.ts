import assert from "node:assert/strict";
import test from "node:test";
import { validateSong } from "../../song/index.ts";
import type { VoiceContext, VoiceEvent } from "../render.schema.ts";
import { eightOhEightVoice } from "./eight-o-eight.tool.ts";

const rate = 44100;
const params = { drive: 2.2, decayMs: 1100, attackMs: 3 };

function context(events: VoiceEvent[], glide = 0, frames = rate): VoiceContext {
  const track = validateSong({ version: 1, bpm: 120,
    tracks: [{ id: "sub", kind: "notes", instrument: "808", pattern: "c2", glide }],
    sections: [{ id: "one", bars: 1 }], arrangement: [{ section: "one" }] }).tracks[0]!;
  return { sampleRate: rate, frames, track, events };
}

function event(midi: number, startFrame: number, stopFrame: number, velocity = 1): VoiceEvent {
  return { midi, sample: null, velocity, startFrame, gateFrames: stopFrame - startFrame,
    stopFrame, eventIndex: 0, seed: 1 };
}

function crossings(audio: Float32Array, begin: number, end: number): number {
  let count = 0;
  for (let frame = begin + 1; frame < end; frame++) {
    if ((audio[frame - 1] ?? 0) < 0 && (audio[frame] ?? 0) >= 0) count++;
  }
  return count / ((end - begin) / rate);
}

void test("C2 settles near 65.406 Hz and renders deterministically", () => {
  const ctx = context([event(36, 0, rate)]);
  const audio = eightOhEightVoice.render(ctx, params);
  assert.ok(Math.abs(crossings(audio, rate / 5, rate * 4 / 5) - 65.406) < 2);
  assert.deepEqual(eightOhEightVoice.render(ctx, params), audio);
  assert.ok(audio.every(Number.isFinite));
});

void test("50 ms glide begins near previous pitch then settles at G1", () => {
  const ctx = context([event(36, 0, rate / 2), event(31, rate / 2, rate)], 50);
  const audio = eightOhEightVoice.render(ctx, params);
  const early = crossings(audio, rate / 2, rate * .6);
  const late = crossings(audio, rate * .75, rate * .95);
  assert.ok(early > 52 && early < 68, `early frequency ${early}`);
  assert.ok(late > 45 && late < 54, `late frequency ${late}`);
});

void test("overlapping slots stop at the next onset, including a silent next note", () => {
  const split = rate / 2;
  const audio = eightOhEightVoice.render(context([
    event(36, 0, rate), event(31, split, rate, 0),
  ]), params);
  assert.ok(audio.slice(0, split).some((value) => Math.abs(value) > .1));
  assert.ok(audio.slice(split).every((value) => value === 0));
});

void test("last simultaneous event wins and final 8 ms release reaches silence", () => {
  const split = rate / 2;
  const ctx = context([event(36, 0, split, 0), event(31, 0, split)], 0, rate);
  const audio = eightOhEightVoice.render(ctx, params);
  assert.ok(audio.some((value) => Math.abs(value) > .1));
  assert.ok(audio.slice(split).every((value) => value === 0));
  assert.ok(Math.abs(audio[split - 1] ?? 0) < .001);
  assert.ok(Math.abs(audio[split + Math.round(.05 * rate)] ?? 0) < .001);
});

test("a full-velocity 808 note peaks at the voice output level", async () => {
  const { EIGHT_O_EIGHT_LEVEL, eightOhEightVoice } = await import("./eight-o-eight.tool.ts");
  const frames = 44100;
  const track = { id: "sub", kind: "notes", instrument: "808", pattern: null, velocity: 1, gain: 0, pan: 0, gate: 0.9, mono: true, glide: 0, transpose: 0, swing: false, sends: { reverb: 0, delay: 0 }, duck: null, params: {} } as const;
  const out = eightOhEightVoice.render({ sampleRate: 44100, frames, track: { ...track, sends: { reverb: 0, delay: 0 }, params: {} }, events: [{ midi: 36, sample: null, velocity: 1, startFrame: 0, gateFrames: frames, stopFrame: frames, eventIndex: 0, seed: 1 }] }, { drive: 2.2, decayMs: 1100, attackMs: 3 });
  let peak = 0;
  for (const v of out) peak = Math.max(peak, Math.abs(v));
  assert.ok(peak <= EIGHT_O_EIGHT_LEVEL + 1e-6 && peak > EIGHT_O_EIGHT_LEVEL * 0.9, String(peak));
});
