import { Music2Error } from "../shared/index.ts";

function invalid(text: string, expected: string): never {
  throw new Music2Error("E_PARSE", `expected ${expected}`, {
    details: { src: text, offset: 0, expected }, fix: `${text}\n^ expected ${expected}`,
  });
}

export function noteToMidi(text: string): number {
  const match = /^([a-gA-G])(#|b|s)?(-?\d)$/.exec(text);
  if (!match) return invalid(text, "note with explicit octave, e.g. c4");
  const name = match[1]?.toLowerCase();
  const base: Record<string, number> = { c: 0, d: 2, e: 4, f: 5, g: 7, a: 9, b: 11 };
  const pitch = base[name ?? ""];
  if (pitch === undefined) return invalid(text, "note name");
  const accidental = match[2] === "b" ? -1 : match[2] ? 1 : 0;
  return (Number(match[3]) + 1) * 12 + pitch + accidental;
}

export function midiToName(m: number): string {
  if (!Number.isInteger(m)) return invalid(String(m), "integer MIDI pitch");
  const names = ["c", "c#", "d", "eb", "e", "f", "f#", "g", "g#", "a", "bb", "b"];
  return `${names[((m % 12) + 12) % 12]}${Math.floor(m / 12) - 1}`;
}

export function parseSampleRef(text: string): { name: string; index: number } {
  const match = /^([A-Za-z][A-Za-z0-9#.-]*)(?::(\d+))?$/.exec(text);
  if (!match?.[1]) return invalid(text, "sample name or name:index");
  const index = match[2] === undefined ? 0 : Number(match[2]);
  if (!Number.isSafeInteger(index)) return invalid(text, "safe sample index");
  return { name: match[1], index };
}

export function parseNumber(text: string): number {
  if (!/^-?\d+(?:\.\d+)?$/.test(text)) return invalid(text, "decimal number");
  const value = Number(text);
  if (!Number.isFinite(value)) return invalid(text, "finite decimal number");
  return value;
}
