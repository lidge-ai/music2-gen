import type { InsertProcessor } from "./fx.schema.ts";
import { createBiquadState, designBiquad, processBiquadSample } from "./biquad.tool.ts";
import { createSvfState, designSvf, processSvfSample } from "./svf.tool.ts";

export const processFilter: InsertProcessor<"filter"> = (buffer, params, ctx) => {
  const { left, right } = buffer;
  const { mix, mode, q, cutoffHz, lfoDepthOct, lfoRateHz } = params;
  if (mix === 0) return;
  const dry = 1 - mix;
  const cutoff = ctx.curves?.["cutoffHz"];
  if (cutoff) {
    if (lfoDepthOct === 0 || lfoRateHz === 0) {
      const l = createBiquadState(); const r = createBiquadState();
      for (let start = 0; start < left.length; start += 32) {
        const c = designBiquad(mode, cutoff[start]!, ctx.sampleRate, q);
        for (let i = start; i < Math.min(start + 32, left.length); i++) {
          const x = left[i]!; const y = right[i]!;
          left[i] = dry * x + mix * processBiquadSample(x, c, l);
          right[i] = dry * y + mix * processBiquadSample(y, c, r);
        }
      }
    } else {
      const l = createSvfState(); const r = createSvfState();
      const step = 2 * Math.PI * lfoRateHz / ctx.sampleRate;
      for (let start = 0; start < left.length; start += 32) {
        const phase = (start * step) % (2 * Math.PI);
        const lc = designSvf(cutoff[start]! * 2 ** (lfoDepthOct * Math.sin(phase)), q, ctx.sampleRate);
        const rc = designSvf(cutoff[start]! * 2 ** (lfoDepthOct * Math.cos(phase)), q, ctx.sampleRate);
        for (let i = start; i < Math.min(start + 32, left.length); i++) {
          const x = left[i]!; const y = right[i]!;
          left[i] = dry * x + mix * processSvfSample(x, lc, l, mode);
          right[i] = dry * y + mix * processSvfSample(y, rc, r, mode);
        }
      }
    }
    return;
  }
  if (lfoDepthOct === 0 || lfoRateHz === 0) {
    const c = designBiquad(mode, cutoffHz, ctx.sampleRate, q);
    const l = createBiquadState(); const r = createBiquadState();
    for (let i = 0; i < left.length; i++) {
      const x = left[i]!; const y = right[i]!;
      left[i] = dry * x + mix * processBiquadSample(x, c, l);
      right[i] = dry * y + mix * processBiquadSample(y, c, r);
    }
    return;
  }
  const l = createSvfState(); const r = createSvfState();
  const step = 2 * Math.PI * lfoRateHz / ctx.sampleRate;
  // Hold coefficients for one short control block; state and phase remain continuous.
  for (let start = 0; start < left.length; start += 32) {
    const phase = (start * step) % (2 * Math.PI);
    const lc = designSvf(cutoffHz * 2 ** (lfoDepthOct * Math.sin(phase)), q, ctx.sampleRate);
    const rc = designSvf(cutoffHz * 2 ** (lfoDepthOct * Math.cos(phase)), q, ctx.sampleRate);
    const end = Math.min(start + 32, left.length);
    for (let i = start; i < end; i++) {
      const x = left[i]!; const y = right[i]!;
      left[i] = dry * x + mix * processSvfSample(x, lc, l, mode);
      right[i] = dry * y + mix * processSvfSample(y, rc, r, mode);
    }
  }
};
