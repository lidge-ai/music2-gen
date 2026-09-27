import { fillRect, line, polyline, text } from "./canvas.tool.ts";
import type { Rgb, RgbCanvas } from "./canvas.tool.ts";
import { C, TIME_LEFT, TIME_RIGHT, duration, heading, number, plotFrame, sectionLines, separator, timeX } from "./panels.shared.tool.ts";
import type { OverviewInput } from "./panels.shared.tool.ts";

function graph(canvas: RgbCanvas, values: readonly { time: number; value: number | null }[], input: OverviewInput,
  top: number, bottom: number, min: number, max: number, color: Rgb, dots = false): void {
  let previous: readonly [number, number] | null = null;
  for (const item of values) {
    if (item.value === null || !Number.isFinite(item.value)) { previous = null; continue; }
    const x = timeX(item.time, duration(input));
    const y = Math.round(bottom - (Math.max(min, Math.min(max, item.value)) - min) / (max - min) * (bottom - top));
    if (previous) polyline(canvas, [previous, [x, y]], color);
    if (dots) fillRect(canvas, x - 2, y - 2, 5, 5, color);
    previous = [x, y];
  }
}

export function drawLoudness(canvas: RgbCanvas, input: OverviewInput): void {
  heading(canvas, 320, "LOUDNESS / LUFS");
  for (const tick of [0, -12, -24, -36, -48]) {
    const y = 356 + Math.round((-tick / 48) * 120);
    line(canvas, TIME_LEFT, y, TIME_RIGHT, y, C.grid);
    text(canvas, 40, y - 7, String(tick), C.secondary, 2);
  }
  sectionLines(canvas, input, 350, 477);
  const intervals = input.flow.analysis.intervals;
  graph(canvas, intervals.map((row) => ({ time: (row.startSeconds + row.endSeconds) / 2, value: row.lufs })),
    input, 356, 476, -48, 0, C.sky, true);
  graph(canvas, input.flow.loudness.shortTerm10Hz.map((row) => ({ time: row.timeSeconds, value: row.lufs })),
    input, 356, 476, -48, 0, C.secondary);
  const outside = intervals.filter((row) => row.lufs !== null && (row.lufs > 0 || row.lufs < -48));
  outside.forEach((row) => {
    const x = timeX((row.startSeconds + row.endSeconds) / 2, duration(input));
    const y = row.lufs! > 0 ? 350 : 478;
    text(canvas, Math.min(x, TIME_RIGHT - 75), y, `${row.lufs! > 0 ? ">" : "<"}${number(row.lufs)}`, C.sky, 2);
  });
  separator(canvas, 499);
}

function laneKind(input: OverviewInput, trackIndex: number): number {
  const track = input.song?.tracks[trackIndex];
  if (!track) return 2;
  if (track.kind === "drums") return 0;
  return /bass|808/i.test(`${track.id} ${track.instrument}`) ? 1 : 2;
}

export function drawDensity(canvas: RgbCanvas, input: OverviewInput): void {
  heading(canvas, 510, input.timeline ? "ARRANGEMENT DENSITY / EVENTS/BAR" : "ONSET DENSITY / S");
  if (input.timeline) {
    const timeline = input.timeline;
    const counts = Array.from({ length: 3 }, () => new Uint16Array(timeline.bars));
    for (const event of timeline.events) if (event.bar >= 0 && event.bar < timeline.bars) counts[laneKind(input, event.trackIndex)]![event.bar]!++;
    const names = ["DRUMS", "BASS/808", "OTHER NOTES"];
    const colors = [C.yellow, C.green, C.magenta];
    counts.forEach((values, lane) => {
      const base = 549 + lane * 23;
      text(canvas, 10, base - 12, names[lane]!, C.secondary, 2);
      const maxCount = Math.max(1, ...values);
      values.forEach((value, bar) => {
        const x0 = timeX(bar * timeline.secondsPerBar, duration(input));
        const x1 = timeX((bar + 1) * timeline.secondsPerBar, duration(input));
        const height = Math.round(value / maxCount * 16);
        fillRect(canvas, x0 + 1, base - height, Math.max(1, x1 - x0 - 2), height, colors[lane]!);
      });
    });
  } else {
    const rows = input.flow.analysis.intervals;
    const maxRate = Math.max(1, ...rows.map((row) => row.onsetsPerSecond));
    rows.forEach((row) => {
      const x0 = timeX(row.startSeconds, duration(input));
      const x1 = timeX(row.endSeconds, duration(input));
      const height = Math.round(58 * row.onsetsPerSecond / maxRate);
      fillRect(canvas, x0, 609 - height, Math.max(1, x1 - x0), height, C.yellow);
    });
  }
  plotFrame(canvas, input, 540, 610);
  separator(canvas, 619);
}

