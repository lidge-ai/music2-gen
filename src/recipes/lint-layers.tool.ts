import { barsOf, eventsAt, isBackbeat, isKick } from "./lint-geometry.tool.ts";
import type { LintGeometry } from "./lint-geometry.tool.ts";
import { isBassInstrument, melodyTrackIds } from "./lint-roles.tool.ts";
import type { LintResult } from "./lint.tool.ts";

/** Suggest a role stack only for sources with audible onsets in arranged peak sections. */
export function thinPeakLayerRules(g: LintGeometry): LintResult[] {
  const audible = new Map<string, { sections: Set<string>; drums: boolean }>();
  for (const placement of g.placements) {
    if (placement.role !== "hook" && placement.role !== "groove") continue;
    for (const bar of barsOf(placement)) for (const event of eventsAt(g, bar)) {
      if (event.velocity <= 0) continue;
      const entry = audible.get(event.track) ?? { sections: new Set<string>(), drums: false };
      entry.sections.add(placement.section);
      entry.drums ||= isKick(g, event) || isBackbeat(g, event);
      audible.set(event.track, entry);
    }
  }
  const melody = melodyTrackIds(g).find((id) => audible.has(id));
  const out: LintResult[] = [];
  for (const [index, track] of g.song.tracks.entries()) {
    const entry = audible.get(track.id);
    if (!entry || track.layers?.length ||
        !(entry.drums || isBassInstrument(track.instrument) || track.id === melody)) continue;
    out.push({ id: "generic/thin_peak_layers", severity: "info", path: `tracks[${index}]`,
      observed: `no layers in ${[...entry.sections].join(", ")}`, expected: ">=1 layer",
      fix: "Add complementary sources to this track's layers, then render and check their balance." });
  }
  return out;
}
