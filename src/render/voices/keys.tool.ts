import type { VoiceSpec } from "../render.schema.ts";

const TAU = 2 * Math.PI;

export const keysVoice: VoiceSpec = {
  id: "keys", kind: "notes", monoDefault: false,
  params: {
    ratio: { default: 2, min: 1, max: 8 },
    index: { default: 1.4, min: 0, max: 8 },
    attackMs: { default: 8, min: 0, max: 200 },
    releaseMs: { default: 220, min: 20, max: 2000 },
  },
  render(ctx, params) {
    const output = new Float32Array(ctx.frames);
    const attackFrames = params["attackMs"]! * ctx.sampleRate / 1000;
    const releaseFrames = params["releaseMs"]! * ctx.sampleRate / 1000;
    for (const event of ctx.events) {
      if (event.midi === null) continue;
      const start = Math.max(0, event.startFrame);
      const end = Math.min(ctx.frames, event.stopFrame);
      const step = TAU * 440 * 2 ** ((event.midi - 69) / 12) / ctx.sampleRate;
      const modStep = step * params["ratio"]!;
      let carrierPhase = step * (start - event.startFrame);
      let modulatorPhase = modStep * (start - event.startFrame);
      for (let frame = start; frame < end; frame++) {
        const age = frame - event.startFrame;
        const attack = attackFrames === 0 ? 1 : Math.min(1, (age + 1) / attackFrames);
        const release = age < event.gateFrames ? 1 : Math.exp(-6.9 * (age - event.gateFrames) / releaseFrames);
        const index = params["index"]! * event.velocity * (0.35 + 0.65 * Math.exp(-age / (0.15 * ctx.sampleRate)));
        output[frame]! += 0.43 * event.velocity * attack * release * Math.sin(carrierPhase + index * Math.sin(modulatorPhase));
        carrierPhase += step;
        modulatorPhase += modStep;
      }
    }
    return output;
  },
};
