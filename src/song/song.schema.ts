import { Music2Error } from "../shared/index.ts";
import { noteToMidi, parseMini, parseNumber, parseSampleRef } from "../pattern/index.ts";
import type { Node } from "../pattern/index.ts";

/** Delivery presets (devlog/_plan/260928_music2_flow_practice/020_real_world_checks.md). Owned here so song validation needs no usecases import. */
export const USE_CASE_IDS = ["short_15", "short_30", "short_60", "vo_bed", "podcast_sting", "podcast_theme", "game_loop", "type_beat", "study_lofi"] as const;
export type UseCaseId = (typeof USE_CASE_IDS)[number];

export interface Song {
  version: 1; title?: string; genre?: string; bpm: number;
  meter?: { numerator: number; denominator: 4 }; key?: string; seed?: number; swing?: number;
  sampleRate?: 44100 | 48000; tailSeconds?: number;
  /** Whole song is a loop body: render wraps the tail onto the start and exports exactly the timeline length. */
  loop?: boolean; useCase?: UseCaseId;
  master?: { gainDb?: number; ceilingDb?: number; targetLufs?: number };
  tracks: Track[]; sections: Section[]; arrangement: { section: string; repeats?: number }[];
}
export interface Track {
  id: string; kind: "drums" | "notes"; instrument: string; pattern?: string;
  velocity?: number | string; gain?: number; pan?: number; gate?: number; mono?: boolean;
  glide?: number; transpose?: number; swing?: boolean;
  sends?: { reverb?: number; delay?: number };
  duck?: { by: string; amount: number; releaseMs?: number };
  params?: Record<string, number>;
}
export interface Section {
  id: string; bars: number;
  role?: "intro" | "verse" | "hook" | "build" | "breakdown" | "groove" | "outro" | "bridge";
  patterns?: Record<string, string | null>;
}
export interface ResolvedTrack {
  id: string; kind: "drums" | "notes"; instrument: string;
  pattern: string | null; velocity: number | string; gain: number; pan: number; gate: number;
  mono: boolean; glide: number; transpose: number; swing: boolean;
  sends: { reverb: number; delay: number };
  duck: { by: string; amount: number; releaseMs: number } | null;
  params: Record<string, number>;
}
export interface ResolvedSection { id: string; bars: number; role: Section["role"] | null; patterns: Record<string, string | null> }
export interface ResolvedSong {
  version: 1; title: string; genre: string | null; bpm: number;
  meter: { numerator: number; denominator: 4 }; key: string | null; seed: number; swing: number;
  sampleRate: 44100 | 48000; tailSeconds: number; loop: boolean; useCase: UseCaseId | null;
  master: { gainDb: number; ceilingDb: number; targetLufs: number | null };
  tracks: ResolvedTrack[]; sections: ResolvedSection[];
  arrangement: { section: string; repeats: number }[];
}

