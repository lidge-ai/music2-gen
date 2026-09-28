import { Music2Error } from "../../shared/index.ts";
import type { ResolvedSong, ResolvedTrack } from "../../song/index.ts";
import type { VoiceSpec } from "../render.schema.ts";
import { bassVoice } from "./bass.tool.ts";
import { bellVoice } from "./bell.tool.ts";
import { drumsVoice } from "./drums.tool.ts";
import { eightOhEightVoice } from "./eight-o-eight.tool.ts";
import { keysVoice } from "./keys.tool.ts";
import { leadVoice } from "./lead.tool.ts";
import { padVoice } from "./pad.tool.ts";
import { pluckVoice } from "./pluck.tool.ts";
import { sfxVoice } from "./sfx.tool.ts";
import { supersawVoice } from "./supersaw.tool.ts";
import { pianoVoice } from "./piano.tool.ts";
import { epianoVoice } from "./epiano.tool.ts";
import { organVoice } from "./organ.tool.ts";
import { stringsVoice } from "./strings.tool.ts";
import { brassVoice } from "./brass.tool.ts";
import { fluteVoice } from "./flute.tool.ts";
import { choirVoice } from "./choir.tool.ts";
import { marimbaVoice } from "./marimba.tool.ts";
import { vibraphoneVoice } from "./vibraphone.tool.ts";
import { glockenspielVoice } from "./glockenspiel.tool.ts";
import { kalimbaVoice } from "./kalimba.tool.ts";
import { guitarVoice } from "./guitar.tool.ts";

interface Issue { path: string; message: string }

export const VOICES: Readonly<Record<string, VoiceSpec>> = Object.freeze({
  drums: drumsVoice, "808": eightOhEightVoice, bass: bassVoice, bell: bellVoice,
  keys: keysVoice, pluck: pluckVoice, pad: padVoice, lead: leadVoice, supersaw: supersawVoice, sfx: sfxVoice,
  piano: pianoVoice, epiano: epianoVoice, organ: organVoice, strings: stringsVoice, brass: brassVoice,
  flute: fluteVoice, choir: choirVoice, marimba: marimbaVoice, vibraphone: vibraphoneVoice,
  glockenspiel: glockenspielVoice, kalimba: kalimbaVoice, guitar: guitarVoice,
});

function voiceFor(instrument: string): VoiceSpec | undefined {
  return Object.hasOwn(VOICES, instrument) ? VOICES[instrument] : undefined;
}

/** Built-in drum-kind sample vocabulary; kit manifests own their own names. */
export function declaredSampleNames(instrument: string): readonly string[] | null {
  if (instrument.startsWith("kit:")) return null;
  const voice = voiceFor(instrument);
  return voice?.kind === "drums" ? voice.sampleNames ?? null : null;
}

export function resolveVoice(track: ResolvedTrack, index: number): VoiceSpec | null {
  if (track.instrument.startsWith("kit:")) return null;
  const spec = voiceFor(track.instrument);
  if (!spec) throw new Music2Error("E_SCHEMA", `unknown instrument ${track.instrument}`, {
    details: { issues: [{ path: `tracks[${index}].instrument`, message: `unknown instrument ${track.instrument}` }] },
  });
  if (track.kind !== spec.kind) throw new Music2Error("E_SCHEMA", `instrument ${spec.id} requires ${spec.kind} track`, {
    details: { issues: [{ path: `tracks[${index}].kind`, message: `instrument ${spec.id} requires ${spec.kind} track` }] },
  });
  return spec;
}

export function mergeParams(spec: VoiceSpec, params: Readonly<Record<string, number>>): Record<string, number> {
  const merged: Record<string, number> = {};
  for (const [name, rule] of Object.entries(spec.params)) merged[name] = params[name] ?? rule.default;
  return merged;
}

export function validateVoiceParams(song: ResolvedSong): void {
  const issues: Issue[] = [];
  song.tracks.forEach((track, index) => {
    if (track.instrument.startsWith("kit:")) return;
    const spec = voiceFor(track.instrument);
    if (!spec) {
      issues.push({ path: `tracks[${index}].instrument`, message: `unknown instrument ${track.instrument}` });
      return;
    }
    if (track.kind !== spec.kind) {
      issues.push({ path: `tracks[${index}].kind`, message: `instrument ${spec.id} requires ${spec.kind} track` });
    }
    if ((spec.id === "bass" || spec.id === "808") && !track.mono) {
      issues.push({ path: `tracks[${index}].mono`, message: `instrument ${spec.id} requires mono:true` });
    }
    for (const [name, value] of Object.entries(track.params)) {
      const path = `tracks[${index}].params.${name}`;
      const rule = Object.hasOwn(spec.params, name) ? spec.params[name] : undefined;
      if (!rule) issues.push({ path, message: "unknown parameter" });
      else if (!Number.isFinite(value)) issues.push({ path, message: "must be finite" });
      else if (value < rule.min || value > rule.max) {
        issues.push({ path, message: `must be in [${rule.min},${rule.max}]` });
      } else if (rule.integer && !Number.isInteger(value)) issues.push({ path, message: "must be an integer" });
      // Vibraphone tremolo is off at 0 or a musical 2..7 Hz; slower rates read as a volume drift.
      else if (spec.id === "vibraphone" && name === "tremoloHz" && value > 0 && value < 2) {
        issues.push({ path, message: "must be 0 (off) or in [2,7]" });
      }
    }
  });
  if (issues.length) throw new Music2Error("E_SCHEMA", `song has ${issues.length} voice issue(s)`, {
    details: { issues },
  });
}
