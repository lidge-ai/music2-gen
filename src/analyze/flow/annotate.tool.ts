import type { Timeline } from "../../song/index.ts";
import type { AnalysisWarning, SectionMetrics } from "../analysis.schema.ts";
import type { FlowAnalysis } from "./flow.schema.ts";

const clock = (seconds: number): string => {
  const whole = Math.max(0, Math.round(seconds));
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
};
const bar = (number: number): string => `B${String(number).padStart(2, "0")}`;

/** Shared wording for the JSON finding list, Markdown and overview image. */
export function flowAnnotations(
  flow: Pick<FlowAnalysis, "axisKind" | "sectionDeltas" | "noveltyPeaks" | "repeats">,
  warnings: readonly AnalysisWarning[], _sections: readonly SectionMetrics[], timeline?: Timeline,
): { verdicts: [string, string, string]; annotations: string[] } {
  const priority = warnings.find((warning) => warning.code === "CLIPPING") ??
    warnings.find((warning) => warning.code === "LUFS_OFF_TARGET") ?? warnings[0];
  const first = priority ? `${priority.code}${priority.observed === null ? "" : ` ${priority.observed.toFixed(1)}`}` : "NO FLAGS";
  const largest = flow.sectionDeltas.filter((delta) => delta.deltaLu !== null)
    .sort((a, b) => Math.abs(b.deltaLu!) - Math.abs(a.deltaLu!) || a.atSeconds - b.atSeconds)[0];
  const gap = largest ? `SECTION GAP ${largest.deltaLu! >= 0 ? "+" : ""}${largest.deltaLu!.toFixed(1)} LU INTO ${largest.toId.toUpperCase()} AT ${bar(largest.atBar!)}`
    : "SECTION GAP N/A";
  const hook = timeline?.placements.find((placement) => placement.role === "hook");
  const firstHook = hook ? `FIRST HOOK ${hook.section.toUpperCase()}#${hook.occurrence} AT ${bar(hook.startBar + 1)}` : "NO HOOK DECLARED";
  const annotations: string[] = [];
  for (const peak of flow.noveltyPeaks) {
    const where = peak.atBar === null ? clock(peak.atSeconds) : bar(peak.atBar);
    annotations.push(`BOUNDARY ${where}${peak.declaredHit === null ? "" : peak.declaredHit ? " MATCHED" : " MISSED"}`);
  }
  for (const repeat of flow.repeats) {
    annotations.push(repeat.firstStartBar === null ?
      `${clock(repeat.firstStartSeconds)}-${clock(repeat.firstEndSeconds)} REPEAT ${clock(repeat.secondStartSeconds)}-${clock(repeat.secondEndSeconds)}; SIM ${repeat.meanSimilarity.toFixed(2)}` :
      `BARS ${repeat.firstStartBar}-${repeat.firstEndBar} REPEAT ${repeat.secondStartBar}-${repeat.secondEndBar}; SIM ${repeat.meanSimilarity.toFixed(2)}`);
  }
  return { verdicts: [first, gap, firstHook], annotations };
}
