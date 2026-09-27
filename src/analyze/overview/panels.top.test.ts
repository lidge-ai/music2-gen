import assert from "node:assert/strict";
import test from "node:test";
import type { AnalysisJson } from "../analysis.schema.ts";
import type { FlowRenderData } from "../flow/flow.schema.ts";
import { createCanvas } from "./canvas.tool.ts";
import { C } from "./panels.shared.tool.ts";
import { drawHeader, drawVerdicts } from "./panels.top.tool.ts";

test("header and three verdict slots stay in their fixed bands", () => {
  const canvas = createCanvas(1600, 1400, C.background);
  const analysis = { durationSeconds: 12, estimatedBpm: null, declaredBpm: null,
    declaredKey: null, estimatedKey: null, integratedLufs: null, truePeakEstimateDbtp: null } as AnalysisJson;
  const flow = { analysis: { axisKind: "0.5 s", verdicts: ["NO FLAGS", "SECTION GAP N/A", "NO HOOK DECLARED"] } } as FlowRenderData;
  drawHeader(canvas, { analysis, flow });
  drawVerdicts(canvas, { analysis, flow });
  const pixel = (x: number, y: number): number[] => Array.from(canvas.rgb.subarray((y * 1600 + x) * 3, (y * 1600 + x) * 3 + 3));
  assert.deepEqual(pixel(27, 8), C.primary); // A of AUDIO ANALYSIS
  assert.deepEqual(pixel(24, 109), C.primary); // N of NO FLAGS
  assert.deepEqual(pixel(539, 120), C.grid); // verdict separator
  assert.deepEqual(pixel(1000, 170), C.background);
});
