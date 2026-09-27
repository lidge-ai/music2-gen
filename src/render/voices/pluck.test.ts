import assert from "node:assert/strict";
import test from "node:test";
import { validateSong } from "../../song/index.ts";
import type { VoiceContext, VoiceEvent } from "../render.schema.ts";
import { pluckVoice } from "./pluck.tool.ts";

const rate = 44100;
const track = validateSong({ version: 1, bpm: 120,
  tracks: [{ id: "pluck", kind: "notes", instrument: "pluck" }],
  sections: [{ id: "a", bars: 1 }], arrangement: [{ section: "a" }] }).tracks[0]!;
const defaults = Object.fromEntries(Object.entries(pluckVoice.params).map(([name, spec]) => [name, spec.default]));
function note(seed: number, midi = 60): VoiceEvent {
  return { midi, sample: null, velocity: 1, startFrame: 0, gateFrames: rate, stopFrame: rate, eventIndex: 0, seed };
}
function render(events: VoiceEvent[]): Float32Array {
  const ctx: VoiceContext = { sampleRate: rate, frames: rate, track, events };
  return pluckVoice.render(ctx, defaults);
}

void test("pluck excitation is byte identical for equal seed and differs for another", () => {
  const a = render([note(12)]);
  const b = render([note(12)]);
  const c = render([note(13)]);
  assert.deepEqual(a, b);
  assert.notDeepEqual(a.subarray(0, 200), c.subarray(0, 200));
});

void test("C4 feedback period is about 168-169 frames", () => {
  const audio = render([note(42)]);
  let bestLag = 0;
  let best = -Infinity;
  for (let lag = 160; lag <= 178; lag++) {
    let correlation = 0;
    for (let i = 500; i < 5000; i++) correlation += audio[i]! * audio[i + lag]!;
    if (correlation > best) { best = correlation; bestLag = lag; }
  }
  assert.ok(bestLag === 168 || bestLag === 169, `period=${bestLag}`);
});

void test("pluck sums separate events and releases after gate", () => {
  const event = { ...note(1), gateFrames: 4410 };
  const a = render([event]);
  const pair = render([event, { ...event, seed: 2 }]);
  assert.notDeepEqual(a.subarray(0, 200), pair.subarray(0, 200));
  let early = 0, late = 0;
  for (let i = 1000; i < 2000; i++) early += a[i]! ** 2;
  for (let i = 12000; i < 13000; i++) late += a[i]! ** 2;
  assert.ok(late < early * 0.001);
});
