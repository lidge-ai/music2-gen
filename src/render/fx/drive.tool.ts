import type { InsertProcessor } from "./fx.schema.ts";

// Symmetric 31-tap half-band low-pass. Its odd offsets vanish except the center.
const TAPS = new Float64Array(16);
let tapSum = 0;
for (let j = 0; j < TAPS.length; j++) {
  const offset = 2 * j - 15;
  const sinc = Math.sin(Math.PI * offset / 2) / (Math.PI * offset);
  const window = .54 - .46 * Math.cos(2 * Math.PI * (2 * j) / 30);
  TAPS[j] = sinc * window;
  tapSum += TAPS[j]!;
}
for (let j = 0; j < TAPS.length; j++) TAPS[j] = TAPS[j]! / (2 * tapSum);

/** 2x interpolation and decimation, with 15 original-frame latency. */
function driveChannel(samples: Float32Array, amount: number, toneHz: number, mix: number, rate: number): void {
  const history = new Float64Array(16);
  const even = new Float64Array(16);
  const odd = new Float64Array(16);
  const dryLine = new Float64Array(16);
  const norm = Math.tanh(amount);
  const lpGain = 1 - Math.exp(-2 * Math.PI * toneHz / rate);
  let toneState = 0;
  let pos = 0;
  for (let i = 0; i < samples.length; i++) {
    const dry = samples[i]!;
    history[pos] = dry;
    dryLine[pos] = dry;
    let upEven = 0;
    for (let j = 0; j < 16; j++) upEven += 2 * TAPS[j]! * history[(pos - j + 16) & 15]!;
    const upOdd = history[(pos - 7 + 16) & 15]!;
    even[pos] = Math.tanh(amount * upEven) / norm;
    odd[pos] = Math.tanh(amount * upOdd) / norm;
    let down = .5 * odd[(pos - 8 + 16) & 15]!;
    for (let j = 0; j < 16; j++) down += TAPS[j]! * even[(pos - j + 16) & 15]!;
    toneState += lpGain * (down - toneState);
    samples[i] = (1 - mix) * dryLine[(pos - 15 + 16) & 15]! + mix * toneState;
    pos = (pos + 1) & 15;
  }
}

export const processDrive: InsertProcessor<"drive"> = (buffer, params, ctx) => {
  if (params.mix === 0) return;
  driveChannel(buffer.left, params.amount, params.toneHz, params.mix, ctx.sampleRate);
  driveChannel(buffer.right, params.amount, params.toneHz, params.mix, ctx.sampleRate);
};
