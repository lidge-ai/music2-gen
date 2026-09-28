import { fnv1a32, mulberry32 } from "../shared/index.ts";

export const TRANSITION_ATOMS = ["riser", "pitchriser", "downlifter", "impact", "whoosh", "revcymbal", "noisebuild", "subdrop", "zap", "crackle"] as const;
export type TransitionAtom = (typeof TRANSITION_ATOMS)[number];
export const GAME_PRESETS = ["pickup", "laser", "explosion", "powerup", "hit", "jump", "blip", "alert", "click", "confirm", "error"] as const;
export const SFX_PRESETS: readonly string[] = [...TRANSITION_ATOMS, ...GAME_PRESETS];
export const GENERATOR_VERSION = "music2-sfx/1";

export const TRANSITION_PARAMS: Readonly<Record<string, { default: number; min: number; max: number; integer?: boolean }>> = {
  riserSemitones: { default: 19, min: 0, max: 36 },
  sweepFromHz: { default: 250, min: 100, max: 2000 },
  sweepToHz: { default: 8000, min: 1000, max: 16000 },
  pitchHz: { default: 220, min: 55, max: 880 },
  impactDecay: { default: .8, min: .2, max: 3 },
  crackleRate: { default: 8, min: 1, max: 30 },
  noiseColor: { default: 0, min: 0, max: 1, integer: true },
};
export type TransitionParams = Record<string, number>;

export const TRANSITION_KEYS: Record<TransitionAtom, readonly string[]> = {
  riser: ["sweepFromHz", "sweepToHz", "noiseColor"],
  pitchriser: ["riserSemitones", "pitchHz"],
  downlifter: ["sweepFromHz", "sweepToHz", "noiseColor"],
  impact: ["impactDecay"],
  whoosh: ["noiseColor"],
  revcymbal: ["noiseColor"], noisebuild: ["sweepFromHz", "sweepToHz", "noiseColor"],
  subdrop: ["impactDecay"], zap: [], crackle: ["crackleRate", "noiseColor"],
};
export const TRANSITION_SECONDS: Record<TransitionAtom, number> = {
  riser: 2, pitchriser: 2, downlifter: 2, impact: .8, whoosh: .7,
  revcymbal: 1, noisebuild: 1, subdrop: .8, zap: .14, crackle: 2,
};
export const GAME_SECONDS: Record<string, number> = {
  pickup: .2, laser: .18, explosion: .8, powerup: .6, hit: .15, jump: .25,
  blip: .08, alert: .4, click: .05, confirm: .22, error: .4,
};

export interface NumberSpec { default: number; min: number; max: number; integer?: boolean }
export const GAME_PARAMS: Record<string, NumberSpec> = {
  wave: { default: 0, min: 0, max: 3, integer: true },
  fstart: { default: 440, min: 40, max: 4000 }, fmin: { default: 40, min: 20, max: 1000 },
  slide: { default: 0, min: -10, max: 8 }, deltaSlide: { default: 0, min: -20, max: 20 },
  vDepth: { default: 0, min: 0, max: 100 }, vRate: { default: 5, min: 1, max: 12 },
  jump: { default: 0, min: -24, max: 24 }, tArp: { default: .08, min: 0, max: .5 },
  duty: { default: .5, min: .1, max: .9 }, dutySlope: { default: 0, min: -2, max: 2 },
  attack: { default: 0, min: 0, max: .5 }, sustain: { default: .1, min: .002, max: 1 },
  punch: { default: 0, min: 0, max: 1 }, decay: { default: .15, min: .01, max: 2 },
  repeat: { default: 0, min: 0, max: .5 }, phaserMix: { default: 0, min: -.8, max: .8 },
  phaserDelay: { default: .006, min: .002, max: .02 },
  phaserSweep: { default: 0, min: -.01, max: .01 },
  lpHz: { default: 12000, min: 100, max: 21600 }, lpQ: { default: .707, min: .5, max: 8 },
  lpSweep: { default: 0, min: -8, max: 8 }, hpHz: { default: 20, min: 20, max: 8000 },
  hpSweep: { default: 0, min: -8, max: 8 },
};

