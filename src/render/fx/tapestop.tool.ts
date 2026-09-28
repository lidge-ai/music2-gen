import { Music2Error } from "../../shared/index.ts";
import type { InsertProcessor } from "./fx.schema.ts";

const END_FADE_SECONDS = 0.015;

/** Slow a frozen source snapshot, then fade and silence the remainder of this insert buffer. */
export const processTapeStop: InsertProcessor<"tapestop"> = (buffer, params, ctx) => {
  const secondsPerBar = ctx.secondsPerBar;
  if (secondsPerBar === undefined || !Number.isFinite(secondsPerBar) || secondsPerBar <= 0) {
    throw new Music2Error("E_RENDER", "tapestop requires secondsPerBar");
  }
  const rate = ctx.sampleRate;
  const start = Math.round(((params.startBar - 1) * secondsPerBar - (ctx.startSeconds ?? 0)) * rate);
  const frames = buffer.left.length;
  if (start >= frames) return;
  const duration = params.beats * 60 / ctx.bpm * rate;
  if (start + duration <= 0) {
    buffer.left.fill(0); buffer.right.fill(0);
    return;
  }
  // A crop beginning inside the stop needs its earlier source; the mixer pre-rolls that case.
  const first = Math.max(0, start);
  const left = buffer.left.slice(first);
  const right = buffer.right.slice(first);
  const fade = END_FADE_SECONDS * rate;
  let position = 0;
  for (let frame = first; frame < frames; frame++) {
    const elapsed = frame - start;
    if (elapsed >= duration) {
      buffer.left.fill(0, frame); buffer.right.fill(0, frame);
      break;
    }
    const u = Math.max(0, Math.min(1, elapsed / duration));
    const index = Math.min(Math.floor(position), left.length - 1);
    const fraction = position - index;
    const gain = Math.min(1, Math.max(0, (duration - elapsed) / fade));
    buffer.left[frame] = ((left[index] ?? 0) * (1 - fraction) + (left[index + 1] ?? left[index] ?? 0) * fraction) * gain;
    buffer.right[frame] = ((right[index] ?? 0) * (1 - fraction) + (right[index + 1] ?? right[index] ?? 0) * fraction) * gain;
    position += (1 - u) ** 2;
  }
};
