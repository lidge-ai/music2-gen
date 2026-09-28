import { mulberry32 } from "../../shared/prng.tool.ts";
import type { VoiceContext } from "../render.schema.ts";

const TAU = 2 * Math.PI;
const T60 = Math.log(1000);

export interface ModalPreset {
  ratios: readonly number[];
  levels: readonly number[];
  seconds: readonly number[];
  gain: number;
  releaseSeconds: number;
  strikeSeconds: number;
}

/** Independent bar/tine modes with bounded T60 tails and a seeded short strike. */
export function renderModal(ctx: VoiceContext, decayScale: number, preset: ModalPreset,
  strike: number, tremoloHz = 0): Float32Array {
  const output = new Float32Array(ctx.frames);
  const rate = ctx.sampleRate;
  const motorStep = TAU * tremoloHz / rate;
  for (const event of ctx.events) {
    if (event.midi === null) continue;
    const f0 = 440 * 2 ** ((event.midi - 69) / 12);
    const start = Math.max(0, event.startFrame);
    const gate = Math.max(0, event.gateFrames);
    const stop = Math.min(ctx.frames, event.stopFrame);
    const releaseFrames = Math.max(1, preset.releaseSeconds * rate);
    const strikeFrames = Math.ceil(preset.strikeSeconds * rate);
    const rng = mulberry32(event.seed);
    let filteredNoise = 0;
    const strikeEnd = Math.min(stop, event.startFrame + strikeFrames);
    for (let frame = start; frame < strikeEnd; frame++) {
      const age = frame - event.startFrame;
      filteredNoise = 0.5 * filteredNoise + 0.5 * (2 * rng() - 1);
      const envelope = Math.sin(Math.PI * (age + 0.5) / strikeFrames);
      output[frame]! += preset.gain * event.velocity * 0.035 * strike * envelope * filteredNoise;
    }
    for (let mode = 0; mode < preset.ratios.length; mode++) {
      const frequency = f0 * preset.ratios[mode]!;
      if (frequency >= 0.45 * rate) continue;
      const seconds = preset.seconds[mode]! * decayScale;
      const naturalFrames = Math.ceil(seconds * rate * 100 / 60);
      const end = Math.min(stop, event.startFrame + naturalFrames,
        event.startFrame + gate + Math.ceil(releaseFrames * 100 / 60));
      const step = TAU * frequency / rate;
      const decay = Math.exp(-T60 / (seconds * rate));
      const release = Math.exp(-T60 / releaseFrames);
      const upperScale = mode === 0 ? 1 : 0.55 + 0.9 * strike;
      let amp = preset.gain * event.velocity * preset.levels[mode]! * upperScale;
      let phase = step * (start - event.startFrame);
      for (let frame = start; frame < end; frame++) {
        const age = frame - event.startFrame;
        const motor = tremoloHz === 0 ? 1 : 1 + 0.2 * Math.sin(motorStep * frame);
        output[frame]! += amp * Math.sin(phase) * motor;
        phase += step;
        amp *= decay * (age >= gate ? release : 1);
      }
    }
  }
  return output;
}