function bandLevel(rms: number): number {
  return rms <= 0 ? 0 : Math.max(0, Math.min(1, (20 * Math.log10(rms) + 60) / 60));
}

export function drawWaveform(canvas: RgbCanvas, input: OverviewInput): void {
  heading(canvas, 630, "THREE-BAND WAVEFORM");
  text(canvas, 136, 662, "MUSIC2 RGB — APPROXIMATE BANDS", C.secondary, 2);
  const cols = input.flow.waveform;
  const center = 740;
  line(canvas, TIME_LEFT, center, TIME_RIGHT, center, C.grid);
  cols.forEach((col, index) => {
    const x = TIME_LEFT + Math.round(index * (TIME_RIGHT - TIME_LEFT) / Math.max(1, cols.length - 1));
    const levels = [bandLevel(col.lowRms), bandLevel(col.midRms), bandLevel(col.highRms)] as const;
    const sum = levels[0] + levels[1] + levels[2];
    const intensity = Math.max(...levels);
    const mixed = (channel: 0 | 1 | 2): number => Math.round(intensity *
      (levels[0] * C.red[channel] + levels[1] * C.green[channel] + levels[2] * C.blue[channel]) / sum);
    const color: Rgb = sum === 0 ? C.navy : [mixed(0), mixed(1), mixed(2)];
    const peak = Math.max(col.lowPeak, col.midPeak, col.highPeak);
    const rms = Math.max(col.lowRms, col.midRms, col.highRms);
    const peakHeight = Math.round(Math.min(1, peak) * 49);
    const rmsHeight = Math.round(Math.min(1, rms) * 49);
    line(canvas, x, center - peakHeight, x, center + peakHeight, color);
    const dim: Rgb = [Math.round(color[0] * 0.6), Math.round(color[1] * 0.6), Math.round(color[2] * 0.6)];
    line(canvas, x, center - rmsHeight, x, center + rmsHeight, dim);
  });
  sectionLines(canvas, input, 681, 795);
  separator(canvas, 799);
}

export function drawNovelty(canvas: RgbCanvas, input: OverviewInput): void {
  heading(canvas, 807, "NOVELTY / STRUCTURE CHANGES");
  const intervals = input.flow.analysis.intervals;
  const novelty = input.flow.similarity.novelty;
  // Scale to the curve maximum (at least 0.1) and print it, so weak but real changes stay visible.
  const top = Math.max(0.1, ...Array.from(novelty));
  graph(canvas, Array.from(novelty, (value, i) => ({ time: intervals[i]?.startSeconds ?? intervals[intervals.length - 1]?.endSeconds ?? duration(input), value })), input, 837, 877, 0, top, C.magenta);
  text(canvas, 24, 850, `MAX ${top.toFixed(2)}`, C.secondary, 2);
  input.flow.analysis.noveltyPeaks.forEach((peak) => {
    const x = timeX(peak.atSeconds, duration(input));
    line(canvas, x, 838, x, 878, C.orange);
    const label = peak.atBar === null ? `${Math.round(peak.atSeconds)}S` : `B${peak.atBar} ${peak.declaredHit ? "HIT" : "MISS"}`;
    text(canvas, Math.min(x, TIME_RIGHT - 100), 878, label, C.secondary, 2);
  });
  plotFrame(canvas, input, 835, 884);
  separator(canvas, 899);
}

export function drawBrightness(canvas: RgbCanvas, input: OverviewInput): void {
  heading(canvas, 907, "BRIGHTNESS = CENTROID HZ");
  const rows = input.flow.analysis.intervals;
  const max = Math.max(1000, ...rows.map((row) => row.centroidHz ?? 0));
  graph(canvas, rows.map((row) => ({ time: (row.startSeconds + row.endSeconds) / 2, value: row.centroidHz })),
    input, 939, 980, 0, max, C.yellow, true);
  plotFrame(canvas, input, 936, 984);
  separator(canvas, 999);
}
