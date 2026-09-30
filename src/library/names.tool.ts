import { noteToMidi } from "../pattern/index.ts";

export const AUDIO_EXTENSION = /\.(wav|aif|aiff|aifc)$/i;
const NOTE_SUFFIX = /([A-G])([#b]?)(-?\d)( M)?\.(wav|aif|aiff)$/i;
export function namedMidi(name: string): number | null {
  const match = NOTE_SUFFIX.exec(name);
  if (!match) return null;
  try { return noteToMidi(`${match[1]}${match[2]}${match[3]}`); } catch { return null; }
}

/** First-match word table; open hats must precede generic/closed hats. */
const DRUM_WORDS: readonly [string, RegExp][] = [
  ["bd", /(?:^|[^a-z])(kick|bd|bass[ _-]*drum)(?:[^a-z]|$)/i],
  ["sd", /(?:^|[^a-z])(snare|sd)(?:[^a-z]|$)/i],
  ["cp", /(?:^|[^a-z])(clap|cp)(?:[^a-z]|$)/i],
  ["oh", /(?:^|[^a-z])(open|oh)(?:[^a-z]|$)/i],
  ["hh", /(?:^|[^a-z])(hat|hh|hi[ _-]*hat|hihat)(?:[^a-z]|$)/i],
  ["rim", /(?:^|[^a-z])(rim|rimshot)(?:[^a-z]|$)/i],
  ["perc", /(?:^|[^a-z])(perc|percussion|shaker|conga)(?:[^a-z]|$)/i],
  ["tom", /(?:^|[^a-z])tom(?:[^a-z]|$)/i],
  ["cr", /(?:^|[^a-z])(crash|cr)(?:[^a-z]|$)/i],
  ["rd", /(?:^|[^a-z])(ride|rd)(?:[^a-z]|$)/i],
];
export function drumAtom(name: string): string | null { return DRUM_WORDS.find(([, pattern]) => pattern.test(name))?.[0] ?? null; }
