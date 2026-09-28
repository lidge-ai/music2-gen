import assert from "node:assert/strict";
import { test } from "node:test";
import type { StereoBuffer } from "../../audio-io/index.ts";
import { processWidth } from "./width.tool.ts";

function sideSine(hz: number): StereoBuffer {
  const rate = 48000;
  const left = new Float32Array(rate);
  const right = new Float32Array(rate);
  for (let i = 0; i < rate; i++) {
    left[i] = Math.sin(2 * Math.PI * hz * i / rate);
    right[i] = -left[i]!;
  }
  return { sampleRate: rate, left, right, sourceChannels: 2 };
}

function sideRms(audio: StereoBuffer): number {
  let power = 0;
  for (let i = 24000; i < 48000; i++) power += ((audio.left[i]! - audio.right[i]!) * 0.5) ** 2;
  return Math.sqrt(power / 24000);
}

test("zero width folds to mono and 120 Hz fourth-order split removes low side", () => {
  const mono = sideSine(1000);
  processWidth(mono, { amount: 0, monoBelowHz: 120 }, { sampleRate: 48000, bpm: 120 });
  assert.deepEqual(mono.left, mono.right);
  const low = sideSine(50);
  const high = sideSine(1000);
  processWidth(low, { amount: 1, monoBelowHz: 120 }, { sampleRate: 48000, bpm: 120 });
  processWidth(high, { amount: 1, monoBelowHz: 120 }, { sampleRate: 48000, bpm: 120 });
  assert.ok(sideRms(low) < 0.04);
  assert.ok(Math.abs(sideRms(high) - Math.SQRT1_2) < 0.02);
});

test("width passes high side, removes low side, and leaves mid unchanged", () => {
  const cutoff = 120;
  const gainDb = (hz: number): number => {
    const audio = sideSine(hz);
    const before = sideRms(audio);
    processWidth(audio, { amount: 1, monoBelowHz: cutoff }, { sampleRate: 48000, bpm: 120 });
    return 20 * Math.log10(sideRms(audio) / before);
  };
  assert.ok(gainDb(cutoff / 4) <= -20);
  assert.ok(Math.abs(gainDb(cutoff) + 6.02) < 0.2);
  assert.ok(Math.abs(gainDb(cutoff * 4)) <= 0.5);

  const rate = 48000;
  const left = Float32Array.from({ length: rate }, (_, i) => 0.7 * Math.sin(2 * Math.PI * 700 * i / rate) + 0.3 * Math.sin(2 * Math.PI * 480 * i / rate));
  const right = Float32Array.from({ length: rate }, (_, i) => 0.7 * Math.sin(2 * Math.PI * 700 * i / rate) - 0.3 * Math.sin(2 * Math.PI * 480 * i / rate));
  const mid = Float32Array.from(left, (value, i) => (value + right[i]!) * 0.5);
  processWidth({ sampleRate: rate, left, right, sourceChannels: 2 },
    { amount: 1, monoBelowHz: cutoff }, { sampleRate: rate, bpm: 120 });
  for (let i = 0; i < rate; i++) assert.ok(Math.abs((left[i]! + right[i]!) * 0.5 - mid[i]!) < 1e-6);
});
