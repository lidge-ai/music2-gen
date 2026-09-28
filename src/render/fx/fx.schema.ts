/**
 * Production effect contracts (devlog/_fin/260928_music2_fx). Declarative parameter specs are the single source for
 * validation, defaults and the generated JSON Schema. Processors live next to this file and run in place on stereo buffers.
 */
import type { StereoBuffer } from "../../audio-io/index.ts";

export const NOTE_DIVISIONS = ["1/16", "1/16d", "1/16t", "1/8", "1/8d", "1/8t", "1/4", "1/4d", "1/4t", "1/2", "1/2d", "1/2t"] as const;
export type NoteDivision = (typeof NOTE_DIVISIONS)[number];

/** Numeric spec: inclusive range and default; integer when set. */
export interface NumberSpec { kind: "number"; default: number; min: number; max: number; integer?: boolean }
export interface EnumSpec<T extends string = string> { kind: "enum"; default: T; values: readonly T[] }
export interface BooleanSpec { kind: "boolean"; default: boolean }
export type ParamSpec = NumberSpec | EnumSpec | BooleanSpec;

const n = (d: number, min: number, max: number, integer = false): NumberSpec => ({ kind: "number", default: d, min, max, ...(integer ? { integer } : {}) });
const e = <T extends string>(d: T, values: readonly T[]): EnumSpec<T> => ({ kind: "enum", default: d, values });
const b = (d: boolean): BooleanSpec => ({ kind: "boolean", default: d });

/** Track insert effects, applied in declared order on a stereo work buffer before pan, gain, duck and sends. */
export const INSERT_SPECS = {
  eq: { lowGainDb: n(0, -18, 18), lowHz: n(120, 40, 500), midGainDb: n(0, -18, 18), midHz: n(1000, 200, 6000), midQ: n(0.7, 0.2, 5), highGainDb: n(0, -18, 18), highHz: n(8000, 2000, 18000) },
  filter: { mode: e("lowpass", ["lowpass", "highpass", "bandpass"] as const), cutoffHz: n(1000, 20, 18000), q: n(0.707, 0.2, 10), lfoRateHz: n(0, 0, 20), lfoDepthOct: n(0, 0, 4), mix: n(1, 0, 1) },
  drive: { amount: n(2, 1, 12), toneHz: n(8000, 500, 18000), mix: n(1, 0, 1) },
  compressor: { thresholdDb: n(-18, -60, 0), ratio: n(4, 1, 20), attackMs: n(10, 0.1, 100), releaseMs: n(100, 10, 2000), kneeDb: n(6, 0, 24), makeupDb: n(0, -12, 24) },
  chorus: { rateHz: n(0.35, 0.05, 5), depthMs: n(5, 0, 15), baseMs: n(15, 5, 35), feedback: n(0, -0.8, 0.8), mix: n(0.5, 0, 1) },
  // Integer input remains schema-compatible; the processor rounds odd stage counts up to even.
  phaser: { rateHz: n(0.3, 0.05, 5), depth: n(0.7, 0, 1), stages: n(4, 2, 12, true), feedback: n(0, -0.8, 0.8), mix: n(0.5, 0, 1) },
  width: { amount: n(1, 0, 2), monoBelowHz: n(120, 80, 250) },
  crush: { bits: n(8, 4, 16, true), downsample: n(2, 1, 32, true), mix: n(1, 0, 1) },
  tremolo: { rateHz: n(4, 0.05, 20), depth: n(0.5, 0, 1), phaseDegrees: n(0, 0, 180), mix: n(1, 0, 1) },
  delay: { time: e<NoteDivision>("1/8d", NOTE_DIVISIONS), feedback: n(0.35, 0, 0.95), pingPong: b(false), lowCutHz: n(20, 20, 1000), highCutHz: n(18000, 1000, 18000), mix: n(0.35, 0, 1) },
  tapestop: { startBar: n(1, 1, 1024, true), beats: n(2, 0.25, 16) },
} as const satisfies Record<string, Record<string, ParamSpec>>;
export type InsertType = keyof typeof INSERT_SPECS;
export const INSERT_TYPES = Object.keys(INSERT_SPECS) as InsertType[];
/** Master inserts are a subset, applied after the dry+wet sum and before loudness targeting and limiting. */
export const MASTER_INSERT_TYPES = ["eq", "compressor", "drive", "width"] as const satisfies readonly InsertType[];
export const MAX_TRACK_INSERTS = 12;
export const MAX_MASTER_INSERTS = 4;

export const REVERB_TYPES = ["room", "plate", "hall"] as const;
export const REVERB_SPEC = {
  type: e<(typeof REVERB_TYPES)[number]>("room", REVERB_TYPES), decaySeconds: n(1.5, 0.2, 8), preDelayMs: n(0, 0, 250), damping: n(0.5, 0, 1),
  lowCutHz: n(80, 20, 1000), highCutHz: n(16000, 1000, 18000), width: n(1, 0, 2), mix: n(1, 0, 1),
} as const satisfies Record<string, ParamSpec>;
export const DELAY_BUS_SPEC = {
  time: e<NoteDivision>("1/8d", NOTE_DIVISIONS), feedback: n(0.35, 0, 0.95), pingPong: b(true), lowCutHz: n(20, 20, 1000), highCutHz: n(18000, 1000, 18000), mix: n(1, 0, 1),
} as const satisfies Record<string, ParamSpec>;

type Value<S> = S extends NumberSpec ? number : S extends EnumSpec<infer T> ? T : S extends BooleanSpec ? boolean : never;
export type Params<M extends Record<string, ParamSpec>> = { [K in keyof M]: Value<M[K]> };
export type InsertParams<T extends InsertType> = Params<(typeof INSERT_SPECS)[T]>;
/** Resolved insert: every parameter present after defaults. */
export type ResolvedInsert = { [T in InsertType]: { type: T } & InsertParams<T> }[InsertType];
export type ReverbBusParams = Params<typeof REVERB_SPEC>;
export type DelayBusParams = Params<typeof DELAY_BUS_SPEC>;
/** Raw (song JSON) insert: type plus any subset of its parameters. */
export type InsertInput = { [T in InsertType]: { type: T } & Partial<InsertParams<T>> }[InsertType];

/** Context every processor receives. */
export interface FxContext { sampleRate: number; bpm: number; startSeconds?: number; secondsPerBar?: number }
/** In-place stereo processor contract shared by all insert effects. */
export type InsertProcessor<T extends InsertType> = (buffer: StereoBuffer, params: InsertParams<T>, ctx: FxContext) => void;

/** Seconds of one note division at a tempo: quarter = 60/bpm; dotted x1.5; triplet x2/3. */
export function divisionSeconds(division: NoteDivision, bpm: number): number {
  const [, denom, suffix] = /^1\/(\d+)([dt]?)$/.exec(division)!;
  const base = (60 / bpm) * 4 / Number(denom);
  return suffix === "d" ? base * 1.5 : suffix === "t" ? base * 2 / 3 : base;
}
