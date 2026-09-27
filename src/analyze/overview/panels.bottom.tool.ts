import { fillRect, line, text } from "./canvas.tool.ts";
import type { Rgb, RgbCanvas } from "./canvas.tool.ts";
import { C, RAIL_ROW, boundedText, heading, number, separator } from "./panels.shared.tool.ts";
import type { OverviewInput } from "./panels.shared.tool.ts";

const BAND_NAMES = ["SUB", "LOW", "LOWMID", "MID", "PRESENCE", "AIR"] as const;

function drawBands(canvas: RgbCanvas, input: OverviewInput): void {
  heading(canvas, 1009, "GLOBAL BAND SHARE — NOT TIME");
  input.analysis.bands.slice(0, 6).forEach((band, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const x = 136 + col * 344;
    const y = 1061 + row * 69;
    text(canvas, x, y, BAND_NAMES[i]!, C.primary, 2);
    const pct = Math.max(0, Math.min(100, band.share * 100));
    fillRect(canvas, x, y + 22, 247, 10, C.navy);
    fillRect(canvas, x, y + 22, Math.round(247 * pct / 100), 10, C.sky);
    text(canvas, x + 250, y + 16, `${number(pct)}%`, C.secondary, 2);
  });
}

/** Display floor: the lowest off-diagonal similarity of nonsilent cells, capped at 0.9, so near-uniform matrices still show contrast. The printed floor keeps the stretch honest. */
function displayFloor(matrix: Float32Array, size: number): number {
  let low = 1;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    if (x === y) continue;
    const v = matrix[y * size + x] ?? 0;
    if (v > 0 && v < low) low = v;
  }
  return Math.min(0.9, Math.max(0, low === 1 ? 0 : low));
}

/** Display cells are area averages of the full numeric SSM; detection retains full resolution. */
function drawSsm(canvas: RgbCanvas, input: OverviewInput): void {
  const { matrix, size } = input.flow.similarity;
  const floor = displayFloor(matrix, size);
  text(canvas, 880, 1004, `SELF SIMILARITY  DARK = ${floor.toFixed(2)}  PALE = 1.00`, C.primary, 1);
  const side = Math.min(256, size);
  const ox = 880; const oy = 1014;
  fillRect(canvas, ox, oy, 256, 256, C.navy);
  if (side > 0) {
    for (let py = 0; py < 256; py++) {
      const y0 = Math.min(size - 1, Math.floor(py * size / 256));
      const y1 = Math.min(size, Math.max(y0 + 1, Math.ceil((py + 1) * size / 256)));
      for (let px = 0; px < 256; px++) {
        const x0 = Math.min(size - 1, Math.floor(px * size / 256));
        const x1 = Math.min(size, Math.max(x0 + 1, Math.ceil((px + 1) * size / 256)));
        let sum = 0; let cells = 0;
        for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { sum += matrix[y * size + x] ?? 0; cells++; }
        const v = Math.max(0, Math.min(1, (sum / cells - floor) / (1 - floor)));
        const color: Rgb = [
          Math.round(C.navy[0] + (C.pale[0] - C.navy[0]) * v),
          Math.round(C.navy[1] + (C.pale[1] - C.navy[1]) * v),
          Math.round(C.navy[2] + (C.pale[2] - C.navy[2]) * v),
        ];
        fillRect(canvas, ox + px, oy + py, 1, 1, color);
      }
    }
  }
  if (input.timeline && size > 0) {
    for (const placement of input.timeline.placements) {
      const at = Math.round(256 * placement.startBar / input.timeline.bars);
      line(canvas, ox + at, oy, ox + at, oy + 255, C.grid);
      line(canvas, ox, oy + at, ox + 255, oy + at, C.grid);
      text(canvas, Math.min(ox + at, ox + 218), 1272, `B${placement.startBar + 1}`, C.secondary, 1);
      text(canvas, 858, Math.min(oy + at, oy + 248), `${placement.startBar + 1}`, C.secondary, 1);
    }
  } else {
    text(canvas, 880, 1272, input.flow.analysis.axisKind.toUpperCase(), C.secondary, 1);
  }
}

export function drawBandsAndSsm(canvas: RgbCanvas, input: OverviewInput): void {
  drawBands(canvas, input);
  drawSsm(canvas, input);
  separator(canvas, 1289);
}

export function drawLegends(canvas: RgbCanvas, input: OverviewInput): void {
  const extra = RAIL_ROW * Math.max(0, (input.timeline?.placements.length ?? 0) - 20);
  const top = 1290 + extra;
  if (extra > 0) separator(canvas, top);
  boundedText(canvas, 24, top + 12, "NUMBER = SECTION TABLE", 740, C.primary);
  boundedText(canvas, 800, top + 12, "ORANGE OUTLINE = HOOK", 770, C.orange);
  boundedText(canvas, 24, top + 39, "SKY BLUE = LUFS", 740, C.sky);
  boundedText(canvas, 800, top + 39, "BAR HEIGHT = EVENTS/BAR", 770, C.primary);
  boundedText(canvas, 24, top + 66, "SSM PALE = SIMILAR", 740, C.pale);
  boundedText(canvas, 800, top + 66, "RED <200 HZ | GREEN 200-2000 HZ | BLUE >2000 HZ", 770, C.secondary, 2);
  line(canvas, 24, canvas.height - 1, 1576, canvas.height - 1, C.grid);
}
