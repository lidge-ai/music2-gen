import assert from "node:assert/strict";
import test from "node:test";
import type { StereoBuffer } from "../../audio-io/index.ts";
import { processDrive } from "./drive.tool.ts";

test("mix zero bypasses exactly", () => {
  const left = Float32Array.from([1, -.5, .25]);
  const buffer: StereoBuffer = { sampleRate: 48000, left, right: left.slice(), sourceChannels: 2 };
  processDrive(buffer, { amount: 12, toneHz: 18000, mix: 0 }, { sampleRate: 48000, bpm: 120 });
  assert.deepEqual([...left], [1, -.5, .25]);
});

test("oversampled wet impulse has bounded finite output and latency; dry aligns", () => {
  const rate = 48000; const length = 256;
  const impulse = new Float32Array(length); impulse[0] = .1;
  const wet: StereoBuffer = { sampleRate: rate, left: impulse.slice(), right: impulse.slice(), sourceChannels: 2 };
  processDrive(wet, { amount: 12, toneHz: 18000, mix: 1 }, { sampleRate: rate, bpm: 120 });
  assert.ok(wet.left.every(Number.isFinite));
  // Symmetric FIRs pre-ring; their impulse energy is centered on frame 15.
  const peakFrame = wet.left.reduce((best, value, i) => Math.abs(value) > Math.abs(wet.left[best]!) ? i : best, 0);
  assert.equal(peakFrame, 15);
  const dry: StereoBuffer = { sampleRate: rate, left: impulse.slice(), right: impulse.slice(), sourceChannels: 2 };
  processDrive(dry, { amount: 12, toneHz: 18000, mix: .001 }, { sampleRate: rate, bpm: 120 });
  assert.ok(dry.left[15]! > .09);
});

test("2x half-band path suppresses the 10 kHz third-harmonic alias", () => {
  const rate = 48000; const length = rate;
  const input = Float32Array.from({ length }, (_, i) => .6 * Math.sin(2 * Math.PI * 10000 * i / rate));
  const naive = Float32Array.from(input, (x) => Math.tanh(12 * x) / Math.tanh(12));
  const buffer: StereoBuffer = { sampleRate: rate, left: input, right: input.slice(), sourceChannels: 2 };
  processDrive(buffer, { amount: 12, toneHz: 18000, mix: 1 }, { sampleRate: rate, bpm: 120 });
  const aliasLevel = (samples: Float32Array): number => {
    let cosine = 0; let sine = 0;
    for (let i = length / 2; i < length; i++) {
      const angle = 2 * Math.PI * 18000 * i / rate;
      cosine += samples[i]! * Math.cos(angle);
      sine += samples[i]! * Math.sin(angle);
    }
    return Math.hypot(cosine, sine);
  };
  assert.ok(20 * Math.log10(aliasLevel(input) / aliasLevel(naive)) < -10);
});
