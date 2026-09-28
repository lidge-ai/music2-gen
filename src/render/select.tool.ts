import { fnv1a32 } from "../shared/index.ts";
import type { ResolvedSong, Timeline } from "../song/index.ts";
import type { VoiceEvent } from "./render.schema.ts";
import { mergeParams, resolveVoice } from "./voices/registry.tool.ts";

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
    selected[event.trackIndex]!.push({
      midi: event.midi, sample: event.sample, velocity: event.velocity,
      startFrame, gateFrames: Math.max(0, Math.round(event.duration * rate)),
      stopFrame: frames, eventIndex, seed: fnv1a32(song.seed, track.id, eventIndex),
    });
  }
  for (let index = 0; index < selected.length; index++) {
    const track = song.tracks[index]!;
    const events = selected[index]!;
    if (track.mono) {
      for (let i = 0; i < events.length; i++) {
        const next = events[i + 1];
        if (next) events[i]!.stopFrame = Math.min(frames, next.startFrame);
      }
    } else if (track.kind === "notes" && !track.instrument.startsWith("kit:") && !track.instrument.startsWith("sfz:")) {
      const voice = resolveVoice(track, index)!;
      const params = mergeParams(voice, track.params);
      const releaseMs = voice.id === "bell" ? 120 : voice.id === "pluck" ? 80 : params["releaseMs"];
      if (releaseMs !== undefined) {
        // Voice envelopes reach about -120 dB after twice their release time.
        const tailFrames = Math.ceil(2 * releaseMs * rate / 1000);
        for (const event of events) event.stopFrame = Math.min(frames, event.startFrame + event.gateFrames + tailFrames);
      }
    }
  }
  return selected;
}
