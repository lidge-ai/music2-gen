import assert from "node:assert/strict";
import test from "node:test";
import type { StereoBuffer } from "../../audio-io/index.ts";
import { compressGain, processCompressor } from "./compressor.tool.ts";

const rate = 48000;
const params = { thresholdDb: -18, ratio: 4, attackMs: 10, releaseMs: 100, kneeDb: 0, makeupDb: 0 };
const context = { sampleRate: rate, bpm: 120 };

function rms(channel: Float32Array, start: number, end: number): number {
  let power = 0;
  for (let i = start; i < end; i++) power += channel[i]! ** 2;
  return Math.sqrt(power / (end - start));
}

test("gain computer has hard-ratio line and continuous soft knee", () => {
  assert.equal(compressGain(-12, -18, 4, 0), 4.5);
  assert.equal(compressGain(-21, -18, 4, 6), 0);
  assert.equal(compressGain(-18, -18, 4, 6), .5625);
  assert.equal(compressGain(-15, -18, 4, 6), 2.25);
});

test("linked RMS compressor settles a -12 dBFS RMS sine near -16.5 dBFS", () => {
  const amplitude = Math.SQRT2 * 10 ** (-12 / 20);
  const left = Float32Array.from({ length: rate * 2 }, (_, i) => amplitude * Math.sin(2 * Math.PI * 1000 * i / rate));
  const right = left.slice();
  const audio: StereoBuffer = { sampleRate: rate, left, right, sourceChannels: 2 };
  processCompressor(audio, params, context);
  const outputDb = 20 * Math.log10(rms(left, rate, rate * 2));
  assert.ok(Math.abs(outputDb + 16.5) <= 0.5, `settled RMS=${outputDb} dBFS`);
});

test("stereo link applies identical gain to unequal channels", () => {
  const loud = 10 ** (-9 / 20);
  const left = new Float32Array(rate).fill(loud);
  const right = new Float32Array(rate).fill(loud / 2);
  processCompressor({ sampleRate: rate, left, right, sourceChannels: 2 }, params, context);
  assert.ok(Math.abs(left.at(-1)! / loud - right.at(-1)! / (loud / 2)) < 1e-6);
  assert.ok(left.at(-1)! < loud * 0.75);
});

test("attack and release follow separate gain smoothing time constants", () => {
  const loud = 10 ** (-12 / 20);
  const quiet = 10 ** (-40 / 20);
  const left = Float32Array.from({ length: rate * 2 }, (_, i) => i < rate ? loud : quiet);
  const right = left.slice();
  processCompressor({ sampleRate: rate, left, right, sourceChannels: 2 }, params, context);
  const reductionAtAttack = -20 * Math.log10(left[480]! / loud);
  const reductionAtSettle = -20 * Math.log10(left[rate - 1]! / loud);
  const reductionAtRelease = -20 * Math.log10(left[rate + 4800]! / quiet);
  assert.ok(reductionAtAttack > 0.5 && reductionAtAttack < reductionAtSettle - 0.5);
  assert.ok(Math.abs(reductionAtSettle - 4.5) < 0.05);
  assert.ok(reductionAtRelease > 1 && reductionAtRelease < 2.5);
  assert.ok(Math.abs(-20 * Math.log10(left.at(-1)! / quiet)) < 0.05);
});
