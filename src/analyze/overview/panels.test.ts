import assert from "node:assert/strict";
import test from "node:test";
import type { AnalysisJson } from "../analysis.schema.ts";
import type { FlowRenderData } from "../flow/flow.schema.ts";
import type { Timeline } from "../../song/timeline.tool.ts";
import { createCanvas } from "./canvas.tool.ts";
import { drawSections } from "./panels.tool.ts";
import { C } from "./panels.shared.tool.ts";

const at = (rgb: Uint8Array, x: number, y: number): number[] => Array.from(rgb.subarray((y * 1600 + x) * 3, (y * 1600 + x) * 3 + 3));

test("B01/B05/B13/B17 align to the shared time axis and hook is outlined", () => {
  const placements = [
    { section: "intro", role: "intro" as const, startBar: 0, bars: 4, occurrence: 0 },
    { section: "hook", role: "hook" as const, startBar: 4, bars: 8, occurrence: 0 },
    { section: "verse", role: "verse" as const, startBar: 12, bars: 4, occurrence: 0 },
  ].map((p, i) => ({ ...p, entry: i, repeat: 0, ordinal: i }));
  const timeline: Timeline = { bars: 16, secondsPerBar: 1, durationSeconds: 16, placements, events: [] };
  const analysis = { durationSeconds: 16, sections: placements.map((p) => ({ id: `${p.section}#0`,
    integratedLufs: -18, role: p.role })) } as unknown as AnalysisJson;
  const flow = { analysis: { axisKind: "bars", intervals: [], noveltyPeaks: [], repeats: [] } } as unknown as FlowRenderData;
  const canvas = createCanvas(1600, 1400, C.background);
  drawSections(canvas, { analysis, flow, timeline });
  for (const x of [136, 394, 910, 1168]) assert.deepEqual(at(canvas.rgb, x, 250), C.grid);
  assert.deepEqual(at(canvas.rgb, 500, 218), C.orange);
  assert.deepEqual(at(canvas.rgb, 1196, 230), C.orange);
});

test("WAV rail visibly states NO DECLARED SECTIONS", () => {
  const canvas = createCanvas(1600, 1400, C.background);
  const analysis = { durationSeconds: 2 } as AnalysisJson;
  const flow = { analysis: { axisKind: "0.5 s", intervals: [], noveltyPeaks: [], repeats: [] } } as unknown as FlowRenderData;
  drawSections(canvas, { analysis, flow });
  assert.deepEqual(at(canvas.rgb, 1200, 230), C.primary);
});
