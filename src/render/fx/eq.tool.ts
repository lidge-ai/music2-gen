import type { InsertProcessor } from "./fx.schema.ts";
import { createBiquadState, designBiquad, processBiquadSample, processBiquadStereo } from "./biquad.tool.ts";

export const processEq: InsertProcessor<"eq"> = (buffer, params, ctx) => {
  if (ctx.curves?.["lowGainDb"] || ctx.curves?.["midGainDb"] || ctx.curves?.["highGainDb"]) {
    for (const [gain, kind, frequency, q] of [
      ["lowGainDb", "lowshelf", params.lowHz, Math.SQRT1_2],
      ["midGainDb", "peak", params.midHz, params.midQ],
      ["highGainDb", "highshelf", params.highHz, Math.SQRT1_2],
    ] as const) {
      const l = createBiquadState(); const r = createBiquadState();
      for (let start = 0; start < buffer.left.length; start += 32) {
        const c = designBiquad(kind, frequency, ctx.sampleRate, q, ctx.curves[gain]?.[start] ?? params[gain]);
        for (let i = start; i < Math.min(start + 32, buffer.left.length); i++) {
          buffer.left[i] = processBiquadSample(buffer.left[i]!, c, l);
          buffer.right[i] = processBiquadSample(buffer.right[i]!, c, r);
        }
      }
    }
    return;
  }
  if (params.lowGainDb !== 0) processBiquadStereo(buffer.left, buffer.right,
    designBiquad("lowshelf", params.lowHz, ctx.sampleRate, Math.SQRT1_2, params.lowGainDb));
  if (params.midGainDb !== 0) processBiquadStereo(buffer.left, buffer.right,
    designBiquad("peak", params.midHz, ctx.sampleRate, params.midQ, params.midGainDb));
  if (params.highGainDb !== 0) processBiquadStereo(buffer.left, buffer.right,
    designBiquad("highshelf", params.highHz, ctx.sampleRate, Math.SQRT1_2, params.highGainDb));
};
