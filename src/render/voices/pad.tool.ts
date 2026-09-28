import type { VoiceSpec } from "../render.schema.ts";
import { FilterEnvelope, hasNewSynthParams, UnisonOscillator, VoiceLowpass } from "./osc.tool.ts";

const TAU = 2 * Math.PI;

export const padVoice: VoiceSpec = {
  id: "pad", kind: "notes", monoDefault: false,
  automatable: ["cutoffHz"],
  params: {
    detuneCents: { default: 11, min: 0, max: 50 },
    cutoffHz: { default: 1800, min: 80, max: 12000 },
    attackMs: { default: 400, min: 10, max: 5000 },
    releaseMs: { default: 700, min: 20, max: 5000 },
    unison: { default: 3, min: 1, max: 9, integer: true },
    filterEnvAmount: { default: 0, min: 0, max: 1 },
    filterEnvDecayMs: { default: 500, min: 20, max: 5000 },
  },
  render(ctx, params) {
    if (hasNewSynthParams(ctx.track.params, true)) return renderEnhancedPad(ctx, params);
    const output = new Float32Array(ctx.frames);
    const attackFrames = params["attackMs"]! * ctx.sampleRate / 1000;
    const releaseFrames = params["releaseMs"]! * ctx.sampleRate / 1000;
    const filterGain = 1 - Math.exp(-TAU * params["cutoffHz"]! / ctx.sampleRate);
    const detune = 2 ** (params["detuneCents"]! / 1200);
    for (const event of ctx.events) {
      if (event.midi === null) continue;
      const eventFilterGain = event.params?.["cutoffHz"] === undefined ? filterGain :
        1 - Math.exp(-TAU * event.params["cutoffHz"] / ctx.sampleRate);
      const start = Math.max(0, event.startFrame);
      const end = Math.min(ctx.frames, event.stopFrame);
      const frequency = 440 * 2 ** ((event.midi - 69) / 12);
      const lowStep = frequency / detune / ctx.sampleRate;
      const midStep = frequency / ctx.sampleRate;
      const highStep = frequency * detune / ctx.sampleRate;
      let low = lowStep * (start - event.startFrame) + 0.13;
      let mid = midStep * (start - event.startFrame) + 0.47;
      let high = highStep * (start - event.startFrame) + 0.81;
      let filtered = 0;
      for (let frame = start; frame < end; frame++) {
        const age = frame - event.startFrame;
        const raw = (2 * (low - Math.floor(low)) + 2 * (mid - Math.floor(mid)) + 2 * (high - Math.floor(high)) - 3) / 3;
        filtered += eventFilterGain * (raw - filtered);
        const attack = 1 - Math.exp(-3 * (age + 1) / attackFrames);
        const release = age < event.gateFrames ? 1 : Math.exp(-6.9 * (age - event.gateFrames) / releaseFrames);
        output[frame]! += 0.55 * event.velocity * filtered * attack * release;
        low += lowStep; mid += midStep; high += highStep;
      }
    }
    return output;
  },
};

function renderEnhancedPad(ctx: Parameters<VoiceSpec["render"]>[0], params: Readonly<Record<string, number>>): Float32Array {
  const output = new Float32Array(ctx.frames);
  const rate = ctx.sampleRate;
  const attackFrames = params["attackMs"]! * rate / 1000;
  const releaseFrames = params["releaseMs"]! * rate / 1000;
  const decayFrames = params["filterEnvDecayMs"]! * rate / 1000;
  for (const event of ctx.events) {
    if (event.midi === null) continue;
    const frequency = 440 * 2 ** ((event.midi - 69) / 12);
    const oscillator = new UnisonOscillator(params["unison"]!, params["detuneCents"]!, event.seed);
    const filter = new VoiceLowpass(0);
    const filterEnvelope = new FilterEnvelope(event.params?.["cutoffHz"] ?? params["cutoffHz"]!, params["filterEnvAmount"]!, decayFrames, rate);
    const end = Math.min(ctx.frames, event.stopFrame);
    for (let frame = Math.max(0, event.startFrame); frame < end; frame++) {
      const age = frame - event.startFrame;
      const raw = oscillator.sample(frequency, rate);
      const g = filterEnvelope.value(age);
      const attack = 1 - Math.exp(-3 * (age + 1) / attackFrames);
      const release = age < event.gateFrames ? 1 : Math.exp(-6.9 * (age - event.gateFrames) / releaseFrames);
      output[frame]! += 0.55 * event.velocity * filter.process(raw, g) * attack * release;
    }
  }
  return output;
}
