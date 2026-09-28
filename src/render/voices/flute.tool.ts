import { mulberry32 } from "../../shared/prng.tool.ts";
import type { VoiceSpec } from "../render.schema.ts";

const TAU = 2 * Math.PI;
const RELEASE_FLOOR = Math.log(1000);

export const fluteVoice: VoiceSpec = {
  id: "flute", kind: "notes", monoDefault: false,
  params: {
    breath: { default: 0.1, min: 0.03, max: 0.15 },
    attackMs: { default: 80, min: 40, max: 200 },
    releaseMs: { default: 180, min: 80, max: 300 },
    vibratoCents: { default: 16, min: 8, max: 25 },
  },
  render(ctx, params) {
    const output = new Float32Array(ctx.frames);
    const rate = ctx.sampleRate;
    const attackFrames = params["attackMs"]! * rate / 1000;
    const releaseFrames = params["releaseMs"]! * rate / 1000;
    const vibratoDelay = Math.round(0.18 * rate);
    for (const event of ctx.events) {
      if (event.midi === null) continue;
      const f0 = 440 * 2 ** ((event.midi - 69) / 12);
      const random = mulberry32(event.seed);
      let phase = 0;
      let priorNoise = 0;
      let airy = 0;
      const noiseGain = 1 - Math.exp(-TAU * 4000 / rate);
      const end = Math.min(ctx.frames, event.stopFrame,
        event.startFrame + event.gateFrames + Math.ceil(2 * releaseFrames));
      for (let frame = event.startFrame; frame < end; frame++) {
        const age = frame - event.startFrame;
        const vibratoAge = age - vibratoDelay;
        const depth = vibratoAge > 0 ?
          (1 - Math.exp(-vibratoAge / (0.07 * rate))) * params["vibratoCents"]! : 0;
        const cents = depth * Math.sin(TAU * 5.2 * vibratoAge / rate);
        phase += TAU * f0 * 2 ** (cents / 1200) / rate;
        if (phase >= TAU) phase %= TAU;
        const white = 2 * random() - 1;
        const high = white - priorNoise;
        priorNoise = white;
        airy += noiseGain * (high - airy);
        const chiff = Math.exp(-age / (0.025 * rate));
        const harmonic = 2 * f0 < 0.45 * rate ? 0.13 * Math.sin(2 * phase + 0.2) : 0;
        const tone = Math.sin(phase) + harmonic +
          params["breath"]! * (0.12 + 2 * chiff) * airy;
        const held = Math.min(age, event.gateFrames);
        const attack = 1 - Math.exp(-3 * (held + 1) / attackFrames);
        const release = age <= event.gateFrames ? 1 :
          Math.exp(-RELEASE_FLOOR * (age - event.gateFrames) / releaseFrames);
        if (frame >= 0) output[frame]! += 0.25 * event.velocity * tone * attack * release;
      }
    }
    return output;
  },
};
