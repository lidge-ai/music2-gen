import type { VoiceSpec } from "../render.schema.ts";
import { FilterEnvelope, hasNewSynthParams, UnisonOscillator, VoiceLowpass } from "./osc.tool.ts";

const TAU = 2 * Math.PI;

export const leadVoice: VoiceSpec = {
  id: "lead", kind: "notes", monoDefault: false,
  params: {
    wave: { default: 1, min: 0, max: 1, integer: true },
    vibratoHz: { default: 5, min: 0, max: 12 },
    vibratoCents: { default: 12, min: 0, max: 100 },
    releaseMs: { default: 120, min: 5, max: 2000 },
    unison: { default: 1, min: 1, max: 9, integer: true },
    detuneCents: { default: 0, min: 0, max: 50 },
    filterEnvAmount: { default: 0, min: 0, max: 1 },
    filterEnvDecayMs: { default: 500, min: 20, max: 5000 },
  },
  render(ctx, params) {
    if (hasNewSynthParams(ctx.track.params)) return renderEnhancedLead(ctx, params);
    const output = new Float32Array(ctx.frames);
    const releaseFrames = params["releaseMs"]! * ctx.sampleRate / 1000;
    const onsetFrames = 0.08 * ctx.sampleRate;
    const attackFrames = 0.005 * ctx.sampleRate;
    for (let eventIndex = 0; eventIndex < ctx.events.length; eventIndex++) {
      const event = ctx.events[eventIndex]!;
      if (event.midi === null) continue;
      const vibratoCents = event.params?.["vibratoCents"] ?? params["vibratoCents"]!;
      const next = ctx.track.mono ? ctx.events[eventIndex + 1] : undefined;
      const end = Math.min(ctx.frames, event.stopFrame, next?.startFrame ?? ctx.frames);
      const start = Math.max(0, event.startFrame);
      const frequency = 440 * 2 ** ((event.midi - 69) / 12);
      let phase = 0;
      for (let frame = event.startFrame; frame < end; frame++) {
        const age = frame - event.startFrame;
        const vibratoAge = Math.max(0, age - onsetFrames) / ctx.sampleRate;
        const vibrato = age < onsetFrames ? 0 : vibratoCents * Math.sin(TAU * params["vibratoHz"]! * vibratoAge);
        phase += frequency * 2 ** (vibrato / 1200) / ctx.sampleRate;
        phase -= Math.floor(phase);
        if (frame < start) continue;
        const attack = Math.min(1, (age + 1) / attackFrames);
        const release = age < event.gateFrames ? 1 : Math.exp(-6.9 * (age - event.gateFrames) / releaseFrames);
        const wave = params["wave"] === 0 ? 2 * phase - 1 : (phase < 0.5 ? 1 : -1);
        output[frame]! += 0.42 * event.velocity * attack * release * wave;
      }
    }
    return output;
  },
};

function renderEnhancedLead(ctx: Parameters<VoiceSpec["render"]>[0], params: Readonly<Record<string, number>>): Float32Array {
  const output = new Float32Array(ctx.frames);
  const rate = ctx.sampleRate;
  const releaseFrames = params["releaseMs"]! * rate / 1000;
  const onsetFrames = 0.08 * rate;
  const decayFrames = params["filterEnvDecayMs"]! * rate / 1000;
  for (let index = 0; index < ctx.events.length; index++) {
    const event = ctx.events[index]!;
    if (event.midi === null) continue;
    const vibratoCents = event.params?.["vibratoCents"] ?? params["vibratoCents"]!;
    const next = ctx.track.mono ? ctx.events[index + 1] : undefined;
    const end = Math.min(ctx.frames, event.stopFrame, next?.startFrame ?? ctx.frames);
    const oscillator = new UnisonOscillator(params["unison"]!, params["detuneCents"]!, event.seed);
    const filter = new VoiceLowpass(0);
    const filterEnvelope = new FilterEnvelope(12000, params["filterEnvAmount"]!, decayFrames, rate);
    const frequency = 440 * 2 ** ((event.midi - 69) / 12);
    for (let frame = event.startFrame; frame < end; frame++) {
      const age = frame - event.startFrame;
      const vibratoAge = Math.max(0, age - onsetFrames) / rate;
      const vibrato = age < onsetFrames ? 0 : vibratoCents * Math.sin(TAU * params["vibratoHz"]! * vibratoAge);
      const raw = oscillator.sample(frequency * 2 ** (vibrato / 1200), rate, params["wave"] === 1);
      if (frame < 0) continue;
      const g = filterEnvelope.value(age);
      const attack = Math.min(1, (age + 1) / (0.005 * rate));
      const release = age < event.gateFrames ? 1 : Math.exp(-6.9 * (age - event.gateFrames) / releaseFrames);
      output[frame]! += 0.42 * event.velocity * attack * release * filter.process(raw, g);
    }
  }
  return output;
}
