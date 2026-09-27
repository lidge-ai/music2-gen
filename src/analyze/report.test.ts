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
  assert.match(report, /\| NO_BEATS \| n\/a \| n\/a \| No beats \|/);
  assert.match(report, /## Flow\nAxis: 0\.5 s/);
  assert.match(report, /- overview\.png/);
  assert.doesNotMatch(report, /pianoroll\.png/);
  analysis.flow.sectionMeans = [{ id: "hook#0", role: "hook", startBar: 9, bars: 8,
    startSeconds: 16, endSeconds: 32, meanLufs: -16 }];
  analysis.flow.verdicts = ["SECTION_LOUDNESS_FLAT 0.9", "SECTION GAP N/A", "FIRST HOOK HOOK#0 AT B09"];
  analysis.warnings.push({ code: "SECTION_LOUDNESS_FLAT", observed: .9, threshold: 1,
    message: "Section loudness contrast is below the genre guide.",
    fix: "Change section layers or gain, then rerender and compare ungated section means." });
  const updated = renderAnalysisReport(analysis);
  assert.ok(updated.indexOf("| NO_BEATS |") < updated.indexOf("| SECTION_LOUDNESS_FLAT |"));
  assert.match(updated, /hook#0 \(hook\) B9–B16, 16\.00–32\.00s: -16\.00 LUFS/);
  assert.ok(updated.includes(analysis.warnings[1]!.fix!));
  assert.ok(updated.includes(analysis.flow.verdicts[0]));
  for (const code of ["LOW_END_DOMINANCE", "LOW_MID_BUILDUP", "SUB_WITHOUT_BODY", "HIGH_END_THIN"] as const) {
    analysis.warnings.push({ code, observed: .8, threshold: .5, message: `${code} measurement`, fix: `${code} fix` });
  }
  const balanceReport = renderAnalysisReport(analysis);
  for (const code of ["LOW_END_DOMINANCE", "LOW_MID_BUILDUP", "SUB_WITHOUT_BODY", "HIGH_END_THIN"]) {
    assert.ok(balanceReport.includes(`| ${code} | 0.80 | 0.50 | ${code} measurement | ${code} fix |`));
  }
});
