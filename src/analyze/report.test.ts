import assert from "node:assert/strict";
import test from "node:test";
import type { AnalysisJson } from "./analysis.schema.ts";
import { renderAnalysisReport } from "./report.tool.ts";

test("report names unavailable measurements and avoids claiming a WAV transcription", () => {
  const analysis: AnalysisJson = {
    version: 1, source: "wav", sampleRate: 44100, channels: 1, durationSeconds: 1, tailSeconds: null,
    samplePeakDbfs: null, samplePeakLinear: 0, clippedSamples: 0, rmsDbfs: null,
    integratedLufs: null, lraLu: null, lraProvisional: true, truePeakEstimateDbtp: null,
    truePeakOversample: 4, declaredBpm: null, estimatedBpm: null, tempoConfidence: 0,
    tempoCandidates: [], declaredKey: null, estimatedKey: null, keyConfidence: 0,
    keyCandidates: [], chroma: Array(12).fill(0) as number[], bands: [],
    flow: { axisKind: "0.5 s", intervals: [], shortTermLufs1Hz: [], sectionMeans: [], sectionDeltas: [],
      noveltyPeaks: [], repeats: [], verdicts: ["NO_BEATS", "SECTION GAP N/A", "NO HOOK DECLARED"], annotations: [] },
    sections: [], tracks: [],
    targetLufs: null, warnings: [{ code: "NO_BEATS", observed: null, threshold: null, message: "No beats" }],
  };
  const report = renderAnalysisReport(analysis);
  assert.match(report, /LRA: n\/a provisional/);
  assert.match(report, /No song timeline supplied/);
  assert.match(report, /NO_BEATS: No beats/);
  assert.match(report, /## Flow\nAxis: 0\.5 s/);
  assert.match(report, /- overview\.png/);
  assert.doesNotMatch(report, /pianoroll\.png/);
});
