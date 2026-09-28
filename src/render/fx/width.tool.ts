import type { InsertProcessor } from "./fx.schema.ts";
import { createBiquadState, designBiquad, processBiquadSample } from "./biquad.tool.ts";

/** Matched Linkwitz-Riley fourth-order low/high side split; their sum is allpass. */
export const processWidth: InsertProcessor<"width"> = (buffer, params, ctx) => {
  const { amount, monoBelowHz } = params;
  const curve = ctx.curves?.["amount"];
  const low = designBiquad("lowpass", monoBelowHz, ctx.sampleRate);
  const high = designBiquad("highpass", monoBelowHz, ctx.sampleRate);
  const low1 = createBiquadState(); const low2 = createBiquadState();
  const high1 = createBiquadState(); const high2 = createBiquadState();
  for (let i = 0; i < buffer.left.length; i++) {
    const left = buffer.left[i]!;
    const right = buffer.right[i]!;
    const mid = (left + right) * 0.5;
    const side = (left - right) * 0.5;
    const sideLow = processBiquadSample(processBiquadSample(side, low, low1), low, low2);
    const sideHigh = processBiquadSample(processBiquadSample(side, high, high1), high, high2);
    const sideAllpass = sideLow + sideHigh;
    const scaled = (curve?.[i] ?? amount) * (sideAllpass - sideLow);
    buffer.left[i] = mid + scaled;
    buffer.right[i] = mid - scaled;
  }
};
