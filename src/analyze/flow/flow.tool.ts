import type { StereoBuffer } from "../../audio-io/buffer.schema.ts";
import type { ResolvedSong, Timeline } from "../../song/index.ts";
import type { AnalysisWarning, BandValue, BeatMap, SectionMetrics } from "../analysis.schema.ts";
import type { OnsetEnvelopes } from "../tempo.tool.ts";
import { flowAnnotations } from "./annotate.tool.ts";
import { threeBandWaveform } from "./bands3.tool.ts";
import { intervalFeatures } from "./features.tool.ts";
import type { FlowAnalysis, FlowRenderData } from "./flow.schema.ts";
import { flowIntervals } from "./intervals.tool.ts";
import { flowLoudness } from "./loudness-curve.tool.ts";
import { flowSimilarity } from "./similarity.tool.ts";

export interface FlowContext {
  beatMap: BeatMap | null; onset: OnsetEnvelopes;
  warnings: readonly AnalysisWarning[]; sections: readonly SectionMetrics[];
  bands: readonly BandValue[]; song?: ResolvedSong; timeline?: Timeline;
  /** Already resampled by analyzeAudio for rates outside the meter's 8..192 kHz range. */
  metered?: StereoBuffer;
}

/** Pure flow measurement over the musical duration, excluding any song render tail. */
export function analyzeFlow(pcm: StereoBuffer, ctx: FlowContext): FlowRenderData {
  const duration = ctx.timeline?.durationSeconds ?? pcm.left.length / pcm.sampleRate;
  const end = Math.max(0, Math.min(pcm.left.length, Math.round(duration * pcm.sampleRate)));
  const audio: StereoBuffer = end === pcm.left.length ? pcm : { sampleRate: pcm.sampleRate, sourceChannels: pcm.sourceChannels,
    left: pcm.left.subarray(0, end), right: pcm.right.subarray(0, end) };
  const meter = ctx.metered ?? audio;
  const meterEnd = Math.max(0, Math.min(meter.left.length, Math.round(duration * meter.sampleRate)));
  const metered = meterEnd === meter.left.length ? meter : { sampleRate: meter.sampleRate,
    sourceChannels: meter.sourceChannels, left: meter.left.subarray(0, meterEnd), right: meter.right.subarray(0, meterEnd) };
  const grid = flowIntervals(duration, ctx.beatMap ?? undefined, ctx.timeline);
  const loudness = flowLoudness(metered, grid, ctx.timeline);
  const waveform = threeBandWaveform(audio);
  const features = intervalFeatures(audio, grid, ctx.onset.onset, loudness.intervalLufs);
  const similarity = flowSimilarity(features, grid, ctx.timeline);
  const intervals = grid.intervals.map((row, index) => ({ ...row, lufs: loudness.intervalLufs[index] ?? null,
    onsetCount: features[index]!.onsetCount, onsetsPerSecond: features[index]!.onsetsPerSecond,
    centroidHz: features[index]!.centroidHz }));
  const facts = { axisKind: grid.axisKind, sectionDeltas: loudness.sectionDeltas,
    noveltyPeaks: similarity.peaks, repeats: similarity.repeats };
  const { verdicts, annotations } = flowAnnotations(facts, ctx.warnings, ctx.sections, ctx.timeline);
  const analysis: FlowAnalysis = { axisKind: grid.axisKind, intervals,
    shortTermLufs1Hz: loudness.shortTermLufs1Hz, sectionMeans: loudness.sectionMeans,
    sectionDeltas: loudness.sectionDeltas, noveltyPeaks: similarity.peaks,
    repeats: similarity.repeats, verdicts, annotations };
  return { analysis, waveform, loudness, similarity };
}