const id = { type: "string", pattern: "^[a-z][a-z0-9_-]{0,31}$" };
const unit = { type: "number", minimum: 0, maximum: 1 };
const pattern = { type: "string" };
const trackProperties = {
  id, kind: { enum: ["drums", "notes"] }, instrument: { type: "string", minLength: 1 }, pattern,
  velocity: { oneOf: [unit, pattern] }, gain: { type: "number", minimum: -60, maximum: 12 },
  pan: { type: "number", minimum: -1, maximum: 1 }, gate: { type: "number", minimum: 0.05, maximum: 1 },
  mono: { type: "boolean" }, glide: { type: "number", minimum: 0, maximum: 500 },
  transpose: { type: "integer", minimum: -24, maximum: 24 }, swing: { type: "boolean" },
  sends: { type: "object", additionalProperties: false, properties: { reverb: unit, delay: unit } },
  duck: { type: "object", required: ["by", "amount"], additionalProperties: false,
    properties: { by: id, amount: unit, releaseMs: { type: "number", minimum: 0 } } },
  params: { type: "object", additionalProperties: { type: "number" } },
};
const sectionProperties = {
  id, bars: { type: "integer", minimum: 1, maximum: 256 },
  role: { enum: ["intro", "verse", "hook", "build", "breakdown", "groove", "outro", "bridge"] },
  patterns: { type: "object", additionalProperties: { oneOf: [pattern, { type: "null" }] } },
};
const arrangementProperties = { section: id, repeats: { type: "integer", minimum: 1, maximum: 64 } };
const songProperties = {
  version: { const: 1 }, title: { type: "string", maxLength: 120 }, genre: { type: "string" },
  bpm: { type: "number", minimum: 40, maximum: 240 },
  meter: { type: "object", required: ["numerator", "denominator"], additionalProperties: false,
    properties: { numerator: { type: "integer", minimum: 2, maximum: 12 }, denominator: { const: 4 } } },
  key: { type: "string", pattern: "^[A-G](#|b)? (major|minor)$" },
  seed: { type: "integer", minimum: 0, maximum: 4294967295 },
  swing: { type: "number", minimum: 0.5, maximum: 0.75 },
  sampleRate: { enum: [44100, 48000] }, tailSeconds: { type: "number", minimum: 0, maximum: 10 },
  loop: { type: "boolean" }, useCase: { enum: [...USE_CASE_IDS] },
  master: { type: "object", additionalProperties: false, properties: {
    gainDb: { type: "number", minimum: -24, maximum: 12 },
    ceilingDb: { type: "number", minimum: -6, maximum: 0 },
    targetLufs: { type: "number", minimum: -30, maximum: -6 },
  } },
  tracks: { type: "array", minItems: 1, maxItems: 32, items: {
    type: "object", required: ["id", "kind", "instrument"], additionalProperties: false, properties: trackProperties,
  } },
  sections: { type: "array", minItems: 1, maxItems: 64, items: {
    type: "object", required: ["id", "bars"], additionalProperties: false, properties: sectionProperties,
  } },
  arrangement: { type: "array", minItems: 1, maxItems: 256, items: {
    type: "object", required: ["section"], additionalProperties: false, properties: arrangementProperties,
  } },
};
export const SONG_JSON_SCHEMA = {
  $schema: "https://json-schema.org/draft/2020-12/schema", title: "music2 song v1", type: "object",
  required: ["version", "bpm", "tracks", "sections", "arrangement"],
  additionalProperties: false, properties: songProperties,
} as const;

interface Issue { path: string; message: string }
type Rule = Record<string, unknown>;
const object = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

function check(value: unknown, rule: Rule, path: string, issues: Issue[]): void {
  if ("const" in rule && value !== rule["const"]) issues.push({ path, message: `must equal ${String(rule["const"])}` });
  if (Array.isArray(rule["enum"]) && !rule["enum"].includes(value)) issues.push({ path, message: "invalid value" });
  if (Array.isArray(rule["oneOf"])) {
    const branches = rule["oneOf"] as Rule[];
    if (!branches.some((branch) => { const found: Issue[] = []; check(value, branch, path, found); return found.length === 0; })) {
      issues.push({ path, message: "invalid value" });
    }
    return;
  }
  const type = rule["type"];
  if (type === "null") { if (value !== null) issues.push({ path, message: "must be null" }); return; }
  if (type === "object") {
    if (!object(value)) { issues.push({ path, message: "must be an object" }); return; }
    const props = (rule["properties"] ?? {}) as Record<string, Rule>;
    for (const key of (rule["required"] ?? []) as string[]) {
      if (!(key in value)) issues.push({ path: `${path}.${key}`, message: "is required" });
    }
    for (const [key, child] of Object.entries(value)) {
      const sub = props[key] ?? rule["additionalProperties"];
      if (sub === false || sub === undefined) issues.push({ path: `${path}.${key}`, message: "unknown key" });
      else if (object(sub)) check(child, sub, `${path}.${key}`, issues);
    }
    return;
  }
  if (type === "array") {
    if (!Array.isArray(value)) { issues.push({ path, message: "must be an array" }); return; }
    if (value.length < Number(rule["minItems"]) || value.length > Number(rule["maxItems"])) {
      issues.push({ path, message: `item count must be ${String(rule["minItems"])}..${String(rule["maxItems"])}` });
    }
    value.forEach((item: unknown, index) => check(item, rule["items"] as Rule, `${path}[${index}]`, issues));
    return;
  }
  if (type === "string") {
    if (typeof value !== "string") { issues.push({ path, message: "must be a string" }); return; }
    if (rule["minLength"] !== undefined && value.length < Number(rule["minLength"])) issues.push({ path, message: "too short" });
    if (rule["maxLength"] !== undefined && value.length > Number(rule["maxLength"])) issues.push({ path, message: "too long" });
    if (typeof rule["pattern"] === "string" && !new RegExp(rule["pattern"]).test(value)) issues.push({ path, message: "invalid format" });
    return;
  }
  if (type === "number" || type === "integer") {
    if (typeof value !== "number" || !Number.isFinite(value) || (type === "integer" && !Number.isInteger(value))) {
      issues.push({ path, message: `must be a finite ${type}` }); return;
    }
    if (rule["minimum"] !== undefined && value < Number(rule["minimum"])) issues.push({ path, message: "below minimum" });
    if (rule["maximum"] !== undefined && value > Number(rule["maximum"])) issues.push({ path, message: "above maximum" });
    return;
  }
  if (type === "boolean" && typeof value !== "boolean") issues.push({ path, message: "must be a boolean" });
}

