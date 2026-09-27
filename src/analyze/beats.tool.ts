import type { ResolvedSong, Timeline } from "../song/index.ts";
import { buildTimeline } from "../song/timeline.tool.ts";
import type { BeatMap, BeatSection, TempoEstimate } from "./analysis.schema.ts";
import { BEATS_VERSION } from "./analysis.schema.ts";

/** Build an exact song grid when metadata is supplied, otherwise an audio estimate. */
export function makeBeatMap(
  tempo: TempoEstimate, durationSeconds: number, song?: ResolvedSong, timeline?: Timeline,
): BeatMap | null {
  if (song) {
    const resolvedTimeline = timeline ?? buildTimeline(song);
    const bpm = song.bpm;
    const meter = song.meter.numerator;
    const musicalDuration = resolvedTimeline.durationSeconds;
    const secondsPerBeat = 60 / bpm;
    const beatCount = Math.ceil(musicalDuration / secondsPerBeat - 1e-9);
    const beatsSeconds = Array.from({ length: beatCount }, (_, index) => index * secondsPerBeat);
    const downbeatsSeconds = beatsSeconds.filter((_, index) => index % meter === 0);
    const sections: BeatSection[] = resolvedTimeline.placements.map((placement) => ({
      id: `${placement.section}#${placement.occurrence}`,
      role: placement.role,
      startSeconds: placement.startBar * resolvedTimeline.secondsPerBar,
      endSeconds: Math.min(musicalDuration, (placement.startBar + placement.bars) * resolvedTimeline.secondsPerBar),
    }));
    return { version: BEATS_VERSION, bpm, meter, timeSignature: { numerator: meter, denominator: 4 },
      offsetFrames: 0, source: "song", confidence: 1, beatsSeconds, downbeatsSeconds, sections };
  }
  if (tempo.bpm === null) return null;
  return { version: BEATS_VERSION, bpm: tempo.bpm, meter: 4,
    timeSignature: { numerator: 4, denominator: 4 }, offsetFrames: 0, source: "audio",
    confidence: tempo.confidence * .7,
    beatsSeconds: tempo.beatsSeconds.filter((time) => Number.isFinite(time) && time >= 0 && time < durationSeconds).sort((a, b) => a - b),
    downbeatsSeconds: tempo.downbeatsSeconds.filter((time) => Number.isFinite(time) && time >= 0 && time < durationSeconds).sort((a, b) => a - b),
    sections: [] };
}
