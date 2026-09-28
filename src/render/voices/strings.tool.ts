import { mulberry32 } from "../../shared/prng.tool.ts";
import type { VoiceSpec } from "../render.schema.ts";
import { polyBlepSaw } from "./osc.tool.ts";

const TAU = 2 * Math.PI;
const RELEASE_FLOOR = Math.log(1000);

export const stringsVoice: VoiceSpec = {
  id: "strings", kind: "notes", monoDefault: false,
  params: {
    detuneCents: { default: 7, min: 3, max: 12 },
    attackMs: { default: 300, min: 120, max: 800 },
    releaseMs: { default: 700, min: 200, max: 1500 },
    chorusMix: { default: 0.2, min: 0, max: 0.35 },
  },
  render(ctx, params) {
    const output = new Float32Array(ctx.frames);
    const rate = ctx.sampleRate;
    const attackFrames = params["attackMs"]! * rate / 1000;
    const releaseFrames = params["releaseMs"]! * rate / 1000;
    const mix = params["chorusMix"]!;
    for (const event of ctx.events) {
      if (event.midi === null) continue;
      const f0 = 440 * 2 ** ((event.midi - 69) / 12);
      const phases = new Float64Array(5);
      const steps = new Float64Array(5);
      const random = mulberry32(event.seed);
      for (let voice = 0; voice < 5; voice++) {
        phases[voice] = 0.13 + voice * 0.02 + (random() - 0.5) * 0.02;
        steps[voice] = f0 * 2 ** ((voice - 2) * params["detuneCents"]! / 2400) / rate;
      }
      const cutoff = Math.min(0.45 * rate, 1800 * (0.7 + 0.6 * event.velocity));
      const lpGain = 1 - Math.exp(-TAU * cutoff / rate);
      const chorus = mix > 0 ? new Float32Array(Math.ceil(0.025 * rate)) : null;
      let filtered = 0;
      const end = Math.min(ctx.frames, event.stopFrame,
        event.startFrame + event.gateFrames + Math.ceil(2 * releaseFrames));
      for (let frame = event.startFrame; frame < end; frame++) {
        const age = frame - event.startFrame;
        let raw = 0;
        for (let voice = 0; voice < 5; voice++) {
          const phase = phases[voice]!;
          const step = steps[voice]!;
          if (step < 0.45) raw += polyBlepSaw(phase, step) / 5;
          phases[voice] = (phase + step) % 1;
        }
        filtered += lpGain * (raw - filtered);
        let signal = filtered;
        if (chorus) {
          const write = age % chorus.length;
          const delay = Math.round((0.018 + 0.003 * Math.sin(TAU * 0.53 * age / rate)) * rate);
          const read = (write - delay + chorus.length) % chorus.length;
          signal = (1 - mix) * filtered + mix * chorus[read]!;
          chorus[write] = filtered;
        }
        const held = Math.min(age, event.gateFrames);
        const attack = 1 - Math.exp(-3 * (held + 1) / attackFrames);
        const release = age <= event.gateFrames ? 1 :
          Math.exp(-RELEASE_FLOOR * (age - event.gateFrames) / releaseFrames);
        if (frame >= 0) output[frame]! += 0.92 * event.velocity * signal * attack * release;
      }
    }
    return output;
  },
};
