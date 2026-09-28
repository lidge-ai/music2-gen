import { libraryInstrument } from "../sampler/index.ts";
import type { LintGeometry } from "./lint-geometry.tool.ts";

/** Synth voices that carry a line; shared by the layering and phrase rules. */
export const FOCAL_VOICES = new Set(["lead", "bell", "pluck", "keys", "piano", "epiano", "guitar", "flute",
  "brass", "marimba", "vibraphone", "glockenspiel", "kalimba"]);
/** Sustained beds that never count as the melody. */
export const BED_VOICES = new Set(["strings", "pad", "choir", "organ"]);

const libraryRole = (instrument: string): "focal" | "bed" | null =>
  instrument.startsWith("lib:") ? libraryInstrument(instrument.slice(4)).role : null;
export const isFocalInstrument = (instrument: string): boolean =>
  libraryRole(instrument) === "focal" || FOCAL_VOICES.has(instrument);
export const isBedInstrument = (instrument: string): boolean =>
  libraryRole(instrument) === "bed" || BED_VOICES.has(instrument);
export const isBassInstrument = (instrument: string): boolean => instrument === "bass" || instrument === "808";
const isSampledMelody = (instrument: string): boolean => instrument.startsWith("kit:") || instrument.startsWith("sfz:");

/**
 * Every notes track that may carry the melody, in track order. Focal voices and user samples come first;
 * when a song has none, any notes track that is neither bass nor a bed qualifies. Order and ids never matter.
 */
export function melodyTrackIds(g: LintGeometry): string[] {
  const notes = g.song.tracks.filter((track) => track.kind === "notes" && !isBassInstrument(track.instrument));
  const focal = notes.filter((track) => isFocalInstrument(track.instrument) || isSampledMelody(track.instrument));
  return (focal.length ? focal : notes.filter((track) => !isBedInstrument(track.instrument))).map((track) => track.id);
}
