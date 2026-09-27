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

interface Issue { path: string; message: string }

export const VOICES: Readonly<Record<string, VoiceSpec>> = Object.freeze({
  drums: drumsVoice, "808": eightOhEightVoice, bass: bassVoice, bell: bellVoice,
  keys: keysVoice, pluck: pluckVoice, pad: padVoice, lead: leadVoice,
});

function voiceFor(instrument: string): VoiceSpec | undefined {
  return Object.hasOwn(VOICES, instrument) ? VOICES[instrument] : undefined;
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
    }
  });
  if (issues.length) throw new Music2Error("E_SCHEMA", `song has ${issues.length} voice issue(s)`, {
    details: { issues },
  });
}
