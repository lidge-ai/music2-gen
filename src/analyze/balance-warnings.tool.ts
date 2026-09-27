import type { AnalysisWarning, BandValue } from "./analysis.schema.ts";

const BASS_HEAVY = new Set(["trap", "drill_uk", "drill_ny", "house", "techno"]);
const WARM = new Set(["boom_bap", "lofi_hiphop"]);

/** Whole-file linear-power guides; these are prompts to inspect a mix, not loudness targets. */
export function balanceWarnings(bands: readonly BandValue[], genre?: string | null): AnalysisWarning[] {
  if (bands.every((band) => band.share === 0)) return [];
  const sub = bands[0]!.share;
  const low = bands[1]!.share;
  const lowMid = bands[2]!.share;
  const presence = bands[4]!.share;
  const air = bands[5]!.share;
  const lowTotal = sub + low;
  const highTotal = presence + air;
  const threshold = BASS_HEAVY.has(genre ?? "") ? .92 : WARM.has(genre ?? "") ? .85 : .55;
  const guide = genre && (BASS_HEAVY.has(genre) || WARM.has(genre)) ? `${genre} genre guide` : "unknown-genre/WAV-only guide";
  const result: AnalysisWarning[] = [];
  if (lowTotal > threshold) result.push({ code: "LOW_END_DOMINANCE", observed: lowTotal, threshold,
    message: `Sub and low bands exceed the ${guide}; inspect the kick, bass, and other layers.`,
    fix: "Rebalance low layers against the rest of the rendered mix, then measure again." });
  if (lowMid > .25) result.push({ code: "LOW_MID_BUILDUP", observed: lowMid, threshold: .25,
    message: "The 250–500 Hz band exceeds the low-mid guide; inspect stacked chords and bass harmonics.",
    fix: "Check low voicings and overlapping layers, then rerender and measure." });
  if (lowTotal > .5 && sub / lowTotal > .65) result.push({ code: "SUB_WITHOUT_BODY", observed: sub / lowTotal, threshold: .65,
    message: `Sub is ${((sub / lowTotal) * 100).toFixed(1)}% of the low end (total share ${lowTotal.toFixed(3)}); inspect audibility on small speakers.`,
    fix: "Inspect bass harmonics and the 60–250 Hz body before changing the mix." });
  if (genre !== "lofi_hiphop" && highTotal < .02) result.push({ code: "HIGH_END_THIN", observed: highTotal, threshold: .02,
    message: "Presence and air fall below the high-end guide; inspect audible upper layers.",
    fix: "Check upper percussion and melodic layers, then rerender and measure." });
  return result;
}
