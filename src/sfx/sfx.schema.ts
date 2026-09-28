import { Music2Error } from "../shared/index.ts";
import { drawPreset, GAME_ALLOWED, GAME_PARAMS, GAME_SECONDS, GENERATOR_VERSION, SFX_PRESETS,
  TRANSITION_ATOMS, TRANSITION_KEYS, TRANSITION_PARAMS, TRANSITION_SECONDS } from "./presets.tool.ts";
import type { TransitionAtom } from "./presets.tool.ts";

export interface ResolvedSfx {
  generatorVersion: string;
  preset: string;
  seed: number;
  seconds: number;
  frames: number;
  sampleRate: number;
  params: Record<string, number>;
}

function invalid(message: string): never { throw new Music2Error("E_INPUT", message); }

export function parseParamsFlag(text: string): Record<string, number> {
  if (typeof text !== "string" || text.length === 0) invalid("params must be comma-separated k=v values");
  const values: Record<string, number> = {};
  for (const part of text.split(",")) {
    const match = /^([A-Za-z][A-Za-z0-9]*)=([+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?)$/.exec(part);
    if (!match) invalid(`malformed parameter ${part}`);
    const key = match[1]!;
    if (Object.hasOwn(values, key)) invalid(`duplicate parameter ${key}`);
    const value = Number(match[2]);
    if (!Number.isFinite(value)) invalid(`parameter ${key} must be finite`);
    values[key] = value;
  }
  return values;
}

function numeric(value: unknown, name: string, min: number, max: number, integer = false): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max || (integer && !Number.isInteger(value))) {
    invalid(`${name} must be ${integer ? "an integer" : "a number"} in ${min}..${max}`);
  }
  return value;
}

export function resolveSfx(input: {
  preset: string; seed?: number; seconds?: number; sampleRate?: number;
  params?: Readonly<Record<string, number>>;
}): ResolvedSfx {
  const preset = input.preset;
  if (!SFX_PRESETS.includes(preset)) invalid(`unknown sfx preset ${String(preset)}`);
  const transition = (TRANSITION_ATOMS as readonly string[]).includes(preset);
  const seed = numeric(input.seed ?? 1, "seed", 0, 0xffffffff, true);
  const sampleRate = input.sampleRate ?? 44100;
  if (sampleRate !== 44100 && sampleRate !== 48000) invalid("sampleRate must be 44100 or 48000");
  const defaultSeconds = transition ? TRANSITION_SECONDS[preset as TransitionAtom] : GAME_SECONDS[preset]!;
  const requested = numeric(input.seconds ?? defaultSeconds, "seconds", .05, 30);
  const frames = Math.round(requested * sampleRate);
  // 16-bit stereo PCM RIFF: fixed 36-byte header followed by four bytes per frame.
  if (36 + frames * 4 > 0xffffffff) invalid("SFX exceeds RIFF length");

  const overrides = input.params ?? {};
  const keys = transition ? TRANSITION_KEYS[preset as TransitionAtom] : Object.keys(GAME_PARAMS);
  const allowed = transition ? keys : GAME_ALLOWED[preset]!;
  for (const [key, value] of Object.entries(overrides)) {
    if (!allowed.includes(key)) invalid(`parameter ${key} is not allowed for ${preset}`);
    const spec = transition ? TRANSITION_PARAMS[key]! : GAME_PARAMS[key]!;
    const lower = preset === "laser" && key === "slide" ? -14 : spec.min;
    const upper = key === "lpHz" ? Math.min(spec.max, sampleRate * .45) : spec.max;
    numeric(value, key, lower, upper, spec.integer);
    if (key === "repeat" && value !== 0 && value < .03) invalid("repeat must be zero or at least 0.03");
  }
  const drawn = transition ? {} : drawPreset(preset, seed);
  const values: Record<string, number> = {};
  for (const key of keys) {
    const spec = transition ? TRANSITION_PARAMS[key]! : GAME_PARAMS[key]!;
    values[key] = overrides[key] ?? drawn[key] ?? spec.default;
  }
  return { generatorVersion: GENERATOR_VERSION, preset, seed, seconds: frames / sampleRate,
    frames, sampleRate, params: values };
}
