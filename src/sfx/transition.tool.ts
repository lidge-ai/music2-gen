import { fnv1a32, mulberry32, Music2Error } from "../shared/index.ts";
import { TRANSITION_ATOMS, TRANSITION_PARAMS } from "./presets.tool.ts";
import type { TransitionAtom } from "./presets.tool.ts";
import { Biquad, PinkNoise, bounded, pulse, saw } from "./dsp.tool.ts";

const TAU = 2 * Math.PI;
const T60_LOG = Math.log(1000);

export function transitionTailSeconds(atom: TransitionAtom, params: Readonly<Record<string, number>>): number {
  return atom === "impact" || atom === "subdrop" ? params["impactDecay"] ?? .8 : 0;
}

interface TransitionContext {
  atom: TransitionAtom; variant: number; slot: number; rate: number; seed: number;
  params: Readonly<Record<string, number>>; velocity: number; frames: number;
  /** Frames actually synthesized: the event length capped by the caller's writable window. */
  limit: number;
}

function get(p: Readonly<Record<string, number>>, key: string): number {
  return p[key] ?? TRANSITION_PARAMS[key]?.default ?? 0;
}

function noiseSweep(ctx: TransitionContext): Float32Array {
  const { atom, variant, rate, seed, params, velocity, frames } = ctx;
  const out = new Float32Array(ctx.limit);
  const draw = mulberry32(fnv1a32(seed, atom, variant));
  const pink = new PinkNoise(); const bp = new Biquad(); const hp = new Biquad();
  hp.configure("highpass", 150, rate);
  const from = atom === "whoosh" ? 300 : atom === "revcymbal" ? 4000 : get(params, "sweepFromHz");
  const to = atom === "whoosh" ? 6000 : atom === "revcymbal" ? 10000 : get(params, "sweepToHz");
  const color = get(params, "noiseColor") === 1;
  for (let n = 0; n < ctx.limit; n++) {
    const u = Math.min(1, n / Math.max(1, frames - 1));
    const sweep = atom === "downlifter" ? 1 - u : atom === "whoosh" ? Math.sin(Math.PI * u) : u;
    const hz = from * (to / from) ** sweep * (variant === 1 ? .8 : variant === 2 ? 1.15 : 1);
    if (n % 32 === 0) bp.configure("bandpass", hz, rate, variant === 3 ? .65 : 1.2);
    const white = 2 * draw() - 1;
    const source = color ? pink.next(white, draw) : white;
    let filtered = bp.sample(source);
    if (atom === "whoosh") filtered = hp.sample(filtered);
    let gain: number;
    if (atom === "riser") gain = Math.sin(Math.PI * u / 2) ** 2;
    else if (atom === "downlifter") gain = (1 - u) ** 1.5;
    else if (atom === "whoosh") gain = Math.sin(Math.PI * u) ** 1.5;
    else if (atom === "revcymbal") gain = u * u;
    else gain = Math.sin(Math.PI * u / 2) ** 2 * (.65 + .35 * Math.sin(TAU * (5 + variant) * u) ** 2);
    const taper = Math.min(1, (frames - n - 1) / Math.max(1, .005 * rate));
    out[n] = bounded(.75 * velocity * gain * taper * filtered);
  }
  return out;
}

function pitchedRiser(ctx: TransitionContext): Float32Array {
  const { variant, rate, params, velocity, frames } = ctx;
  const out = new Float32Array(ctx.limit);
  const phases = new Float64Array(5);
  const detunes = [-2, -1, 0, 1, 2];
  const cents = [7, 11, 3, 15][variant]!;
  const base = get(params, "pitchHz"); const semitones = get(params, "riserSemitones");
  for (let n = 0; n < ctx.limit; n++) {
    const u = n / Math.max(1, frames - 1);
    const f = base * 2 ** (semitones * u / 12);
    let value = 0;
    for (let i = 0; i < 5; i++) {
      const hz = f * 2 ** (detunes[i]! * cents / 1200);
      const dt = Math.min(.45, hz / rate);
      value += saw(phases[i]!, dt);
      phases[i] = (phases[i]! + dt) % 1;
    }
    const taper = Math.min(1, (frames - n - 1) / Math.max(1, .005 * rate));
    out[n] = bounded(value * (.65 / 5) * u ** 1.5 * velocity * taper);
  }
  return out;
}

