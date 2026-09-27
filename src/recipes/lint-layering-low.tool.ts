import { pitchedIntervals, placementOrdinalByBar, placementSpan } from "./lint-geometry.tool.ts";
import type { LintGeometry, PitchedInterval } from "./lint-geometry.tool.ts";
import type { LintResult } from "./lint.tool.ts";

const LOW_MIDI = 46;
const OVERLAP_SHARE = 0.25;
const AUDIBLE_GAIN_DB = -24;
const PAN_LIMIT = 0.1;
const SUB_FLOOR_MIDI = 22;

function warning(id: string, path: string, observed: string | number, expected: string | number, fix: string): LintResult {
  return { id: `generic/${id}`, severity: "warning", path, observed, expected, fix };
}

function overlap(g: LintGeometry, intervals: PitchedInterval[]): LintResult[] {
  const out: LintResult[] = [];
  const ordinalByBar = placementOrdinalByBar(g);
  const byPlacement: PitchedInterval[][] = g.placements.map(() => []);
  for (const interval of intervals) byPlacement[ordinalByBar[interval.event.bar]!]!.push(interval);
  for (const placement of g.placements) {
    const { start, end } = placementSpan(g, placement);
    const points: { time: number; kind: -1 | 1; track: string }[] = [];
    for (const interval of byPlacement[placement.ordinal]!) {
      if (interval.event.midi! > LOW_MIDI || interval.event.velocity <= 0 ||
          g.song.tracks[interval.event.trackIndex]!.gain <= AUDIBLE_GAIN_DB) continue;
      const left = Math.max(start, interval.start), right = Math.min(end, interval.end);
      if (right > left) {
        points.push({ time: left, kind: 1, track: interval.event.track });
        points.push({ time: right, kind: -1, track: interval.event.track });
      }
    }
    points.sort((a, b) => a.time - b.time || a.kind - b.kind || a.track.localeCompare(b.track));
    const active = new Map<string, number>();
    let covered = 0, firstTime: number | null = null;
    let firstTracks: string[] = [];
    let previous = start;
    for (const point of points) {
      if (active.size >= 2 && point.time > previous) {
        covered += point.time - previous;
        if (firstTime === null) {
          firstTime = previous;
          firstTracks = [...active.keys()].sort().slice(0, 2);
        }
      }
      if (point.kind === -1) {
        const count = active.get(point.track)! - 1;
        if (count) active.set(point.track, count); else active.delete(point.track);
      } else active.set(point.track, (active.get(point.track) ?? 0) + 1);
      previous = point.time;
    }
    const share = covered / (end - start);
    if (share >= OVERLAP_SHARE && firstTime !== null) {
      const bar = Math.floor(firstTime / g.timeline.secondsPerBar) + 1;
      out.push(warning("low_end_overlap", `arrangement.${placement.ordinal}`,
        `section ${placement.section} occurrence ${placement.occurrence + 1}; first bar ${bar}; tracks ${firstTracks.join("/")}; share ${share.toFixed(4)}`,
        `overlap < ${OVERLAP_SHARE}`, "Give one low track the main role, shorten or separate the other notes, then check the render."));
    }
  }
  return out;
}

export function lowLayeringRules(g: LintGeometry): LintResult[] {
  const intervals = pitchedIntervals(g);
  const out = overlap(g, intervals);
  for (const [index, track] of g.song.tracks.entries()) {
    if (track.kind !== "notes") continue;
    const notes = g.timeline.events.filter((event) => event.trackIndex === index && event.midi !== null);
    const low = notes.filter((event) => event.midi! <= LOW_MIDI).length;
    if (Math.abs(track.pan) > PAN_LIMIT &&
        (track.instrument === "bass" || track.instrument === "808" || (notes.length > 0 && low / notes.length >= 0.25))) {
      out.push(warning("low_pan", `tracks.${track.id}.pan`, `${track.pan}; ${low}/${notes.length} notes <= MIDI ${LOW_MIDI}`,
        `|pan| <= ${PAN_LIMIT}`, "Center the low voice or split the upper stereo layer from the low part."));
    }
    const sub = notes.find((event) => event.midi! <= SUB_FLOOR_MIDI);
    if (sub) out.push(warning("sub_floor", `tracks.${track.id}`,
      `first bar ${sub.bar + 1}; MIDI ${sub.midi}`, `MIDI > ${SUB_FLOOR_MIDI}`,
      "Raise the note or verify the intended subsonic effect on the rendered mix."));
  }
  return out;
}
