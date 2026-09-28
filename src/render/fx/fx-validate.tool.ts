import { validateFxFields } from "../../song/song.schema.ts";

/** FX boundary validation for direct ResolvedSong render calls. */
export function validateResolvedFx(song: unknown): void {
  if (!song || typeof song !== "object" || Array.isArray(song)) return;
  const source = song as Record<string, unknown>;
  const buses = source["fx"];
  if (!buses || typeof buses !== "object" || Array.isArray(buses)) { validateFxFields(song); return; }
  const fx = Object.fromEntries(Object.entries(buses).filter(([key, value]) =>
    value !== null || (key !== "reverb" && key !== "delay")));
  validateFxFields({ ...source, fx });
}
