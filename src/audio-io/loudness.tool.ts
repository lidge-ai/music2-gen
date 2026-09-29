import { Music2Error } from "../shared/index.ts";
import type { StereoBuffer } from "./buffer.schema.ts";
import type { LoudnessMetrics } from "./loudness.schema.ts";
import { kWeightedPower } from "./kweight.tool.ts";

const LOUDNESS_OFFSET = -0.691;
const ABSOLUTE_GATE = -70;
const TRUE_PEAK_TAPS = 48;
const TRUE_PEAK_PHASES = 4;

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

interface WeightedPrefix { prefix: Float64Array; samplePeak: number }

/** Validates PCM and returns the K-weighted power prefix sum plus the sample peak. */
function kWeightedPrefix(pcm: StereoBuffer): WeightedPrefix {
  const { sampleRate, left, right, sourceChannels } = pcm;
  if (!Number.isInteger(sampleRate) || sampleRate < 8000 || sampleRate > 192000 ||
      !(left instanceof Float32Array) || !(right instanceof Float32Array) || left.length !== right.length ||
      (sourceChannels !== 1 && sourceChannels !== 2)) {
    throw new Music2Error("E_INPUT", "invalid PCM for loudness measurement");
  }
  const prefix = new Float64Array(left.length + 1);
  let samplePeak = 0;
  kWeightedPower(pcm, (frame, power) => {
    const l = left[frame]!;
    const r = right[frame]!;
    samplePeak = Math.max(samplePeak, Math.abs(l), sourceChannels === 2 ? Math.abs(r) : 0);
    prefix[frame + 1] = prefix[frame]! + power;
  });
  return { prefix, samplePeak };
}

/** BS.1770 gated integrated loudness only; the same arithmetic as measureLoudness(pcm).integratedLufs, without the true-peak pass. */
export function integratedLoudness(pcm: StereoBuffer): number | null {
  const power = gatedMean(blockPowers(kWeightedPrefix(pcm).prefix, pcm.sampleRate, .4), 10);
  return power === null ? null : loudness(power);
}

/** BS.1770 integrated loudness, EBU loudness range and a 4x true-peak estimate. */
export function measureLoudness(pcm: StereoBuffer): LoudnessMetrics {
  const { sampleRate, left, right, sourceChannels } = pcm;
  const { prefix, samplePeak } = kWeightedPrefix(pcm);
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
