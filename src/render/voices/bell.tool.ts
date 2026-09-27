import type { VoiceSpec } from "../render.schema.ts";

const TAU = 2 * Math.PI;

export const bellVoice: VoiceSpec = {
  id: "bell", kind: "notes", monoDefault: false,
  params: {
    ratio: { default: 3.5, min: 1, max: 12 },
    index: { default: 2.2, min: 0, max: 10 },
    decayMs: { default: 450, min: 50, max: 5000 },
  },
  render(ctx, params) {
    const output = new Float32Array(ctx.frames);
    const decayFrames = params["decayMs"]! * ctx.sampleRate / 1000;
    for (const event of ctx.events) {
      if (event.midi === null) continue;
      const start = Math.max(0, event.startFrame);
      const end = Math.min(ctx.frames, event.stopFrame);
      const frequency = 440 * 2 ** ((event.midi - 69) / 12);
      const carrierStep = TAU * frequency / ctx.sampleRate;
      const modulatorStep = carrierStep * params["ratio"]!;
      let carrierPhase = carrierStep * (start - event.startFrame);
      let modulatorPhase = modulatorStep * (start - event.startFrame);
      for (let frame = start; frame < end; frame++) {
        const age = frame - event.startFrame;
        const natural = Math.exp(-4.6 * age / decayFrames);
        const gate = age <= event.gateFrames ? 1 : Math.exp(-6.9 * (age - event.gateFrames) / (0.12 * ctx.sampleRate));
        const index = params["index"]! * Math.exp(-7 * age / decayFrames);
        output[frame]! += 0.48 * event.velocity * natural * gate * Math.sin(carrierPhase + index * Math.sin(modulatorPhase));
        carrierPhase += carrierStep;
        modulatorPhase += modulatorStep;
      }
    }
    return output;
  },
};
