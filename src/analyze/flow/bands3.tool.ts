import type { StereoBuffer } from "../../audio-io/buffer.schema.ts";
import type { FlowWaveformColumn } from "./flow.schema.ts";

type Coefficients = readonly [number, number, number, number, number];

function coefficients(rate: number, cutoff: number, high: boolean): Coefficients {
  const omega = 2 * Math.PI * cutoff / rate;
  const cosine = Math.cos(omega);
  const alpha = Math.sin(omega) / (2 / Math.SQRT2);
  const a0 = 1 + alpha;
  const numerator = high ? [(1 + cosine) / 2, -(1 + cosine), (1 + cosine) / 2]
    : [(1 - cosine) / 2, 1 - cosine, (1 - cosine) / 2];
  return [numerator[0]! / a0, numerator[1]! / a0, numerator[2]! / a0,
    -2 * cosine / a0, (1 - alpha) / a0];
}

class Biquad {
  private z1 = 0;
  private z2 = 0;
  private readonly c: Coefficients;
  constructor(c: Coefficients) { this.c = c; }
  process(input: number): number {
    const [b0, b1, b2, a1, a2] = this.c;
    const output = b0 * input + this.z1;
    this.z1 = b1 * input - a1 * output + this.z2;
    this.z2 = b2 * input - a2 * output;
    return output;
  }
}

/** Fixed music2 RGB bands; filter overlap near crossovers is intentional. */
export function threeBandWaveform(pcm: StereoBuffer, width = 1200): FlowWaveformColumn[] {
  const result: FlowWaveformColumn[] = Array.from({ length: width }, () => ({
    lowPeak: 0, lowRms: 0, midPeak: 0, midRms: 0, highPeak: 0, highRms: 0,
  }));
  if (pcm.left.length === 0 || width <= 0) return result;
  const channels = pcm.sourceChannels === 1 ? [pcm.left] : [pcm.left, pcm.right];
  const counts = new Uint32Array(width);
  for (const samples of channels) {
    const low = new Biquad(coefficients(pcm.sampleRate, 200, false));
    const remainder = new Biquad(coefficients(pcm.sampleRate, 200, true));
    const mid = new Biquad(coefficients(pcm.sampleRate, 2000, false));
    const high = new Biquad(coefficients(pcm.sampleRate, 2000, true));
    for (let frame = 0; frame < samples.length; frame++) {
      const column = Math.min(width - 1, Math.floor(frame * width / samples.length));
      const value = samples[frame]!;
      const rem = remainder.process(value);
      const values = [low.process(value), mid.process(rem), high.process(rem)] as const;
      const row = result[column]!;
      row.lowPeak = Math.max(row.lowPeak, Math.abs(values[0]));
      row.midPeak = Math.max(row.midPeak, Math.abs(values[1]));
      row.highPeak = Math.max(row.highPeak, Math.abs(values[2]));
      row.lowRms += values[0] ** 2;
      row.midRms += values[1] ** 2;
      row.highRms += values[2] ** 2;
      counts[column] = counts[column]! + 1;
    }
  }
  for (let column = 0; column < width; column++) {
    const row = result[column]!;
    const count = counts[column]!;
    if (count > 0) {
      row.lowRms = Math.sqrt(row.lowRms / count);
      row.midRms = Math.sqrt(row.midRms / count);
      row.highRms = Math.sqrt(row.highRms / count);
    }
  }
  return result;
}
