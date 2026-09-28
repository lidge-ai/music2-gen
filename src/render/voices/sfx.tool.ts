import { Music2Error } from "../../shared/index.ts";
import { renderTransition, TRANSITION_ATOMS, TRANSITION_PARAMS } from "../../sfx/index.ts";
import type { TransitionAtom } from "../../sfx/index.ts";
import type { VoiceSpec } from "../render.schema.ts";

const NAMES: readonly string[] = TRANSITION_ATOMS;
const KNEE = 0.8;

/** Identity below the knee; overlapping events above it saturate smoothly toward, never past, full scale. */
function soften(x: number): number {
  const magnitude = Math.abs(x);
  if (magnitude <= KNEE) return x;
  return Math.sign(x) * (KNEE + (1 - KNEE) * Math.tanh((magnitude - KNEE) / (1 - KNEE)));
}

/**
 * Synthesized transition effects as a drum-kind voice. Each atom fills its weighted pattern slot
 * (gateFrames, gate ignored upstream); impact and subdrop may ring to their decay bound, never past the render.
 */
export const sfxVoice: VoiceSpec = {
  id: "sfx", kind: "drums", monoDefault: false, sampleNames: NAMES, params: TRANSITION_PARAMS,
  render(ctx, params) {
    const out = new Float32Array(ctx.frames);
    // Count sounding events per frame so only overlaps are softened; a lone event keeps its exact samples.
    const layers = new Uint8Array(ctx.frames);
    for (const event of ctx.events) {
      const name = event.sample?.name;
      if (name === undefined || !NAMES.includes(name)) {
        throw new Music2Error("E_SCHEMA", `unknown sfx atom ${String(name)} on track ${ctx.track.id}`, {
          details: { issues: [{ path: `tracks.${ctx.track.id}.pattern`, message: `unknown sfx atom ${String(name)}` }] },
        });
      }
      if (event.startFrame < 0 || event.startFrame >= ctx.frames || event.gateFrames <= 0) continue;
      const variant = ((event.sample!.index % 4) + 4) % 4;
      const pcm = renderTransition(name as TransitionAtom, variant, event.gateFrames / ctx.sampleRate,
        ctx.sampleRate, event.seed, params, event.velocity, ctx.frames - event.startFrame);
      const end = Math.min(ctx.frames, event.startFrame + pcm.length);
      for (let frame = event.startFrame; frame < end; frame++) {
        out[frame] = out[frame]! + pcm[frame - event.startFrame]!;
        if (layers[frame]! < 255) layers[frame] = layers[frame]! + 1;
      }
    }
    for (let frame = 0; frame < out.length; frame++) if (layers[frame]! > 1) out[frame] = soften(out[frame]!);
    return out;
  },
};