function atoms(node: Node, visit: (raw: string) => void): void {
  switch (node.type) {
    case "atom": visit(node.atom.raw); break;
    case "seq": node.steps.forEach(({ node: child }) => atoms(child, visit)); break;
    case "stack": node.branches.forEach((child) => atoms(child, visit)); break;
    case "alt": node.items.forEach((child) => atoms(child, visit)); break;
    case "choose": node.options.forEach((child) => atoms(child, visit)); break;
    case "fast": case "slow": case "euclid": case "degrade": atoms(node.node, visit); break;
    case "rest": break;
  }
}

function checkPattern(value: string, kind: Track["kind"] | "velocity" | null, path: string, issues: Issue[]): void {
  try {
    const node = parseMini(value);
    atoms(node, (raw) => {
      try {
        if (kind === null) return;
        if (kind === "velocity") parseNumber(raw);
        else if (kind === "notes") {
          if (/^-?\d+(?:\.\d+)?$/.test(raw)) {
            const midi = parseNumber(raw);
            if (!Number.isInteger(midi) || midi < 0 || midi > 127) throw new Error("MIDI number must be 0..127");
          } else noteToMidi(raw);
        } else {
          if (/^[a-gA-G](?:#|b|s)?-?\d$/.test(raw) || /^-?\d/.test(raw)) throw new Error("drum atom must be a sample name");
          parseSampleRef(raw);
        }
      } catch (error) { issues.push({ path, message: error instanceof Error ? error.message : "invalid atom" }); }
    });
  } catch (error) {
    const offset = error instanceof Music2Error ? error.details?.["offset"] : undefined;
    issues.push({ path, message: `${error instanceof Error ? error.message : "invalid pattern"}${typeof offset === "number" ? ` (offset ${offset})` : ""}` });
  }
}

export function validateSong(input: unknown): ResolvedSong {
  const issues: Issue[] = [];
  check(input, SONG_JSON_SCHEMA, "$", issues);
  if (object(input)) {
    const tracks: unknown[] = Array.isArray(input["tracks"]) ? input["tracks"] : [];
    const sections: unknown[] = Array.isArray(input["sections"]) ? input["sections"] : [];
    const arrangement: unknown[] = Array.isArray(input["arrangement"]) ? input["arrangement"] : [];
    const trackIds = new Set<string>();
    const sectionIds = new Set<string>();
    tracks.forEach((raw: unknown, i) => {
      if (!object(raw)) return;
      const path = `$.tracks[${i}]`;
      if (typeof raw["id"] === "string") {
        if (trackIds.has(raw["id"])) issues.push({ path: `${path}.id`, message: "duplicate track id" });
        trackIds.add(raw["id"]);
      }
      if (typeof raw["pattern"] === "string") {
        const kind = raw["kind"] === "drums" || raw["kind"] === "notes" ? raw["kind"] : null;
        checkPattern(raw["pattern"], kind, `${path}.pattern`, issues);
      }
      if (typeof raw["velocity"] === "string") checkPattern(raw["velocity"], "velocity", `${path}.velocity`, issues);
    });
    sections.forEach((raw: unknown, i) => {
      if (!object(raw)) return;
      const path = `$.sections[${i}]`;
      if (typeof raw["id"] === "string") {
        if (sectionIds.has(raw["id"])) issues.push({ path: `${path}.id`, message: "duplicate section id" });
        sectionIds.add(raw["id"]);
      }
      if (object(raw["patterns"])) for (const [track, patternValue] of Object.entries(raw["patterns"])) {
        const subpath = `${path}.patterns.${track}`;
        if (!trackIds.has(track)) issues.push({ path: subpath, message: "unknown track" });
        const found = tracks.find((candidate: unknown) => object(candidate) && candidate["id"] === track);
        if (typeof patternValue === "string") {
          const kind = object(found) && (found["kind"] === "notes" || found["kind"] === "drums") ? found["kind"] : null;
          checkPattern(patternValue, kind, subpath, issues);
        }
      }
    });
    tracks.forEach((raw: unknown, i) => {
      if (!object(raw) || !object(raw["duck"])) return;
      const by = raw["duck"]["by"];
      if (typeof by === "string" && (!trackIds.has(by) || by === raw["id"])) {
        issues.push({ path: `$.tracks[${i}].duck.by`, message: by === raw["id"] ? "cannot duck self" : "unknown track" });
      }
    });
    arrangement.forEach((raw: unknown, i) => {
      if (object(raw) && typeof raw["section"] === "string" && !sectionIds.has(raw["section"])) {
        issues.push({ path: `$.arrangement[${i}].section`, message: "unknown section" });
      }
    });
  }
  if (issues.length) throw new Music2Error("E_SCHEMA", `song has ${issues.length} issue(s)`, { details: { issues } });
  const song = input as Song;
  return {
    version: 1, title: song.title ?? "untitled", genre: song.genre ?? null, bpm: song.bpm,
    meter: song.meter ?? { numerator: 4, denominator: 4 }, key: song.key ?? null,
    seed: song.seed ?? 1, swing: song.swing ?? 0.5, sampleRate: song.sampleRate ?? 44100,
    tailSeconds: song.tailSeconds ?? 2, loop: song.loop ?? false, useCase: song.useCase ?? null,
    master: { gainDb: song.master?.gainDb ?? 0, ceilingDb: song.master?.ceilingDb ?? -1, targetLufs: song.master?.targetLufs ?? null },
    tracks: song.tracks.map((track) => ({
      id: track.id, kind: track.kind, instrument: track.instrument, pattern: track.pattern ?? null,
      velocity: track.velocity ?? 0.8, gain: track.gain ?? 0, pan: track.pan ?? 0,
      gate: track.gate ?? 0.9, mono: track.mono ?? (track.instrument === "808" || track.instrument === "bass"),
      glide: track.glide ?? 0, transpose: track.transpose ?? 0, swing: track.swing ?? false,
      sends: { reverb: track.sends?.reverb ?? 0, delay: track.sends?.delay ?? 0 },
      duck: track.duck ? { by: track.duck.by, amount: track.duck.amount, releaseMs: track.duck.releaseMs ?? 180 } : null,
      params: { ...track.params },
    })),
    sections: song.sections.map((section) => ({ id: section.id, bars: section.bars, role: section.role ?? null, patterns: { ...section.patterns } })),
    arrangement: song.arrangement.map(({ section, repeats }) => ({ section, repeats: repeats ?? 1 })),
  };
}
