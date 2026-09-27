import { measureText, wrapText } from "../font.tool.ts";
import { fillRect, line, text } from "./canvas.tool.ts";
import type { RgbCanvas } from "./canvas.tool.ts";
import { C, RAIL_LEFT, RAIL_RIGHT, RAIL_ROW, TIME_LEFT, TIME_RIGHT, boundedText, clock, duration, heading, number, outlinedRect, separator, timeX } from "./panels.shared.tool.ts";
import type { OverviewInput } from "./panels.shared.tool.ts";

export function drawHeader(canvas: RgbCanvas, input: OverviewInput): void {
  const title = input.song?.title ?? "AUDIO ANALYSIS";
  const lines = wrapText(title, 1540, 3).slice(0, 2);
  lines.forEach((part, i) => text(canvas, 24, 6 + i * 23, part, C.primary, 3));
  const infoY = lines.length > 1 ? 52 : 35;
  const meter = input.song ? `${input.song.meter.numerator}/4` : input.flow.analysis.axisKind.toUpperCase();
  text(canvas, 24, infoY, `DURATION ${clock(duration(input))} | ${meter}`, C.secondary, 3);
  const bpm = input.analysis.estimatedBpm === null ? "N/A" : number(input.analysis.estimatedBpm, 0);
  const declared = input.analysis.declaredBpm === null ? "" : ` (DECLARED ${number(input.analysis.declaredBpm, 0)})`;
  const summary = `BPM ${bpm}${declared} | ${input.analysis.declaredKey ?? input.analysis.estimatedKey ?? "N/A"} | ${number(input.analysis.integratedLufs)} LUFS | TP ${number(input.analysis.truePeakEstimateDbtp)} DBTP`;
  boundedText(canvas, 24, infoY + 24, summary, 1540, C.primary);
  separator(canvas, 99);
}

export function drawVerdicts(canvas: RgbCanvas, input: OverviewInput): void {
  const slotWidth = 510;
  input.flow.analysis.verdicts.forEach((verdict, i) => {
    const x = 24 + i * 522;
    const wrapped = wrapText(verdict, slotWidth, 3).slice(0, 2);
    wrapped.forEach((part, row) => text(canvas, x, 109 + row * 25, part, C.primary, 3));
    if (i < 2) line(canvas, x + slotWidth + 5, 105, x + slotWidth + 5, 164, C.grid);
  });
  separator(canvas, 169);
}

function railSong(canvas: RgbCanvas, input: OverviewInput): void {
  const timeline = input.timeline!;
  const finite = input.analysis.sections.filter((s) => s.integratedLufs !== null);
  const loudest = finite.reduce<typeof finite[number] | null>((best, item) =>
    !best || item.integratedLufs! > best.integratedLufs! ? item : best, null);
  timeline.placements.forEach((placement, i) => {
    const top = 175 + i * RAIL_ROW;
    const row = input.analysis.sections[i];
    const id = `${placement.section.toUpperCase()}#${placement.occurrence}`;
    const role = placement.role && placement.role.toUpperCase() !== placement.section.toUpperCase() ? `${placement.role.toUpperCase()} ` : "";
    // The printed ID is exactly the occurrence ID; a role that differs from the section ID goes on line two.
    const tag = `${String(i + 1).padStart(2, "0")} ${id}`;
    const position = `B${String(placement.startBar + 1).padStart(2, "0")} ${clock(placement.startBar * timeline.secondsPerBar)}`;
    const first = `${tag} ${position}`;
    const railWidth = RAIL_RIGHT - RAIL_LEFT;
    const fit = (...options: string[]): string => options.find((option) => measureText(option, 3) <= railWidth) ?? options[options.length - 1]!;
    const value = number(row?.integratedLufs ?? null);
    const second = row === undefined || row.integratedLufs === null ? fit(`${role}LUFS N/A`, "SECTION LUFS N/A") :
      row === loudest ? fit(`${role}${value} LOUDEST`, `LUFS ${value} LOUDEST`) : fit(`${role}LUFS ${value}`, `SECTION LUFS ${value}`);
    const compact = measureText(first, 3) > railWidth;
    const lines = compact ? wrapText(tag, railWidth, 3) : [first];
    boundedText(canvas, RAIL_LEFT, top + 1, lines[0]!, railWidth, placement.role === "hook" ? C.orange : C.primary);
    const lu = number(row?.integratedLufs ?? null);
    const detailed = `${position} LUFS ${lu}${row === loudest ? " LOUDEST" : ""}`;
    const shortDetail = row === loudest ? `B${String(placement.startBar + 1).padStart(2, "0")} ${lu} LOUDEST` : detailed;
    const detail = !compact ? second : lines.length > 1 ? lines[1]! :
      measureText(detailed, 3) <= railWidth ? detailed : shortDetail;
    boundedText(canvas, RAIL_LEFT, top + 26, detail, railWidth, C.secondary);
    if (placement.role === "hook") outlinedRect(canvas, RAIL_LEFT - 4, top, RAIL_RIGHT - RAIL_LEFT + 6, RAIL_ROW - 2, C.orange);
  });
}

