import { Music2Error } from "../shared/index.ts";
import { noteToMidi, parseMini, parseNumber, parseSampleRef } from "../pattern/index.ts";
import type { Node } from "../pattern/index.ts";
import { DELAY_BUS_SPEC, INSERT_SPECS, MASTER_INSERT_TYPES, MAX_MASTER_INSERTS, MAX_TRACK_INSERTS, REVERB_SPEC } from "../render/fx/fx.schema.ts";
import type { DelayBusParams, InsertInput, ResolvedInsert, ReverbBusParams, ParamSpec } from "../render/fx/fx.schema.ts";
import { audioTracksRule, automationRule, notesRule, pluginChainRule, resolveAudioTracks, resolveDawTrack, resolvePlugins, validateDawFields, validatePluginFields } from "./song-daw.schema.ts";
import type { AudioTrackInput, LaneInput, NoteInput, PluginUse, ResolvedAudioTrack, ResolvedLane, ResolvedNote } from "./song-daw.schema.ts";

/** Delivery presets (devlog/_fin/260928_music2_flow_practice/020_real_world_checks.md). Owned here so song validation needs no usecases import. */
export const USE_CASE_IDS = ["short_15", "short_30", "short_60", "vo_bed", "podcast_sting", "podcast_theme", "game_loop", "type_beat", "study_lofi"] as const;
export type UseCaseId = (typeof USE_CASE_IDS)[number];

export interface Song {
  version: 1; title?: string; genre?: string; bpm: number;
  meter?: { numerator: number; denominator: 4 }; key?: string; seed?: number; swing?: number;
  sampleRate?: 44100 | 48000; tailSeconds?: number;
  /** Whole song is a loop body: render wraps the tail onto the start and exports exactly the timeline length. */
  loop?: boolean; useCase?: UseCaseId;
  master?: { gainDb?: number; ceilingDb?: number; targetLufs?: number; fx?: InsertInput[] };
  fx?: { reverb?: Partial<ReverbBusParams>; delay?: Partial<DelayBusParams> };
  tracks: Track[]; sections: Section[]; arrangement: { section: string; repeats?: number }[];
  audioTracks?: AudioTrackInput[];
}
export interface Track {
  id: string; kind: "drums" | "notes"; instrument: string; pattern?: string;
  velocity?: number | string; gain?: number; pan?: number; gate?: number; mono?: boolean;
  glide?: number; transpose?: number; swing?: boolean;
  sends?: { reverb?: number; delay?: number };
  fx?: InsertInput[];
  duck?: { by: string; amount: number; releaseMs?: number };
  params?: Record<string, number>;
  notes?: NoteInput[]; automation?: LaneInput[];
  plugins?: PluginUse[];
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
  fx?: ResolvedInsert[];
  duck: { by: string; amount: number; releaseMs: number } | null;
  params: Record<string, number>;
  notes?: ResolvedNote[]; automation?: ResolvedLane[];
  plugins?: PluginUse[];
}
export interface ResolvedSection { id: string; bars: number; role: Section["role"] | null; patterns: Record<string, string | null> }
export interface ResolvedSong {
  version: 1; title: string; genre: string | null; bpm: number;
  meter: { numerator: number; denominator: 4 }; key: string | null; seed: number; swing: number;
  sampleRate: 44100 | 48000; tailSeconds: number; loop: boolean; useCase: UseCaseId | null;
  master: { gainDb: number; ceilingDb: number; targetLufs: number | null; fx: ResolvedInsert[] };
  fx: { reverb: ReverbBusParams | null; delay: DelayBusParams | null } | null;
  tracks: ResolvedTrack[]; sections: ResolvedSection[];
  arrangement: { section: string; repeats: number }[];
  audioTracks?: ResolvedAudioTrack[];
}

