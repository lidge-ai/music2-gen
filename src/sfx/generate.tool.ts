import { renderGame } from "./game.tool.ts";
import { TRANSITION_ATOMS } from "./presets.tool.ts";
import { renderTransition } from "./transition.tool.ts";
import type { TransitionAtom } from "./presets.tool.ts";
import type { ResolvedSfx } from "./sfx.schema.ts";

export function generateSfx(resolved: ResolvedSfx): { left: Float32Array; right: Float32Array } {
  const transition = (TRANSITION_ATOMS as readonly string[]).includes(resolved.preset);
  const source = transition ? renderTransition(resolved.preset as TransitionAtom, 0,
    resolved.seconds, resolved.sampleRate, resolved.seed, resolved.params, 1, resolved.frames) : renderGame(resolved);
  const left = new Float32Array(resolved.frames);
  left.set(source.subarray(0, resolved.frames));
  return { left, right: left.slice() };
}
