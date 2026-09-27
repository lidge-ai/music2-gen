import assert from "node:assert/strict";
import test from "node:test";
import type { StereoBuffer } from "../../audio-io/buffer.schema.ts";
import { threeBandWaveform } from "./bands3.tool.ts";

for (const rate of [44100, 48000]) for (const [frequency, band] of [[100, "low"], [1000, "mid"], [8000, "high"]] as const) {
  test(`${frequency} Hz occupies ${band} band at ${rate} Hz`, () => {
    const left = Float32Array.from({ length: rate }, (_, frame) => .5 * Math.sin(2 * Math.PI * frequency * frame / rate));
    const audio: StereoBuffer = { sampleRate: rate, left, right: left, sourceChannels: 1 };
    const column = threeBandWaveform(audio, 10)[5]!;
    const rms = column[`${band}Rms`];
    assert.ok(Math.abs(rms - .3536) < .03, String(rms));
    assert.ok(Math.abs(column[`${band}Peak`] - .5) < .03);
    for (const other of ["low", "mid", "high"] as const) if (other !== band) assert.ok(rms > column[`${other}Rms`]);
  });
}

test("silent and single-channel stereo band columns", () => {
  const left = Float32Array.from({ length: 48000 }, (_, frame) => .5 * Math.sin(2 * Math.PI * 1000 * frame / 48000));
  const zero = new Float32Array(left.length);
  const base: StereoBuffer = { sampleRate: 48000, left: zero, right: zero, sourceChannels: 2 };
  assert.ok(threeBandWaveform(base, 10).every((row) => Object.values(row).every((value) => value === 0)));
  const middle = threeBandWaveform({ ...base, left }, 10)[5]!;
  assert.ok(Math.abs(middle.midPeak - .5) < .03);
  assert.ok(Math.abs(middle.midRms - .25) < .03);
});
