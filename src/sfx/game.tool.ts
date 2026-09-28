import { fnv1a32, mulberry32 } from "../shared/index.ts";
import { Biquad, bounded, pulse, saw } from "./dsp.tool.ts";
import type { ResolvedSfx } from "./sfx.schema.ts";

const TAU = 2 * Math.PI;
const GET = (p: Readonly<Record<string, number>>, key: string): number => p[key]!;

function envelope(t: number, p: Readonly<Record<string, number>>): number {
  const attack = GET(p, "attack"); const sustain = GET(p, "sustain");
  if (t < attack) return attack === 0 ? 1 : t / attack;
  if (t < attack + sustain) return 1 + GET(p, "punch") * (1 - (t - attack) / sustain);
  return Math.max(0, 1 - (t - attack - sustain) / GET(p, "decay"));
}

function frequency(t: number, p: Readonly<Record<string, number>>): number {
  const repeat = GET(p, "repeat");
  const local = repeat > 0 ? t % repeat : t;
  const octaves = GET(p, "slide") * local + .5 * GET(p, "deltaSlide") * local * local +
    GET(p, "vDepth") / 1200 * Math.sin(TAU * GET(p, "vRate") * t) +
    (local >= GET(p, "tArp") ? GET(p, "jump") / 12 : 0);
  return GET(p, "fstart") * 2 ** octaves;
}

/** Physical-unit game/UI voice. All state is per invocation, and buffers are bounded by requested frames. */
export function renderGame(resolved: ResolvedSfx): Float32Array {
  const { sampleRate: rate, frames, params: p, seed, preset } = resolved;
  const out = new Float32Array(frames);
  const draw = mulberry32(fnv1a32(seed, preset, "game-noise"));
  const low = new Biquad(); const high = new Biquad();
  const phaserSize = Math.ceil(.04 * rate) + 2;
  const phaser = new Float32Array(phaserSize);
  const phaserMix = GET(p, "phaserMix");
  let phase = 0;
  for (let n = 0; n < frames; n++) {
    const t = n / rate;
    const env = envelope(t, p);
    if (env <= 0 && t >= GET(p, "attack") + GET(p, "sustain") + GET(p, "decay")) break;
    const f = frequency(t, p);
    if (f < GET(p, "fmin")) break;
    const hz = Math.min(rate * .45, Math.max(20, f));
    const dt = hz / rate;
    const repeat = GET(p, "repeat");
    const local = repeat > 0 ? t % repeat : t;
    const duty = Math.max(.05, Math.min(.95, GET(p, "duty") + GET(p, "dutySlope") * local));
    const wave = GET(p, "wave");
    let sample = wave === 0 ? Math.sin(TAU * phase) : wave === 1 ? saw(phase, dt) :
      wave === 2 ? pulse(phase, dt, duty) : 2 * draw() - 1;
    phase = (phase + dt) % 1;
    sample *= env * .48;
    if (phaserMix !== 0) {
      const delay = Math.max(.002, Math.min(.02, GET(p, "phaserDelay") + GET(p, "phaserSweep") * t)) * rate;
      const read = (n - delay + phaserSize * 2) % phaserSize;
      const a = Math.floor(read); const b = (a + 1) % phaserSize;
      sample += phaserMix * (phaser[a]! * (1 - (read - a)) + phaser[b]! * (read - a));
      phaser[n % phaserSize] = sample;
    }
    if (n % 32 === 0) {
      low.configure("lowpass", Math.min(rate * .45, GET(p, "lpHz") * 2 ** (GET(p, "lpSweep") * t)), rate, GET(p, "lpQ"));
      high.configure("highpass", Math.min(rate * .45, GET(p, "hpHz") * 2 ** (GET(p, "hpSweep") * t)), rate);
    }
    out[n] = bounded(high.sample(low.sample(sample)));
  }
  return out;
}
