import { mulberry32 } from "../../shared/prng.tool.ts";

/** Polynomial correction around a phase discontinuity. Phase is in [0, 1). */
export function polyBlep(phase: number, step: number): number {
  if (step <= 0 || step >= 1) return 0;
  if (phase < step) {
    const x = phase / step;
    return x + x - x * x - 1;
  }
  if (phase > 1 - step) {
    const x = (phase - 1) / step;
    return x * x + x + x + 1;
  }
  return 0;
}

export function polyBlepSaw(phase: number, step: number): number {
  return 2 * phase - 1 - polyBlep(phase, step);
}

export function polyBlepSquare(phase: number, step: number): number {
  return (phase < 0.5 ? 1 : -1) + polyBlep(phase, step) -
    polyBlep(phase < 0.5 ? phase + 0.5 : phase - 0.5, step);
}

/** One independent phase per oscillator; ratios are symmetrical in cents. */
export class UnisonOscillator {
  readonly phases: Float64Array;
  readonly ratios: Float64Array;
  constructor(count: number, detuneCents: number, seed: number) {
    this.phases = new Float64Array(count);
    this.ratios = new Float64Array(count);
    const random = mulberry32(seed);
    const spread = Math.max(1, (count - 1) / 2);
    for (let i = 0; i < count; i++) {
      this.phases[i] = random();
      this.ratios[i] = 2 ** (detuneCents * (i - (count - 1) / 2) / spread / 1200);
    }
  }

  sample(frequency: number, rate: number, square = false, centerMix = 0.5): number {
    let sum = 0;
    let weights = 0;
    const center = (this.phases.length - 1) / 2;
    for (let i = 0; i < this.phases.length; i++) {
      const step = Math.min(0.45, frequency * this.ratios[i]! / rate);
      const phase = this.phases[i]!;
      const weight = Math.abs(i - center) < 1 ? 1 : centerMix;
      sum += weight * (square ? polyBlepSquare(phase, step) : polyBlepSaw(phase, step));
      weights += weight;
      let next = phase + step;
      if (next >= 1) next -= 1;
      this.phases[i] = next;
    }
    return sum / weights;
  }
}

/** TPT state-variable low-pass; retain double-precision state per note. */
export class VoiceLowpass {
  private s1 = 0;
  private s2 = 0;
  private readonly k: number;
  constructor(resonance: number) { this.k = 1 / (Math.SQRT1_2 + resonance * 4); }

  process(input: number, g: number): number {
    const hp = (input - (this.k + g) * this.s1 - this.s2) / (1 + this.k * g + g * g);
    const bp = g * hp + this.s1;
    const lp = g * bp + this.s2;
    this.s1 = 2 * bp - this.s1;
    this.s2 = 2 * lp - this.s2;
    return lp;
  }
}

/** Cutoff envelope opens by at most four octaves and decays to the base cutoff. */
export function filterG(baseHz: number, amount: number, decayFrames: number,
  age: number, rate: number): number {
  const cutoff = Math.min(0.45 * rate, baseHz * 2 ** (4 * amount * Math.exp(-age / decayFrames)));
  return Math.tan(Math.PI * cutoff / rate);
}

/** Recalculate a decaying cutoff every 64 samples and interpolate the SVF control. */
export class FilterEnvelope {
  private blockStart = -64;
  private startG = 0;
  private endG = 0;
  private readonly constantG: number | null;
  private readonly baseHz: number;
  private readonly amount: number;
  private readonly decayFrames: number;
  private readonly rate: number;
  constructor(baseHz: number, amount: number, decayFrames: number, rate: number) {
    this.baseHz = baseHz;
    this.amount = amount;
    this.decayFrames = decayFrames;
    this.rate = rate;
    this.constantG = amount === 0 ? filterG(baseHz, 0, decayFrames, 0, rate) : null;
  }

  value(age: number): number {
    if (this.constantG !== null) return this.constantG;
    if (age >= this.blockStart + 64) {
      this.blockStart = Math.floor(age / 64) * 64;
      this.startG = filterG(this.baseHz, this.amount, this.decayFrames, this.blockStart, this.rate);
      this.endG = filterG(this.baseHz, this.amount, this.decayFrames, this.blockStart + 64, this.rate);
    }
    return this.startG + (this.endG - this.startG) * (age - this.blockStart) / 64;
  }
}

export function hasNewSynthParams(params: Readonly<Record<string, number>>, pad = false): boolean {
  return Object.hasOwn(params, "unison") || Object.hasOwn(params, "filterEnvAmount") ||
    Object.hasOwn(params, "filterEnvDecayMs") || (!pad && Object.hasOwn(params, "detuneCents"));
}
