import type { InsertProcessor } from "./fx.schema.ts";

/** Sinusoidal, nonnegative channel gains; phaseDegrees offsets the right channel. */
export const processTremolo: InsertProcessor<"tremolo"> = (buffer, params, ctx) => {
  const { rateHz, depth, phaseDegrees, mix } = params;
  const curve = ctx.curves?.["depth"];
  if ((depth === 0 && !curve) || mix === 0) return;
  const step = 2 * Math.PI * rateHz / ctx.sampleRate;
  const offset = Math.PI * phaseDegrees / 180;
  let phase = 0;
  const bias = 1 - 0.5 * depth;
  const excursion = 0.5 * depth;
  for (let i = 0; i < buffer.left.length; i++) {
    const frameBias = curve ? 1 - .5 * curve[i]! : bias;
    const frameExcursion = curve ? .5 * curve[i]! : excursion;
    const gainL = 1 - mix + mix * (frameBias + frameExcursion * Math.sin(phase));
    const gainR = 1 - mix + mix * (frameBias + frameExcursion * Math.sin(phase + offset));
    buffer.left[i] = buffer.left[i]! * gainL;
    buffer.right[i] = buffer.right[i]! * gainR;
    phase += step;
    if (phase >= 2 * Math.PI) phase -= 2 * Math.PI;
  }
};
