import { Music2Error } from "../shared/index.ts";
import { buildTimeline } from "../song/index.ts";
import type { ResolvedSong } from "../song/index.ts";
import { mixTracks } from "./mixer.tool.ts";
import type { RenderOptions, RenderResult } from "./render.schema.ts";
import { DRUM_NAMES } from "./voices/drums.tool.ts";
import { validateVoiceParams } from "./voices/registry.tool.ts";

/** Render a validated, resolved song to deterministic stereo PCM. */
export async function renderSong(song: ResolvedSong, songPath: string,
  options: RenderOptions = {}): Promise<RenderResult> {
  validateVoiceParams(song);
  if ((options.mastering ?? "peak") === "peak" && song.master.targetLufs !== null) {
    throw new Music2Error("E_CAPABILITY", "targetLufs requires loudnorm mastering in wp3");
  }
  const timeline = buildTimeline(song);
  for (const event of timeline.events) {
    const track = song.tracks[event.trackIndex]!;
    if (track.instrument === "drums" && event.sample && !DRUM_NAMES.includes(event.sample.name)) {
      throw new Music2Error("E_SCHEMA", `unknown drum sample ${event.sample.name}`, {
        details: { issues: [{ path: `tracks[${event.trackIndex}].pattern`, message: `unknown drum sample ${event.sample.name}` }] },
      });
    }
    if (event.midi !== null && (!Number.isFinite(event.midi) || event.midi < 0 || event.midi > 127)) {
      throw new Music2Error("E_SCHEMA", `invalid MIDI on track ${track.id}`, {
        details: { issues: [{ path: `tracks[${event.trackIndex}].pattern`, message: "MIDI must be 0..127" }] },
      });
    }
  }
  return mixTracks(song, timeline, songPath, options);
}
