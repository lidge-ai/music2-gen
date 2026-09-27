/** Recipe card contract (devlog 040 "Contracts and decisions"). Cards own genre knowledge; lint owns formulas. */
import type { Section, Song } from "../song/index.ts";

export const RECIPE_IDS = ["boom_bap", "drill_ny", "drill_uk", "house", "lofi_hiphop", "techno", "trap"] as const;
export type RecipeId = (typeof RECIPE_IDS)[number];

export type RecipeRole = "kick" | "snare" | "hats" | "bass" | "melody" | "chords" | "percussion";
export interface RecipePaletteEntry { role: RecipeRole; instrument: string; params: Record<string, number> }
export interface RecipeProgression { roman: string; example: string }
export interface RecipeArrangementBlock { role: NonNullable<Section["role"]>; bars: number }
export interface RecipeMixTargets { lufs: number; truePeak: number; notes: string }
export interface RecipeCard {
  id: RecipeId;
  title: string; version: 1; bpm: { min: number; max: number; default: number };
  meter: { numerator: 4; denominator: 4 }; swing: { min: number; max: number; default: number };
  keyDefaults: string[]; scales: string[]; progressions: RecipeProgression[];
  roles: RecipeRole[]; gridRules: string; bassRules: string;
  palette: RecipePaletteEntry[]; arrangement: RecipeArrangementBlock[];
  mixTargets: RecipeMixTargets; lintRules: string[]; starterSong: Song; sources: string[];
}

export function isRecipeId(value: string): value is RecipeId {
  return (RECIPE_IDS as readonly string[]).includes(value);
}
