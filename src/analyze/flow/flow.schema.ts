/** Flow analysis contracts (devlog/_fin/260928_music2_flow_practice/010_overview_image.md). JSON-safe rows cross the public boundary; render data stays internal. */
export type FlowAxisKind = "bars" | "beats" | "0.5 s";
export interface FlowInterval {
  index: number; // zero based
  startSeconds: number; endSeconds: number; // half open
  barNumber: number | null; beatNumber: number | null; // one based when applicable
  lufs: number | null; onsetCount: number; onsetsPerSecond: number;
  centroidHz: number | null;
}
export interface FlowIntervalGrid {
  axisKind: FlowAxisKind; durationSeconds: number;
  intervals: Pick<FlowInterval, "index" | "startSeconds" | "endSeconds" | "barNumber" | "beatNumber">[];
}
export interface FlowCurvePoint { timeSeconds: number; lufs: number | null }
export interface FlowSectionDelta {
  fromId: string; toId: string; atSeconds: number;
  atBar: number | null; deltaLu: number | null;
}
export interface FlowSectionMean {
  id: string; // occurrence id, e.g. "hook#0", placement order
  role: string | null; startBar: number; bars: number; // startBar is one based
  startSeconds: number; endSeconds: number;
  meanLufs: number | null; // ungated mean power over the whole occurrence
}
export interface FlowNoveltyPeak {
  atSeconds: number; atBar: number | null; score: number;
  declaredHit: boolean | null;
}
export interface FlowRepeat {
  firstStartSeconds: number; firstEndSeconds: number;
  secondStartSeconds: number; secondEndSeconds: number;
  firstStartBar: number | null; firstEndBar: number | null;
  secondStartBar: number | null; secondEndBar: number | null;
  meanSimilarity: number;
}
export interface FlowAnalysis {
  axisKind: FlowAxisKind; intervals: FlowInterval[];
  shortTermLufs1Hz: FlowCurvePoint[];
  sectionMeans: FlowSectionMean[]; // empty for WAV-only input
  sectionDeltas: FlowSectionDelta[]; noveltyPeaks: FlowNoveltyPeak[];
  repeats: FlowRepeat[]; verdicts: [string, string, string]; annotations: string[];
}
export interface FlowWaveformColumn {
  lowPeak: number; lowRms: number; midPeak: number; midRms: number;
  highPeak: number; highRms: number;
}
export interface FlowFeature {
  vector: Float32Array; // exactly 20 elements
  silent: boolean; onsetCount: number; onsetsPerSecond: number;
  centroidHz: number | null;
}
export interface FlowLoudnessData {
  intervalLufs: (number | null)[]; sectionMeans: FlowSectionMean[]; sectionDeltas: FlowSectionDelta[];
  momentary10Hz: FlowCurvePoint[]; shortTerm10Hz: FlowCurvePoint[];
  shortTermLufs1Hz: FlowCurvePoint[];
}
export interface FlowSimilarityData {
  matrix: Float32Array; size: number; novelty: Float32Array;
  peaks: FlowNoveltyPeak[]; repeats: FlowRepeat[];
}
/** Internal to the analyze feature: never serialized. */
export interface FlowRenderData {
  analysis: FlowAnalysis; waveform: FlowWaveformColumn[];
  loudness: FlowLoudnessData; similarity: FlowSimilarityData;
}
