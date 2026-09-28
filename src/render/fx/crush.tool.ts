import type { InsertProcessor } from "./fx.schema.ts";

/** Deterministic signed midtread quantization with a shared frame hold clock. */
export const processCrush: InsertProcessor<"crush"> = (buffer, params) => {
  const { bits, downsample, mix } = params;
  if (mix === 0) return;
  const levels = 2 ** (bits - 1) - 1;
  let heldL = 0;
  let heldR = 0;
  for (let i = 0; i < buffer.left.length; i++) {
    const dryL = buffer.left[i]!;
    const dryR = buffer.right[i]!;
    if (i % downsample === 0) {
      heldL = Math.round(Math.max(-1, Math.min(1, dryL)) * levels) / levels;
      heldR = Math.round(Math.max(-1, Math.min(1, dryR)) * levels) / levels;
    }
    buffer.left[i] = dryL * (1 - mix) + heldL * mix;
    buffer.right[i] = dryR * (1 - mix) + heldR * mix;
  }
};
