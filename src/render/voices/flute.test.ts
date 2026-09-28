import assert from "node:assert/strict";
import test from "node:test";
import { validateSong } from "../../song/index.ts";
import type { VoiceContext } from "../render.schema.ts";
import { padVoice } from "./pad.tool.ts";
import { fluteVoice } from "./flute.tool.ts";

const track = validateSong({ version: 1, bpm: 120,
  tracks: [{ id: "v", kind: "notes", instrument: "flute" }],
  sections: [{ id: "a", bars: 1 }], arrangement: [{ section: "a" }] }).tracks[0]!;
const defaults = Object.fromEntries(Object.entries(fluteVoice.params).map(([key, spec]) => [key, spec.default]));
const padDefaults = Object.fromEntries(Object.entries(padVoice.params).map(([key, spec]) => [key, spec.default]));
function context(rate: number, seed = 23, gate = 1.2, midi = 57): VoiceContext {
  return { sampleRate: rate, frames: 2 * rate, track,
    events: [{ midi, sample: null, velocity: 0.8, startFrame: 0,
      gateFrames: Math.round(gate * rate), stopFrame: 2 * rate, eventIndex: 0, seed }] };
}
function rms(audio: Float32Array, rate: number, from: number, to: number): number {
  let sum = 0;
  const start = Math.round(from * rate), end = Math.round(to * rate);
  for (let i = start; i < end; i++) sum += audio[i]! ** 2;
  return Math.sqrt(sum / (end - start));
}
function line(audio: Float32Array, rate: number, from: number, seconds: number, hz: number): number {
  const start = Math.round(from * rate), count = Math.round(seconds * rate);
  let real = 0, imag = 0;
  for (let i = 0; i < count; i++) {
    const window = 0.5 - 0.5 * Math.cos(2 * Math.PI * i / (count - 1));
    const angle = 2 * Math.PI * hz * i / rate;
    real += audio[start + i]! * window * Math.cos(angle);
    imag += audio[start + i]! * window * Math.sin(angle);
  }
  return Math.hypot(real, imag) / count;
}
function highBand(audio: Float32Array, rate: number, from: number, seconds: number): number {
  const start = Math.round(from * rate), end = Math.round((from + seconds) * rate);
  let energy = 0;
  for (let i = start + 1; i < end; i++) energy += (audio[i]! - audio[i - 1]!) ** 2;
  return Math.sqrt(energy / (end - start));
}

for (const rate of [44100, 48000]) {
  void test(`flute ${rate}: fundamental, noise onset and delayed vibrato`, () => {
    const ctx = context(rate);
    const audio = fluteVoice.render(ctx, defaults);
    assert.ok(line(audio, rate, 0.5, 0.3, 440) < line(audio, rate, 0.5, 0.3, 220) * 0.3);
    assert.ok(highBand(audio, rate, 0.01, 0.02) > highBand(audio, rate, 0.5, 0.02) * 0.7);
    const shallow = fluteVoice.render(ctx, { ...defaults, vibratoCents: 8 });
    assert.deepEqual(audio.subarray(0, Math.round(0.18 * rate)),
      shallow.subarray(0, Math.round(0.18 * rate)));
    assert.notDeepEqual(audio.subarray(Math.round(0.5 * rate), Math.round(0.6 * rate)),
      shallow.subarray(Math.round(0.5 * rate), Math.round(0.6 * rate)));
  });
  void test(`flute ${rate}: PCM bounds, pad level, release and seed`, () => {
    const ctx = context(rate);
    const audio = fluteVoice.render(ctx, defaults);
    assert.deepEqual(Buffer.from(audio.buffer), Buffer.from(fluteVoice.render(ctx, defaults).buffer));
    assert.notDeepEqual(audio.subarray(0, 1000), fluteVoice.render(context(rate, 24), defaults).subarray(0, 1000));
    assert.equal(audio.length, ctx.frames);
    assert.ok(audio.every((sample) => Number.isFinite(sample) && Math.abs(sample) <= 1));
    const pad = padVoice.render(ctx, padDefaults);
    const ratio = rms(audio, rate, 0.55, 0.85) / rms(pad, rate, 0.55, 0.85);
    assert.ok(ratio >= 10 ** (-3 / 20) && ratio <= 10 ** (3 / 20), `RMS ratio ${ratio}`);
    assert.ok(rms(audio, rate, 1.6, 1.7) < rms(audio, rate, 0.8, 0.9) * 0.01);
    assert.equal(audio[Math.round(1.2 * rate)],
      fluteVoice.render(context(rate, 23, 1.21), defaults)[Math.round(1.2 * rate)]);
    assert.ok(fluteVoice.render(context(rate, 23, 1.2, 127), defaults).every(Number.isFinite));
    const top = fluteVoice.render(context(rate, 23, 1.2, 127), defaults);
    const f0 = 440 * 2 ** ((127 - 69) / 12);
    const foldedSecond = Math.abs(rate - 2 * f0);
    assert.ok(line(top, rate, 0.5, 0.3, foldedSecond) <
      line(top, rate, 0.5, 0.3, f0) * 0.05, "omitted second harmonic must not fold");
  });
}
