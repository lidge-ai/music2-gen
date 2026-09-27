import { encodeRgbPng } from "../png.tool.ts";
import { createCanvas } from "./canvas.tool.ts";
import { C, RAIL_ROW } from "./panels.shared.tool.ts";
import { drawBandsAndSsm, drawBrightness, drawDensity, drawHeader, drawLegends, drawLoudness, drawNovelty, drawSections, drawVerdicts, drawWaveform } from "./panels.tool.ts";
import type { AnalysisJson } from "../analysis.schema.ts";
import type { FlowRenderData } from "../flow/flow.schema.ts";
import type { ResolvedSong } from "../../song/song.schema.ts";
import type { Timeline } from "../../song/timeline.tool.ts";
import type { OverviewInput } from "./panels.tool.ts";

export function renderOverview(analysis: AnalysisJson, flow: FlowRenderData, song?: ResolvedSong, timeline?: Timeline): Buffer {
  const height = 1400 + RAIL_ROW * Math.max(0, (timeline?.placements.length ?? 0) - 20);
  const canvas = createCanvas(1600, height, C.background);
  const input: OverviewInput = { analysis, flow, ...(song ? { song } : {}), ...(timeline ? { timeline } : {}) };
  drawHeader(canvas, input);
  drawVerdicts(canvas, input);
  drawSections(canvas, input);
  drawLoudness(canvas, input);
  drawDensity(canvas, input);
  drawWaveform(canvas, input);
  drawNovelty(canvas, input);
  drawBrightness(canvas, input);
  drawBandsAndSsm(canvas, input);
  drawLegends(canvas, input);
  return encodeRgbPng(canvas.width, canvas.height, canvas.rgb);
}
