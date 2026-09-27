import { Fraction } from "../shared/index.ts";
import type { Placement, ResolvedSong, TimedEvent, Timeline } from "../song/index.ts";

export const GRID_TOLERANCE = 1 / 64;
export interface LintGeometry {
  song: ResolvedSong;
  timeline: Timeline;
  events: Map<number, TimedEvent[]>;
  full: number[];
  hooks: number[];
  grooves: number[];
  placements: Placement[];
}

export function phase(event: TimedEvent): number {
  const [numerator, denominator] = event.cycleBegin.split("/").map(Number);
  const fraction = new Fraction(numerator ?? 0, denominator ?? 1);
  return Number(fraction.sub(Fraction.of(fraction.floor())));
}
export function at(step: number, event: TimedEvent): boolean {
  return Math.abs(phase(event) - step / 16) <= GRID_TOLERANCE;
}
export function eventsAt(g: LintGeometry, bar: number): TimedEvent[] { return g.events.get(bar) ?? []; }
export function isKick(g: LintGeometry, event: TimedEvent): boolean {
  return g.song.tracks[event.trackIndex]?.kind === "drums" && event.atom.name === "bd";
}
export function isBackbeat(g: LintGeometry, event: TimedEvent): boolean {
  return g.song.tracks[event.trackIndex]?.kind === "drums" && (event.atom.name === "sd" || event.atom.name === "cp");
}
export function isHat(g: LintGeometry, event: TimedEvent): boolean {
  return g.song.tracks[event.trackIndex]?.kind === "drums" && ["hh", "oh", "sh"].includes(event.atom.name);
}
export function is808(g: LintGeometry, event: TimedEvent): boolean {
  const track = g.song.tracks[event.trackIndex];
  return track?.kind === "notes" && track.instrument === "808";
}
export function has(g: LintGeometry, bar: number, predicate: (event: TimedEvent) => boolean): boolean {
  return eventsAt(g, bar).some(predicate);
}
export function kick(g: LintGeometry, bar: number): boolean { return has(g, bar, (e) => isKick(g, e)); }
export function snare9(g: LintGeometry, bar: number): boolean { return has(g, bar, (e) => isBackbeat(g, e) && at(8, e)); }
/** UK drill moving snare: step 9, or step 13 without a step-5 backbeat (Attack/NI drill tutorials); a 5+13 backbeat still fails. */
export function snare9or13(g: LintGeometry, bar: number): boolean {
  if (snare9(g, bar)) return true;
  return has(g, bar, (e) => isBackbeat(g, e) && at(12, e)) && !has(g, bar, (e) => isBackbeat(g, e) && at(4, e));
}
export function snare5and13(g: LintGeometry, bar: number): boolean {
  return [4, 12].every((step) => has(g, bar, (e) => isBackbeat(g, e) && at(step, e)));
}
export function fourKick(g: LintGeometry, bar: number): boolean {
  return [0, 4, 8, 12].every((step) => has(g, bar, (e) => isKick(g, e) && at(step, e)));
}
export function offhat(g: LintGeometry, bar: number): boolean {
  return [2, 6, 10, 14].every((step) => has(g, bar, (e) => isHat(g, e) && ["hh", "oh"].includes(e.atom.name) && at(step, e)));
}
export function active(g: LintGeometry, bar: number): number { return new Set(eventsAt(g, bar).map((e) => e.track)).size; }
export function barsOf(placement: Placement): number[] {
  return Array.from({ length: placement.bars }, (_, i) => placement.startBar + i);
}
export function mean(values: number[]): number { return values.reduce((sum, value) => sum + value, 0) / values.length; }
export function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  if (!sorted.length) return 0;
  return (sorted[Math.floor((sorted.length - 1) / 2)]! + sorted[Math.floor(sorted.length / 2)]!) / 2;
}
export function densityChange(g: LintGeometry, bars: number[], window: number): boolean {
  for (let i = 0; i + 2 * window <= bars.length; i++) {
    if (bars[i + 2 * window - 1]! - bars[i]! !== 2 * window - 1) continue;
    const left = median(bars.slice(i, i + window).map((bar) => active(g, bar)));
    const right = median(bars.slice(i + window, i + 2 * window).map((bar) => active(g, bar)));
    if (Math.abs(left - right) >= 1) return true;
  }
  return false;
}
export function signature(g: LintGeometry, bar: number, track: string): string {
  return eventsAt(g, bar).filter((e) => e.track === track)
    .map((e) => `${phase(e)}:${e.midi ?? e.atom.name}`).sort().join("|");
}
export function comparableBlocks(bars: number[], size: number): boolean {
  return bars.some((bar, index) => index + 2 * size <= bars.length && bars[index + 2 * size - 1]! - bar === 2 * size - 1);
}
export function motif(g: LintGeometry, bars: number[], size: number, track: string): boolean {
  for (let i = 0; i + 2 * size <= bars.length; i++) {
    if (bars[i + 2 * size - 1]! - bars[i]! !== 2 * size - 1) continue;
    const left = bars.slice(i, i + size).map((bar) => signature(g, bar, track));
    const right = bars.slice(i + size, i + 2 * size).map((bar) => signature(g, bar, track));
    if (left.some(Boolean) && left.every((part, j) => part === right[j])) return true;
  }
  return false;
}
export function transitions(g: LintGeometry, bars: number[]): number {
  const allowed = new Set(bars);
  const notes = g.timeline.events.filter((e) => allowed.has(e.bar) && is808(g, e) && e.midi !== null);
  let count = 0;
  for (let i = 1; i < notes.length; i++) if (notes[i - 1]!.midi !== notes[i]!.midi) count++;
  return count;
}
export function createGeometry(song: ResolvedSong, timeline: Timeline, genre: string | null = song.genre): LintGeometry {
  const events = new Map<number, TimedEvent[]>();
  for (const event of timeline.events) {
    if (event.bar < 0 || event.bar >= timeline.bars) continue;
    const list = events.get(event.bar) ?? [];
    list.push(event); events.set(event.bar, list);
  }
  const full: number[] = [], hooks: number[] = [], grooves: number[] = [];
  const kickTracks = new Set(timeline.events.filter((event) => song.tracks[event.trackIndex]?.kind === "drums" && event.atom.name === "bd").map((event) => event.track));
  const snareTracks = new Set(timeline.events.filter((event) => song.tracks[event.trackIndex]?.kind === "drums" && ["sd", "cp"].includes(event.atom.name)).map((event) => event.track));
  for (const track of song.tracks.filter((item) => item.kind === "drums")) {
    if (track.id === "kick") kickTracks.add(track.id);
    if (track.id === "snare" || track.id === "clap") snareTracks.add(track.id);
  }
  for (const placement of timeline.placements) {
    const bars = barsOf(placement);
    if (placement.role === "hook") hooks.push(...bars);
    if (placement.role === "hook" || placement.role === "groove") grooves.push(...bars);
    const section = song.sections.find((item) => item.id === placement.section)!;
    const effective = (id: string): string | null => Object.hasOwn(section.patterns, id) ? section.patterns[id] ?? null : song.tracks.find((track) => track.id === id)?.pattern ?? null;
    const activeDrums = (ids: Set<string>): boolean => [...ids].some((id) => effective(id) !== null);
    if (["hook", "verse", "groove", ...(genre === "techno" ? ["build"] : [])].includes(placement.role ?? "") && activeDrums(kickTracks) && activeDrums(snareTracks)) full.push(...bars);
  }
  return { song, timeline, events, full, hooks, grooves, placements: timeline.placements };
}
