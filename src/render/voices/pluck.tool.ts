import { mulberry32 } from "../../shared/index.ts";
import type { VoiceSpec } from "../render.schema.ts";

export const pluckVoice: VoiceSpec = {
  id: "pluck", kind: "notes", monoDefault: false,
  params: {
    damping: { default: 0.992, min: 0.8, max: 0.9999 },
    decayMs: { default: 900, min: 50, max: 5000 },
    brightness: { default: 0.7, min: 0, max: 1 },
  },
  render(ctx, params) {
    const output = new Float32Array(ctx.frames);
    const decayFrames = params["decayMs"]! * ctx.sampleRate / 1000;
    for (const event of ctx.events) {
      if (event.midi === null) continue;
      const frequency = 440 * 2 ** ((event.midi - 69) / 12);
      const delay = Math.max(2, ctx.sampleRate / frequency - 0.5);
      const burstFrames = Math.ceil(delay);
      const line = new Float32Array(burstFrames + 2);
      const rng = mulberry32(event.seed);
      let smoothed = 0;
      for (let i = 0; i < burstFrames; i++) {
        const noise = 2 * rng() - 1;
        smoothed = 0.5 * (smoothed + noise);
        line[i] = noise * params["brightness"]! + smoothed * (1 - params["brightness"]!);
      }
      const start = Math.max(0, event.startFrame);
      const end = Math.min(ctx.frames, event.stopFrame);
      for (let frame = event.startFrame; frame < end; frame++) {
        const age = frame - event.startFrame;
        let signal: number;
        if (age < burstFrames) {
          signal = line[age]!;
        } else {
          const read = age - delay;
          const base = Math.floor(read);
          const fraction = read - base;
          const a = line[base % line.length]! * (1 - fraction) + line[(base + 1) % line.length]! * fraction;
          const b = line[(base - 1 + line.length) % line.length]! * (1 - fraction) + line[base % line.length]! * fraction;
          signal = 0.5 * params["damping"]! * (a + b);
          line[age % line.length] = signal;
        }
        if (frame >= start) {
          const decay = Math.exp(-2.3 * age / decayFrames);
          const release = age < event.gateFrames ? 1 : Math.exp(-6.9 * (age - event.gateFrames) / (0.08 * ctx.sampleRate));
          output[frame]! += 0.5 * event.velocity * signal * decay * release;
        }
      }
    }
    return output;
  },
};
