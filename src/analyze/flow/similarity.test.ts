import assert from "node:assert/strict";
import test from "node:test";
import type { Timeline } from "../../song/index.ts";
import type { FlowFeature } from "./flow.schema.ts";
import { flowIntervals } from "./intervals.tool.ts";
import { flowSimilarity } from "./similarity.tool.ts";

function feature(position: number, silent = false): FlowFeature {
  const vector = new Float32Array(20);
  if (!silent) vector[position] = 1;
  return { vector, silent, onsetCount: 0, onsetsPerSecond: 0, centroidHz: null };
}
function timeline(bars: number, starts: number[] = []): Timeline {
  return { bars, secondsPerBar: 1, durationSeconds: bars, events: [], placements: starts.map((startBar, ordinal) => ({
    section: String(ordinal), entry: ordinal, repeat: 0, ordinal, occurrence: 0, startBar,
    bars: (starts[ordinal + 1] ?? bars) - startBar, role: null,
  })) };
}

test("eight copied vectors produce a full off-diagonal stripe and repeat", () => {
  const features = Array.from({ length: 28 }, (_, index) => feature(index >= 20 ? index - 20 : index < 12 && index >= 4 ? index - 4 : 8 + index % 12));
  for (let index = 0; index < 8; index++) features[20 + index] = feature(index);
  const result = flowSimilarity(features, flowIntervals(28, undefined, timeline(28)), timeline(28));
  for (let index = 0; index < 8; index++) assert.equal(result.matrix[(4 + index) * 28 + 20 + index], 1);
  assert.ok(result.repeats.some((repeat) => repeat.firstStartBar === 5 && repeat.firstEndBar === 12 &&
    repeat.secondStartBar === 21 && repeat.secondEndBar === 28 && repeat.meanSimilarity === 1));
  features[4] = feature(0, true);
  assert.equal(flowSimilarity(features, flowIntervals(28, undefined, timeline(28))).matrix[4 * 28 + 20], 0);
});

test("Foote novelty picks two change boundaries and none for equal features", () => {
  const declared = timeline(24, [0, 8, 16]);
  const features = Array.from({ length: 24 }, (_, index) => feature(index < 8 || index >= 16 ? 0 : 1));
  const result = flowSimilarity(features, flowIntervals(24, undefined, declared), declared);
  assert.deepEqual(result.peaks.map((peak) => peak.atBar), [9, 17]);
  assert.ok(result.peaks.every((peak) => peak.declaredHit === true));
  const constant = flowSimilarity(Array.from({ length: 24 }, () => feature(0)), flowIntervals(24, undefined, declared));
  assert.deepEqual(constant.peaks, []);
  const near = timeline(24, [0, 9, 18]);
  assert.equal(flowSimilarity(features, flowIntervals(24, undefined, near), near).peaks[0]!.declaredHit, true);
  const far = timeline(24, [0, 10, 19]);
  assert.equal(flowSimilarity(features, flowIntervals(24, undefined, far), far).peaks[0]!.declaredHit, false);
});
