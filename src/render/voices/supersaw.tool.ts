import type { VoiceSpec } from "../render.schema.ts";
import { FilterEnvelope, UnisonOscillator, VoiceLowpass } from "./osc.tool.ts";

export const supersawVoice: VoiceSpec = {
  id: "supersaw", kind: "notes", monoDefault: false,
  params: {
    unison: { default: 7, min: 1, max: 9, integer: true },
    detuneCents: { default: 18, min: 0, max: 50 },
    mix: { default: 0.75, min: 0, max: 1 },
    cutoffHz: { default: 3500, min: 80, max: 12000 },
    resonance: { default: 0.2, min: 0, max: 0.9 },
    filterEnvAmount: { default: 0.5, min: 0, max: 1 },
    filterEnvDecayMs: { default: 500, min: 20, max: 5000 },
    attackMs: { default: 20, min: 0, max: 5000 },
    releaseMs: { default: 250, min: 5, max: 5000 },
  },
  render(ctx, params) {
    const output = new Float32Array(ctx.frames);
    const rate = ctx.sampleRate;
    const attackFrames = params["attackMs"]! * rate / 1000;
    const releaseFrames = params["releaseMs"]! * rate / 1000;
    const decayFrames = params["filterEnvDecayMs"]! * rate / 1000;
    for (let index = 0; index < ctx.events.length; index++) {
      const event = ctx.events[index]!;
      if (event.midi === null) continue;
      const next = ctx.track.mono ? ctx.events[index + 1] : undefined;
      const end = Math.min(ctx.frames, event.stopFrame, next?.startFrame ?? ctx.frames);
      const frequency = 440 * 2 ** ((event.midi - 69) / 12);
      const oscillator = new UnisonOscillator(params["unison"]!, params["detuneCents"]!, event.seed);
      const filter = new VoiceLowpass(params["resonance"]!);
      const filterEnvelope = new FilterEnvelope(params["cutoffHz"]!, params["filterEnvAmount"]!, decayFrames, rate);
      for (let frame = Math.max(0, event.startFrame); frame < end; frame++) {
        const age = frame - event.startFrame;
        const raw = oscillator.sample(frequency, rate, false, params["mix"]);
        const g = filterEnvelope.value(age);
        const amp = attackFrames === 0 ? 1 : Math.min(1, (age + 1) / attackFrames);
        const release = age < event.gateFrames ? 1 : Math.exp(-6.9 * (age - event.gateFrames) / releaseFrames);
        output[frame]! += 0.55 * event.velocity * amp * release * filter.process(raw, g);
      }
    }
    return output;
  },
};
