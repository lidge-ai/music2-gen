import type { StereoBuffer } from "../audio-io/index.ts";
import { realSpectrum } from "./fft.tool.ts";

const WINDOW_SECONDS = 0.05;
const POWER_FLOOR = 1e-6; // -60 dBFS in amplitude, squared for power.
const COMPARISON_EPSILON = 1e-6; // Float32 storage can place an exact threshold just above its decimal value.
const BANDS = [[20, 200], [200, 2000], [2000, 20000]] as const;

export interface LoopSeamMetrics {
  jumpFs: number;
  rmsFirstDbfs: number | null;
  rmsLastDbfs: number | null;
  rmsStepDb: number | null;
  bandStepDb: { low: number | null; mid: number | null; high: number | null };
}
export interface LoopSeamResult { metrics: LoopSeamMetrics; observed: number | null; threshold: number | null }

function decibels(power: number): number | null { return power === 0 ? null : 10 * Math.log10(power); }
function step(first: number, last: number, floor: number): number | null {
  if (first <= floor && last <= floor) return 0;
  if (first === 0 || last === 0) return null;
  return Math.abs(10 * Math.log10(Math.max(first, floor) / Math.max(last, floor)));
}

function windowPowers(pcm: StereoBuffer, start: number, length: number): { rms: number; bands: number[] } {
  const size = 2 ** Math.ceil(Math.log2(Math.max(2, length)));
  const powers = [0, 0, 0];
  let squareSum = 0;
  for (const channel of [pcm.left, pcm.right]) {
    const samples = new Float32Array(size);
    for (let i = 0; i < length; i++) {
      const sample = channel[start + i]!;
      squareSum += sample * sample;
      samples[i] = sample * (0.5 - 0.5 * Math.cos(2 * Math.PI * i / length));
    }
    const spectrum = realSpectrum(samples, 0, size);
    for (let bin = 1; bin < spectrum.length; bin++) {
      const hz = bin * pcm.sampleRate / size;
      const power = 2 * (spectrum[bin]! / (length / 2)) ** 2;
      BANDS.forEach(([low, high], index) => { if (hz >= low && hz < high) powers[index]! += power / 2; });
    }
  }
  return { rms: squareSum / (2 * length), bands: powers };
}

/** Compare the first and last 50 ms of a rendered whole-song loop. */
export function loopSeam(pcm: StereoBuffer): LoopSeamResult {
  const length = Math.min(pcm.left.length, Math.max(1, Math.round(pcm.sampleRate * WINDOW_SECONDS)));
  const first = windowPowers(pcm, 0, length);
  const last = windowPowers(pcm, pcm.left.length - length, length);
  const jumpFs = Math.max(Math.abs(pcm.left[0]! - pcm.left.at(-1)!), Math.abs(pcm.right[0]! - pcm.right.at(-1)!));
  const rmsStepDb = step(first.rms, last.rms, POWER_FLOOR);
  const bandSteps = first.bands.map((power, index) => step(power, last.bands[index]!, POWER_FLOOR));
  const metrics: LoopSeamMetrics = {
    jumpFs, rmsFirstDbfs: decibels(first.rms), rmsLastDbfs: decibels(last.rms), rmsStepDb,
    bandStepDb: { low: bandSteps[0]!, mid: bandSteps[1]!, high: bandSteps[2]! },
  };
  if (jumpFs > 0.1 + COMPARISON_EPSILON) return { metrics, observed: jumpFs, threshold: 0.1 };
  if (rmsStepDb === null ? Math.max(first.rms, last.rms) > POWER_FLOOR : rmsStepDb > 3 + COMPARISON_EPSILON) {
    return { metrics, observed: rmsStepDb, threshold: 3 };
  }
  for (const band of BANDS.keys()) {
    const value = bandSteps[band]!;
    if (value === null ? Math.max(first.bands[band]!, last.bands[band]!) > POWER_FLOOR : value > 6 + COMPARISON_EPSILON) {
      return { metrics, observed: value, threshold: 6 };
    }
  }
  return { metrics, observed: null, threshold: null };
}
