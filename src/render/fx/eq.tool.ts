import type { InsertProcessor } from "./fx.schema.ts";
import { designBiquad, processBiquadStereo } from "./biquad.tool.ts";

export const processEq: InsertProcessor<"eq"> = (buffer, params, ctx) => {
  if (params.lowGainDb !== 0) processBiquadStereo(buffer.left, buffer.right,
    designBiquad("lowshelf", params.lowHz, ctx.sampleRate, Math.SQRT1_2, params.lowGainDb));
  if (params.midGainDb !== 0) processBiquadStereo(buffer.left, buffer.right,
    designBiquad("peak", params.midHz, ctx.sampleRate, params.midQ, params.midGainDb));
  if (params.highGainDb !== 0) processBiquadStereo(buffer.left, buffer.right,
    designBiquad("highshelf", params.highHz, ctx.sampleRate, Math.SQRT1_2, params.highGainDb));
};
