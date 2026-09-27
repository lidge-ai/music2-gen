import assert from "node:assert/strict";
import test from "node:test";
import type { Timeline } from "../../song/index.ts";
import type { AnalysisWarning } from "../analysis.schema.ts";
import type { FlowAnalysis } from "./flow.schema.ts";
import { flowAnnotations } from "./annotate.tool.ts";

const warning = (code: AnalysisWarning["code"]): AnalysisWarning => ({ code, observed: 1, threshold: 0, message: code });
const timeline: Timeline = { bars: 16, secondsPerBar: 1, durationSeconds: 16, events: [],
  placements: [{ section: "verse", role: "verse", entry: 0, repeat: 0, ordinal: 0, occurrence: 0, startBar: 0, bars: 4 },
    { section: "hook", role: "hook", entry: 1, repeat: 0, ordinal: 1, occurrence: 0, startBar: 4, bars: 12 }] };

test("warning priority, signed gap tie, first hook, and exact boundary wording", () => {
  const flow: Pick<FlowAnalysis, "axisKind" | "sectionDeltas" | "noveltyPeaks" | "repeats"> = {
    axisKind: "bars", sectionDeltas: [
      { fromId: "verse#0", toId: "hook#0", atSeconds: 4, atBar: 5, deltaLu: 6 },
      { fromId: "hook#0", toId: "verse#1", atSeconds: 12, atBar: 13, deltaLu: -6 }],
    noveltyPeaks: [{ atSeconds: 8, atBar: 9, score: .4, declaredHit: true },
      { atSeconds: 10, atBar: 11, score: .2, declaredHit: false }], repeats: [],
  };
  const result = flowAnnotations(flow, [warning("LUFS_OFF_TARGET"), warning("CLIPPING")], [], timeline);
  assert.match(result.verdicts[0], /^CLIPPING/);
  assert.equal(result.verdicts[1], "SECTION GAP +6.0 LU INTO HOOK#0 AT B05");
  assert.equal(result.verdicts[2], "FIRST HOOK HOOK#0 AT B05");
  assert.deepEqual(result.annotations, ["BOUNDARY B09 MATCHED", "BOUNDARY B11 MISSED"]);
});

test("audio-only annotations use seconds and no bar or hook claim", () => {
  const result = flowAnnotations({ axisKind: "0.5 s", sectionDeltas: [],
    noveltyPeaks: [{ atSeconds: 8, atBar: null, score: .4, declaredHit: null }],
    repeats: [{ firstStartSeconds: 0, firstEndSeconds: 4, secondStartSeconds: 8, secondEndSeconds: 12,
      firstStartBar: null, firstEndBar: null, secondStartBar: null, secondEndBar: null, meanSimilarity: .93 }] }, [], []);
  assert.equal(result.verdicts[0], "NO FLAGS");
  assert.equal(result.verdicts[1], "SECTION GAP N/A");
  assert.equal(result.verdicts[2], "NO HOOK DECLARED");
  assert.deepEqual(result.annotations, ["BOUNDARY 0:08", "0:00-0:04 REPEAT 0:08-0:12; SIM 0.93"]);
});

test("overview verdict uses explicit warning priority without reordering findings", () => {
  const flow: Pick<FlowAnalysis, "axisKind" | "sectionDeltas" | "noveltyPeaks" | "repeats"> = {
    axisKind: "0.5 s", sectionDeltas: [], noveltyPeaks: [], repeats: [],
  };
  const order: AnalysisWarning["code"][] = ["CLIPPING", "LUFS_OFF_TARGET", "LOW_END_DOMINANCE",
    "LOW_MID_BUILDUP", "SUB_WITHOUT_BODY", "HIGH_END_THIN"];
  for (let i = 0; i < order.length; i++) {
    const rows = [warning("EMPTY_HIGH_BAND"), warning("LOOP_SEAM_DISCONTINUITY"),
      ...order.slice(i).reverse().map(warning)];
    assert.equal(flowAnnotations(flow, rows, []).verdicts[0], `${order[i]} 1.0`);
  }
  assert.equal(flowAnnotations(flow, [warning("EMPTY_HIGH_BAND"), warning("LOW_END_DOMINANCE"), warning("HIGH_END_THIN")], []).verdicts[0], "LOW_END_DOMINANCE 1.0");
  assert.equal(flowAnnotations(flow, [warning("EMPTY_HIGH_BAND"), warning("HIGH_END_THIN")], []).verdicts[0], "HIGH_END_THIN 1.0");
  assert.equal(flowAnnotations(flow, [warning("EMPTY_HIGH_BAND")], []).verdicts[0], "EMPTY_HIGH_BAND 1.0");
  assert.equal(flowAnnotations(flow, [], []).verdicts[0], "NO FLAGS");
});
