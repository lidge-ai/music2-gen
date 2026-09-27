import assert from "node:assert/strict";
import test from "node:test";
import type { StereoBuffer } from "./buffer.schema.ts";
import { kWeightedPower } from "./kweight.tool.ts";

for (const rate of [44100, 48000]) for (const channels of [1, 2] as const) {
  test(`K scan ${rate} Hz ${channels} channel`, () => {
    const left = Float32Array.from({ length: rate + Math.round(rate * .05) }, (_, frame) =>
      .1 * Math.sin(2 * Math.PI * 997 * frame / rate));
    const pcm: StereoBuffer = { sampleRate: rate, left, right: left, sourceChannels: channels };
    let visited = 0;
    const blocks = kWeightedPower(pcm, (_frame, power) => { visited += power; });
    assert.equal(blocks.length, 11);
    const total = blocks.reduce((sum, value) => sum + value, 0);
    assert.ok(Math.abs(visited - total) / total < 1e-9);
    assert.ok(blocks[0]! > 0);
    if (channels === 2) {
      const mono = kWeightedPower({ ...pcm, sourceChannels: 1 });
      assert.equal(blocks[0], 2 * mono[0]!);
    }
  });
}

test("K scan silence and invalid PCM", () => {
  const left = new Float32Array(4800);
  const pcm: StereoBuffer = { sampleRate: 48000, left, right: left, sourceChannels: 1 };
  assert.deepEqual(Array.from(kWeightedPower(pcm)), [0]);
  left[10] = NaN;
  assert.throws(() => kWeightedPower(pcm), { code: "E_INPUT" });
  assert.throws(() => kWeightedPower({ ...pcm, sampleRate: 5 }), { code: "E_INPUT" });
});
