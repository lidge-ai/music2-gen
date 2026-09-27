import { active, barsOf, densityChange, mean, motif, signature } from "./lint-geometry.tool.ts";
import type { LintGeometry } from "./lint-geometry.tool.ts";

export function melodyId(g: LintGeometry): string | null {
  return g.song.tracks.find((track) => track.kind === "notes" && track.instrument !== "808" && track.id !== "bass")?.id ?? null;
}
export function bassId(g: LintGeometry): string | null {
  return g.song.tracks.find((track) => track.kind === "notes" && (track.instrument === "bass" || track.instrument === "808"))?.id ?? null;
}
export function motifIn(g: LintGeometry, bars: number[], sizes: number[], track: string | null): boolean {
  return track !== null && sizes.some((size) => motif(g, bars, size, track));
}
export function phraseChange(g: LintGeometry, bars: number[], size: number, track: string | null): boolean {
  if (track === null || bars.length < size * 2) return false;
  return bars.slice(0, size).some((bar, index) => signature(g, bar, track) !== signature(g, bars[index + size]!, track));
}
export function muteChange(g: LintGeometry): boolean {
  return g.placements.some((placement, i) => {
    if (placement.role === "hook" || placement.role === "verse" || placement.role === "groove") return false;
    const section = g.song.sections.find((item) => item.id === placement.section)!;
    if (!Object.values(section.patterns).some((value) => value === null)) return false;
    return [g.placements[i - 1], g.placements[i + 1]].some((adjacent) =>
      adjacent && ["hook", "verse", "groove"].includes(adjacent.role ?? "") &&
      Object.entries(section.patterns).some(([id, value]) => {
        if (value !== null) return false;
        const neighbor = g.song.sections.find((item) => item.id === adjacent.section)!;
        const pattern = Object.hasOwn(neighbor.patterns, id) ? neighbor.patterns[id] : g.song.tracks.find((track) => track.id === id)?.pattern;
        return pattern !== null && pattern !== undefined;
      }));
  });
}
export function sectionMotifChange(g: LintGeometry, track: string | null): boolean {
  if (track === null) return false;
  for (let i = 1; i < g.placements.length; i++) {
    const previous = g.placements[i - 1]!, current = g.placements[i]!;
    if (signature(g, previous.startBar, track) !== signature(g, current.startBar, track)) return true;
  }
  return false;
}
export function densityWindows(g: LintGeometry, roles: string[], window: number): boolean {
  const bars = g.placements.filter((placement) => roles.includes(placement.role ?? "")).flatMap(barsOf);
  return densityChange(g, bars, window);
}
export function meanActive(g: LintGeometry, bars: number[]): number {
  return mean(bars.map((bar) => active(g, bar)));
}
export function activeSet(g: LintGeometry, bars: number[]): string {
  return [...new Set(bars.flatMap((bar) => (g.events.get(bar) ?? []).map((event) => event.track)))].sort().join(",");
}
