import { USE_CASE_IDS } from "../song/song.schema.ts";
import type { UseCaseId } from "../song/song.schema.ts";
import type { RecipeId } from "../recipes/recipe.schema.ts";

export type { UseCaseId } from "../song/song.schema.ts";
export { USE_CASE_IDS } from "../song/song.schema.ts";
export interface UseCasePreset {
  id: UseCaseId; title: string; allowedGenres?: RecipeId[]; defaultSeconds?: number;
  targetLufs: number; ceilingDb: number;
}
export const USE_CASES: readonly UseCasePreset[] = [
  { id: "short_15", title: "15-second short", defaultSeconds: 15, targetLufs: -14, ceilingDb: -1 },
  { id: "short_30", title: "30-second short", defaultSeconds: 30, targetLufs: -14, ceilingDb: -1 },
  { id: "short_60", title: "60-second short", defaultSeconds: 60, targetLufs: -14, ceilingDb: -1 },
  { id: "vo_bed", title: "Voice-over bed", targetLufs: -22, ceilingDb: -1 },
  { id: "podcast_sting", title: "Podcast sting", defaultSeconds: 4, targetLufs: -16, ceilingDb: -1 },
  { id: "podcast_theme", title: "Podcast theme", defaultSeconds: 10, targetLufs: -16, ceilingDb: -1 },
  { id: "game_loop", title: "Game loop", targetLufs: -16, ceilingDb: -1 },
  { id: "type_beat", title: "Type beat", targetLufs: -12, ceilingDb: -2 },
  { id: "study_lofi", title: "Study lo-fi", allowedGenres: ["lofi_hiphop"], defaultSeconds: 120, targetLufs: -14, ceilingDb: -1 },
];
export function isUseCaseId(value: string): value is UseCaseId {
  return (USE_CASE_IDS as readonly string[]).includes(value);
}
