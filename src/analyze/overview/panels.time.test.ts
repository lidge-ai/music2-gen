import assert from "node:assert/strict";
import test from "node:test";
import type { AnalysisJson } from "../analysis.schema.ts";
import type { FlowRenderData } from "../flow/flow.schema.ts";
import { createCanvas } from "./canvas.tool.ts";
import { C } from "./panels.shared.tool.ts";
import { drawBrightness, drawDensity } from "./panels.time.tool.ts";

test("WAV density uses onset rate and brightness uses centroid", () => {
  const canvas = createCanvas(1600, 1400, C.background);
  const analysis = { durationSeconds: 2 } as AnalysisJson;
  const flow = { analysis: { axisKind: "0.5 s", intervals: [
    { startSeconds: 0, endSeconds: 1, onsetsPerSecond: 4, centroidHz: 1000 },
    { startSeconds: 1, endSeconds: 2, onsetsPerSecond: 0, centroidHz: null },
  ] } } as FlowRenderData;
  drawDensity(canvas, { analysis, flow });
  drawBrightness(canvas, { analysis, flow });
  const pixel = (x: number, y: number): number[] => Array.from(canvas.rgb.subarray((y * 1600 + x) * 3, (y * 1600 + x) * 3 + 3));
  assert.deepEqual(pixel(200, 580), C.yellow);
  assert.deepEqual(pixel(900, 580), C.background);
  assert.deepEqual(pixel(394, 939), C.yellow);
  assert.deepEqual(pixel(910, 939), C.background);
});
