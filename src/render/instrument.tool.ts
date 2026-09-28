import { createStereo } from "../audio-io/index.ts";
import type { StereoBuffer } from "../audio-io/index.ts";
import { loadSfz, renderSfz } from "../sampler/index.ts";
import type { LoadedSfz, SfzWarning } from "../sampler/index.ts";
import { Music2Error } from "../shared/index.ts";
import type { ResolvedTrack } from "../song/index.ts";
import { loadKit, renderKit } from "./kit.tool.ts";
import type { LoadedKit, VoiceContext } from "./render.schema.ts";

export type LoadedSampleInstrument = { kind: "kit"; resource: LoadedKit; warnings: readonly SfzWarning[] } |
  { kind: "sfz"; resource: LoadedSfz; warnings: readonly SfzWarning[] };
export function isSampleInstrument(instrument: string): boolean {
  return instrument.startsWith("kit:") || instrument.startsWith("sfz:");
}
export async function loadSampleInstrument(songPath: string, track: ResolvedTrack, rate: number): Promise<LoadedSampleInstrument | null> {
  if (track.instrument.startsWith("kit:")) return { kind: "kit", resource: await loadKit(songPath, track.instrument, rate), warnings: [] };
  if (!track.instrument.startsWith("sfz:")) return null;
  if (track.kind !== "notes") throw new Music2Error("E_SCHEMA", "SFZ requires notes track");
  const resource = await loadSfz(songPath, track.instrument.slice(4), rate);
  return { kind: "sfz", resource, warnings: resource.instrument.warnings };
}
export function renderSampleInstrument(ctx: VoiceContext, loaded: LoadedSampleInstrument): StereoBuffer {
  if (loaded.kind === "sfz") return renderSfz(ctx.events.filter((event) => event.midi !== null).map((event) => ({
    midi: event.midi!, velocity: event.velocity, startFrame: event.startFrame,
    gateFrames: event.gateFrames, stopFrame: event.stopFrame, eventIndex: event.eventIndex, seed: event.seed,
  })), loaded.resource, ctx.sampleRate, ctx.frames);
  const mono = renderKit(ctx, loaded.resource);
  const stereo = createStereo(ctx.sampleRate, ctx.frames);
  stereo.left.set(mono); stereo.right.set(mono);
  return stereo;
}
