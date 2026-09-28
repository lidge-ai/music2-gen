import assert from "node:assert/strict";
import test from "node:test";
import { validateSong } from "../../song/index.ts";
import type { VoiceContext } from "../render.schema.ts";
import { padVoice } from "./pad.tool.ts";
import { brassVoice } from "./brass.tool.ts";

const track = validateSong({ version: 1, bpm: 120,
  tracks: [{ id: "v", kind: "notes", instrument: "brass" }],
  sections: [{ id: "a", bars: 1 }], arrangement: [{ section: "a" }] }).tracks[0]!;
const defaults = Object.fromEntries(Object.entries(brassVoice.params).map(([key, spec]) => [key, spec.default]));
const padDefaults = Object.fromEntries(Object.entries(padVoice.params).map(([key, spec]) => [key, spec.default]));
function context(rate: number, velocity = 0.8, midi = 57, gate = 1.2): VoiceContext {
  return { sampleRate: rate, frames: 2 * rate, track,
    events: [{ midi, sample: null, velocity, startFrame: 0, gateFrames: Math.round(gate * rate),
      stopFrame: 2 * rate, eventIndex: 0, seed: 19 }] };
}
function rms(audio: Float32Array, rate: number, from: number, to: number): number {
  const start = Math.round(from * rate), end = Math.round(to * rate);
  let sum = 0;
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
function crossingPitch(audio: Float32Array, rate: number, from: number, to: number): number {
  const crossings: number[] = [];
  for (let i = Math.round(from * rate) + 1; i < Math.round(to * rate); i++) {
    const before = audio[i - 1]!, after = audio[i]!;
    if (before < 0 && after >= 0) crossings.push(i - 1 - before / (after - before));
  }
  assert.ok(crossings.length >= 3);
  return rate * (crossings.length - 1) / (crossings[crossings.length - 1]! - crossings[0]!);
}

for (const rate of [44100, 48000]) {
  void test(`brass ${rate}: deterministic finite level and release`, () => {
    const ctx = context(rate);
    const audio = brassVoice.render(ctx, defaults);
    assert.deepEqual(Buffer.from(audio.buffer), Buffer.from(brassVoice.render(ctx, defaults).buffer));
    assert.equal(audio.length, ctx.frames);
    let peak = 0;
    for (const sample of audio) { assert.ok(Number.isFinite(sample)); peak = Math.max(peak, Math.abs(sample)); }
    assert.ok(peak <= 1, `peak ${peak}`);
    const pad = padVoice.render(ctx, padDefaults);
    const ratio = rms(audio, rate, 0.55, 0.85) / rms(pad, rate, 0.55, 0.85);
    assert.ok(ratio >= 10 ** (-3 / 20) && ratio <= 10 ** (3 / 20), `RMS ratio ${ratio}`);
    assert.ok(rms(audio, rate, 1.6, 1.7) < rms(audio, rate, 0.8, 0.9) * 0.01);
    assert.equal(audio[Math.round(1.2 * rate)],
      brassVoice.render(context(rate, 0.8, 57, 1.21), defaults)[Math.round(1.2 * rate)]);
  });
  void test(`brass ${rate}: velocity and envelope brighten upper harmonics`, () => {
    const soft = brassVoice.render(context(rate, 0.3), defaults);
    const loud = brassVoice.render(context(rate, 0.9), defaults);
    const ratio = (audio: Float32Array, from: number) =>
      line(audio, rate, from, 0.12, 10 * 220) / line(audio, rate, from, 0.12, 220);
    assert.ok(ratio(loud, 0.18) > ratio(soft, 0.18), "velocity must open filter");
    assert.ok(ratio(loud, 0.18) > ratio(loud, 0.01), "attack must open filter");
    const highQ = brassVoice.render(context(rate, 1, 127), { ...defaults, q: 2, peakHz: 8000 });
    assert.ok(highQ.every(Number.isFinite));
    assert.ok(highQ.every((sample) => Math.abs(sample) <= 1));
  });
  void test(`brass ${rate}: pitch scoop settles to A3`, () => {
    const audio = brassVoice.render(context(rate), { ...defaults, scoopCents: 70 });
    const onset = crossingPitch(audio, rate, 0.007, 0.065);
    const stable = crossingPitch(audio, rate, 0.4, 0.8);
    assert.ok(onset < stable - 2, `${onset} vs ${stable}`);
    assert.ok(Math.abs(stable - 220) < 1, `stable pitch ${stable}`);
  });
}
