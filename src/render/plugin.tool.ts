import { createStereo } from "../audio-io/index.ts";
import type { StereoBuffer } from "../audio-io/index.ts";
import { Music2Error } from "../shared/index.ts";
import type { ResolvedTrack } from "../song/index.ts";
import type { ExternalProcessor } from "./render.schema.ts";

/** Cross the optional processor boundary after inserts, before any track controls. */
export async function processTrackPlugins(track: ResolvedTrack, source: StereoBuffer | Float32Array,
  external: ExternalProcessor | undefined, context: { bpm: number; seed: number; startSeconds: number },
  sampleRate: number): Promise<StereoBuffer | Float32Array> {
  if (!track.plugins?.length) return source;
  if (!external) throw new Music2Error("E_CAPABILITY", "external plugin audio requires --allow-plugins and --plugin-host or MUSIC2_PLUGIN_HOST");
  const input = createStereo(sampleRate, source instanceof Float32Array ? source.length : source.left.length);
  if (source instanceof Float32Array) { input.left.set(source); input.right.set(source); }
  else { input.left.set(source.left); input.right.set(source.right); }
  const output = await external.process(track.id, track.plugins, input, context);
  if (output.sampleRate !== sampleRate || output.left.length !== input.left.length || output.right.length !== input.right.length)
    throw new Music2Error("E_RENDER", `plugin returned mismatched audio on ${track.id}`);
  for (let i = 0; i < output.left.length; i++) {
    const left = output.left[i]!, right = output.right[i]!;
    if (!Number.isFinite(left) || !Number.isFinite(right) || Math.abs(left) > 64 || Math.abs(right) > 64)
      throw new Music2Error("E_RENDER", `plugin returned invalid audio on ${track.id}`);
  }
  return output;
}
