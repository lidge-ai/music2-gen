import assert from "node:assert/strict";
import test from "node:test";
import type { Timeline } from "../../song/index.ts";
import type { BeatMap } from "../analysis.schema.ts";
import { flowIntervals } from "./intervals.tool.ts";

const timeline: Timeline = { bars: 16, secondsPerBar: 4 * 60 / 140,
  durationSeconds: 16 * 4 * 60 / 140, placements: [], events: [] };
const beatMap: BeatMap = { version: 1, bpm: 120, meter: 4, timeSignature: { numerator: 4, denominator: 4 },
  offsetFrames: 0, source: "audio", confidence: .6, beatsSeconds: [0, .5, 1, 1.5],
  downbeatsSeconds: [], sections: [] };

test("declared song bars are exact", () => {
  const grid = flowIntervals(40, undefined, timeline);
  assert.equal(grid.axisKind, "bars");
  assert.equal(grid.intervals.length, 16);
  assert.equal(grid.intervals[15]!.endSeconds, 16 * 4 * 60 / 140);
});

test("audio beats need reliable, increasing samples", () => {
  const beats = flowIntervals(2, beatMap);
  assert.equal(beats.axisKind, "beats");
  assert.deepEqual(beats.intervals.map((row) => [row.startSeconds, row.endSeconds]), [[0, .5], [.5, 1], [1, 1.5]]);
  for (const map of [{ ...beatMap, confidence: .59 }, { ...beatMap, beatsSeconds: [0, .5, 1] },
    { ...beatMap, beatsSeconds: [0, .5, .5, 1] }, undefined]) {
    const grid = flowIntervals(1.2, map);
    assert.equal(grid.axisKind, "0.5 s");
    assert.deepEqual(grid.intervals.map((row) => [row.startSeconds, row.endSeconds]), [[0, .5], [.5, 1], [1, 1.2]]);
  }
  assert.equal(flowIntervals(.3).intervals.length, 1);
});
