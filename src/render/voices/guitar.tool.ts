import { mulberry32 } from "../../shared/prng.tool.ts";
import type { VoiceSpec } from "../render.schema.ts";

const T60 = Math.log(1000);

export const guitarVoice: VoiceSpec = {
  id: "guitar", kind: "notes", monoDefault: false,
  params: {
    type: { default: 0, min: 0, max: 1, integer: true },
    pickPosition: { default: 0.22, min: 0.12, max: 0.35 },
    releaseMs: { default: 150, min: 50, max: 300 },
  },
  render(ctx, params) {
    const output = new Float32Array(ctx.frames);
    const rate = ctx.sampleRate;
    const steel = params["type"] === 1;
    const sustainSeconds = steel ? 4.2 : 1.8;
    const naturalDecay = Math.exp(-T60 / (sustainSeconds * rate));
    const releaseFrames = params["releaseMs"]! * rate / 1000;
    const releaseDecay = Math.exp(-T60 / releaseFrames);
    for (const event of ctx.events) {
      if (event.midi === null) continue;
      const f0 = 440 * 2 ** ((event.midi - 69) / 12);
      const period = rate / f0;
      // A two-tap loop filter costs about half a sample of phase delay.
      // Keep the allpass delay in [0.5, 1.5) for a well-conditioned coefficient.
      const delay = Math.max(2, Math.floor(period - 1));
      const fraction = period - 0.5 - delay;
      const allpassA = (1 - fraction) / (1 + fraction);
      const length = delay + 2;
      const ring = new Float64Array(length);
      const noise = new Float64Array(length);
      const rng = mulberry32(event.seed);
      for (let i = 0; i < length; i++) noise[i] = 2 * rng() - 1;
      const pickDelay = Math.max(1, Math.round(params["pickPosition"]! * period));
      const excitationGain = steel ? 0.82 : 0.45;
      let exciteLowpass = 0;
      for (let i = 0; i < length; i++) {
        const comb = (noise[i]! - noise[(i - pickDelay + length) % length]!) * 0.5;
        exciteLowpass += excitationGain * (comb - exciteLowpass);
        ring[i] = exciteLowpass;
      }
      const loopGain = steel ? 0.998 : 0.991;
      const start = Math.max(0, event.startFrame);
      const naturalFrames = Math.ceil(sustainSeconds * rate * 100 / 60);
      const end = Math.min(ctx.frames, event.stopFrame, event.startFrame + naturalFrames,
        event.startFrame + event.gateFrames + Math.ceil(releaseFrames * 100 / 60));
      let priorAllpassInput = 0;
      let priorAllpassOutput = 0;
      let amplitude = 0.62 * event.velocity;
      for (let frame = event.startFrame; frame < end; frame++) {
        const age = frame - event.startFrame;
        const index = age % length;
        const older = ring[(index + length - delay) % length]!;
        const oldest = ring[(index + length - delay - 1) % length]!;
        const lowpass = 0.5 * (older + oldest);
        const allpass = allpassA * lowpass + priorAllpassInput - allpassA * priorAllpassOutput;
        priorAllpassInput = lowpass;
        priorAllpassOutput = allpass;
        const signal = loopGain * allpass;
        ring[index] = signal;
        if (frame >= start) output[frame]! += amplitude * signal;
        amplitude *= naturalDecay * (age >= event.gateFrames ? releaseDecay : 1);
      }
    }
    return output;
  },
};
