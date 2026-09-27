import { Music2Error } from "../shared/index.ts";
import type { StereoBuffer } from "./buffer.schema.ts";
import type { LoudnessMetrics } from "./loudness.schema.ts";

type Biquad = readonly [number, number, number, number, number];

const LOUDNESS_OFFSET = -0.691;
const ABSOLUTE_GATE = -70;
const TRUE_PEAK_TAPS = 48;
const TRUE_PEAK_PHASES = 4;

function kWeighting(rate: number): readonly [Biquad, Biquad] {
  const shelfK = Math.tan(Math.PI * 1681.97445095553 / rate);
  const shelfQ = 0.707175236955419;
  const vh = 10 ** (3.99984385397 / 20);
  const vb = vh ** 0.499666774155;
  const shelfA0 = 1 + shelfK / shelfQ + shelfK * shelfK;
  const shelf: Biquad = [
    (vh + vb * shelfK / shelfQ + shelfK * shelfK) / shelfA0,
    2 * (shelfK * shelfK - vh) / shelfA0,
    (vh - vb * shelfK / shelfQ + shelfK * shelfK) / shelfA0,
    2 * (shelfK * shelfK - 1) / shelfA0,
    (1 - shelfK / shelfQ + shelfK * shelfK) / shelfA0,
  ];
  const highK = Math.tan(Math.PI * 38.13547087614 / rate);
  const highQ = 0.500327037325395;
  const highA0 = 1 + highK / highQ + highK * highK;
  const highPass: Biquad = [1, -2, 1,
    2 * (highK * highK - 1) / highA0,
    (1 - highK / highQ + highK * highK) / highA0];
  return [shelf, highPass];
}

class Filter {
  private z1 = 0;
  private z2 = 0;
  private readonly coefficients: Biquad;
  constructor(coefficients: Biquad) { this.coefficients = coefficients; }

  process(input: number): number {
    const [b0, b1, b2, a1, a2] = this.coefficients;
    const output = b0 * input + this.z1;
    this.z1 = b1 * input - a1 * output + this.z2;
    this.z2 = b2 * input - a2 * output;
    return output;
  }
}

function loudness(power: number): number {
  return power > 0 ? LOUDNESS_OFFSET + 10 * Math.log10(power) : -Infinity;
}

function blockPowers(prefix: Float64Array, rate: number, windowSeconds: number): number[] {
  const size = Math.round(windowSeconds * rate);
  const hop = Math.round(0.1 * rate);
  const powers: number[] = [];
  for (let start = 0; start + size < prefix.length; start += hop) {
    powers.push((prefix[start + size]! - prefix[start]!) / size);
  }
  return powers;
}

function gatedMean(powers: readonly number[], relativeGate: number): number | null {
  let firstSum = 0;
  let firstCount = 0;
  for (const power of powers) {
    if (loudness(power) >= ABSOLUTE_GATE) { firstSum += power; firstCount++; }
  }
  if (firstCount === 0) return null;
  const threshold = loudness(firstSum / firstCount) - relativeGate;
  let sum = 0;
  let count = 0;
  for (const power of powers) {
    if (loudness(power) >= ABSOLUTE_GATE && loudness(power) >= threshold) {
      sum += power;
      count++;
    }
  }
  return count > 0 ? sum / count : null;
}

function loudnessRange(powers: readonly number[]): number | null {
  const mean = gatedMean(powers, 20);
  if (mean === null) return null;
  const threshold = loudness(mean) - 20;
  const values = powers.filter((power) => loudness(power) >= ABSOLUTE_GATE && loudness(power) >= threshold)
    .map(loudness).sort((a, b) => a - b);
  if (values.length === 0) return null;
  return values[Math.round((values.length - 1) * .95)]! - values[Math.round((values.length - 1) * .1)]!;
}

