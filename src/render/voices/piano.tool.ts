import { mulberry32 } from "../../shared/prng.tool.ts";
import type { VoiceSpec } from "../render.schema.ts";

const TAU = 2 * Math.PI;
const T60 = Math.log(1000);
const PARTIALS = 32;
const HAMMER_SECONDS = 0.005;

export const pianoVoice: VoiceSpec = {
  id: "piano", kind: "notes", monoDefault: false,
  params: {
    inharmonicity: { default: 0.0002, min: 0.0001, max: 0.0004 },
    hammer: { default: 0.5, min: 0, max: 1 },
    releaseMs: { default: 200, min: 80, max: 400 },
  },
  render(ctx, params) {
    const output = new Float32Array(ctx.frames);
    const rate = ctx.sampleRate;
    const ceiling = 0.45 * rate;
    const releaseFrames = params["releaseMs"]! * rate / 1000;
    const releaseFactor = Math.exp(-T60 * 100 / 60 / releaseFrames);
    const hammerFrames = Math.max(1, Math.round(HAMMER_SECONDS * rate));
    for (const event of ctx.events) {
      if (event.midi === null || event.velocity <= 0) continue;
      const frequency = 440 * 2 ** ((event.midi - 69) / 12);
      const steps: number[] = [];
      const cosSteps: number[] = [];
      const amplitudes: number[] = [];
      const promptFactors: number[] = [];
      const afterFactors: number[] = [];
      let amplitudeSum = 0;
      for (let n = 1; n <= PARTIALS; n++) {
        const hz = n * frequency * Math.sqrt(1 + params["inharmonicity"]! * n * n);
        if (hz >= ceiling) break;
        const step = TAU * hz / rate;
        steps.push(Math.sin(step));
        cosSteps.push(Math.cos(step));
        const amplitude = (1 + 0.8 * event.velocity * n / 8) / n ** 1.3;
        amplitudes.push(amplitude);
        amplitudeSum += amplitude;
        promptFactors.push(Math.exp(-T60 / (rate * 0.9 / n ** 0.3)));
        afterFactors.push(Math.exp(-T60 / (rate * 5 / n ** 0.5)));
      }
      const count = steps.length;
      const sines = new Float64Array(count);
      const cosines = new Float64Array(count).fill(1);
      const prompt = new Float64Array(count).fill(1);
      const after = new Float64Array(count).fill(1);
      const gain = amplitudeSum === 0 ? 0 : 0.9 * event.velocity / amplitudeSum;
      const random = mulberry32(event.seed);
      let previousNoise = 0;
      let release = 1;
      const start = Math.max(0, event.startFrame);
      // The aftersound is already below -100 dB after 8.34 s; key-off ends sooner.
      const end = Math.min(ctx.frames, event.stopFrame,
        event.startFrame + Math.ceil(8.34 * rate),
        event.startFrame + event.gateFrames + Math.ceil(releaseFrames));
      for (let frame = event.startFrame; frame < end; frame++) {
        const age = frame - event.startFrame;
        let tone = 0;
        for (let i = 0; i < count; i++) {
          tone += amplitudes[i]! * sines[i]! * (0.7 * prompt[i]! + 0.3 * after[i]!);
          const sine = sines[i]! * cosSteps[i]! + cosines[i]! * steps[i]!;
          cosines[i] = cosines[i]! * cosSteps[i]! - sines[i]! * steps[i]!;
          sines[i] = sine;
          prompt[i] = prompt[i]! * promptFactors[i]!;
          after[i] = after[i]! * afterFactors[i]!;
        }
        if (age > event.gateFrames) release *= releaseFactor;
        let hammer = 0;
        if (age < hammerFrames) {
          const noise = random() * 2 - 1;
          hammer = 0.035 * params["hammer"]! * event.velocity *
            (noise - previousNoise) * (1 - age / hammerFrames);
          previousNoise = noise;
        }
        if (frame >= start) output[frame]! += gain * tone * release + hammer;
      }
    }
    return output;
  },
};
