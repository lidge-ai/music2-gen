import { createStereo } from "../audio-io/index.ts";
import type { StereoBuffer } from "../audio-io/index.ts";
import { loadClipSources, renderClips } from "../sampler/index.ts";
import { Music2Error } from "../shared/index.ts";
import type { ResolvedSong, Timeline } from "../song/index.ts";
import { duckEnvelope } from "./fx.tool.ts";
import { applyInsertChain } from "./fx/index.ts";
import type { RenderStem } from "./render.schema.ts";

/** Mix resolved audio lanes after instrument lanes, before bus returns. */
export async function mixAudioTracks(song: ResolvedSong, songPath: string,
  window: { startFrame: number; frames: number },
  buses: { master: StereoBuffer; reverb: StereoBuffer; delay: StereoBuffer }, stems: RenderStem[],
  timeline?: Timeline, captureStems = false): Promise<{ reverbActive: boolean; delayActive: boolean }> {
  let reverbActive = false; let delayActive = false;
  const sources = await loadClipSources(songPath, (song.audioTracks ?? []).flatMap((track) => track.clips));
  for (const track of song.audioTracks ?? []) {
    const fullOrigin = window.startFrame > 0 && track.fx.length > 0;
    const renderStart = fullOrigin ? 0 : window.startFrame;
    const renderFrames = fullOrigin ? window.startFrame + window.frames : window.frames;
    const rendered = renderClips(track, sources, { sampleRate: song.sampleRate, bpm: song.bpm,
      startFrame: renderStart, frames: renderFrames });
    if (track.fx.length) applyInsertChain(rendered, track.fx, { sampleRate: song.sampleRate, bpm: song.bpm,
      startSeconds: renderStart / song.sampleRate,
      ...(timeline ? { secondsPerBar: timeline.secondsPerBar } : {}) }, track.id);
    const offset = window.startFrame - renderStart;
    const sourceIndex = track.duck ? song.tracks.findIndex((candidate) => candidate.id === track.duck!.by) : -1;
    const duck = track.duck && sourceIndex >= 0 && timeline ? duckEnvelope(window.startFrame + window.frames,
      timeline.events.filter((event) => event.trackIndex === sourceIndex).map((event) =>
        Math.round(event.time * song.sampleRate)),
      song.sampleRate, track.duck.amount, track.duck.releaseMs) : null;
    const stem = captureStems ? createStereo(song.sampleRate, window.frames) : null;
    const leftGain = 10 ** (track.gain / 20) * Math.cos((track.pan + 1) * Math.PI / 4) * Math.SQRT2;
    const rightGain = 10 ** (track.gain / 20) * Math.sin((track.pan + 1) * Math.PI / 4) * Math.SQRT2;
    for (let i = 0; i < window.frames; i++) {
      const factor = duck?.[window.startFrame + i] ?? 1;
      const left = rendered.left[offset + i]! * leftGain * factor;
      const right = rendered.right[offset + i]! * rightGain * factor;
      if (!Number.isFinite(left) || !Number.isFinite(right)) throw new Music2Error("E_RENDER", `nonfinite audio track sample on ${track.id}`,
        { details: { track: track.id, frame: i } });
      buses.master.left[i]! += left; buses.master.right[i]! += right;
      if (track.sends.reverb !== 0) { buses.reverb.left[i]! += left * track.sends.reverb; buses.reverb.right[i]! += right * track.sends.reverb; }
      if (track.sends.delay !== 0) { buses.delay.left[i]! += left * track.sends.delay; buses.delay.right[i]! += right * track.sends.delay; }
      if (stem) { stem.left[i] = left; stem.right[i] = right; }
    }
    if (stem) stems.push({ trackId: track.id, audio: stem });
    reverbActive ||= track.sends.reverb > 0;
    delayActive ||= track.sends.delay > 0;
  }
  return { reverbActive, delayActive };
}
