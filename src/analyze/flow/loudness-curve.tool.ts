import type { StereoBuffer } from "../../audio-io/buffer.schema.ts";
import { kWeightedPower } from "../../audio-io/kweight.tool.ts";
import type { Timeline } from "../../song/index.ts";
import type { FlowCurvePoint, FlowIntervalGrid, FlowLoudnessData, FlowSectionMean } from "./flow.schema.ts";

const toLufs = (power: number): number | null => power > 0 ? -.691 + 10 * Math.log10(power) : null;
const sampleAt = (seconds: number, rate: number, length: number): number =>
  Math.max(0, Math.min(length, Math.round(seconds * rate)));

/** Ungated continuous K-power means and complete trailing 100 ms block windows. */
export function flowLoudness(pcm: StereoBuffer, grid: FlowIntervalGrid, timeline?: Timeline): FlowLoudnessData {
  const { sampleRate: rate } = pcm;
  const length = pcm.left.length;
  const intervals = grid.intervals.map((row) => ({
    start: sampleAt(row.startSeconds, rate, length), end: sampleAt(row.endSeconds, rate, length), sum: 0,
  }));
  const placements = timeline?.placements.map((placement) => ({
    placement, start: sampleAt(placement.startBar * timeline.secondsPerBar, rate, length),
    end: sampleAt((placement.startBar + placement.bars) * timeline.secondsPerBar, rate, length), sum: 0,
  })) ?? [];
  let interval = 0, section = 0;
  // Exact 100 ms blocks: block k covers [round(k*rate/10), round((k+1)*rate/10)), so 1 Hz points land on whole seconds
  // even when rate/10 is not an integer (11.025 kHz).
  const edge = (k: number): number => Math.round(k * rate / 10);
  let completeBlocks = 0;
  while (edge(completeBlocks + 1) <= length) completeBlocks++;
  const blocks = new Float64Array(Math.max(0, completeBlocks));
  const blockSamples = new Float64Array(Math.max(0, completeBlocks));
  for (let k = 0; k < completeBlocks; k++) blockSamples[k] = edge(k + 1) - edge(k);
  let block = 0;
  kWeightedPower(pcm, (frame, power) => {
    while (block < completeBlocks && frame >= edge(block + 1)) block++;
    if (block < completeBlocks) blocks[block]! += power;
    while (interval < intervals.length && frame >= intervals[interval]!.end) interval++;
    if (interval < intervals.length && frame >= intervals[interval]!.start) intervals[interval]!.sum += power;
    while (section < placements.length && frame >= placements[section]!.end) section++;
    if (section < placements.length && frame >= placements[section]!.start) placements[section]!.sum += power;
  });
  const intervalLufs = intervals.map(({ start, end, sum }) => toLufs(end > start ? sum / (end - start) : 0));
  const sectionMeans: FlowSectionMean[] = placements.map(({ placement, start, end, sum }) => ({
    id: `${placement.section}#${placement.occurrence}`, role: placement.role ?? null,
    startBar: placement.startBar + 1, bars: placement.bars,
    startSeconds: placement.startBar * timeline!.secondsPerBar,
    endSeconds: Math.min(timeline!.durationSeconds, (placement.startBar + placement.bars) * timeline!.secondsPerBar),
    meanLufs: toLufs(end > start ? sum / (end - start) : 0),
  }));
  const sectionDeltas = sectionMeans.slice(1).map((next, index) => {
    const previous = sectionMeans[index]!;
    return { fromId: previous.id, toId: next.id, atSeconds: next.startSeconds, atBar: next.startBar,
      deltaLu: previous.meanLufs === null || next.meanLufs === null ? null : next.meanLufs - previous.meanLufs };
  });
  const momentary10Hz: FlowCurvePoint[] = [];
  const shortTerm10Hz: FlowCurvePoint[] = [];
  const shortTermLufs1Hz: FlowCurvePoint[] = [];
  let momentarySum = 0, shortSum = 0, momentaryCount = 0, shortCount = 0;
  for (let index = 0; index < completeBlocks; index++) {
    const power = blocks[index]!;
    momentarySum += power; momentaryCount += blockSamples[index]!;
    shortSum += power; shortCount += blockSamples[index]!;
    if (index >= 4) { momentarySum -= blocks[index - 4]!; momentaryCount -= blockSamples[index - 4]!; }
    if (index >= 30) { shortSum -= blocks[index - 30]!; shortCount -= blockSamples[index - 30]!; }
    const timeSeconds = (index + 1) / 10;
    const momentary = index >= 3 ? toLufs(momentarySum / momentaryCount) : null;
    const shortTerm = index >= 29 ? toLufs(shortSum / shortCount) : null;
    momentary10Hz.push({ timeSeconds, lufs: momentary });
    shortTerm10Hz.push({ timeSeconds, lufs: shortTerm });
    if (index >= 29 && (index + 1) % 10 === 0) shortTermLufs1Hz.push({ timeSeconds, lufs: shortTerm });
  }
  return { intervalLufs, sectionMeans, sectionDeltas, momentary10Hz, shortTerm10Hz, shortTermLufs1Hz };
}
