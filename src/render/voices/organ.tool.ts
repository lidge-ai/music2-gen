import { mulberry32 } from "../../shared/prng.tool.ts";
import type { VoiceSpec } from "../render.schema.ts";

const TAU = 2 * Math.PI;
const T60 = Math.log(1000);
const DRAWBARS = [
  ["d16", 0.5], ["d513", 1.5], ["d8", 1], ["d4", 2], ["d223", 3],
  ["d2", 4], ["d135", 5], ["d113", 6], ["d1", 8],
] as const;

export const organVoice: VoiceSpec = {
  id: "organ", kind: "notes", monoDefault: false,
  params: {
    d16: { default: 8, min: 0, max: 8, integer: true },
    d513: { default: 8, min: 0, max: 8, integer: true },
    d8: { default: 8, min: 0, max: 8, integer: true },
    d4: { default: 0, min: 0, max: 8, integer: true },
    d223: { default: 0, min: 0, max: 8, integer: true },
    d2: { default: 0, min: 0, max: 8, integer: true },
    d135: { default: 0, min: 0, max: 8, integer: true },
    d113: { default: 0, min: 0, max: 8, integer: true },
    d1: { default: 0, min: 0, max: 8, integer: true },
    releaseMs: { default: 80, min: 30, max: 150 },
  },
  render(ctx, params) {
    const output = new Float32Array(ctx.frames);
    const rate = ctx.sampleRate;
    const releaseFrames = params["releaseMs"]! * rate / 1000;
    const releaseFactor = Math.exp(-T60 * 100 / 60 / releaseFrames);
    const attackFrames = Math.max(1, 0.002 * rate);
    const clickFrames = Math.max(1, Math.round(0.003 * rate));
    for (const event of ctx.events) {
      if (event.midi === null || event.velocity <= 0) continue;
      const frequency = 440 * 2 ** ((event.midi - 69) / 12);
      const sineSteps: number[] = [];
      const cosineSteps: number[] = [];
      const gains: number[] = [];
      let total = 0;
      for (const [name, ratio] of DRAWBARS) {
        const gain = params[name]! / 8;
        if (gain === 0 || ratio * frequency >= 0.45 * rate) continue;
        const step = TAU * ratio * frequency / rate;
        sineSteps.push(Math.sin(step));
        cosineSteps.push(Math.cos(step));
        gains.push(gain);
        total += gain;
      }
      const sines = new Float64Array(gains.length);
      const cosines = new Float64Array(gains.length).fill(1);
      const norm = total === 0 ? 0 : 0.22 / Math.max(1, Math.sqrt(total));
      const random = mulberry32(event.seed);
      let previousNoise = 0;
      let release = 1;
      const start = Math.max(0, event.startFrame);
      const end = Math.min(ctx.frames, event.stopFrame,
        event.startFrame + event.gateFrames + Math.ceil(releaseFrames));
      for (let frame = event.startFrame; frame < end; frame++) {
        const age = frame - event.startFrame;
        let tone = 0;
        for (let i = 0; i < gains.length; i++) {
          tone += gains[i]! * sines[i]!;
          const sine = sines[i]! * cosineSteps[i]! + cosines[i]! * sineSteps[i]!;
          cosines[i] = cosines[i]! * cosineSteps[i]! - sines[i]! * sineSteps[i]!;
          sines[i] = sine;
        }
        if (age > event.gateFrames) release *= releaseFactor;
        let click = 0;
        if (age < clickFrames) {
          const noise = random() * 2 - 1;
          click = 0.02 * event.velocity * (noise - previousNoise) * (1 - age / clickFrames);
          previousNoise = noise;
        }
        if (frame >= start) output[frame]! += event.velocity * norm *
          Math.min(1, (age + 1) / attackFrames) * release * tone + click;
      }
    }
    return output;
  },
};
