import assert from "node:assert/strict";
import test from "node:test";
import { createStereo } from "../../audio-io/index.ts";
import { validateSong } from "../../song/index.ts";
import { applyInsertChain } from "./index.ts";

const types = [
  ["filter", "cutoffHz", 1000, 4000], ["eq", "lowGainDb", 3, -6],
  ["eq", "midGainDb", 3, -6], ["eq", "highGainDb", 3, -6],
  ["drive", "amount", 2, 8], ["tremolo", "depth", .5, .9],
  ["delay", "mix", .35, .8], ["width", "amount", 1, 0],
] as const;

for (const [type, parameter, steady, moved] of types) {
  test(`${type}.${parameter} constant curve matches static and dynamic curve changes PCM`, () => {
    const song = validateSong({ version: 1, bpm: 120, sampleRate: 44100,
      tracks: [{ id: "p", kind: "notes", instrument: "piano", pattern: "c4",
        fx: [{ type, [parameter]: steady }] }],
      sections: [{ id: "one", bars: 1 }], arrangement: [{ section: "one" }] });
    const insert = song.tracks[0]!.fx![0]!;
    const frames = type === "delay" ? 24000 : 256;
    const halfway = frames / 2;
    const original = createStereo(44100, frames);
    for (let i = 0; i < frames; i++) { original.left[i] = Math.sin(i * .13) * .4; original.right[i] = Math.cos(i * .11) * .4; }
    const staticBuffer = { ...original, left: original.left.slice(), right: original.right.slice() };
    const constant = { ...original, left: original.left.slice(), right: original.right.slice() };
    const changing = { ...original, left: original.left.slice(), right: original.right.slice() };
    applyInsertChain(staticBuffer, [insert], { sampleRate: 44100, bpm: 120 }, "p");
    applyInsertChain(constant, [insert], { sampleRate: 44100, bpm: 120,
      insertCurves: { 0: { [parameter]: new Float32Array(frames).fill(steady) } } }, "p");
    const dynamic = new Float32Array(frames).fill(steady); dynamic.fill(moved, halfway);
    applyInsertChain(changing, [insert], { sampleRate: 44100, bpm: 120,
      insertCurves: { 0: { [parameter]: dynamic } } }, "p");
    for (let i = 0; i < frames; i++) {
      assert.ok(Math.abs(staticBuffer.left[i]! - constant.left[i]!) < 1e-6, `${type}.${parameter} L@${i}`);
      assert.ok(Math.abs(staticBuffer.right[i]! - constant.right[i]!) < 1e-6, `${type}.${parameter} R@${i}`);
    }
    assert.ok(changing.left.some((sample, i) => Math.abs(sample - constant.left[i]!) > 1e-5));
  });
}
