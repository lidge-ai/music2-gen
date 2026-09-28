import { Fraction, Music2Error, barTicks, ticksToSeconds } from "../shared/index.ts";
import type { ResolvedSong } from "./song.schema.ts";
import type { TimedEvent } from "./timeline.tool.ts";

export function appendListEvents(song: ResolvedSong, events: TimedEvent[], counts: Map<string, number>): void {
  const ticksPerBar = barTicks(song.meter.numerator);
  song.tracks.forEach((track, trackIndex) => {
    if (track.notes === undefined) return;
    track.notes.forEach((note, resolvedIndex) => {
      const count = (counts.get(track.id) ?? 0) + 1;
      if (count > 20000) throw new Music2Error("E_SCHEMA", `track ${track.id} exceeds 20000 events`, {
        details: { issues: [{ path: `$.tracks[${trackIndex}]`, message: "exceeds 20000 events" }] },
      });
      counts.set(track.id, count);
      const spelling = note.pitch === null ? `${note.sample!.name}:${note.sample!.index}` : String(note.pitch);
      const duration = ticksToSeconds(note.lengthTicks, song.bpm);
      events.push({ track: track.id, trackIndex, bar: Math.floor(note.tick / ticksPerBar),
        time: ticksToSeconds(note.tick, song.bpm), duration, slot: duration,
        cycleBegin: new Fraction(note.tick, ticksPerBar).toString(),
        atom: { raw: spelling, name: spelling, index: note.sample?.index ?? null, num: note.pitch, offset: -1 },
        midi: note.pitch, sample: note.sample, velocity: note.velocity, order: resolvedIndex });
    });
  });
}
