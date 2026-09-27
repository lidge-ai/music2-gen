import { test } from "node:test";
import assert from "node:assert/strict";
import type { StereoBuffer } from "../audio-io/buffer.schema.ts";
import { measureBands } from "./bands.tool.ts";

function sine(sampleRate: number, frequency: number, channels: 1 | 2 = 2): StereoBuffer {
  const frames = Math.round(sampleRate * 0.35);
  const left = Float32Array.from({ length: frames }, (_, i) => 0.5 * Math.sin(2 * Math.PI * frequency * i / sampleRate));
  return { sampleRate, left, right: channels === 1 ? new Float32Array(frames) : left.slice(), sourceChannels: channels };
}

test("50 Hz concentrates in sub", () => {
  const { bands } = measureBands(sine(44100, 50));
  assert.ok(bands[0]!.share > 0.8, String(bands[0]!.share));
  assert.ok(Math.abs(bands.reduce((sum, band) => sum + band.share, 0) - 1) < 1e-9);
});

test("10 kHz concentrates in air", () => {
  const { bands } = measureBands(sine(44100, 10000));
  assert.ok(bands[5]!.share > 0.9, String(bands[5]!.share));
  assert.equal(bands[5]!.toHz, 20000);
});

test("silence has zero shares and null relative dB", () => {
  const pcm = sine(44100, 0);
  const { bands } = measureBands(pcm);
  assert.equal(bands.length, 6);
  for (const band of bands) {
    assert.equal(band.share, 0);
    assert.equal(band.dbRelative, null);
  }
});

test("48 kHz analysis retains the 20 kHz upper edge", () => {
  const { bands } = measureBands(sine(48000, 10000));
  assert.equal(bands[5]!.toHz, 20000);
  assert.ok(bands[5]!.share > 0.9);
});

test("bands beyond Nyquist have zero width at a low sample rate", () => {
  const { bands } = measureBands(sine(6000, 1000));
  assert.equal(bands[5]!.fromHz, 3000);
  assert.equal(bands[5]!.toHz, 3000);
  assert.equal(bands[5]!.share, 0);
});

test("mono and stereo-duplicated spectra agree", () => {
  const stereo = sine(44100, 10000);
  const mono = { ...stereo, right: new Float32Array(stereo.left.length), sourceChannels: 1 as const };
  const a = measureBands(mono).bands;
  const b = measureBands(stereo).bands;
  for (let i = 0; i < a.length; i++) assert.ok(Math.abs(a[i]!.share - b[i]!.share) < 1e-6);
});
