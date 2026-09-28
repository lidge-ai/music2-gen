import { mulberry32 } from "../../shared/prng.tool.ts";
import type { VoiceSpec } from "../render.schema.ts";
import { polyBlepSaw } from "./osc.tool.ts";

const TAU = 2 * Math.PI;
const RELEASE_FLOOR = Math.log(1000);
const PLAYERS = 5;
/** Uneven section tuning (fraction of detuneCents): no two players share a beat period. */
const OFFSETS = [-1, -0.41, 0.07, 0.56, 0.93] as const;
/** Each player's vibrato rate in Hz; depth is a few cents and fades in after the bow settles. */
const VIBRATO_HZ = [5.1, 5.6, 4.8, 5.9, 5.3] as const;
const VIBRATO_CENTS = 6;
const VIBRATO_ONSET_S = 0.15;
/**
 * An in-tune principal carries the fundamental; the detuned section above it is high-passed at this multiple of f0.
 * Detuned players that share the fundamental beat together into a slow, deep swell ("wow-wow") that no chorus hides.
 */
const PRINCIPAL = 0.6;
const SECTION_HIGHPASS = 2.5;
const LEVEL = 0.62;
const CHORUS_CENTER_S = 0.012;
const CHORUS_DEPTH_S = 0.0007;
const CHORUS_HZ = 0.37;

interface Section {
  phases: Float64Array; steps: Float64Array; vibratoPhases: Float64Array;
  principalPhase: number; principalStep: number; hpCoefficient: number; hpState: number; hpInput: number;
}

function section(f0: number, detuneCents: number, rate: number, seed: number): Section {
  const random = mulberry32(seed);
  const phases = new Float64Array(PLAYERS), steps = new Float64Array(PLAYERS), vibratoPhases = new Float64Array(PLAYERS);
  for (let player = 0; player < PLAYERS; player++) {
    phases[player] = random();
    vibratoPhases[player] = random();
    steps[player] = f0 * 2 ** (OFFSETS[player]! * detuneCents / 1200) / rate;
  }
  return { phases, steps, vibratoPhases, principalPhase: random(), principalStep: f0 / rate,
    hpCoefficient: Math.exp(-TAU * Math.min(0.45 * rate, SECTION_HIGHPASS * f0) / rate), hpState: 0, hpInput: 0 };
}

/** One sample: the in-tune principal plus the high-passed, detuned, vibrato section. */
function bow(s: Section, age: number, rate: number): number {
  const seconds = age / rate;
  const depth = VIBRATO_CENTS * Math.LN2 / 1200 * Math.min(1, Math.max(0, seconds / VIBRATO_ONSET_S - 1));
  let raw = 0;
  for (let player = 0; player < PLAYERS; player++) {
    const vibrato = depth === 0 ? 1 : 1 + depth * Math.sin(TAU * (VIBRATO_HZ[player]! * seconds + s.vibratoPhases[player]!));
    const step = s.steps[player]! * vibrato;
    const phase = s.phases[player]!;
    if (step < 0.45) raw += polyBlepSaw(phase, step) / PLAYERS;
    s.phases[player] = (phase + step) % 1;
  }
  s.hpState = s.hpCoefficient * (s.hpState + raw - s.hpInput);
  s.hpInput = raw;
  const principal = s.principalStep < 0.45 ? polyBlepSaw(s.principalPhase, s.principalStep) : 0;
  s.principalPhase = (s.principalPhase + s.principalStep) % 1;
  return PRINCIPAL * principal + (1 - PRINCIPAL) * s.hpState;
}

/** Short, shallow modulated delay read with linear interpolation (no stepped delay times). */
class Chorus {
  private readonly buffer: Float32Array;
  private readonly rate: number;
  private readonly mix: number;
  constructor(rate: number, mix: number) {
    this.rate = rate;
    this.mix = mix;
    this.buffer = new Float32Array(Math.ceil((CHORUS_CENTER_S + CHORUS_DEPTH_S) * rate) + 2);
  }
  process(input: number, age: number): number {
    const size = this.buffer.length;
    const write = age % size;
    const delay = (CHORUS_CENTER_S + CHORUS_DEPTH_S * Math.sin(TAU * CHORUS_HZ * age / this.rate)) * this.rate;
    const position = write - delay + size;
    const index = Math.floor(position), fraction = position - index;
    const wet = this.buffer[index % size]! * (1 - fraction) + this.buffer[(index + 1) % size]! * fraction;
    this.buffer[write] = input;
    return (1 - this.mix) * input + this.mix * (age > delay ? wet : 0);
  }
}

export const stringsVoice: VoiceSpec = {
  id: "strings", kind: "notes", monoDefault: false,
  params: {
    detuneCents: { default: 10, min: 3, max: 12 },
    attackMs: { default: 300, min: 120, max: 800 },
    releaseMs: { default: 500, min: 200, max: 1500 },
    chorusMix: { default: 0.2, min: 0, max: 0.35 },
  },
  render(ctx, params) {
    const output = new Float32Array(ctx.frames);
    const rate = ctx.sampleRate;
    const attackFrames = params["attackMs"]! * rate / 1000;
    const releaseFrames = params["releaseMs"]! * rate / 1000;
    const mix = params["chorusMix"]!;
    for (const event of ctx.events) {
      if (event.midi === null) continue;
      const f0 = 440 * 2 ** ((event.midi - 69) / 12);
      const players = section(f0, params["detuneCents"]!, rate, event.seed);
      const cutoff = Math.min(0.45 * rate, Math.max(1800, 5 * f0) * (0.7 + 0.6 * event.velocity));
      const lpGain = 1 - Math.exp(-TAU * cutoff / rate);
      const chorus = mix > 0 ? new Chorus(rate, mix) : null;
      let filtered = 0;
      const end = Math.min(ctx.frames, event.stopFrame, event.startFrame + event.gateFrames + Math.ceil(2 * releaseFrames));
      for (let frame = event.startFrame; frame < end; frame++) {
        const age = frame - event.startFrame;
        filtered += lpGain * (bow(players, age, rate) - filtered);
        const signal = chorus ? chorus.process(filtered, age) : filtered;
        const attack = 1 - Math.exp(-3 * (Math.min(age, event.gateFrames) + 1) / attackFrames);
        const release = age <= event.gateFrames ? 1 : Math.exp(-RELEASE_FLOOR * (age - event.gateFrames) / releaseFrames);
        if (frame >= 0) output[frame]! += LEVEL * event.velocity * signal * attack * release;
      }
    }
    return output;
  },
};
