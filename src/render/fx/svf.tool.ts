/** Trapezoidal-integrator state-variable filter with double-precision state. */
export interface SvfState { s1: number; s2: number }
export interface SvfCoefficients { g: number; k: number; inverse: number }
export type SvfMode = "lowpass" | "highpass" | "bandpass";

export function designSvf(cutoffHz: number, q: number, sampleRate: number): SvfCoefficients {
  const g = Math.tan(Math.PI * Math.max(1, Math.min(cutoffHz, sampleRate * .45)) / sampleRate);
  const k = 1 / q;
  return { g, k, inverse: 1 / (1 + k * g + g * g) };
}

export function createSvfState(): SvfState { return { s1: 0, s2: 0 }; }

export function processSvfSample(input: number, c: SvfCoefficients, state: SvfState, mode: SvfMode): number {
  const hp = (input - (c.k + c.g) * state.s1 - state.s2) * c.inverse;
  const bp = c.g * hp + state.s1;
  const lp = c.g * bp + state.s2;
  state.s1 = 2 * bp - state.s1;
  state.s2 = 2 * lp - state.s2;
  return mode === "lowpass" ? lp : mode === "highpass" ? hp : c.k * bp;
}