const id = { type: "string", pattern: "^[a-z][a-z0-9_-]{0,31}$" };
const unit = { type: "number", minimum: 0, maximum: 1 };
const pattern = { type: "string" };
function paramRule(spec: ParamSpec): Record<string, unknown> {
  if (spec.kind === "number") return { type: spec.integer ? "integer" : "number", minimum: spec.min, maximum: spec.max };
  if (spec.kind === "enum") return { enum: [...spec.values] };
  return { type: "boolean" };
}
function paramProperties(specs: Record<string, ParamSpec>): Record<string, Record<string, unknown>> {
  return Object.fromEntries(Object.entries(specs).map(([key, spec]) => [key, paramRule(spec)]));
}
function insertRule(types: readonly (keyof typeof INSERT_SPECS)[], maximum: number): Record<string, unknown> {
  return { type: "array", minItems: 0, maxItems: maximum, items: { oneOf: types.map((type) => ({
    type: "object", required: ["type"], additionalProperties: false,
    properties: { type: { const: type }, ...paramProperties(INSERT_SPECS[type]) },
  })) } };
}
const trackFxRule = insertRule(Object.keys(INSERT_SPECS) as (keyof typeof INSERT_SPECS)[], MAX_TRACK_INSERTS);
const masterFxRule = insertRule(MASTER_INSERT_TYPES, MAX_MASTER_INSERTS);
const busRule = (specs: Record<string, ParamSpec>): Record<string, unknown> =>
  ({ type: "object", additionalProperties: false, properties: paramProperties(specs) });
const fxRule = { type: "object", additionalProperties: false,
  properties: { reverb: busRule(REVERB_SPEC), delay: busRule(DELAY_BUS_SPEC) } };
const trackProperties = {
  id, kind: { enum: ["drums", "notes"] }, instrument: { type: "string", minLength: 1 }, pattern,
  velocity: { oneOf: [unit, pattern] }, gain: { type: "number", minimum: -60, maximum: 12 },
  pan: { type: "number", minimum: -1, maximum: 1 }, gate: { type: "number", minimum: 0.05, maximum: 1 },
  mono: { type: "boolean" }, glide: { type: "number", minimum: 0, maximum: 500 },
  transpose: { type: "integer", minimum: -24, maximum: 24 }, swing: { type: "boolean" },
  sends: { type: "object", additionalProperties: false, properties: { reverb: unit, delay: unit } },
  fx: trackFxRule,
  duck: { type: "object", required: ["by", "amount"], additionalProperties: false,
    properties: { by: id, amount: unit, releaseMs: { type: "number", minimum: 0 } } },
  params: { type: "object", additionalProperties: { type: "number" } },
  notes: notesRule, automation: automationRule, plugins: pluginChainRule,
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
    fx: masterFxRule,
  } },
  fx: fxRule,
  tracks: { type: "array", minItems: 1, maxItems: 32, items: {
    type: "object", required: ["id", "kind", "instrument"], additionalProperties: false, properties: trackProperties,
  } },
  sections: { type: "array", minItems: 1, maxItems: 64, items: {
    type: "object", required: ["id", "bars"], additionalProperties: false, properties: sectionProperties,
  } },
  arrangement: { type: "array", minItems: 1, maxItems: 256, items: {
    type: "object", required: ["section"], additionalProperties: false, properties: arrangementProperties,
  } },
  audioTracks: audioTracksRule(trackFxRule),
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
    if (object(value) && branches.some((branch) => object(branch["properties"]) && "type" in branch["properties"]) &&
      typeof value["type"] !== "string") {
      issues.push({ path: `${path}.type`, message: "effect type is required" }); return;
    }
    if (object(value) && typeof value["type"] === "string") {
      const matching = branches.find((branch) => object(branch["properties"]) &&
        object(branch["properties"]["type"]) &&
        ((branch["properties"] as Record<string, Rule>)["type"]?.["const"] === value["type"]));
      if (matching) { check(value, matching, path, issues); return; }
      issues.push({ path: `${path}.type`, message: "unknown effect type" }); return;
    }
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
      issues.push({ path, message: path.endsWith(".automation") && rule["maxItems"] === 32 ? "at most 32 lanes" :
        `item count must be ${String(rule["minItems"])}..${String(rule["maxItems"])}` });
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
    if (rule["exclusiveMinimum"] !== undefined && value <= Number(rule["exclusiveMinimum"])) issues.push({ path, message: "below minimum" });
    if (rule["maximum"] !== undefined && value > Number(rule["maximum"])) issues.push({ path, message: "above maximum" });
    return;
  }
  if (type === "boolean" && typeof value !== "boolean") issues.push({ path, message: "must be a boolean" });
}

