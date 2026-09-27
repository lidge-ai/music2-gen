import assert from "node:assert/strict";
import test from "node:test";
import type { StereoBuffer } from "../../audio-io/buffer.schema.ts";
import type { Timeline } from "../../song/index.ts";
import { analyzeFlow } from "./flow.tool.ts";

function audio(seconds: number, rate = 8000): StereoBuffer {
  const left = Float32Array.from({ length: rate * seconds }, (_, frame) => .1 * Math.sin(2 * Math.PI * 440 * frame / rate));
  return { sampleRate: rate, left, right: left, sourceChannels: 1 };
}
const onset = (seconds: number) => ({ onset: new Float64Array(seconds * 100), hats: new Float64Array(seconds * 100),
  low: new Float64Array(seconds * 100), frameRate: 100 as const });

test("repeated song flow is exact and JSON contains no typed arrays", () => {
  const timeline: Timeline = { bars: 16, secondsPerBar: 1, durationSeconds: 16, events: [],
    placements: [{ section: "verse", role: "verse", entry: 0, repeat: 0, ordinal: 0, occurrence: 0, startBar: 0, bars: 8 },
      { section: "hook", role: "hook", entry: 1, repeat: 0, ordinal: 1, occurrence: 0, startBar: 8, bars: 8 }] };
  const pcm = audio(17);
  const ctx = { beatMap: null, onset: onset(17), warnings: [], sections: [], bands: [], timeline };
  const first = analyzeFlow(pcm, ctx);
  const second = analyzeFlow(pcm, ctx);
  assert.deepEqual(first.analysis, second.analysis);
  assert.deepEqual(first.similarity.matrix, second.similarity.matrix);
  assert.deepEqual(first.waveform, second.waveform);
  assert.equal(first.analysis.axisKind, "bars");
  assert.equal(first.analysis.intervals.length, 16);
  assert.equal(first.analysis.intervals[15]!.endSeconds, 16);
  assert.equal(first.analysis.sectionMeans.length, 2);
  const visit = (value: unknown): void => {
    assert.ok(!(value instanceof Float32Array) && !(value instanceof Float64Array));
    if (value && typeof value === "object") for (const child of Object.values(value)) visit(child);
  };
  visit(first.analysis);
});

test("WAV silence has frame axis, null LUFS and no declared sections", () => {
  const zeros = new Float32Array(8000);
  const result = analyzeFlow({ sampleRate: 8000, left: zeros, right: zeros, sourceChannels: 1 },
    { beatMap: null, onset: onset(1), warnings: [], sections: [], bands: [] });
  assert.equal(result.analysis.axisKind, "0.5 s");
  assert.deepEqual(result.analysis.intervals.map((row) => row.lufs), [null, null]);
  assert.deepEqual(result.analysis.sectionMeans, []);
});
