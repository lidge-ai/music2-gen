/** Analysis contract (devlog 030 "New TypeScript types"). */
import type { Section, Track } from "../song/index.ts";
import type { LoudnessMetrics } from "../audio-io/index.ts";
import type { FlowAnalysis } from "./flow/flow.schema.ts";

export type { LoudnessMetrics };
export const ANALYSIS_VERSION = 1;
export const BEATS_VERSION = 1;
export const BAND_EDGES_HZ = [20, 60, 250, 500, 2000, 8000, 20000] as const;

export interface ComplexSpectrum { real: Float64Array; imag: Float64Array }
export interface TempoCandidate { bpm: number; score: number; relation: "primary" | "half" | "double" }
export interface TempoEstimate {
  bpm: number | null; confidence: number; candidates: TempoCandidate[];
  beatsSeconds: number[]; downbeatsSeconds: number[];
}
export interface KeyCandidate { key: string; kkScore: number; temperleyScore: number }
export interface KeyEstimate {
  key: string | null; confidence: number; candidates: KeyCandidate[];
  /** C, C#, D, ... B; 12 nonnegative values, sum 1 when tonal. */
  chroma: number[];
}
export interface BandValue {
  name: "sub" | "low" | "lowMid" | "mid" | "presence" | "air";
  fromHz: number; toHz: number; share: number; dbRelative: number | null;
}
export interface BandMetrics { bands: BandValue[] }
export interface BeatSection { id: string; role: Section["role"] | null; startSeconds: number; endSeconds: number }
export interface BeatMap {
  version: 1; bpm: number;
  /** Beats per bar as a number, for the vid2-gen reader (vid2-gen src/timeline/resolve.ts). */
  meter: number;
  timeSignature: { numerator: number; denominator: 4 };
  offsetFrames: 0; source: "song" | "audio"; confidence: number;
  beatsSeconds: number[]; downbeatsSeconds: number[]; sections: BeatSection[];
}
export interface SectionMetrics {
  id: string; role: Section["role"] | null; startSeconds: number; endSeconds: number;
  rmsDbfs: number | null; integratedLufs: number | null;
}
export interface TrackDensity { id: string; kind: Track["kind"]; eventCount: number; eventsPerBar: number; eventsPerSecond: number }
export interface AnalysisWarning {
  code: "CLIPPING" | "LUFS_OFF_TARGET" | "LOW_END_DOMINANCE" | "EMPTY_HIGH_BAND" | "NO_BEATS" | "METER_ASSUMED" | "KEY_UNCERTAIN";
  observed: number | null; threshold: number | null; message: string;
}
export interface AnalysisJson {
  version: 1; source: "wav" | "song"; sampleRate: number; channels: number;
  durationSeconds: number; tailSeconds: number | null; samplePeakDbfs: number | null; samplePeakLinear: number;
  clippedSamples: number; rmsDbfs: number | null; integratedLufs: number | null;
  lraLu: number | null; lraProvisional: boolean;
  truePeakEstimateDbtp: number | null; truePeakOversample: 4;
  declaredBpm: number | null; estimatedBpm: number | null;
  tempoConfidence: number; tempoCandidates: TempoCandidate[];
  declaredKey: string | null; estimatedKey: string | null;
  keyConfidence: number; keyCandidates: KeyCandidate[]; chroma: number[];
  bands: BandValue[]; flow: FlowAnalysis; sections: SectionMetrics[]; tracks: TrackDensity[];
  targetLufs: number | null; warnings: AnalysisWarning[];
}
export interface AnalysisResult {
  analysis: AnalysisJson; reportMarkdown: string; spectrogramPng: Buffer; overviewPng: Buffer;
  pianoRollPng?: Buffer; beatMap?: BeatMap;
}
export interface AnalysisArtifacts {
  analysisJson: string; analysisMd: string; spectrogramPng: string; overviewPng: string;
  pianoRollPng: string | null; beatsJson: string | null;
  summary: { declaredBpm: number | null; estimatedBpm: number | null; integratedLufs: number | null; warnings: AnalysisWarning[] };
}
