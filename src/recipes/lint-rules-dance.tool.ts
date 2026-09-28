import { active, barsOf, comparableBlocks, densityChange, fourKick, isHat, median, offhat, snare5and13 } from "./lint-geometry.tool.ts";
import type { LintGeometry } from "./lint-geometry.tool.ts";
import { outsideKey } from "./lint-generic.tool.ts";
import { activeSet, bassId, meanActive, motifIn } from "./lint-rules-phrase.tool.ts";
import type { LintResult } from "./lint.tool.ts";

const warning = (id: string, path: string, observed: string | number, expected: string | number, fix: string): LintResult =>
  ({ id, severity: "warning", path, observed, expected, fix });
function ratioRule(out: LintResult[], id: string, g: LintGeometry, threshold: number,
  predicate: (bar: number) => boolean, fix: string): void {
  if (!g.grooves.length) return;
  const count = g.grooves.filter(predicate).length;
  if (count / g.grooves.length < threshold) out.push(warning(id, "arrangement", `${(count / g.grooves.length * 100).toFixed(1)}% (${count}/${g.grooves.length})`, `${(threshold * 100).toFixed(1)}%`, fix));
}
export function danceRules(g: LintGeometry, genre: "house" | "techno", generic: LintResult[]): LintResult[] {
  const out: LintResult[] = [];
  const min = genre === "house" ? 120 : 126, max = genre === "house" ? 130 : 140;
  if (g.song.bpm < min || g.song.bpm > max) out.push(warning(`${genre}/1`, "bpm", g.song.bpm, `${min}..${max}`, `Set bpm between ${min} and ${max}.`));
  ratioRule(out, `${genre}/2`, g, .90, (bar) => fourKick(g, bar), "Place kicks on steps 1, 5, 9 and 13 in groove bars.");
  if (genre === "house") {
    ratioRule(out, "house/3", g, .75, (bar) => snare5and13(g, bar), "Place claps/snares on steps 5 and 13.");
    ratioRule(out, "house/4", g, .75, (bar) => offhat(g, bar), "Place open/closed hats on steps 3, 7, 11 and 15.");
    if (g.song.key) {
      const outside = outsideKey(g, () => true);
      if (outside.length) out.push(warning("house/5", `tracks.${outside[0]!.track}`, `${outside.length} notes; first bar ${outside[0]!.bar}`,
        `bass/melody in ${g.song.key}`, "Retune bass/melody or change the declared key."));
    }
    const eligible = g.placements.filter((p) => ["groove", "hook", "breakdown"].includes(p.role ?? "")).flatMap(barsOf);
    if (comparableBlocks(eligible, 8) && !densityChange(g, eligible, 8)) out.push(warning("house/6", "arrangement", "no adjacent 8-bar density change", "change of >=1 median layer", "Add or mute a layer after eight bars."));
    const outro = g.placements.filter((p) => p.role === "outro").at(-1);
    const groove = g.placements.filter((p) => p.role === "groove" || p.role === "hook").at(-1);
    if (outro && groove && meanActive(g, barsOf(outro)) >= meanActive(g, barsOf(groove))) out.push(warning("house/7", `sections.${outro.section}`,
      `${meanActive(g, barsOf(outro)).toFixed(2)} >= ${meanActive(g, barsOf(groove)).toFixed(2)}`, "outro mean layers < final groove", "Mute one or more layers in the outro."));
  } else {
    const bass = bassId(g);
    const percussion = g.song.tracks.find((track) =>
      g.timeline.events.some((e) => e.track === track.id && isHat(g, e)))?.id ?? null;
    if ([1, 2].some((size) => comparableBlocks(g.grooves, size)) && !motifIn(g, g.grooves, [1, 2], bass ?? percussion)) out.push(warning("techno/3", `tracks.${bass ?? percussion ?? "bass"}`, "no repeated bass/percussion motif", "repeated 1- or 2-bar motif", "Repeat a short bass or percussion motif."));
    const candidates = g.placements.filter((p) => p.role === "build" || p.role === "groove").flatMap(barsOf);
    let changed = false, compared = false;
    for (const size of [8, 16]) for (let i = 0; i + size * 2 <= candidates.length; i += size) {
      if (candidates[i + size * 2 - 1]! - candidates[i]! !== size * 2 - 1) continue;
      compared = true;
      const left = candidates.slice(i, i + size), right = candidates.slice(i + size, i + size * 2);
      if (activeSet(g, left) !== activeSet(g, right) || median(left.map((bar) => active(g, bar))) !== median(right.map((bar) => active(g, bar)))) changed = true;
    }
    if (compared && !changed) out.push(warning("techno/4", "arrangement", "all compared windows identical", "8/16-bar layer change", "Add or remove a layer in a build/groove phrase."));
    const breakdowns = g.placements.filter((p) => p.role === "breakdown");
    const groove = g.placements.find((p) => p.role === "groove");
    if (groove && breakdowns.some((p) => meanActive(g, barsOf(p)) >= meanActive(g, barsOf(groove)))) out.push(warning("techno/5", `sections.${breakdowns[0]!.section}`, "breakdown mean layers >= groove", "breakdown mean layers < groove", "Mute a layer in the breakdown."));
    if (generic.some((r) => r.id === "generic/clipping_risk")) out.push(warning("techno/6", "arrangement", "static clipping risk", "onset sum <=1.5", "Lower gains or velocities and inspect rendered audio."));
  }
  return out;
}
