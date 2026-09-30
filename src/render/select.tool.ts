import { fnv1a32, secondsToTicks } from "../shared/index.ts";
import { valueAt } from "../automation/index.ts";
import type { ResolvedSong, ResolvedTrack, Timeline } from "../song/index.ts";
import type { VoiceEvent } from "./render.schema.ts";
import { mergeParams, resolveVoice } from "./voices/registry.tool.ts";
import { isSampleInstrument } from "./instrument.tool.ts";

export function selectEvents(song: ResolvedSong, timeline: Timeline, start: number, end: number, frames: number): VoiceEvent[][] {
  const rate = song.sampleRate;
  const offset = start * timeline.secondsPerBar;
  const counters = new Uint32Array(song.tracks.length);
  const selected: VoiceEvent[][] = song.tracks.map(() => []);
  for (const event of timeline.events) {
    const eventIndex = counters[event.trackIndex] ?? 0;
    counters[event.trackIndex] = eventIndex + 1;
    if (event.bar < start || event.bar >= end) continue;
    const track = song.tracks[event.trackIndex]!;
    const startFrame = Math.round((event.time - offset) * rate);
    if (startFrame < 0 || startFrame >= frames) continue;
    const voiceLanes = track.automation?.filter((lane) => lane.target.startsWith("param."));
    const onsetParams = voiceLanes?.length ? Object.fromEntries(voiceLanes.map((lane) =>
      [lane.target.slice(6), valueAt(lane, secondsToTicks(event.time, song.bpm))])) : undefined;
    selected[event.trackIndex]!.push({
      midi: event.midi, sample: event.sample, velocity: event.velocity,
      startFrame, gateFrames: Math.max(0, Math.round(event.duration * rate)),
      stopFrame: frames, eventIndex, seed: fnv1a32(song.seed, track.id, eventIndex),
      ...(onsetParams ? { params: onsetParams } : {}),
    });
  }
  for (let index = 0; index < selected.length; index++) {
    const track = song.tracks[index]!;
    const events = selected[index]!;
    limitStops(events, track, index, frames, rate);
  }
  return selected;
}

/** Recompute lifetime for this voice, rather than inheriting another source's release cutoff. */
export function limitStops(events: VoiceEvent[], track: ResolvedTrack, trackIndex: number, frames: number, sampleRate: number): void {
  for (const event of events) event.stopFrame = frames;
  if (track.mono) {
    for (let i = 0; i < events.length; i++) {
      const next = events[i + 1];
      if (next) events[i]!.stopFrame = Math.min(frames, next.startFrame);
    }
  } else if (track.kind === "notes" && !isSampleInstrument(track.instrument)) {
    const voice = resolveVoice(track, trackIndex)!;
    const params = mergeParams(voice, track.params);
    const releaseMs = voice.id === "bell" ? 120 : voice.id === "pluck" ? 80 : params["releaseMs"];
    if (releaseMs !== undefined) {
      // Voice envelopes reach about -120 dB after twice their release time.
      const tailFrames = Math.ceil(2 * releaseMs * sampleRate / 1000);
      for (const event of events) event.stopFrame = Math.min(frames, event.startFrame + event.gateFrames + tailFrames);
    }
  }
}
