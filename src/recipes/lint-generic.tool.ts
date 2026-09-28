import type { TimedEvent } from "../song/index.ts";
import { GRID_TOLERANCE, is808, phase } from "./lint-geometry.tool.ts";
import type { LintGeometry } from "./lint-geometry.tool.ts";
import type { LintResult } from "./lint.tool.ts";
import type { Placement } from "../song/index.ts";
import { mean } from "./lint-geometry.tool.ts";

const CLIP_RISK_SUM = 1.5;
const ROOTS: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
export function outsideKey(g: LintGeometry, select: (event: TimedEvent) => boolean): TimedEvent[] {
  if (!g.song.key) return [];
  const [root = "C", mode = "major"] = g.song.key.split(" ");
  const base = ROOTS[root[0] ?? "C"]! + (root[1] === "#" ? 1 : root[1] === "b" ? -1 : 0);
  const scale = mode === "minor" ? [0, 2, 3, 5, 7, 8, 10] : [0, 2, 4, 5, 7, 9, 11];
  return g.timeline.events.filter((event) => event.midi !== null && select(event) &&
    !scale.includes(((event.midi - base) % 12 + 12) % 12));
}
export function polyphonic808(g: LintGeometry): string[] {
  const failures: string[] = [];
  const tracks = g.song.tracks.filter((item) => item.kind === "notes" && item.instrument === "808");
  for (const track of tracks) {
    if (!track.mono) failures.push(`${track.id}: mono=false`);
    const events = g.timeline.events.filter((event) => event.track === track.id).sort((a, b) => a.time - b.time);
    for (let i = 0; i < events.length; i++) {
      for (let j = i + 1; j < events.length && events[j]!.time < events[i]!.time + events[i]!.duration - .001; j++)
        failures.push(`${track.id}: overlap bar ${events[i]!.bar}`);
    }
  }
  const events = g.timeline.events.filter((event) => is808(g, event)).sort((a, b) => a.time - b.time);
  for (let i = 0; i < events.length; i++) {
    for (let j = i + 1; j < events.length && Math.abs(events[j]!.time - events[i]!.time) <= .001; j++) {
      if (events[j]!.midi !== events[i]!.midi) failures.push(`${events[i]!.track}/${events[j]!.track}: simultaneous pitches bar ${events[i]!.bar}`);
    }
  }
  return [...new Set(failures)];
}
export function clippingRisk(g: LintGeometry): number {
  let maximum = 0;
  for (const events of g.events.values()) {
    const ordered = [...events].sort((a, b) => phase(a) - phase(b));
    for (const event of ordered) {
      const position = phase(event);
      const sum = ordered.filter((other) => Math.abs(phase(other) - position) <= GRID_TOLERANCE)
        .reduce((total, other) => total + other.velocity * 10 ** ((g.song.tracks[other.trackIndex]?.gain ?? 0) / 20), 0);
      maximum = Math.max(maximum, sum);
    }
  }
  return maximum;
}
export function genericRules(g: LintGeometry, unknownGenre: boolean): LintResult[] {
  const results: LintResult[] = [];
  const add = (id: string, path: string, observed: string | number, expected: string | number, fix: string): void => {
    results.push({ id: `generic/${id}`, severity: "warning", path, observed, expected, fix });
  };
  const empty = g.song.tracks.filter((track) => !g.timeline.events.some((event) => event.track === track.id));
  if (empty.length) add("empty_track", "tracks", empty.map((track) => track.id).join(", "), "at least one onset per track", "Add onsets or remove the track.");
  if (unknownGenre) add("unknown_genre", "genre", g.song.genre ?? "", "music2 recipes id", "Choose `music2 recipes` id or pass `--genre`.");
  for (const track of g.song.tracks) {
    if (track.kind !== "notes" || (track.instrument !== "strings" && track.instrument !== "brass")) continue;
    const family = track.instrument;
    add("synthetic_acoustic", `tracks.${track.id}.instrument`, family,
      `sampled ${family} for acoustic parts`,
      `Use lib:${family} or lib:${family}-staccato for acoustic ${family}; keep ${family} only when a synth-${family} sound is explicitly wanted.`);
  }
  const notes = g.timeline.events.filter((event) => event.midi !== null);
  const outside = outsideKey(g, () => true);
  if (outside.length) add("out_of_key", `tracks.${outside[0]!.track}`, `${outside.length}/${notes.length}; first bar ${outside[0]!.bar}`, "all notes in declared key", "Change notes/key; document intentional chromatic notes in arrangement metadata later.");
  const polyphony = polyphonic808(g);
  if (polyphony.length) add("808_polyphony", "tracks", polyphony.join(", "), "monophonic 808", "Set mono true; shorten/revoice overlaps.");
  const peak = clippingRisk(g);
  if (peak > CLIP_RISK_SUM) add("clipping_risk", "tracks", Number(peak.toFixed(3)), `static onset sum <= ${CLIP_RISK_SUM}`, "Lower gains/velocities, then verify with analyze.");
  const genre = g.song.genre;
  const dance = genre === "house" || genre === "techno";
  const short = g.song.useCase?.startsWith("short_") ?? false;
  const hookLimit: Record<string, number> = { trap: 9, drill_ny: 9, drill_uk: 13, house: 65, boom_bap: 41 };
  if (genre) {
    const limit = short ? 1 : hookLimit[genre];
    if (limit !== undefined) {
      const hook = g.placements.find((placement) => placement.role === "hook");
      const drop = hook ?? (genre === "house" ? g.placements.find((placement, index) => placement.role === "groove" &&
        g.placements.slice(0, index).some((previous) => previous.role === "breakdown")) : undefined);
      if (drop && drop.startBar + 1 > limit) add("hook_too_late", `arrangement.${drop.section}`,
        drop.startBar + 1, limit, "Move the first hook earlier or choose an intentional alternate arrangement.");
    }
    if (["trap", "drill_ny", "drill_uk", "boom_bap", "house", "techno"].includes(genre)) {
      const count = (placement: Placement): number => {
        const start = placement.startBar * g.timeline.secondsPerBar;
        const end = (placement.startBar + placement.bars) * g.timeline.secondsPerBar;
        return new Set(g.timeline.events.filter((event) => event.time >= start && event.time < end).map((event) => event.track)).size;
      };
      const loud = g.placements.filter((placement) => dance ? placement.role === "hook" || placement.role === "groove" : placement.role === "hook");
      const quiet = g.placements.filter((placement) => placement.role === (dance ? "breakdown" : "verse"));
      if (loud.length && quiet.length) {
        const difference = mean(loud.map(count)) - mean(quiet.map(count));
        const threshold = dance ? 2 : 1;
        if (difference < threshold) add("no_density_contrast", "arrangement", difference, threshold,
          "Mute a layer in verse/breakdown or restore one in hook/groove; rerender to confirm.");
      }
    }
  }
  return results;
}
export function has808(g: LintGeometry): boolean { return g.song.tracks.some((track) => track.kind === "notes" && track.instrument === "808"); }
export function notes808(g: LintGeometry, bars: number[]): TimedEvent[] {
  const included = new Set(bars);
  return g.timeline.events.filter((event) => included.has(event.bar) && is808(g, event));
}