const truePeakWeights: Float64Array[] = Array.from({ length: TRUE_PEAK_PHASES - 1 }, (_, index) => {
  const phase = (index + 1) / TRUE_PEAK_PHASES;
  const weights = new Float64Array(TRUE_PEAK_TAPS);
  let sum = 0;
  for (let tap = 0; tap < TRUE_PEAK_TAPS; tap++) {
    const x = tap - 23 - phase;
    const sinc = x === 0 ? 1 : Math.sin(Math.PI * x) / (Math.PI * x);
    const window = .5 - .5 * Math.cos(2 * Math.PI * tap / (TRUE_PEAK_TAPS - 1));
    weights[tap] = sinc * window;
    sum += weights[tap]!;
  }
  for (let tap = 0; tap < TRUE_PEAK_TAPS; tap++) weights[tap] = weights[tap]! / sum;
  return weights;
});

function truePeakOf(channel: Float32Array, samplePeak: number): number {
  let peak = samplePeak;
  for (let frame = 0; frame < channel.length - 1; frame++) {
    for (const weights of truePeakWeights) {
      let value = 0;
      let availableWeight = 0;
      for (let tap = 0; tap < TRUE_PEAK_TAPS; tap++) {
        const sample = channel[frame + tap - 23];
        if (sample !== undefined) {
          value += sample * weights[tap]!;
          availableWeight += weights[tap]!;
        }
      }
      if (availableWeight !== 0) value /= availableWeight;
      peak = Math.max(peak, Math.abs(value));
    }
  }
  return peak;
}

/** BS.1770 integrated loudness, EBU loudness range and a 4x true-peak estimate. */
export function measureLoudness(pcm: StereoBuffer): LoudnessMetrics {
  const { sampleRate, left, right, sourceChannels } = pcm;
  if (!Number.isInteger(sampleRate) || sampleRate < 8000 || sampleRate > 192000 ||
      !(left instanceof Float32Array) || !(right instanceof Float32Array) || left.length !== right.length ||
      (sourceChannels !== 1 && sourceChannels !== 2)) {
    throw new Music2Error("E_INPUT", "invalid PCM for loudness measurement");
  }
  const [shelf, highPass] = kWeighting(sampleRate);
  const leftShelf = new Filter(shelf); const leftHigh = new Filter(highPass);
  const rightShelf = new Filter(shelf); const rightHigh = new Filter(highPass);
  const prefix = new Float64Array(left.length + 1);
  let samplePeak = 0;
  for (let frame = 0; frame < left.length; frame++) {
    const l = left[frame]!;
    const r = right[frame]!;
    if (!Number.isFinite(l) || !Number.isFinite(r)) {
      throw new Music2Error("E_INPUT", "nonfinite audio sample", { details: { frame } });
    }
    samplePeak = Math.max(samplePeak, Math.abs(l), sourceChannels === 2 ? Math.abs(r) : 0);
    const filteredLeft = leftHigh.process(leftShelf.process(l));
    let power = filteredLeft * filteredLeft;
    if (sourceChannels === 2) {
      const filteredRight = rightHigh.process(rightShelf.process(r));
      power += filteredRight * filteredRight;
    }
    prefix[frame + 1] = prefix[frame]! + power;
  }
  const integratedPower = gatedMean(blockPowers(prefix, sampleRate, .4), 10);
  const range = loudnessRange(blockPowers(prefix, sampleRate, 3));
  const truePeak = samplePeak === 0 ? 0 : Math.max(
    truePeakOf(left, samplePeak), sourceChannels === 2 ? truePeakOf(right, samplePeak) : 0);
  return {
    integratedLufs: integratedPower === null ? null : loudness(integratedPower),
    lraLu: range,
    lraProvisional: left.length / sampleRate < 60,
    samplePeakDbfs: samplePeak === 0 ? null : 20 * Math.log10(samplePeak),
    truePeakEstimateDbtp: truePeak === 0 ? null : 20 * Math.log10(truePeak),
    truePeakOversample: 4,
  };
}
