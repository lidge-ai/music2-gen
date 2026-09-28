import assert from "node:assert/strict";
import test from "node:test";
import { validateSong } from "../../song/index.ts";
import type { VoiceContext, VoiceEvent } from "../render.schema.ts";
import { padVoice } from "./pad.tool.ts";
import { stringsVoice } from "./strings.tool.ts";

const track = validateSong({ version: 1, bpm: 120,
  tracks: [{ id: "v", kind: "notes", instrument: "strings" }],
  sections: [{ id: "a", bars: 1 }], arrangement: [{ section: "a" }] }).tracks[0]!;
const defaults = Object.fromEntries(Object.entries(stringsVoice.params).map(([key, spec]) => [key, spec.default]));
const padDefaults = Object.fromEntries(Object.entries(padVoice.params).map(([key, spec]) => [key, spec.default]));
function context(rate: number, midi = 57, seed = 123, gate = 1.2): VoiceContext {
  const event: VoiceEvent = { midi, sample: null, velocity: 0.8, startFrame: 0,
    gateFrames: Math.round(gate * rate), stopFrame: 2 * rate, eventIndex: 0, seed };
  return { sampleRate: rate, frames: 2 * rate, track, events: [event] };
}
function rms(audio: Float32Array, rate: number, from: number, to: number): number {
  let sum = 0;
  const start = Math.round(from * rate), end = Math.round(to * rate);
  for (let i = start; i < end; i++) sum += audio[i]! ** 2;
  return Math.sqrt(sum / (end - start));
}
function checkBounds(audio: Float32Array): void {
  let peak = 0;
  for (const sample of audio) { assert.ok(Number.isFinite(sample)); peak = Math.max(peak, Math.abs(sample)); }
  assert.ok(peak <= 1, `peak ${peak}`);
}

for (const rate of [44100, 48000]) {
  void test(`strings ${rate}: attack, level, release, seed and PCM bounds`, () => {
    const ctx = context(rate);
    const audio = stringsVoice.render(ctx, defaults);
    const repeat = stringsVoice.render(ctx, defaults);
    assert.equal(audio.length, ctx.frames);
    assert.deepEqual(Buffer.from(audio.buffer), Buffer.from(repeat.buffer));
    checkBounds(audio);
    assert.ok(rms(audio, rate, 0, 0.02) < rms(audio, rate, 0.28, 0.38));
    const pad = padVoice.render(ctx, padDefaults);
    const ratio = rms(audio, rate, 0.55, 0.85) / rms(pad, rate, 0.55, 0.85);
    assert.ok(ratio >= 10 ** (-3 / 20) && ratio <= 10 ** (3 / 20), `RMS ratio ${ratio}`);
    assert.ok(rms(audio, rate, 1.8, 1.9) < rms(audio, rate, 0.8, 0.9) * 0.01);
    const longer = stringsVoice.render(context(rate, 57, 123, 1.21), defaults);
    assert.equal(audio[Math.round(1.2 * rate)], longer[Math.round(1.2 * rate)]);
  });
  void test(`strings ${rate}: chorus bypass and detuned ensemble`, () => {
    const ctx = context(rate);
    const dry = stringsVoice.render(ctx, { ...defaults, chorusMix: 0 });
    const wet = stringsVoice.render(ctx, defaults);
    assert.notDeepEqual(wet.subarray(rate / 2, rate / 2 + 500), dry.subarray(rate / 2, rate / 2 + 500));
    assert.deepEqual(dry, stringsVoice.render(ctx, { ...defaults, chorusMix: 0 }));
    assert.notDeepEqual(dry.subarray(rate / 2, rate / 2 + 500),
      stringsVoice.render(ctx, { ...defaults, detuneCents: 12, chorusMix: 0 }).subarray(rate / 2, rate / 2 + 500));
    assert.notDeepEqual(dry.subarray(0, 500), stringsVoice.render(context(rate, 57, 124),
      { ...defaults, chorusMix: 0 }).subarray(0, 500));
    checkBounds(stringsVoice.render(context(rate, 127), defaults));
  });
  void test(`strings ${rate}: ensemble level stays near pad across phase seeds`, () => {
    for (let seed = 0; seed < 16; seed++) {
      const ctx = context(rate, 57, seed);
      const ratio = rms(stringsVoice.render(ctx, defaults), rate, 0.55, 0.85) /
        rms(padVoice.render(ctx, padDefaults), rate, 0.55, 0.85);
      assert.ok(ratio >= 10 ** (-3 / 20) && ratio <= 10 ** (3 / 20), `seed ${seed}: ${ratio}`);
    }
  });
}
