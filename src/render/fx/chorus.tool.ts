import type { InsertProcessor } from "./fx.schema.ts";
import { DelayLine } from "./delayline.tool.ts";

/** Two independently modulated fractional taps, with the right LFO in quadrature. */
export const processChorus: InsertProcessor<"chorus"> = (buffer, params, ctx) => {
  const { rateHz, depthMs, baseMs, feedback, mix } = params;
  if (mix === 0) return;
  const rate = ctx.sampleRate;
  const leftLine = new DelayLine(rate * (baseMs + depthMs) / 1000 + 1);
  const rightLine = new DelayLine(rate * (baseMs + depthMs) / 1000 + 1);
  const base = rate * baseMs / 1000;
  const depth = rate * depthMs / 1000;
  const phaseStep = 2 * Math.PI * rateHz / rate;
  let phase = 0;
  for (let i = 0; i < buffer.left.length; i++) {
    const dryL = buffer.left[i]!;
    const dryR = buffer.right[i]!;
    const wetL = leftLine.read(base + depth * Math.sin(phase));
    const wetR = rightLine.read(base + depth * Math.cos(phase));
    leftLine.write(dryL + feedback * wetL);
    rightLine.write(dryR + feedback * wetR);
    buffer.left[i] = dryL * (1 - mix) + wetL * mix;
    buffer.right[i] = dryR * (1 - mix) + wetR * mix;
    phase += phaseStep;
    if (phase >= 2 * Math.PI) phase -= 2 * Math.PI;
  }
};