function boom(ctx: TransitionContext): Float32Array {
  const { atom, variant, rate, seed, params, velocity } = ctx;
  const out = new Float32Array(ctx.limit);
  const draw = mulberry32(fnv1a32(seed, atom, variant));
  const bp = new Biquad(); bp.configure("bandpass", atom === "impact" ? 3000 : 180, rate, .9);
  const decay = get(params, "impactDecay");
  let phase = 0;
  for (let n = 0; n < ctx.limit; n++) {
    const t = n / rate;
    const f = atom === "impact" ? 40 + 110 * Math.exp(-t / .05) : 35 + 95 * Math.exp(-t / .08);
    phase += TAU * f / rate;
    const env = Math.exp(-T60_LOG * t / decay);
    const noise = bp.sample(2 * draw() - 1);
    const transientMix = [.2, .32, .12, .24][variant]!;
    const bodyMix = [.68, .55, .72, .54][variant]!;
    const transient = atom === "impact" ? transientMix * Math.exp(-t / .035) * noise +
      (t < .003 ? (1 - t / .003) * .17 * (2 * draw() - 1) : 0) :
      transientMix * .4 * Math.exp(-t / .04) * noise;
    out[n] = bounded(velocity * (bodyMix * Math.sin(phase) * env + transient));
  }
  return out;
}

function zap(ctx: TransitionContext): Float32Array {
  const { variant, rate, velocity, frames } = ctx;
  const out = new Float32Array(ctx.limit);
  let phase = 0;
  for (let n = 0; n < ctx.limit; n++) {
    const t = n / rate;
    const f = 180 + 1620 * Math.exp(-t / .035);
    const dt = f / rate;
    const value = pulse(phase, dt, [.5, .3, .7, .42][variant]!);
    phase = (phase + dt) % 1;
    const taper = Math.min(1, (frames - n - 1) / Math.max(1, .003 * rate));
    out[n] = bounded(.52 * velocity * value * Math.exp(-T60_LOG * t / .16) * taper);
  }
  return out;
}

function crackle(ctx: TransitionContext): Float32Array {
  const { variant, rate, seed, params, velocity } = ctx;
  const out = new Float32Array(ctx.limit);
  const draw = mulberry32(fnv1a32(seed, "crackle", variant));
  const pink = new PinkNoise();
  const color = get(params, "noiseColor") === 1;
  for (let n = 0; n < ctx.limit; n++) {
    const white = 2 * draw() - 1;
    out[n] = (variant === 3 ? .022 : .013) * velocity * (color ? pink.next(white, draw) : white);
  }
  const ratePerSecond = get(params, "crackleRate");
  let t = 0;
  while (t < ctx.limit / rate) {
    t += -Math.log(Math.max(draw(), Number.EPSILON)) / ratePerSecond;
    const start = Math.floor(t * rate);
    const width = Math.round((.0003 + draw() * .0027) * rate * (variant === 1 ? 1.6 : 1));
    const amp = (draw() < .5 ? -1 : 1) * (.25 + .35 * draw()) * velocity * (variant === 2 ? 1.2 : 1);
    for (let i = 0; i < width && start + i < ctx.limit; i++) {
      out[start + i] = bounded(out[start + i]! + amp * Math.exp(-5 * i / width));
    }
  }
  return out;
}

export function renderTransition(atom: TransitionAtom, variant: number, slotSeconds: number,
  sampleRate: number, seed: number, params: Readonly<Record<string, number>>, velocity = 1,
  maxFrames = Number.POSITIVE_INFINITY): Float32Array {
  if (!(TRANSITION_ATOMS as readonly string[]).includes(atom) || !Number.isInteger(variant) ||
      !Number.isFinite(slotSeconds) || slotSeconds < 0 || !Number.isFinite(sampleRate) || sampleRate <= 0 || Number.isNaN(maxFrames) || maxFrames < 0) {
    throw new Music2Error("E_INPUT", "invalid transition render request");
  }
  const frames = Math.round(Math.max(slotSeconds, transitionTailSeconds(atom, params)) * sampleRate);
  const ctx: TransitionContext = { atom, variant: ((variant % 4) + 4) % 4, slot: slotSeconds,
    rate: sampleRate, seed, params, velocity: Math.max(0, Math.min(1, velocity)), frames,
    limit: Math.min(frames, Math.floor(maxFrames)) };
  if (atom === "pitchriser") return pitchedRiser(ctx);
  if (atom === "impact" || atom === "subdrop") return boom(ctx);
  if (atom === "zap") return zap(ctx);
  if (atom === "crackle") return crackle(ctx);
  return noiseSweep(ctx);
}