function railWav(canvas: RgbCanvas, input: OverviewInput): void {
  const rows = [
    `AXIS: ${input.flow.analysis.axisKind.toUpperCase()}`,
    "NO DECLARED SECTIONS",
    `ONSETS ${input.flow.analysis.intervals.reduce((sum, row) => sum + row.onsetCount, 0)}`,
    `NOVELTY PEAKS ${input.flow.analysis.noveltyPeaks.length}`,
    ...input.flow.analysis.noveltyPeaks.map((peak) => `PEAK ${clock(peak.atSeconds)}`),
    ...input.flow.analysis.repeats.map((repeat) => `REPEAT ${clock(repeat.firstStartSeconds)} > ${clock(repeat.secondStartSeconds)}`),
  ];
  rows.forEach((row, i) => boundedText(canvas, RAIL_LEFT, 180 + i * RAIL_ROW, row, RAIL_RIGHT - RAIL_LEFT, C.primary));
}

export function drawSections(canvas: RgbCanvas, input: OverviewInput): void {
  heading(canvas, 179, input.timeline ? "SECTION FLOW" : "AUDIO AXIS");
  line(canvas, TIME_LEFT, 277, TIME_RIGHT, 277, C.grid);
  if (input.timeline?.placements.length) {
    const timeline = input.timeline;
    timeline.placements.forEach((placement, i) => {
      const x0 = timeX(placement.startBar * timeline.secondsPerBar, duration(input));
      const x1 = timeX((placement.startBar + placement.bars) * timeline.secondsPerBar, duration(input));
      fillRect(canvas, x0 + 2, 220, Math.max(0, x1 - x0 - 3), 50, [25, 43, 57]);
      if (placement.role === "hook") outlinedRect(canvas, x0 + 1, 218, Math.max(1, x1 - x0 - 1), 54, C.orange, 2);
      const id = `${placement.section.toUpperCase()}#${placement.occurrence}`;
      const blockLabel = `${String(i + 1).padStart(2, "0")} ${id}`;
      const blockWidth = Math.max(0, x1 - x0 - 12);
      // Narrow blocks drop to 2x text before truncating, so the occurrence suffix stays readable.
      const blockScale = measureText(blockLabel, 3) <= blockWidth ? 3 : 2;
      boundedText(canvas, x0 + 7, blockScale === 3 ? 232 : 236, blockLabel, blockWidth, C.primary, blockScale);
      fillRect(canvas, x0 - 1, 218, 3, 59, C.grid);
      const tick = `B${String(placement.startBar + 1).padStart(2, "0")}`;
      text(canvas, Math.min(x0, TIME_RIGHT - measureText(tick, 2)), 278, tick, C.secondary, 2);
      text(canvas, Math.min(x0, TIME_RIGHT - 60), 295, clock(placement.startBar * timeline.secondsPerBar), C.secondary, 2);
    });
    fillRect(canvas, TIME_RIGHT - 1, 218, 3, 59, C.grid);
    text(canvas, TIME_RIGHT - 57, 278, `B${String(timeline.bars + 1).padStart(2, "0")}`, C.secondary, 2);
    text(canvas, TIME_RIGHT - 60, 295, clock(duration(input)), C.secondary, 2);
    railSong(canvas, input);
  } else {
    text(canvas, TIME_LEFT, 236, `AXIS ${input.flow.analysis.axisKind.toUpperCase()} | ${clock(duration(input))}`, C.secondary, 3);
    railWav(canvas, input);
  }
  line(canvas, 1183, 170, 1183, canvas.height - 110, C.grid);
  separator(canvas, 309);
}
