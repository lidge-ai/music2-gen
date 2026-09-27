import { test } from "node:test";
import assert from "node:assert/strict";
import { createStereo } from "./buffer.tool.ts";
import { measureLoudness } from "./loudness.tool.ts";

function sine(rate: number, seconds: number, dbfs: number, channels: 1 | 2 = 2) {
  const pcm = createStereo(rate, rate * seconds);
  pcm.sourceChannels = channels;
  const amplitude = 10 ** (dbfs / 20);
  for (let frame = 0; frame < pcm.left.length; frame++) {
    const sample = amplitude * Math.sin(2 * Math.PI * 1000 * frame / rate);
    pcm.left[frame] = sample;
    pcm.right[frame] = sample;
  }
  return pcm;
}

for (const rate of [44100, 48000]) {
  test(`stereo -23 dBFS 1 kHz measures -23 LUFS at ${rate} Hz`, () => {
    const result = measureLoudness(sine(rate, 20, -23));
    assert.ok(result.integratedLufs !== null && Math.abs(result.integratedLufs + 23) < .1,
      String(result.integratedLufs));
    assert.equal(result.truePeakOversample, 4);
    assert.equal(result.lraProvisional, true);
  });
}

test("mono -20 dBFS 1 kHz measures -23.01 LUFS using only left", () => {
  const pcm = sine(44100, 20, -20, 1);
  pcm.right.fill(0.9);
  const result = measureLoudness(pcm);
  assert.ok(result.integratedLufs !== null && Math.abs(result.integratedLufs + 23.01) < .1,
    String(result.integratedLufs));
  assert.ok(result.samplePeakDbfs !== null && Math.abs(result.samplePeakDbfs + 20) < .01);
});

test("two 20-second levels produce 10 LU loudness range", () => {
  const pcm = sine(44100, 40, -20);
  for (let frame = 20 * 44100; frame < pcm.left.length; frame++) {
    pcm.left[frame] = pcm.left[frame]! * 10 ** (-10 / 20);
    pcm.right[frame] = pcm.right[frame]! * 10 ** (-10 / 20);
  }
  const result = measureLoudness(pcm);
  assert.ok(result.lraLu !== null && Math.abs(result.lraLu - 10) < 1, String(result.lraLu));
  assert.equal(result.lraProvisional, true);
});

test("silence and a short clip have null integrated loudness", () => {
  const silence = measureLoudness(createStereo(44100, 44100));
  assert.equal(silence.integratedLufs, null);
  assert.equal(silence.lraLu, null);
  assert.equal(silence.samplePeakDbfs, null);
  assert.equal(silence.truePeakEstimateDbtp, null);
  const short = measureLoudness(sine(44100, .1, -20));
  assert.equal(short.integratedLufs, null);
});

test("4x reconstruction catches an intersample peak", () => {
  const pcm = createStereo(44100, 64);
  pcm.left[24] = 1; pcm.left[25] = 1;
  pcm.right[24] = 1; pcm.right[25] = 1;
  const result = measureLoudness(pcm);
  assert.ok(result.truePeakEstimateDbtp !== null && result.truePeakEstimateDbtp > 0.5,
    String(result.truePeakEstimateDbtp));
  assert.equal(result.samplePeakDbfs, 0);
});

test("4x reconstruction preserves the interior of a constant signal", () => {
  const pcm = createStereo(44100, 256);
  pcm.left.fill(.5); pcm.right.fill(.5);
  const result = measureLoudness(pcm);
  assert.ok(result.truePeakEstimateDbtp !== null);
  assert.ok(Math.abs(10 ** (result.truePeakEstimateDbtp / 20) - .5) < 1e-4);
});