function checkFxOrder(input: Record<string, unknown>, issues: Issue[]): void {
  const checkCuts = (raw: unknown, path: string): void => {
    if (!object(raw)) return;
    if (typeof raw["lowCutHz"] === "number" && typeof raw["highCutHz"] === "number" && raw["lowCutHz"] >= raw["highCutHz"])
      issues.push({ path: `${path}.lowCutHz`, message: "must be below highCutHz" });
  };
  const tracks = Array.isArray(input["tracks"]) ? input["tracks"] : [];
  const chains = tracks.map((track: unknown, i: number) => ({ fx: object(track) ? track["fx"] : null, path: `$.tracks[${i}].fx` }));
  if (Array.isArray(input["audioTracks"])) input["audioTracks"].forEach((track: unknown, i: number) =>
    chains.push({ fx: object(track) ? track["fx"] : null, path: `$.audioTracks[${i}].fx` }));
  chains.push({ fx: object(input["master"]) ? input["master"]["fx"] : null, path: "$.master.fx" });
  for (const chain of chains) {
    if (!Array.isArray(chain.fx)) continue;
    chain.fx.forEach((raw: unknown, i: number) => {
      if (!object(raw)) return;
      const path = `${chain.path}[${i}]`;
      if (raw["type"] === "eq") {
        const low = raw["lowHz"] ?? INSERT_SPECS.eq.lowHz.default;
        const mid = raw["midHz"] ?? INSERT_SPECS.eq.midHz.default;
        const high = raw["highHz"] ?? INSERT_SPECS.eq.highHz.default;
        if (typeof low === "number" && typeof mid === "number" && low >= mid) issues.push({ path: `${path}.lowHz`, message: "must be below midHz" });
        if (typeof mid === "number" && typeof high === "number" && mid >= high) issues.push({ path: `${path}.midHz`, message: "must be below highHz" });
      }
      if (raw["type"] === "delay") checkCuts({ lowCutHz: raw["lowCutHz"] ?? INSERT_SPECS.delay.lowCutHz.default,
        highCutHz: raw["highCutHz"] ?? INSERT_SPECS.delay.highCutHz.default }, path);
    });
  }
  if (object(input["fx"])) {
    for (const [name, specs] of [["reverb", REVERB_SPEC], ["delay", DELAY_BUS_SPEC]] as const) {
      const raw = input["fx"][name];
      if (!object(raw)) continue;
      checkCuts({ lowCutHz: raw["lowCutHz"] ?? specs.lowCutHz.default,
        highCutHz: raw["highCutHz"] ?? specs.highCutHz.default }, `$.fx.${name}`);
    }
  }
}

function withDefaults(specs: Record<string, ParamSpec>, input: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(specs).map(([key, spec]) => [key, input[key] ?? spec.default]));
}
function resolvedInserts(input: InsertInput[] | undefined): ResolvedInsert[] {
  return (input ?? []).map((insert) => ({ type: insert.type, ...withDefaults(INSERT_SPECS[insert.type], insert) } as ResolvedInsert));
}
function resolvedBus<T>(specs: Record<string, ParamSpec>, input: Partial<T> | undefined): T | null {
  return input === undefined ? null : withDefaults(specs, input) as T;
}

