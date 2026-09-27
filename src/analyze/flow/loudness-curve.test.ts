import assert from "node:assert/strict";
import test from "node:test";
import type { StereoBuffer } from "../../audio-io/buffer.schema.ts";
import type { Timeline } from "../../song/index.ts";
import { flowIntervals } from "./intervals.tool.ts";
import { flowLoudness } from "./loudness-curve.tool.ts";

function pcm(seconds: number, level: (time: number) => number, sampleRate = 48000): StereoBuffer {
  const left = Float32Array.from({ length: Math.round(seconds * sampleRate) }, (_, frame) =>
    level(frame / sampleRate) * Math.sin(2 * Math.PI * 997 * frame / sampleRate));
  return { sampleRate, left, right: left, sourceChannels: 1 };
}

test("K mean is ungated and amplitude doubling adds 6.02 LU", () => {
  const audio = pcm(3, (time) => time < 1 ? .1 : .2);
  const result = flowLoudness(audio, flowIntervals(3));
  assert.ok(Math.abs(result.intervalLufs[0]! + 23.01) < .2);
  assert.ok(Math.abs(result.intervalLufs[4]! + 16.99) < .2);
  assert.ok(Math.abs(result.intervalLufs[4]! - result.intervalLufs[0]! - 6.02) < .15);
  assert.equal(result.shortTermLufs1Hz.length, 1);
  assert.equal(result.shortTermLufs1Hz[0]!.timeSeconds, 3);
  assert.ok(result.shortTermLufs1Hz[0]!.lufs! > -19.5);
  assert.ok(result.shortTermLufs1Hz[0]!.lufs! < -17);
});

test("11.025 kHz blocks keep whole-second 1 Hz points", () => {
  const result = flowLoudness(pcm(3, () => .1, 11025), flowIntervals(3));
  assert.equal(result.shortTermLufs1Hz.length, 1);
  assert.equal(result.shortTermLufs1Hz[0]!.timeSeconds, 3);
  assert.ok(Math.abs(result.shortTermLufs1Hz[0]!.lufs! + 23.01) < .3);
});

test("incomplete windows and silence remain null", () => {
  const short = flowLoudness(pcm(.3, () => .1), flowIntervals(.3));
  assert.ok(short.momentary10Hz.every((point) => point.lufs === null));
  assert.deepEqual(short.shortTermLufs1Hz, []);
  assert.deepEqual(flowLoudness(pcm(2.9, () => .1), flowIntervals(2.9)).shortTermLufs1Hz, []);
  const zero = flowLoudness(pcm(3, () => 0), flowIntervals(3));
  assert.ok(zero.intervalLufs.every((value) => value === null));
  assert.equal(zero.shortTermLufs1Hz[0]!.lufs, null);
  assert.deepEqual(zero.sectionMeans, []);
});

test("one ungated section mean per placement in order", () => {
  const timeline: Timeline = { bars: 3, secondsPerBar: 1, durationSeconds: 3, events: [],
    placements: ["verse", "build", "hook"].map((section, startBar) => ({
      section, role: section as "verse" | "build" | "hook", entry: startBar, repeat: 0, ordinal: startBar,
      occurrence: 0, startBar, bars: 1,
    })) };
  const result = flowLoudness(pcm(3, (time) => [.1, .2, .4][Math.floor(time)]!), flowIntervals(3, undefined, timeline), timeline);
  assert.deepEqual(result.sectionMeans.map((row) => row.id), ["verse#0", "build#0", "hook#0"]);
  assert.ok(Math.abs(result.sectionMeans[2]!.meanLufs! - result.sectionMeans[0]!.meanLufs! - 12.04) < .2);
});
