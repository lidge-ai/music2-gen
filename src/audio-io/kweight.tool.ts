import { Music2Error } from "../shared/index.ts";
import type { StereoBuffer } from "./buffer.schema.ts";

type Biquad = readonly [number, number, number, number, number];

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

/** Continuous K-weighted channel power, with complete and final partial 100 ms block sums. */
export function kWeightedPower(pcm: StereoBuffer, visit?: (frame: number, power: number) => void): Float64Array {
  const { sampleRate, left, right, sourceChannels } = pcm;
  if (!Number.isInteger(sampleRate) || sampleRate < 8000 || sampleRate > 192000 ||
      !(left instanceof Float32Array) || !(right instanceof Float32Array) || left.length !== right.length ||
      (sourceChannels !== 1 && sourceChannels !== 2)) {
    throw new Music2Error("E_INPUT", "invalid PCM for loudness measurement");
  }
  const [shelf, highPass] = kWeighting(sampleRate);
  const leftShelf = new Filter(shelf); const leftHigh = new Filter(highPass);
  const rightShelf = new Filter(shelf); const rightHigh = new Filter(highPass);
  const blockSize = Math.round(.1 * sampleRate);
  const blocks = new Float64Array(Math.ceil(left.length / blockSize));
  for (let frame = 0; frame < left.length; frame++) {
    const l = left[frame]!;
    const r = right[frame]!;
    if (!Number.isFinite(l) || !Number.isFinite(r)) {
      throw new Music2Error("E_INPUT", "nonfinite audio sample", { details: { frame } });
    }
    const filteredLeft = leftHigh.process(leftShelf.process(l));
    let power = filteredLeft * filteredLeft;
    if (sourceChannels === 2) {
      const filteredRight = rightHigh.process(rightShelf.process(r));
      power += filteredRight * filteredRight;
    }
    visit?.(frame, power);
    const block = Math.floor(frame / blockSize);
    blocks[block] = blocks[block]! + power;
  }
  return blocks;
}
