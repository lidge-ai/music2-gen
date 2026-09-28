/** RBJ Audio EQ Cookbook coefficients, normalized for transposed direct form II. */
export type BiquadKind = "lowpass" | "highpass" | "bandpass" | "peak" | "lowshelf" | "highshelf";
export interface BiquadCoefficients { b0: number; b1: number; b2: number; a1: number; a2: number }
export interface BiquadState { z1: number; z2: number }

export function designBiquad(kind: BiquadKind, frequency: number, sampleRate: number,
  q = Math.SQRT1_2, gainDb = 0, slope = 1): BiquadCoefficients {
  const f = Math.max(1, Math.min(frequency, sampleRate * .45));
  const w = 2 * Math.PI * f / sampleRate;
  const c = Math.cos(w);
  const a = 10 ** (gainDb / 40);
  const alpha = Math.sin(w) / (2 * q);
  let b0: number; let b1: number; let b2: number;
  let a0: number; let a1: number; let a2: number;
  if (kind === "lowpass" || kind === "highpass" || kind === "bandpass") {
    a0 = 1 + alpha; a1 = -2 * c; a2 = 1 - alpha;
    if (kind === "lowpass") {
      b0 = (1 - c) / 2; b1 = 1 - c; b2 = b0;
    } else if (kind === "highpass") {
      b0 = (1 + c) / 2; b1 = -(1 + c); b2 = b0;
    } else {
      b0 = alpha; b1 = 0; b2 = -alpha;
    }
  } else if (kind === "peak") {
    b0 = 1 + alpha * a; b1 = -2 * c; b2 = 1 - alpha * a;
    a0 = 1 + alpha / a; a1 = -2 * c; a2 = 1 - alpha / a;
  } else {
    const shelfAlpha = Math.sin(w) / 2 * Math.sqrt((a + 1 / a) * (1 / slope - 1) + 2);
    const beta = 2 * Math.sqrt(a) * shelfAlpha;
    if (kind === "lowshelf") {
      b0 = a * ((a + 1) - (a - 1) * c + beta);
      b1 = 2 * a * ((a - 1) - (a + 1) * c);
      b2 = a * ((a + 1) - (a - 1) * c - beta);
      a0 = (a + 1) + (a - 1) * c + beta;
      a1 = -2 * ((a - 1) + (a + 1) * c);
      a2 = (a + 1) + (a - 1) * c - beta;
    } else {
      b0 = a * ((a + 1) + (a - 1) * c + beta);
      b1 = -2 * a * ((a - 1) + (a + 1) * c);
      b2 = a * ((a + 1) + (a - 1) * c - beta);
      a0 = (a + 1) - (a - 1) * c + beta;
      a1 = 2 * ((a - 1) - (a + 1) * c);
      a2 = (a + 1) - (a - 1) * c - beta;
    }
  }
  return { b0: b0 / a0, b1: b1 / a0, b2: b2 / a0, a1: a1 / a0, a2: a2 / a0 };
}

export function createBiquadState(): BiquadState { return { z1: 0, z2: 0 }; }

export function processBiquadSample(input: number, c: BiquadCoefficients, state: BiquadState): number {
  const output = c.b0 * input + state.z1;
  state.z1 = c.b1 * input - c.a1 * output + state.z2;
  state.z2 = c.b2 * input - c.a2 * output;
  return output;
}

export function processBiquadStereo(left: Float32Array, right: Float32Array, c: BiquadCoefficients): void {
  const l = createBiquadState(); const r = createBiquadState();
  for (let i = 0; i < left.length; i++) {
    left[i] = processBiquadSample(left[i]!, c, l);
    right[i] = processBiquadSample(right[i]!, c, r);
  }
}
