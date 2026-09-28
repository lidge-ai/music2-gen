import { median, pitchedIntervals, placementOrdinalByBar, placementSpan } from "./lint-geometry.tool.ts";
import type { LintGeometry, PitchedInterval } from "./lint-geometry.tool.ts";
import type { LintResult } from "./lint.tool.ts";
import type { Placement, TimedEvent } from "../song/index.ts";

const LOW_INTERVAL_FLOORS = [0, 52, 51, 48, 46, 46, 47, 34, 43, 41, 41, 41];
const FOCAL = new Set(["lead", "bell", "pluck", "keys", "piano", "epiano", "guitar", "flute",
  "brass", "marimba", "vibraphone", "glockenspiel", "kalimba"]);
const REGISTER_DISTANCE = 7;
const SLOT_SHARE = 0.75;

function warning(id: string, path: string, observed: string, expected: string, fix: string): LintResult {
  return { id: `generic/${id}`, severity: "warning", path, observed, expected, fix };
}
function chordSpacing(g: LintGeometry, intervals: PitchedInterval[]): LintResult[] {
  const out: LintResult[] = [], reported = new Set<string>();
  const ordinalByBar = placementOrdinalByBar(g);
  const byPlacement: PitchedInterval[][] = g.placements.map(() => []);
  for (const interval of intervals) byPlacement[ordinalByBar[interval.event.bar]!]!.push(interval);
  for (const placement of g.placements) {
    const notes = byPlacement[placement.ordinal]!.filter((note) => {
      const track = g.song.tracks[note.event.trackIndex]!;
      return track.instrument !== "bass" && track.instrument !== "808";
    });
    for (let i = 0; i < notes.length; i++) {
      const a = notes[i]!;
      if (reported.has(a.event.track)) continue;
      for (let j = i + 1; j < notes.length; j++) {
        const b = notes[j]!;
        if (b.start >= a.end) break;
        if (a.event.track !== b.event.track || b.end <= a.start) continue;
        const lower = Math.min(a.event.midi!, b.event.midi!);
        const distance = Math.abs(a.event.midi! - b.event.midi!);
        if (distance < 1 || distance > 11 || lower >= LOW_INTERVAL_FLOORS[distance]!) continue;
        const bar = Math.floor(Math.max(a.start, b.start) / g.timeline.secondsPerBar) + 1;
        out.push(warning("low_chord_spacing", `tracks.${a.event.track}`,
          `first bar ${bar}; MIDI ${lower}/${lower + distance}; interval ${distance}; lower ${lower}`,
          `lower MIDI >= ${LOW_INTERVAL_FLOORS[distance]}`,
          "Raise or spread the low chord tones, then judge the rendered low mids."));
        reported.add(a.event.track);
        break;
      }
    }
  }
  return out;
}
function slot(g: LintGeometry, placement: Placement, event: TimedEvent): number {
  const { start } = placementSpan(g, placement);
  const eighth = 30 / g.song.bpm;
  return Math.round((event.time - start) / eighth);
}
function registerCollision(g: LintGeometry): LintResult[] {
  const out: LintResult[] = [];
  for (const placement of g.placements) {
    if (placement.bars < 2) continue;
    const { start, end } = placementSpan(g, placement);
    const occurrenceEvents = Array.from({ length: placement.bars }, (_, offset) => g.events.get(placement.startBar + offset) ?? []).flat();
    const candidates = g.song.tracks.map((track, index) => ({ track, index,
      notes: occurrenceEvents.filter((event) => event.trackIndex === index && event.midi !== null && event.time >= start && event.time < end),
    })).filter(({ track, notes }) => track.kind === "notes" && FOCAL.has(track.instrument) && notes.length);
    for (let i = 0; i < candidates.length; i++) for (let j = i + 1; j < candidates.length; j++) {
      const a = candidates[i]!, b = candidates[j]!;
      const distance = Math.abs(median(a.notes.map((note) => note.midi!)) - median(b.notes.map((note) => note.midi!)));
      if (distance > REGISTER_DISTANCE) continue;
      const sparse = a.notes.length <= b.notes.length ? a : b;
      const dense = sparse === a ? b : a;
      const occupied = new Set(dense.notes.map((note) => slot(g, placement, note)));
      const matches = sparse.notes.filter((note) => occupied.has(slot(g, placement, note))).length;
      const share = matches / sparse.notes.length;
      if (share < SLOT_SHARE) continue;
      out.push(warning("register_collision", `arrangement.${placement.ordinal}`,
        `section ${placement.section} occurrence ${placement.occurrence + 1}; tracks ${a.track.id}/${b.track.id}; median distance ${distance}; shared ${matches}/${sparse.notes.length}`,
        `median distance > ${REGISTER_DISTANCE} or shared slots < ${SLOT_SHARE}`,
        "Move one focal line to another register or stagger its onsets."));
    }
  }
  return out;
}
export function harmonyLayeringRules(g: LintGeometry): LintResult[] {
  return [...chordSpacing(g, pitchedIntervals(g)), ...registerCollision(g)];
}
