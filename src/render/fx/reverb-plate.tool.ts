import type { StereoBuffer } from "../../audio-io/index.ts";
import type { ReverbBusParams } from "./fx.schema.ts";

const REFERENCE_RATE = 29761;
const scale = (samples: number, fs: number): number => Math.max(1, Math.round(samples * fs / REFERENCE_RATE));

class Delay {
  private readonly ring: Float64Array;
  private cursor = 0;
  constructor(length: number) { this.ring = new Float64Array(length); }
  peek(): number { return this.ring[this.cursor] ?? 0; }
  process(input: number): number {
    const delayed = this.ring[this.cursor] ?? 0;
    this.ring[this.cursor] = input;
    this.cursor = this.cursor + 1 === this.ring.length ? 0 : this.cursor + 1;
    return delayed;
  }
  /** Tap index counts forward from the entry of the named delay segment. */
  tap(index: number): number {
    const position = (this.cursor - 1 - index + this.ring.length) % this.ring.length;
    return this.ring[position] ?? 0;
  }
}

class Allpass {
  private readonly ring: Float64Array;
  private readonly history: Delay;
  private readonly length: number;
  private readonly coefficient: number;
  private cursor = 0;
  constructor(length: number, coefficient: number, excursion: number, maxTap: number) {
    this.length = length;
    this.coefficient = coefficient;
    this.ring = new Float64Array(length + excursion + 2);
    this.history = new Delay(maxTap + 1);
  }
  process(input: number, excursion: number): number {
    const delay = this.length + excursion;
    const whole = Math.floor(delay);
    const fraction = delay - whole;
    const size = this.ring.length;
    const a = this.ring[(this.cursor - whole + size) % size] ?? 0;
    const b = this.ring[(this.cursor - whole - 1 + size) % size] ?? 0;
    const delayed = a + (b - a) * fraction;
    const v = input - this.coefficient * delayed;
    const output = delayed + this.coefficient * v;
    this.ring[this.cursor] = v;
    this.cursor = this.cursor + 1 === size ? 0 : this.cursor + 1;
    this.history.process(output);
    return output;
  }
  tap(index: number): number { return this.history.tap(index); }
}

/** Dattorro's crossed figure-eight tank; 29,761-Hz segment and tap lengths scale with fs. */
export function renderPlate(inputL: Float32Array, inputR: Float32Array, output: StereoBuffer, params: ReverbBusParams): void {
  const fs = output.sampleRate;
  // A short RT needs less diffusion as well as less feedback: repeated allpass
  // echoes alone otherwise outlast the requested decay before the first loop.
  const diffusion = Math.max(0.08, Math.min(1, (params.decaySeconds - 0.2) / 1));
  const makeDiffusers = (): Allpass[] => [
    new Allpass(scale(142, fs), 0.75 * diffusion, 0, 0), new Allpass(scale(107, fs), 0.75 * diffusion, 0, 0),
    new Allpass(scale(379, fs), 0.625 * diffusion, 0, 0), new Allpass(scale(277, fs), 0.625 * diffusion, 0, 0),
  ];
  const diffusersL = makeDiffusers();
  const diffusersR = makeDiffusers();
  const modulation = scale(16, fs);
  const earlyL = new Allpass(scale(672, fs), 0.7 * diffusion, modulation, 0);
  const earlyR = new Allpass(scale(908, fs), 0.7 * diffusion, modulation, 0);
  const longL = new Delay(scale(4453, fs));
  const longR = new Delay(scale(4217, fs));
  const lateL = new Allpass(scale(1800, fs), 0.5 * diffusion, 0, scale(1228, fs));
  const lateR = new Allpass(scale(2656, fs), 0.5 * diffusion, 0, scale(1913, fs));
  const finalL = new Delay(scale(3720, fs));
  const finalR = new Delay(scale(3163, fs));
  const leftTraversal = scale(672 + 4453 + 1800 + 3720, fs);
  const rightTraversal = scale(908 + 4217 + 2656 + 3163, fs);
  const gainL = Math.pow(10, -3 * leftTraversal / (fs * params.decaySeconds));
  const gainR = Math.pow(10, -3 * rightTraversal / (fs * params.decaySeconds));
  const bandwidthPole = Math.exp(-2 * Math.PI * 16000 / fs);
  const dampingHz = 18000 - 15000 * params.damping;
  const dampingPole = Math.exp(-2 * Math.PI * dampingHz / fs);
  let bandwidthL = 0, bandwidthR = 0, dampL = 0, dampR = 0;
  const angular = 2 * Math.PI / fs;
  const sinStep = Math.sin(angular);
  const cosStep = Math.cos(angular);
  let sine = 0, cosine = 1;
  for (let i = 0; i < inputL.length; i++) {
    bandwidthL = (1 - bandwidthPole) * (inputL[i] ?? 0) + bandwidthPole * bandwidthL;
    bandwidthR = (1 - bandwidthPole) * (inputR[i] ?? 0) + bandwidthPole * bandwidthR;
    let diffuseL = bandwidthL, diffuseR = bandwidthR;
    for (const stage of diffusersL) diffuseL = stage.process(diffuseL, 0);
    for (const stage of diffusersR) diffuseR = stage.process(diffuseR, 0);
    const crossL = finalR.peek() * gainR;
    const crossR = finalL.peek() * gainL;
    const firstL = earlyL.process(diffuseL + crossL, modulation * sine);
    const firstR = earlyR.process(diffuseR + crossR, modulation * cosine);
    const delayL = longL.process(firstL);
    const delayR = longR.process(firstR);
    dampL = (1 - dampingPole) * delayL + dampingPole * dampL;
    dampR = (1 - dampingPole) * delayR + dampingPole * dampR;
    finalL.process(lateL.process(dampL, 0));
    finalR.process(lateR.process(dampR, 0));
    // Table 2's first left tap is read as 266 in the paper scan; node 48-54
    // is the right long delay here. Other node names follow that branch mapping.
    output.left[i] = 0.30 * (
      longR.tap(scale(266, fs)) + longR.tap(scale(2974, fs)) - lateR.tap(scale(1913, fs)) +
      finalR.tap(scale(1996, fs)) - longL.tap(scale(1990, fs)) - lateL.tap(scale(187, fs)) - finalL.tap(scale(1066, fs)));
    output.right[i] = 0.30 * (
      longL.tap(scale(353, fs)) + longL.tap(scale(3627, fs)) - lateL.tap(scale(1228, fs)) +
      finalL.tap(scale(2673, fs)) - longR.tap(scale(2111, fs)) - lateR.tap(scale(335, fs)) - finalR.tap(scale(121, fs)));
    const nextSine = sine * cosStep + cosine * sinStep;
    cosine = cosine * cosStep - sine * sinStep;
    sine = nextSine;
    if ((i & 4095) === 4095) {
      const magnitude = Math.hypot(sine, cosine);
      sine /= magnitude; cosine /= magnitude;
    }
  }
}
