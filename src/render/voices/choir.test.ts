import assert from "node:assert/strict";
import test from "node:test";
import { validateSong } from "../../song/index.ts";
import type { VoiceContext } from "../render.schema.ts";
import { padVoice } from "./pad.tool.ts";
import { choirVoice } from "./choir.tool.ts";

const track = validateSong({ version: 1, bpm: 120,
  tracks: [{ id: "v", kind: "notes", instrument: "choir" }],
  sections: [{ id: "a", bars: 1 }], arrangement: [{ section: "a" }] }).tracks[0]!;
const defaults = Object.fromEntries(Object.entries(choirVoice.params).map(([key, spec]) => [key, spec.default]));
const padDefaults = Object.fromEntries(Object.entries(padVoice.params).map(([key, spec]) => [key, spec.default]));
function context(rate: number, midi = 57, seed = 29, gate = 1.2): VoiceContext {
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
function line(audio: Float32Array, rate: number, hz: number): number {
  const start = Math.round(0.55 * rate), count = Math.round(0.5 * rate);
  let real = 0, imag = 0;
  for (let i = 0; i < count; i++) {
    const window = 0.5 - 0.5 * Math.cos(2 * Math.PI * i / (count - 1));
    const angle = 2 * Math.PI * hz * i / rate;
    real += audio[start + i]! * window * Math.cos(angle);
    imag += audio[start + i]! * window * Math.sin(angle);
  }
  return Math.hypot(real, imag) / count;
}
function bandPeak(audio: Float32Array, rate: number, lo: number, hi: number): number {
  let best = lo, level = -Infinity;
  for (let hz = lo; hz <= hi; hz += 10) {
    const candidate = line(audio, rate, hz);
    if (candidate > level) { level = candidate; best = hz; }
  }
  return best;
}

for (const rate of [44100, 48000]) {
  void test(`choir ${rate}: parallel formants follow vowel centers`, () => {
    const midi100 = 69 + 12 * Math.log2(100 / 440);
    const ctx = context(rate, midi100);
    const a = choirVoice.render(ctx, defaults);
    for (const center of [660, 1720, 2410]) {
      const peak = bandPeak(a, rate, center - 300, center + 300);
      assert.ok(Math.abs(peak - center) <= 150, `${center}: ${peak}`);
    }
    const i = choirVoice.render(ctx, { ...defaults, vowel: 2 });
    const u = choirVoice.render(ctx, { ...defaults, vowel: 4 });
    assert.ok(bandPeak(i, rate, 750, 2550) > bandPeak(u, rate, 750, 2550));
    assert.ok(line(i, rate, 2300) > line(u, rate, 2300));
  });
  void test(`choir ${rate}: PCM bounds, level, release and seed`, () => {
    const ctx = context(rate);
    const audio = choirVoice.render(ctx, defaults);
    assert.deepEqual(Buffer.from(audio.buffer), Buffer.from(choirVoice.render(ctx, defaults).buffer));
    assert.notDeepEqual(audio.subarray(0, 1000), choirVoice.render(context(rate, 57, 30), defaults).subarray(0, 1000));
    assert.equal(audio.length, ctx.frames);
    assert.ok(audio.every((sample) => Number.isFinite(sample) && Math.abs(sample) <= 1));
    const pad = padVoice.render(ctx, padDefaults);
    const ratio = rms(audio, rate, 0.55, 0.85) / rms(pad, rate, 0.55, 0.85);
    assert.ok(ratio >= 10 ** (-3 / 20) && ratio <= 10 ** (3 / 20), `RMS ratio ${ratio}`);
    assert.ok(rms(audio, rate, 1.8, 1.9) < rms(audio, rate, 0.8, 0.9) * 0.01);
    assert.equal(audio[Math.round(1.2 * rate)],
      choirVoice.render(context(rate, 57, 29, 1.21), defaults)[Math.round(1.2 * rate)]);
    assert.ok(choirVoice.render(context(rate, 127), defaults).every(Number.isFinite));
    const resonant = context(rate, 99, 14);
    resonant.events[0]!.velocity = 1;
    const bounded = choirVoice.render(resonant, { ...defaults, vowel: 1, attackMs: 100 });
    assert.ok(bounded.every((sample) => Number.isFinite(sample) && Math.abs(sample) <= 1));
  });
}
