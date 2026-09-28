import type { InsertProcessor } from "./fx.schema.ts";

/** Cascaded first-order allpasses with stereo quadrature sweep. */
export const processPhaser: InsertProcessor<"phaser"> = (buffer, params, ctx) => {
  const { rateHz, depth, stages, feedback, mix } = params;
  if (mix === 0) return;
  const rate = ctx.sampleRate;
  const count = Math.max(2, Math.min(12, 2 * Math.ceil(stages / 2)));
  const xL = new Float64Array(count);
  const xR = new Float64Array(count);
  const yL = new Float64Array(count);
  const yR = new Float64Array(count);
  const phaseStep = 2 * Math.PI * rateHz / rate;
  let phase = 0;
  let previousL = 0;
  let previousR = 0;
  let coefficientL = 0;
  let coefficientR = 0;
  const maxHz = Math.min(4000, rate * 0.45);
  for (let i = 0; i < buffer.left.length; i++) {
    // A short coefficient block avoids a tan and two trig calls at every stage/sample.
    if ((i & 31) === 0) {
      const sweepL = 0.5 + 0.5 * Math.sin(phase);
      const sweepR = 0.5 + 0.5 * Math.cos(phase);
      const frequencyL = 1000 * Math.pow(maxHz / 1000, depth * (sweepL - 0.5) * 2);
      const frequencyR = 1000 * Math.pow(maxHz / 1000, depth * (sweepR - 0.5) * 2);
      const tangentL = Math.tan(Math.PI * Math.max(20, Math.min(frequencyL, maxHz)) / rate);
      const tangentR = Math.tan(Math.PI * Math.max(20, Math.min(frequencyR, maxHz)) / rate);
      coefficientL = (1 - tangentL) / (1 + tangentL);
      coefficientR = (1 - tangentR) / (1 + tangentR);
    }
    const dryL = buffer.left[i]!;
    const dryR = buffer.right[i]!;
    let wetL = dryL + feedback * previousL;
    let wetR = dryR + feedback * previousR;
    for (let stage = 0; stage < count; stage++) {
      const nextL = -coefficientL * wetL + xL[stage]! + coefficientL * yL[stage]!;
      const nextR = -coefficientR * wetR + xR[stage]! + coefficientR * yR[stage]!;
      xL[stage] = wetL;
      xR[stage] = wetR;
      yL[stage] = nextL;
      yR[stage] = nextR;
      wetL = nextL;
      wetR = nextR;
    }
    previousL = wetL;
    previousR = wetR;
    buffer.left[i] = dryL * (1 - mix) + wetL * mix;
    buffer.right[i] = dryR * (1 - mix) + wetR * mix;
    phase += phaseStep;
    if (phase >= 2 * Math.PI) phase -= 2 * Math.PI;
  }
};
