import { Fraction, Music2Error } from "../shared/index.ts";
import { noteToMidi, onsets, parseMini, parseNumber, parseSampleRef, queryArc } from "../pattern/index.ts";
import type { Atom, Node, QueryCtx } from "../pattern/index.ts";
import { arrange } from "./arrange.tool.ts";
import type { Placement } from "./arrange.tool.ts";
import type { ResolvedSong, ResolvedTrack } from "./song.schema.ts";

export interface TimedEvent {
  track: string; trackIndex: number; bar: number; time: number; duration: number; slot: number;
  cycleBegin: string; atom: Atom; midi: number | null; sample: { name: string; index: number } | null;
  velocity: number; order: number;
}
export interface Timeline {
  bars: number; secondsPerBar: number; durationSeconds: number; placements: Placement[]; events: TimedEvent[];
}

function velocityAt(pattern: Node | null, onset: Fraction, ctx: QueryCtx): number {
  if (!pattern) return 0.8;
  const cycle = Fraction.of(onset.floor());
  const hap = queryArc(pattern, cycle, cycle.add(Fraction.of(1)), ctx)
    .find((candidate) => candidate.whole.begin.lte(onset) && candidate.whole.end.gt(onset));
  return hap ? Math.max(0, Math.min(1, parseNumber(hap.atom.raw))) : 0.8;
}

function swingShift(onset: Fraction, track: ResolvedTrack, song: ResolvedSong, secondsPerBar: number): number {
  if (!track.swing || song.swing <= 0.5) return 0;
  const pos = onset.sub(Fraction.of(onset.floor())).mul(Fraction.of(16));
  return pos.d === 1 && pos.n % 2 === 1 ? (song.swing - 0.5) * 2 * (secondsPerBar / 16) : 0;
}

export function buildTimeline(song: ResolvedSong): Timeline {
  const placements = arrange(song);
  const bars = placements.reduce((count, placement) => count + placement.bars, 0);
  const secondsPerBar = song.meter.numerator * 60 / song.bpm;
  const events: TimedEvent[] = [];
  const counts = new Map<string, number>();
  const sections = new Map(song.sections.map((section) => [section.id, section]));
  const cache = new Map<string, Node>();
  const parsed = (text: string): Node => {
    let node = cache.get(text);
    if (!node) { node = parseMini(text); cache.set(text, node); }
    return node;
  };

  for (const placement of placements) {
    const section = sections.get(placement.section)!;
    song.tracks.forEach((track, trackIndex) => {
      const pattern = Object.hasOwn(section.patterns, track.id) ? section.patterns[track.id] : track.pattern;
      if (pattern === null || pattern === undefined) return;
      const node = parsed(pattern);
      const velocityNode = typeof track.velocity === "string" ? parsed(track.velocity) : null;
      const ctx = { seed: song.seed, salt: `${track.id}@${section.id}` };
      for (let cycle = 0; cycle < placement.bars; cycle++) {
        const begin = Fraction.of(cycle);
        for (const hap of onsets(node, begin, begin.add(Fraction.of(1)), ctx)) {
          const onset = hap.whole.begin;
          const absoluteBar = placement.startBar + onset.floor();
          const slot = Number(hap.whole.end.sub(onset)) * secondsPerBar;
          const time = (placement.startBar + Number(onset)) * secondsPerBar + swingShift(onset, track, song, secondsPerBar);
          const midi = track.kind === "notes" ?
            (hap.atom.num === null ? noteToMidi(hap.atom.raw) : hap.atom.num) + track.transpose : null;
          const sample = track.kind === "drums" ? parseSampleRef(hap.atom.raw) : null;
          const velocity = typeof track.velocity === "number" ? track.velocity : velocityAt(velocityNode, onset, ctx);
          events.push({ track: track.id, trackIndex, bar: absoluteBar, time,
            duration: slot * (track.instrument === "sfx" || track.mono ? 1 : track.gate), slot,
            cycleBegin: onset.toString(), atom: hap.atom, midi, sample, velocity, order: hap.order });
          const count = (counts.get(track.id) ?? 0) + 1;
          if (count > 20000) throw new Music2Error("E_SCHEMA", `track ${track.id} exceeds 20000 events`, {
            details: { issues: [{ path: `$.tracks[${trackIndex}]`, message: "exceeds 20000 events" }] },
          });
          counts.set(track.id, count);
        }
      }
    });
  }
  events.sort((a, b) => a.time - b.time || a.trackIndex - b.trackIndex || a.order - b.order);
  return { bars, secondsPerBar, durationSeconds: bars * secondsPerBar, placements, events };
}
