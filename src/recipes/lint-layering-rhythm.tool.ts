import { isKick, pitchedIntervals } from "./lint-geometry.tool.ts";
import type { LintGeometry } from "./lint-geometry.tool.ts";
import type { LintResult } from "./lint.tool.ts";

const ATTACK_WINDOW_SECONDS = 0.030;
const COINCIDENCE_SHARE = 0.5;
const DUCK_FLOOR = 0.1;

export function rhythmLayeringRules(g: LintGeometry): LintResult[] {
  if (g.genre !== "house" && g.genre !== "techno") return [];
  const kicks = g.timeline.events.filter((event) => isKick(g, event));
  if (!kicks.length) return [];
  const kickTracks = new Set(kicks.map((event) => event.track));
  const intervals = pitchedIntervals(g);
  const out: LintResult[] = [];
  for (const track of g.song.tracks) {
    if (track.kind !== "notes" || (track.instrument !== "bass" && track.instrument !== "808")) continue;
    if (track.duck && track.duck.amount >= DUCK_FLOOR && kickTracks.has(track.duck.by)) continue;
    const notes = intervals.filter((interval) => interval.event.track === track.id && interval.event.velocity > 0);
    const latestEnd: number[] = [];
    notes.forEach((note, index) => { latestEnd[index] = Math.max(index ? latestEnd[index - 1]! : -Infinity, note.end); });
    const matches = kicks.filter((kick) => {
      let left = 0, right = notes.length;
      while (left < right) {
        const mid = Math.floor((left + right) / 2);
        if (notes[mid]!.start <= kick.time + ATTACK_WINDOW_SECONDS) left = mid + 1;
        else right = mid;
      }
      const index = left - 1;
      return index >= 0 && (notes[index]!.start >= kick.time - ATTACK_WINDOW_SECONDS || latestEnd[index]! > kick.time);
    }).length;
    if (matches / kicks.length < COINCIDENCE_SHARE) continue;
    out.push({ id: "generic/kick_bass_unducked", severity: "warning", path: `tracks.${track.id}`,
      observed: `${matches}/${kicks.length} kick onsets coincide with ${track.id}; duck ${track.duck?.by ?? "none"} amount ${track.duck?.amount ?? 0}`,
      expected: `coincidence < ${COINCIDENCE_SHARE} or duck by bd track amount >= ${DUCK_FLOOR}`,
      fix: "Duck the bass from a bd source by at least 0.1 or move bass attacks; a mixed drum source ducks on every event." });
  }
  return out;
}
