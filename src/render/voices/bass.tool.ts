import { Music2Error } from "../../shared/index.ts";
import type { VoiceContext, VoiceEvent, VoiceSpec } from "../render.schema.ts";
import { FilterEnvelope, hasNewSynthParams, UnisonOscillator, VoiceLowpass } from "./osc.tool.ts";

function frequency(ctx: VoiceContext, event: VoiceEvent): number {
  const midi = event.midi;
  if (midi === null || !Number.isFinite(midi) || midi < 0 || midi > 127) {
    throw new Music2Error("E_SCHEMA", `invalid MIDI on track ${ctx.track.id}`, {
      details: { issues: [{ path: `tracks.${ctx.track.id}.pattern`, message: "MIDI must be 0..127" }] },
    });
  }
  return 440 * 2 ** ((midi - 69) / 12);
}

function renderMono(ctx: VoiceContext, wave: number, cutoffHz: number,
  resonance: number, releaseMs: number): Float32Array {
  const out = new Float32Array(ctx.frames);
  const rate = ctx.sampleRate;
  const alpha = 1 - Math.exp(-2 * Math.PI * cutoffHz / rate);
  const releaseFrames = Math.max(1, releaseMs * rate / 1000);
  const glideFrames = ctx.track.glide * rate / 1000;
  let phase = 0;
  let filtered = 0;
  let previousHz: number | null = null;
  for (let eventIndex = 0; eventIndex < ctx.events.length; eventIndex++) {
    const event = ctx.events[eventIndex]!;
    const eventAlpha = event.params?.["cutoffHz"] === undefined ? alpha :
      1 - Math.exp(-2 * Math.PI * event.params["cutoffHz"] / rate);
    const next = ctx.events[eventIndex + 1];
    if (next?.startFrame === event.startFrame) continue;
    const targetHz = frequency(ctx, event);
    const fromHz = previousHz ?? targetHz;
    const end = Math.min(ctx.frames, event.stopFrame, next?.startFrame ?? ctx.frames);
    for (let frame = Math.max(0, event.startFrame); frame < end; frame++) {
      const offset = frame - event.startFrame;
      const hz = glideFrames > 0 ?
        targetHz + (fromHz - targetHz) * Math.exp(-offset / glideFrames) : targetHz;
      phase += hz / rate;
      if (phase >= 1) phase %= 1;
      const oscillator = wave === 0 ? 2 * phase - 1 : phase < .5 ? 1 : -1;
      // The bounded feedback cannot drive the one-pole state outside a finite range.
      const feedback = Math.max(-.9, Math.min(.9, filtered * resonance));
      filtered += eventAlpha * (oscillator - feedback - filtered);
      const attack = Math.min(1, (offset + 1) / (rate * .003));
      const release = offset < event.gateFrames ? 1 :
        Math.exp(-6.907755 * (offset - event.gateFrames) / releaseFrames);
      out[frame] = filtered * attack * release * event.velocity;
    }
    previousHz = targetHz;
  }
  return out;
}

function renderEnhancedBass(ctx: VoiceContext, params: Readonly<Record<string, number>>): Float32Array {
  const out = new Float32Array(ctx.frames);
  const rate = ctx.sampleRate;
  const releaseFrames = Math.max(1, params["releaseMs"]! * rate / 1000);
  const decayFrames = params["filterEnvDecayMs"]! * rate / 1000;
  const glideFrames = ctx.track.glide * rate / 1000;
  let previousHz: number | null = null;
  let oscillator: UnisonOscillator | null = null;
  const filter = new VoiceLowpass(params["resonance"]!);
  for (let index = 0; index < ctx.events.length; index++) {
    const event = ctx.events[index]!;
    const next = ctx.events[index + 1];
    if (next?.startFrame === event.startFrame) continue;
    const targetHz = frequency(ctx, event);
    const fromHz = previousHz ?? targetHz;
    const end = Math.min(ctx.frames, event.stopFrame, next?.startFrame ?? ctx.frames);
    oscillator ??= new UnisonOscillator(params["unison"]!, params["detuneCents"]!, event.seed);
    const filterEnvelope = new FilterEnvelope(event.params?.["cutoffHz"] ?? params["cutoffHz"]!, params["filterEnvAmount"]!, decayFrames, rate);
    for (let frame = Math.max(0, event.startFrame); frame < end; frame++) {
      const age = frame - event.startFrame;
      const hz = glideFrames > 0 ? targetHz + (fromHz - targetHz) * Math.exp(-age / glideFrames) : targetHz;
      const raw = oscillator.sample(hz, rate, params["wave"] === 1);
      const g = filterEnvelope.value(age);
      const attack = Math.min(1, (age + 1) / (rate * .003));
      const release = age < event.gateFrames ? 1 : Math.exp(-6.907755 * (age - event.gateFrames) / releaseFrames);
      out[frame] = filter.process(raw, g) * attack * release * event.velocity;
    }
    previousHz = targetHz;
  }
  return out;
}

export const bassVoice: VoiceSpec = {
  id: "bass", kind: "notes", monoDefault: true,
  automatable: ["cutoffHz"],
  params: {
    wave: { default: 0, min: 0, max: 1, integer: true },
    cutoffHz: { default: 600, min: 40, max: 8000 },
    resonance: { default: .15, min: 0, max: .9 },
    releaseMs: { default: 80, min: 5, max: 1000 },
    unison: { default: 1, min: 1, max: 9, integer: true },
    detuneCents: { default: 0, min: 0, max: 50 },
    filterEnvAmount: { default: 0, min: 0, max: 1 },
    filterEnvDecayMs: { default: 500, min: 20, max: 5000 },
  },
  render(ctx, params) {
    if (hasNewSynthParams(ctx.track.params)) return renderEnhancedBass(ctx, params);
    return renderMono(ctx, params["wave"] ?? 0, params["cutoffHz"] ?? 600,
      params["resonance"] ?? .15, params["releaseMs"] ?? 80);
  },
};
