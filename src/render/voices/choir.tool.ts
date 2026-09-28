import { mulberry32 } from "../../shared/prng.tool.ts";
import type { VoiceSpec } from "../render.schema.ts";
import { polyBlepSaw } from "./osc.tool.ts";

const TAU = 2 * Math.PI;
const RELEASE_FLOOR = Math.log(1000);
const FORMANTS = [
  [660, 1720, 2410], [530, 1840, 2480], [270, 2290, 3010],
  [570, 840, 2410], [300, 870, 2240],
] as const;
const BANDWIDTHS = [130, 180, 260] as const;

/** Three independent constant-peak biquads per ensemble copy. */
export const choirVoice: VoiceSpec = {
  id: "choir", kind: "notes", monoDefault: false,
  params: {
    vowel: { default: 0, min: 0, max: 4, integer: true },
    attackMs: { default: 300, min: 100, max: 500 },
    releaseMs: { default: 600, min: 200, max: 1000 },
    detuneCents: { default: 8, min: 4, max: 12 },
  },
  render(ctx, params) {
    const output = new Float32Array(ctx.frames);
    const rate = ctx.sampleRate;
    const attackFrames = params["attackMs"]! * rate / 1000;
    const releaseFrames = params["releaseMs"]! * rate / 1000;
    const centers = FORMANTS[params["vowel"]!]!;
    const b0 = new Float64Array(3);
    const a1 = new Float64Array(3);
    const a2 = new Float64Array(3);
    for (let band = 0; band < 3; band++) {
      if (centers[band]! >= 0.45 * rate) continue;
      const omega = TAU * centers[band]! / rate;
      const alpha = Math.sin(omega) * BANDWIDTHS[band]! / (2 * centers[band]!);
      const norm = 1 + alpha;
      b0[band] = alpha / norm;
      a1[band] = -2 * Math.cos(omega) / norm;
      a2[band] = (1 - alpha) / norm;
    }
    for (const event of ctx.events) {
      if (event.midi === null) continue;
      const f0 = 440 * 2 ** ((event.midi - 69) / 12);
      const phases = new Float64Array(3);
      const steps = new Float64Array(3);
      const x1 = new Float64Array(9);
      const x2 = new Float64Array(9);
      const y1 = new Float64Array(9);
      const y2 = new Float64Array(9);
      const random = mulberry32(event.seed);
      for (let copy = 0; copy < 3; copy++) {
        phases[copy] = random();
        steps[copy] = f0 * 2 ** ((copy - 1) * params["detuneCents"]! / 1200) / rate;
      }
      const end = Math.min(ctx.frames, event.stopFrame,
        event.startFrame + event.gateFrames + Math.ceil(2 * releaseFrames));
      for (let frame = event.startFrame; frame < end; frame++) {
        const age = frame - event.startFrame;
        let sum = 0;
        for (let copy = 0; copy < 3; copy++) {
          const phase = phases[copy]!;
          const step = steps[copy]!;
          const source = step < 0.45 ? polyBlepSaw(phase, step) : 0;
          phases[copy] = (phase + step) % 1;
          for (let band = 0; band < 3; band++) {
            if (b0[band] === 0) continue;
            const slot = copy * 3 + band;
            const value = b0[band]! * (source - x2[slot]!) -
              a1[band]! * y1[slot]! - a2[band]! * y2[slot]!;
            x2[slot] = x1[slot]!; x1[slot] = source;
            y2[slot] = y1[slot]!; y1[slot] = value;
            sum += value * (centers[band]! / 660) ** 0.65;
          }
        }
        const held = Math.min(age, event.gateFrames);
        const attack = 1 - Math.exp(-3 * (held + 1) / attackFrames);
        const release = age <= event.gateFrames ? 1 :
          Math.exp(-RELEASE_FLOOR * (age - event.gateFrames) / releaseFrames);
        if (frame >= 0) output[frame]! += 1.2 * event.velocity * sum / 3 * attack * release;
      }
    }
    // Smoothly contain resonant peaks, including coincident ensemble/formant harmonics.
    for (let frame = 0; frame < output.length; frame++) output[frame] = Math.tanh(output[frame]!);
    return output;
  },
};
