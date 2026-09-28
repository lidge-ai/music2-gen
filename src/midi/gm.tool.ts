import { Music2Error } from "../shared/errors.tool.ts";

/** GM program bytes are zero-based. Order also determines reverse-map preference. */
export const GM_PROGRAMS = {
  piano: 0, epiano: 4, keys: 5, organ: 16, guitar: 25, bass: 38, "808": 39,
  strings: 48, choir: 52, brass: 61, flute: 73, lead: 80, supersaw: 81,
  pad: 89, bell: 14, pluck: 45, marimba: 12, vibraphone: 11,
  glockenspiel: 9, kalimba: 108,
} as const;

export const DRUM_NOTES = {
  bd: 36, sd: 38, cp: 39, rim: 37, hh: 42, oh: 46,
  "tom:0": 45, "tom:1": 47, "tom:2": 48, "tom:3": 50, perc: 56,
} as const;

/** Private music2 identities on channel 10; general GM playback is not promised. */
export const SFX_NOTES = {
  riser: 84, pitchriser: 85, downlifter: 86, impact: 87, whoosh: 88,
  revcymbal: 89, noisebuild: 90, subdrop: 91, zap: 92, crackle: 93,
} as const;

const GM_ENTRIES = Object.entries(GM_PROGRAMS);
const DRUM_ENTRIES = Object.entries(DRUM_NOTES);
const SFX_ENTRIES = Object.entries(SFX_NOTES);

export function programForInstrument(instrument: string): number | undefined {
  return Object.hasOwn(GM_PROGRAMS, instrument) ? GM_PROGRAMS[instrument as keyof typeof GM_PROGRAMS] : undefined;
}

export function instrumentForProgram(program: number): string | undefined {
  return GM_ENTRIES.find(([, value]) => value === program)?.[0];
}

export function drumNoteFor(name: string, variant = 0): number | undefined {
  const normalized = name.toLowerCase();
  const base = normalized.split(":", 1)[0]!;
  if (base === "tom") {
    const explicit = normalized.includes(":") ? Number(normalized.slice(4)) : variant;
    if (!Number.isInteger(explicit) || explicit < 0) return undefined;
    return [45, 47, 48, 50][explicit % 4];
  }
  const aliases: Record<string, keyof typeof DRUM_NOTES> = {
    kick: "bd", snare: "sd", clap: "cp", hat: "hh", openhat: "oh", sidestick: "rim",
  };
  const key = aliases[base] ?? base;
  return Object.hasOwn(DRUM_NOTES, key) ? DRUM_NOTES[key as keyof typeof DRUM_NOTES] : undefined;
}

export function drumNameFor(note: number): string | undefined {
  return DRUM_ENTRIES.find(([, value]) => value === note)?.[0];
}

export function sfxNoteFor(atom: string): number | undefined {
  const base = atom.split(":", 1)[0]!;
  return Object.hasOwn(SFX_NOTES, base) ? SFX_NOTES[base as keyof typeof SFX_NOTES] : undefined;
}

export function sfxNameFor(note: number): string | undefined {
  return SFX_ENTRIES.find(([, value]) => value === note)?.[0];
}

export function kitMidiMap(names: readonly string[], explicit: Readonly<Record<string, number>> = {}): { byName: Record<string, number>; warnings: string[] } {
  const available = new Set(names);
  const used = new Set<number>();
  const byName: Record<string, number> = {};
  const warnings: string[] = [];
  for (const [name, note] of Object.entries(explicit)) {
    if (!available.has(name) || !Number.isInteger(note) || note < 0 || note > 127 || used.has(note)) {
      throw new Music2Error("E_SCHEMA", `invalid kit MIDI mapping at $.midi.${name}`, { details: { path: `$.midi.${name}` } });
    }
    byName[name] = note;
    used.add(note);
  }
  let fallback = 60;
  for (const name of names) {
    if (Object.hasOwn(byName, name)) continue;
    const alias = drumNoteFor(name);
    if (alias !== undefined && !used.has(alias)) {
      byName[name] = alias;
      used.add(alias);
      continue;
    }
    while (used.has(fallback) && fallback <= 127) fallback++;
    if (fallback > 127) throw new Music2Error("E_CAPABILITY", "kit has more distinct MIDI notes than available");
    byName[name] = fallback;
    used.add(fallback);
    warnings.push(`KIT_FALLBACK_NOTE:${name}=${fallback}`);
    fallback++;
  }
  return { byName, warnings };
}

const FIFTHS_MAJOR = ["Cb", "Gb", "Db", "Ab", "Eb", "Bb", "F", "C", "G", "D", "A", "E", "B", "F#", "C#"];
const FIFTHS_MINOR = ["Ab", "Eb", "Bb", "F", "C", "G", "D", "A", "E", "B", "F#", "C#", "G#", "D#", "A#"];

export function keyToSmf(key: string): { sf: number; mi: 0 | 1 } | null {
  const match = /^([A-G](?:#|b)?) (major|minor)$/.exec(key);
  if (!match) return null;
  const mi = match[2] === "minor" ? 1 : 0;
  const sf = (mi ? FIFTHS_MINOR : FIFTHS_MAJOR).indexOf(match[1]!) - 7;
  return sf < -7 ? null : { sf, mi };
}

export function smfToKey(sf: number, mi: 0 | 1): string {
  if (!Number.isInteger(sf) || sf < -7 || sf > 7 || (mi !== 0 && mi !== 1)) {
    throw new Music2Error("E_INPUT", "SMF key signature must have sf -7..7 and mi 0/1");
  }
  return `${(mi ? FIFTHS_MINOR : FIFTHS_MAJOR)[sf + 7]} ${mi ? "minor" : "major"}`;
}
