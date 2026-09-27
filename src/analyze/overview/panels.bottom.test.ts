import assert from "node:assert/strict";
import test from "node:test";
import type { AnalysisJson } from "../analysis.schema.ts";
import type { FlowRenderData } from "../flow/flow.schema.ts";
import { createCanvas } from "./canvas.tool.ts";
import { C } from "./panels.shared.tool.ts";
import { drawBandsAndSsm, drawLegends } from "./panels.bottom.tool.ts";

test("SSM has pale diagonal, navy off-diagonal and a visible legend", () => {
  const canvas = createCanvas(1600, 1400, C.background);
  const analysis = { bands: [] } as unknown as AnalysisJson;
  const flow = { analysis: { axisKind: "0.5 s" }, similarity: { size: 2, matrix: Float32Array.from([1, 0, 0, 1]) } } as FlowRenderData;
  drawBandsAndSsm(canvas, { analysis, flow });
  drawLegends(canvas, { analysis, flow });
  const pixel = (x: number, y: number): number[] => Array.from(canvas.rgb.subarray((y * 1600 + x) * 3, (y * 1600 + x) * 3 + 3));
  assert.deepEqual(pixel(900, 1034), C.pale);
  assert.deepEqual(pixel(1100, 1034), C.navy);
  assert.deepEqual(pixel(24, 1302), C.primary);
});
