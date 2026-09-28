import type { VoiceSpec } from "../render.schema.ts";
import { polyBlepSaw, VoiceLowpass } from "./osc.tool.ts";

const RELEASE_FLOOR = Math.log(1000);

export const brassVoice: VoiceSpec = {
  id: "brass", kind: "notes", monoDefault: false,
  params: {
    cutoffHz: { default: 600, min: 350, max: 1000 },
    peakHz: { default: 4000, min: 2000, max: 8000 },
    q: { default: 1, min: 0.6, max: 2 },
    scoopCents: { default: 35, min: 10, max: 70 },
    releaseMs: { default: 250, min: 100, max: 400 },
  },
  render(ctx, params) {
    const output = new Float32Array(ctx.frames);
    const rate = ctx.sampleRate;
    const releaseFrames = params["releaseMs"]! * rate / 1000;
    for (const event of ctx.events) {
      if (event.midi === null) continue;
      const f0 = 440 * 2 ** ((event.midi - 69) / 12);
      const filter = new VoiceLowpass((params["q"]! - 0.6) / 1.4 * 0.28);
      const peak = Math.min(0.45 * rate, params["cutoffHz"]! +
        (params["peakHz"]! - params["cutoffHz"]!) * (0.25 + 0.75 * event.velocity));
      const end = Math.min(ctx.frames, event.stopFrame,
        event.startFrame + event.gateFrames + Math.ceil(2 * releaseFrames));
      let phase = 0;
      let g = 0;
      let nextG = 0;
      for (let frame = event.startFrame; frame < end; frame++) {
        const age = frame - event.startFrame;
        const scoop = params["scoopCents"]! * Math.exp(-age / (0.05 * rate));
        const step = f0 * 2 ** (-scoop / 1200) / rate;
        const raw = step < 0.45 ? polyBlepSaw(phase, step) : 0;
        phase = (phase + step) % 1;
        if ((age & 63) === 0) {
          g = nextG;
          const at = age + 64;
          const attack = 1 - Math.exp(-at / (0.055 * rate));
          const decay = 0.72 + 0.28 * Math.exp(-at / (0.22 * rate));
          const cutoff = Math.min(0.45 * rate,
            params["cutoffHz"]! + (peak - params["cutoffHz"]!) * attack * decay);
          nextG = Math.tan(Math.PI * cutoff / rate);
          if (age === 0) g = Math.tan(Math.PI * params["cutoffHz"]! / rate);
        }
        const cutoffG = g + (nextG - g) * (age & 63) / 64;
        const held = Math.min(age, event.gateFrames);
        const amplitude = (1 - Math.exp(-3 * (held + 1) / (0.065 * rate))) *
          (0.82 + 0.18 * Math.exp(-held / (0.2 * rate)));
        const release = age <= event.gateFrames ? 1 :
          Math.exp(-RELEASE_FLOOR * (age - event.gateFrames) / releaseFrames);
        if (frame >= 0) output[frame]! += 0.29 * event.velocity * amplitude * release *
          filter.process(raw, cutoffG);
      }
    }
    return output;
  },
};