type Draw = readonly [name: string, low: number, high: number];
interface GamePreset { waves: readonly number[]; draws: readonly Draw[] }
// Object/array order is the version-1 draw contract. One wave draw precedes every listed field.
export const GAME_TABLE: Record<string, GamePreset> = {
  pickup: { waves: [2, 0], draws: [["fstart", 500, 1100], ["slide", 1, 6], ["sustain", .04, .12], ["decay", .05, .16], ["punch", .1, .5], ["jump", 5, 12], ["tArp", .03, .09]] },
  laser: { waves: [2, 1], draws: [["fstart", 900, 3000], ["slide", -14, -5], ["sustain", .02, .06], ["decay", .06, .18], ["punch", 0, .2], ["duty", .2, .7]] },
  explosion: { waves: [3, 2], draws: [["fstart", 50, 180], ["slide", -6, -1], ["sustain", .08, .25], ["decay", .25, .8], ["punch", .2, .7], ["lpHz", 400, 2500], ["lpSweep", -4, -1]] },
  powerup: { waves: [1, 2], draws: [["fstart", 180, 500], ["slide", 2, 8], ["attack", .01, .1], ["sustain", .15, .4], ["decay", .1, .35], ["punch", 0, .4], ["repeat", .08, .2], ["vDepth", 10, 35]] },
  hit: { waves: [3, 2], draws: [["fstart", 100, 600], ["slide", -10, -3], ["sustain", .01, .06], ["decay", .04, .15], ["punch", .3, .8], ["lpHz", 1000, 6000]] },
  jump: { waves: [2, 0], draws: [["fstart", 200, 500], ["slide", 2, 7], ["sustain", .05, .14], ["decay", .06, .2], ["punch", 0, .25], ["deltaSlide", -2, 0]] },
  blip: { waves: [0, 2], draws: [["fstart", 300, 1400], ["slide", -1, 1], ["sustain", .01, .04], ["decay", .02, .07]] },
  alert: { waves: [0, 2], draws: [["fstart", 440, 1200], ["attack", .005, .03], ["sustain", .1, .25], ["decay", .08, .25], ["jump", 3, 7], ["tArp", .05, .08]] },
  click: { waves: [3, 0], draws: [["fstart", 700, 2500], ["slide", -8, -2], ["sustain", .002, .01], ["decay", .008, .04], ["punch", 0, .2], ["hpHz", 700, 2000]] },
  confirm: { waves: [0, 2], draws: [["fstart", 500, 1000], ["slide", 1, 4], ["attack", .002, .015], ["sustain", .05, .12], ["decay", .08, .18], ["punch", 0, .2], ["jump", 7, 12], ["tArp", .025, .045]] },
  error: { waves: [2, 1], draws: [["fstart", 160, 500], ["slide", -5, -1], ["attack", .002, .02], ["sustain", .1, .25], ["decay", .1, .3], ["punch", .1, .4], ["jump", -7, -2], ["tArp", .035, .065], ["lpHz", 1000, 4000]] },
};

const CORE_KEYS = ["wave", "fstart", "fmin", "slide", "attack", "sustain", "punch", "decay", "lpHz", "hpHz"];
export const GAME_ALLOWED: Record<string, readonly string[]> = Object.fromEntries(
  Object.entries(GAME_TABLE).map(([preset, table]) => [preset, Array.from(new Set([
    ...CORE_KEYS, ...table.draws.map(([key]) => key),
    ...(preset === "powerup" ? ["vRate", "dutySlope"] : []),
    ...(preset === "laser" || preset === "jump" ? ["deltaSlide", "duty"] : []),
    ...(preset === "explosion" || preset === "hit" ? ["lpQ", "lpSweep", "hpHz", "hpSweep"] : []),
    ...(preset === "alert" || preset === "confirm" || preset === "error" ? ["tArp"] : []),
    ...(preset === "blip" ? ["phaserMix", "phaserDelay", "phaserSweep"] : []),
  ]))]),
);

export function drawPreset(preset: string, seed: number): Record<string, number> {
  const table = GAME_TABLE[preset];
  if (!table) return {};
  const draw = mulberry32(fnv1a32(GENERATOR_VERSION, preset, seed));
  const values: Record<string, number> = { wave: table.waves[Math.floor(draw() * table.waves.length)]! };
  for (const [key, low, high] of table.draws) values[key] = low + draw() * (high - low);
  return values;
}
