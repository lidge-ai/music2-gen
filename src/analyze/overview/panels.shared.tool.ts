import { fillRect, line, text } from "./canvas.tool.ts";
import type { Rgb, RgbCanvas } from "./canvas.tool.ts";
import type { AnalysisJson } from "../analysis.schema.ts";
import type { FlowRenderData } from "../flow/flow.schema.ts";
import type { ResolvedSong } from "../../song/song.schema.ts";
import type { Timeline } from "../../song/timeline.tool.ts";

export interface OverviewInput { analysis: AnalysisJson; flow: FlowRenderData; song?: ResolvedSong; timeline?: Timeline }
export const C = {
  background: [15, 23, 34], primary: [241, 245, 249], secondary: [203, 213, 225], grid: [107, 114, 128],
  sky: [86, 180, 233], orange: [230, 159, 0], yellow: [240, 228, 66], green: [0, 158, 115],
  magenta: [204, 121, 167], red: [213, 94, 0], blue: [0, 114, 178],
  navy: [20, 32, 54], pale: [255, 240, 150],
} as const satisfies Record<string, Rgb>;
export const TIME_LEFT = 136;
export const TIME_RIGHT = 1168;
export const RAIL_LEFT = 1200;
export const RAIL_RIGHT = 1576;
/** Rail row height: two 21 px text lines plus gaps; the image grows by this much per occurrence beyond 20. */
export const RAIL_ROW = 50;
export function timeX(t: number, duration: number): number {
  return TIME_LEFT + Math.round(1032 * Math.max(0, Math.min(1, duration > 0 ? t / duration : 0)));
}
export function duration(input: OverviewInput): number { return input.timeline?.durationSeconds ?? input.analysis.durationSeconds; }
export function clock(seconds: number): string {
  const whole = Math.max(0, Math.round(seconds));
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
}
export function number(value: number | null, digits = 1): string { return value === null || !Number.isFinite(value) ? "N/A" : value.toFixed(digits); }
export function separator(canvas: RgbCanvas, y: number): void { line(canvas, 24, y, 1576, y, C.grid); }
export function heading(canvas: RgbCanvas, y: number, label: string): void { text(canvas, 24, y, label, C.primary, 3); }
export function sectionLines(canvas: RgbCanvas, input: OverviewInput, top: number, bottom: number): void {
  if (!input.timeline) return;
  for (const placement of input.timeline.placements) {
    const x = timeX(placement.startBar * input.timeline.secondsPerBar, duration(input));
    line(canvas, x, top, x, bottom, C.grid);
  }
  line(canvas, TIME_RIGHT, top, TIME_RIGHT, bottom, C.grid);
}
export function plotFrame(canvas: RgbCanvas, input: OverviewInput, top: number, bottom: number): void {
  sectionLines(canvas, input, top, bottom);
  line(canvas, TIME_LEFT, bottom, TIME_RIGHT, bottom, C.grid);
}
export function boundedText(canvas: RgbCanvas, x: number, y: number, label: string, width: number, color: Rgb, scale = 3): void {
  // Raster clip is supplied by a pre-measured prefix; labels never spill into the next panel.
  const chars = Array.from(label);
  const capacity = Math.max(0, Math.floor((width + scale) / (6 * scale)));
  text(canvas, x, y, chars.slice(0, capacity).join(""), color, scale);
}
export function outlinedRect(canvas: RgbCanvas, x: number, y: number, w: number, h: number, color: Rgb, thickness = 1): void {
  fillRect(canvas, x, y, w, thickness, color); fillRect(canvas, x, y + h - thickness, w, thickness, color);
  fillRect(canvas, x, y, thickness, h, color); fillRect(canvas, x + w - thickness, y, thickness, h, color);
}