/** Validate FX on direct resolved-song calls as well as raw song input. */
export function validateFxFields(input: unknown): void {
  const issues: Issue[] = [];
  if (!object(input)) return;
  const tracks = Array.isArray(input["tracks"]) ? input["tracks"] : [];
  tracks.forEach((track: unknown, i: number) => {
    if (object(track) && track["fx"] !== undefined) check(track["fx"], trackFxRule, `$.tracks[${i}].fx`, issues);
  });
  if (Array.isArray(input["audioTracks"])) input["audioTracks"].forEach((track: unknown, i: number) => {
    if (object(track) && track["fx"] !== undefined) check(track["fx"], trackFxRule, `$.audioTracks[${i}].fx`, issues);
  });
  if (input["fx"] !== undefined && input["fx"] !== null) check(input["fx"], fxRule, "$.fx", issues);
  if (object(input["master"]) && input["master"]["fx"] !== undefined)
    check(input["master"]["fx"], masterFxRule, "$.master.fx", issues);
  checkFxOrder(input, issues);
  if (issues.length) throw new Music2Error("E_SCHEMA", `song FX has ${issues.length} issue(s)`, { details: { issues } });
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
      if (typeof raw["pattern"] === "string" && raw["notes"] === undefined) {
        const kind = raw["kind"] === "drums" || raw["kind"] === "notes" ? raw["kind"] : null;
        checkPattern(raw["pattern"], kind, `${path}.pattern`, issues);
      }
      if (typeof raw["velocity"] === "string" && raw["notes"] === undefined) checkPattern(raw["velocity"], "velocity", `${path}.velocity`, issues);
    });
    validatePluginFields(tracks, issues);
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
        if (typeof patternValue === "string" && !(object(found) && found["notes"] !== undefined)) {
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
    if (issues.length === 0 && (input["audioTracks"] !== undefined || tracks.some((raw) => object(raw) &&
      (raw["notes"] !== undefined || raw["automation"] !== undefined ||
        (typeof raw["instrument"] === "string" && (raw["instrument"].startsWith("sfz:") || raw["instrument"].startsWith("lib:"))))))) validateDawFields(input, issues);
  }
  if (issues.length) throw new Music2Error("E_SCHEMA", `song has ${issues.length} issue(s)`, { details: { issues } });
  validateFxFields(input);
  const song = input as Song;
  return {
    version: 1, title: song.title ?? "untitled", genre: song.genre ?? null, bpm: song.bpm,
    meter: song.meter ?? { numerator: 4, denominator: 4 }, key: song.key ?? null,
    seed: song.seed ?? 1, swing: song.swing ?? 0.5, sampleRate: song.sampleRate ?? 44100,
    tailSeconds: song.tailSeconds ?? 2, loop: song.loop ?? false, useCase: song.useCase ?? null,
    master: { gainDb: song.master?.gainDb ?? 0, ceilingDb: song.master?.ceilingDb ?? -1, targetLufs: song.master?.targetLufs ?? null,
      fx: resolvedInserts(song.master?.fx) },
    fx: song.fx === undefined ? null : { reverb: resolvedBus<ReverbBusParams>(REVERB_SPEC, song.fx.reverb),
      delay: resolvedBus<DelayBusParams>(DELAY_BUS_SPEC, song.fx.delay) },
    tracks: song.tracks.map((track) => ({
      id: track.id, kind: track.kind, instrument: track.instrument, pattern: track.pattern ?? null,
      velocity: track.velocity ?? 0.8, gain: track.gain ?? 0, pan: track.pan ?? 0,
      gate: track.gate ?? 0.9, mono: track.mono ?? (track.instrument === "808" || track.instrument === "bass"),
      glide: track.glide ?? 0, transpose: track.transpose ?? 0, swing: track.swing ?? false,
      sends: { reverb: track.sends?.reverb ?? 0, delay: track.sends?.delay ?? 0 },
      fx: resolvedInserts(track.fx),
      duck: track.duck ? { by: track.duck.by, amount: track.duck.amount, releaseMs: track.duck.releaseMs ?? 180 } : null,
      params: { ...track.params },
      ...(track.notes === undefined && track.automation === undefined ? {} : resolveDawTrack(track, song)),
      ...(track.plugins === undefined ? {} : { plugins: resolvePlugins(track.plugins) }),
    })),
    sections: song.sections.map((section) => ({ id: section.id, bars: section.bars, role: section.role ?? null, patterns: { ...section.patterns } })),
    arrangement: song.arrangement.map(({ section, repeats }) => ({ section, repeats: repeats ?? 1 })),
    ...(song.audioTracks === undefined ? {} : { audioTracks: resolveAudioTracks(song)! }),
  };
}
