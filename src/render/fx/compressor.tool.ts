import type { InsertProcessor } from "./fx.schema.ts";

/** Requested positive dB reduction from a linked RMS level, before smoothing. */
export function compressGain(levelDb: number, thresholdDb: number, ratio: number, kneeDb: number): number {
  const excess = levelDb - thresholdDb;
  const slope = 1 - 1 / ratio;
  if (kneeDb > 0 && excess > -kneeDb / 2 && excess < kneeDb / 2) {
    const bend = excess + kneeDb / 2;
    return slope * bend * bend / (2 * kneeDb);
  }
  return Math.max(0, slope * excess);
}

export const processCompressor: InsertProcessor<"compressor"> = (buffer, params, ctx) => {
  const { left, right } = buffer;
  const attack = Math.exp(-1000 / (params.attackMs * ctx.sampleRate));
  const release = Math.exp(-1000 / (params.releaseMs * ctx.sampleRate));
  const detectorPole = Math.exp(-1000 / (8 * ctx.sampleRate));
  let meanSquare = 0;
  let reduction = 0;
  for (let i = 0; i < left.length; i++) {
    const l = left[i]!; const r = right[i]!;
    meanSquare = detectorPole * meanSquare + (1 - detectorPole) * (l * l + r * r) * 0.5;
    const wanted = compressGain(10 * Math.log10(Math.max(meanSquare, 1e-24)), params.thresholdDb, params.ratio, params.kneeDb);
    const alpha = wanted > reduction ? attack : release;
    reduction = alpha * reduction + (1 - alpha) * wanted;
    const gain = 10 ** ((params.makeupDb - reduction) / 20);
    left[i] = l * gain;
    right[i] = r * gain;
  }
};
