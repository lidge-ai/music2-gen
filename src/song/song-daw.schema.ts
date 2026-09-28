import { noteToMidi, parseSampleRef } from "../pattern/index.ts";
import { AUTOMATABLE_INSERT_PARAMS, INSERT_SPECS } from "../render/fx/fx.schema.ts";
import type { InsertInput, ParamSpec, ResolvedInsert } from "../render/fx/fx.schema.ts";
import { beatsToTicks, Music2Error, PPQ } from "../shared/index.ts";
import type { ResolvedTrack, Song, Track } from "./song.schema.ts";
export interface PluginUse { id: string; params?: Readonly<Record<string, number | string | boolean>> }

export interface NoteInput { start: number; length: number; pitch?: number | string; sample?: string; velocity?: number }
export interface ResolvedNote { tick: number; lengthTicks: number; pitch: number | null; sample: { name: string; index: number } | null; velocity: number; inputIndex: number }
export interface PointInput { at: number; value: number; curve?: "linear" | "hold" }
export interface LaneInput { target: string; points: PointInput[] }
export interface ResolvedPoint { tick: number; value: number; curve: "linear" | "hold" }
export interface ResolvedLane { target: string; points: ResolvedPoint[] }
export type AutomationTarget = { kind: "gain" | "pan" } | { kind: "send"; bus: "reverb" | "delay" } | { kind: "fx"; index: number; param: string } | { kind: "param"; param: string };
export type StretchInput = { mode: "none" } | { mode: "varispeed"; ratio: number } | { mode: "tempo"; sourceBpm: number } | { mode: "fit"; sourceSeconds: number };
export type ResolvedStretch = StretchInput;
export interface ClipInput { file: string; start: number; length: number; offset?: number; gain?: number; pitch?: number; fadeIn?: number; fadeOut?: number; stretch?: StretchInput }
export interface ResolvedClip { tick: number; lengthTicks: number; file: string; offsetSeconds: number; gainDb: number; pitchSemitones: number; stretch: ResolvedStretch; fadeInSeconds: number; fadeOutSeconds: number }
export interface AudioTrackInput {
  id: string; gain?: number; pan?: number; sends?: { reverb?: number; delay?: number };
  fx?: InsertInput[]; duck?: { by: string; amount: number; releaseMs?: number };
  clips: ClipInput[]; automation?: LaneInput[];
}
export interface ResolvedAudioTrack {
  id: string; gain: number; pan: number; sends: { reverb: number; delay: number }; fx: ResolvedInsert[];
  duck: { by: string; amount: number; releaseMs: number } | null; clips: ResolvedClip[]; automation?: ResolvedLane[];
}
interface Issue { path: string; message: string }
type Rule = Record<string, unknown>;
const object = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
const number = (minimum: number, maximum?: number): Rule => ({ type: "number", minimum, ...(maximum === undefined ? {} : { maximum }) });
const unit = number(0, 1);
const id = { type: "string", pattern: "^[a-z][a-z0-9_-]{0,31}$" };
export const pluginChainRule = { type: "array", minItems: 0, maxItems: 4, items: {
  type: "object", required: ["id"], additionalProperties: false,
  properties: { id, params: { type: "object", additionalProperties: {
    oneOf: [{ type: "number" }, { type: "string" }, { type: "boolean" }],
  } } },
} };
export function validatePluginFields(tracks: readonly unknown[], issues: Issue[]): void {
  tracks.forEach((raw, trackIndex) => {
    if (!object(raw) || !Array.isArray(raw["plugins"])) return;
    const seen = new Set<string>();
    raw["plugins"].forEach((entry: unknown, index: number) => {
      if (!object(entry)) return;
      const path = `$.tracks[${trackIndex}].plugins[${index}]`;
      if (typeof entry["id"] === "string") {
        if (seen.has(entry["id"])) issues.push({ path: `${path}.id`, message: "duplicate plugin id" });
        seen.add(entry["id"]);
      }
      if (!object(entry["params"])) return;
      const params = entry["params"];
      if (Object.keys(params).length > 32) issues.push({ path: `${path}.params`, message: "at most 32 parameters" });
      for (const [name, value] of Object.entries(params)) {
        const paramPath = `${path}.params.${name}`;
        if (!/^[A-Za-z][A-Za-z0-9_]{0,63}$/u.test(name)) issues.push({ path: paramPath, message: "invalid parameter name" });
        if (typeof value === "number" && !Number.isFinite(value) ||
            typeof value === "string" && (Buffer.byteLength(value) > 256 || value.includes("\0")))
          issues.push({ path: paramPath, message: "invalid parameter value" });
      }
    });
  });
}
export function resolvePlugins(plugins: readonly PluginUse[]): PluginUse[] {
  return plugins.map((plugin) => ({ id: plugin.id, ...(plugin.params === undefined ? {} :
    { params: Object.fromEntries(Object.entries(plugin.params).sort(([a], [b]) => a.localeCompare(b))) }) }));
}
export const notesRule = { type: "array", minItems: 0, maxItems: 20000, items: {
  type: "object", required: ["start", "length"], additionalProperties: false,
  properties: { start: number(0), length: number(0.001), pitch: { oneOf: [{ type: "integer", minimum: 0, maximum: 127 }, { type: "string" }] },
    sample: { type: "string" }, velocity: unit },
} };
export const automationRule = { type: "array", minItems: 0, maxItems: 32, items: {
  type: "object", required: ["target", "points"], additionalProperties: false,
  properties: { target: { type: "string", pattern: "^(gain|pan|send\\.(reverb|delay)|fx\\.(0|[1-9][0-9]?)\\.[A-Za-z][A-Za-z0-9]*|param\\.[A-Za-z][A-Za-z0-9]*)$" },
    points: { type: "array", minItems: 1, maxItems: 4096, items: { type: "object", required: ["at", "value"], additionalProperties: false,
      properties: { at: number(0), value: { type: "number" }, curve: { enum: ["linear", "hold"] } } } } },
} };
export function audioTracksRule(fxRule: Rule): Rule {
  const stretch = { type: "object", required: ["mode"], additionalProperties: false, properties: {
    mode: { enum: ["none", "varispeed", "tempo", "fit"] }, ratio: number(0.25, 4),
    sourceBpm: number(40, 300), sourceSeconds: { type: "number", exclusiveMinimum: 0 },
  } };
  return { type: "array", minItems: 0, maxItems: 16, items: { type: "object", required: ["id", "clips"], additionalProperties: false,
    properties: { id, gain: number(-60, 12), pan: number(-1, 1), sends: { type: "object", additionalProperties: false,
      properties: { reverb: unit, delay: unit } }, fx: fxRule,
      duck: { type: "object", required: ["by", "amount"], additionalProperties: false,
        properties: { by: id, amount: unit, releaseMs: number(0) } }, automation: automationRule,
      clips: { type: "array", minItems: 1, maxItems: 256, items: { type: "object", required: ["file", "start", "length"], additionalProperties: false,
        properties: { file: { type: "string" }, start: number(0), length: { type: "number", exclusiveMinimum: 0 },
          offset: number(0), gain: number(-60, 12), pitch: number(-24, 24), fadeIn: number(0, 10), fadeOut: number(0, 10), stretch } } } },
  } };
}

const TARGET = /^(gain|pan|send\.(reverb|delay)|fx\.(0|[1-9][0-9]?)\.([A-Za-z][A-Za-z0-9]*)|param\.([A-Za-z][A-Za-z0-9]*))$/;
export function parseTarget(target: string): AutomationTarget {
  const match = TARGET.exec(target);
  if (!match) throw new Music2Error("E_SCHEMA", "invalid automation target");
  if (target === "gain" || target === "pan") return { kind: target };
  if (match[2]) return { kind: "send", bus: match[2] as "reverb" | "delay" };
  if (match[3] && match[4]) return { kind: "fx", index: Number(match[3]), param: match[4] };
  return { kind: "param", param: match[5]! };
}
function bodyBeats(song: Record<string, unknown>): number | null {
  const sections = song["sections"];
  const arrangement = song["arrangement"];
  const meter = song["meter"];
  if (!Array.isArray(sections) || !Array.isArray(arrangement)) return null;
  const numerator = object(meter) ? meter["numerator"] : 4;
  if (typeof numerator !== "number") return null;
  const lengths = new Map(sections.filter(object).map((section) => [section["id"], section["bars"]]));
  let bars = 0;
  for (const entry of arrangement) {
    if (!object(entry) || typeof lengths.get(entry["section"]) !== "number") return null;
    bars += (lengths.get(entry["section"]) as number) * (typeof entry["repeats"] === "number" ? entry["repeats"] : 1);
  }
  return bars * numerator;
}
function sourcePathValid(path: string, extension: string): boolean {
  return path.length > extension.length && path.endsWith(extension) && !path.startsWith("/") &&
    !/^[A-Za-z]:/.test(path) && !/[\\\0]/.test(path) && path.split("/").every((part) => part !== "" && part !== "..");
}
function add(issues: Issue[], path: string, message: string): void { issues.push({ path, message }); }
function validateStart(value: number, body: number, path: string, issues: Issue[]): void {
  if (value >= body || beatsToTicks(value) >= beatsToTicks(body)) add(issues, path, `starts after song end (${value} beats)`);
}
function validateNotes(track: Record<string, unknown>, path: string, body: number | null, issues: Issue[]): void {
  if (track["notes"] === undefined) return;
  if (track["pattern"] !== undefined) add(issues, `${path}.notes`, "notes and pattern are exclusive");
  if (typeof track["velocity"] === "string") add(issues, `${path}.velocity`, "velocity pattern requires pattern");
  if (track["swing"] !== undefined) add(issues, `${path}.swing`, "swing does not apply to notes");
  if (!Array.isArray(track["notes"])) return;
  track["notes"].forEach((raw: unknown, index: number) => {
    if (!object(raw)) return;
    const notePath = `${path}.notes[${index}]`;
    const kind = track["kind"];
    if (kind === "notes") {
      if (raw["sample"] !== undefined) add(issues, `${notePath}.sample`, "not allowed for notes track");
      if (raw["pitch"] === undefined) add(issues, `${notePath}.pitch`, "is required");
      if (raw["pitch"] !== undefined) {
        try {
          const pitch = typeof raw["pitch"] === "string" ? noteToMidi(raw["pitch"]) : raw["pitch"] as number;
          if (pitch < 0 || pitch > 127) throw new Error("MIDI pitch must be 0..127");
          const transposed = pitch + (typeof track["transpose"] === "number" ? track["transpose"] : 0);
          if (transposed < 0 || transposed > 127) add(issues, `${notePath}.pitch`, "transposed MIDI pitch must be 0..127");
        } catch (error) { add(issues, `${notePath}.pitch`, error instanceof Error ? error.message : "invalid pitch"); }
      }
    } else if (kind === "drums") {
      if (raw["pitch"] !== undefined) add(issues, `${notePath}.pitch`, "not allowed for drums track");
      if (raw["sample"] === undefined) add(issues, `${notePath}.sample`, "is required");
      if (typeof raw["sample"] === "string") {
        try { parseSampleRef(raw["sample"]); }
        catch (error) { add(issues, `${notePath}.sample`, error instanceof Error ? error.message : "invalid sample"); }
      }
    }
    if (body !== null && typeof raw["start"] === "number") validateStart(raw["start"], body, `${notePath}.start`, issues);
    if (typeof raw["length"] === "number" && raw["length"] * PPQ > Number.MAX_SAFE_INTEGER)
      add(issues, `${notePath}.length`, "length exceeds safe ticks");
  });
}
function validateLanes(raw: unknown, path: string, body: number | null, fx: unknown, audio: boolean, issues: Issue[]): void {
  if (!Array.isArray(raw)) return;
  if (raw.length > 32) add(issues, path, "at most 32 lanes");
  const seen = new Set<string>();
  raw.forEach((lane: unknown, index: number) => {
    if (!object(lane) || typeof lane["target"] !== "string") return;
    const targetPath = `${path}[${index}].target`;
    let target: AutomationTarget;
    try { target = parseTarget(lane["target"]); }
    catch { add(issues, targetPath, "invalid automation target"); return; }
    if (seen.has(lane["target"])) add(issues, targetPath, "duplicate automation target");
    seen.add(lane["target"]);
    let spec: ParamSpec | undefined;
    if (target.kind === "param" && audio) add(issues, targetPath, "param target requires music track");
    if (target.kind === "fx") {
      const insert = Array.isArray(fx) ? (fx as unknown[])[target.index] : undefined;
      const type = object(insert) ? insert["type"] : undefined;
      if (typeof type !== "string" || !(type in INSERT_SPECS)) add(issues, targetPath, "unknown insert");
      else {
        spec = (INSERT_SPECS[type as keyof typeof INSERT_SPECS] as Record<string, ParamSpec>)[target.param];
        const allowed = (AUTOMATABLE_INSERT_PARAMS as Record<string, readonly string[]>)[type];
        if (!spec || spec.kind !== "number" || !allowed?.includes(target.param)) add(issues, targetPath, "parameter is not automatable");
      }
    }
    if (!Array.isArray(lane["points"])) return;
    let previousBeat = -1; let previousTick = -1; let sameBeatCount = 0;
    lane["points"].forEach((point: unknown, pointIndex: number) => {
      if (!object(point) || typeof point["at"] !== "number" || typeof point["value"] !== "number") return;
      const pointPath = `${path}[${index}].points[${pointIndex}]`;
      if (body !== null && point["at"] > body) {
        add(issues, `${pointPath}.at`, "after song end"); return;
      }
      const tick = beatsToTicks(point["at"]);
      if (point["at"] < previousBeat) add(issues, `${pointPath}.at`, "points must be nondecreasing");
      sameBeatCount = point["at"] === previousBeat ? sameBeatCount + 1 : 1;
      if (sameBeatCount > 2) add(issues, `${pointPath}.at`, "at most two points at one beat");
      if (point["at"] !== previousBeat && tick === previousTick) add(issues, `${pointPath}.at`, "distinct beats round to same tick");
      previousBeat = point["at"]; previousTick = tick;
      const [min, max] = target.kind === "gain" ? [-60, 12] : target.kind === "pan" ? [-1, 1] :
        target.kind === "send" ? [0, 1] : target.kind === "fx" && spec?.kind === "number" ? [spec.min, spec.max] : [-Infinity, Infinity];
      if (point["value"] < min || point["value"] > max || (spec?.kind === "number" && target.kind === "fx" && spec.integer && !Number.isInteger(point["value"])))
        add(issues, `${pointPath}.value`, "outside target range");
    });
  });
}
function validateClips(track: Record<string, unknown>, path: string, body: number | null, bpm: number, issues: Issue[]): void {
  if (!Array.isArray(track["clips"])) return;
  const spans: { tick: number; end: number; index: number }[] = [];
  track["clips"].forEach((clip: unknown, index: number) => {
    if (!object(clip)) return;
    const clipPath = `${path}.clips[${index}]`;
    if (typeof clip["file"] === "string" && !sourcePathValid(clip["file"], ".wav")) add(issues, `${clipPath}.file`, "invalid relative .wav path");
    if (typeof clip["start"] !== "number" || typeof clip["length"] !== "number") return;
    if (body !== null && clip["start"] >= body) { add(issues, `${clipPath}.start`, `starts after song end (${clip["start"]} beats)`); return; }
    if (body !== null) validateStart(clip["start"], body, `${clipPath}.start`, issues);
    if (clip["start"] * PPQ > Number.MAX_SAFE_INTEGER) { add(issues, `${clipPath}.start`, "start exceeds safe ticks"); return; }
    if (clip["length"] * PPQ > Number.MAX_SAFE_INTEGER) {
      add(issues, `${clipPath}.length`, "length exceeds safe ticks"); return;
    }
    const tick = beatsToTicks(clip["start"]); const lengthTicks = beatsToTicks(clip["length"]);
    if (lengthTicks === 0) { add(issues, `${clipPath}.length`, "length rounds to zero ticks"); return; }
    spans.push({ tick, end: tick + lengthTicks, index });
    const stretch = clip["stretch"];
    if (stretch === undefined) return;
    if (!object(stretch)) return;
    const mode = stretch["mode"];
    const keys = mode === "none" ? ["mode"] : mode === "varispeed" ? ["mode", "ratio"] :
      mode === "tempo" ? ["mode", "sourceBpm"] : mode === "fit" ? ["mode", "sourceSeconds"] : [];
    if (!keys.length || Object.keys(stretch).some((key) => !keys.includes(key)) || keys.some((key) => !(key in stretch))) {
      add(issues, `${clipPath}.stretch`, "invalid stretch mode fields"); return;
    }
    const ratio = mode === "varispeed" ? stretch["ratio"] as number : mode === "tempo" ? (stretch["sourceBpm"] as number) / bpm :
      mode === "fit" ? (lengthTicks / PPQ) * 60 / bpm / (stretch["sourceSeconds"] as number) : 1;
    if (!Number.isFinite(ratio) || ratio < 0.25 || ratio > 4) add(issues, `${clipPath}.stretch`, "stretch ratio outside 0.25..4");
  });
  spans.sort((a, b) => a.tick - b.tick || a.index - b.index);
  for (let i = 1; i < spans.length; i++) if (spans[i]!.tick < spans[i - 1]!.end)
    add(issues, `${path}.clips[${spans[i]!.index}]`, `overlaps clip ${spans[i - 1]!.index}`);
}
export function validateDawFields(input: unknown, issues: Issue[]): void {
  if (!object(input)) return;
  const tracks = Array.isArray(input["tracks"]) ? input["tracks"] : [];
  const audio = Array.isArray(input["audioTracks"]) ? input["audioTracks"] : [];
  const body = bodyBeats(input); const bpm = typeof input["bpm"] === "number" ? input["bpm"] : 120;
  const ids = new Set(tracks.filter(object).map((track) => track["id"]));
  tracks.forEach((track: unknown, index: number) => {
    if (!object(track)) return;
    const path = `$.tracks[${index}]`;
    validateNotes(track, path, body, issues);
    if (typeof track["instrument"] === "string" && track["instrument"].startsWith("sfz:")) {
      if (track["kind"] !== "notes" || !sourcePathValid(track["instrument"].slice(4), ".sfz"))
        add(issues, `${path}.instrument`, "invalid sfz reference for notes track");
    }
    validateLanes(track["automation"], `${path}.automation`, body, track["fx"], false, issues);
  });
  const listIds = new Set(tracks.filter(object).filter((track) => track["notes"] !== undefined).map((track) => track["id"]));
  const sections = Array.isArray(input["sections"]) ? input["sections"] : [];
  sections.forEach((section: unknown, index: number) => {
    if (!object(section) || !object(section["patterns"])) return;
    for (const key of Object.keys(section["patterns"])) if (listIds.has(key))
      add(issues, `$.sections[${index}].patterns.${key}`, "track uses notes");
  });
  audio.forEach((track: unknown, index: number) => {
    if (!object(track)) return;
    const path = `$.audioTracks[${index}]`;
    if (ids.has(track["id"])) add(issues, `${path}.id`, "duplicate track id");
    ids.add(track["id"]);
    const duck = track["duck"];
    if (object(duck) && typeof duck["by"] === "string" &&
      (!tracks.some((source: unknown) => object(source) && source["id"] === duck["by"] &&
        (Array.isArray(source["notes"]) ? source["notes"].length > 0 : typeof source["pattern"] === "string" ||
          sections.some((section: unknown) => object(section) && object(section["patterns"]) && typeof section["patterns"][duck["by"] as string] === "string"))) || duck["by"] === track["id"]))
      add(issues, `${path}.duck.by`, "unknown event track");
    validateClips(track, path, body, bpm, issues);
    validateLanes(track["automation"], `${path}.automation`, body, track["fx"], true, issues);
  });
}

function inserts(input: InsertInput[] | undefined): ResolvedInsert[] {
  return (input ?? []).map((insert) => ({ type: insert.type,
    ...Object.fromEntries(Object.entries(INSERT_SPECS[insert.type] as Record<string, ParamSpec>).map(([key, spec]) => [key, (insert as unknown as Record<string, unknown>)[key] ?? spec.default])) } as ResolvedInsert));
}
export function resolveLanes(input: LaneInput[] | undefined, context: { path: string; bodyBeats: number; inserts: readonly ResolvedInsert[] }): ResolvedLane[] | undefined {
  if (input === undefined) return undefined;
  const issues: Issue[] = [];
  validateLanes(input, context.path, context.bodyBeats, context.inserts, false, issues);
  if (issues.length) throw new Music2Error("E_SCHEMA", `automation has ${issues.length} issue(s)`, { details: { issues } });
  return input?.map((lane) => ({ target: lane.target, points: lane.points.map((point) =>
    ({ tick: beatsToTicks(point.at), value: point.value, curve: point.curve ?? "linear" })) }));
}
export function resolveDawTrack(input: Track, song: Song): Pick<ResolvedTrack, "notes" | "automation"> {
  const result: Pick<ResolvedTrack, "notes" | "automation"> = {};
  const body = bodyBeats(song as unknown as Record<string, unknown>) ?? 0;
  if (input.notes !== undefined) {
    result.notes = input.notes.map((note, inputIndex) => ({ tick: beatsToTicks(note.start), lengthTicks: Math.max(1, beatsToTicks(note.length)),
      pitch: input.kind === "notes" ? (typeof note.pitch === "string" ? noteToMidi(note.pitch) : note.pitch!) + (input.transpose ?? 0) : null,
      sample: input.kind === "drums" ? parseSampleRef(note.sample!) : null,
      velocity: note.velocity ?? (typeof input.velocity === "number" ? input.velocity : 0.8), inputIndex,
    })).sort((a, b) => {
      if (a.tick !== b.tick) return a.tick - b.tick;
      if (a.pitch !== null && b.pitch !== null && a.pitch !== b.pitch) return a.pitch - b.pitch;
      if (a.sample !== null && b.sample !== null) {
        const left = `${a.sample.name}:${a.sample.index}`; const right = `${b.sample.name}:${b.sample.index}`;
        if (left !== right) return left < right ? -1 : 1;
      }
      return a.inputIndex - b.inputIndex;
    });
  }
  if (input.automation !== undefined) result.automation = resolveLanes(input.automation, { path: "", bodyBeats: body, inserts: inserts(input.fx) })!;
  return result;
}
export function resolveAudioTracks(input: Song): ResolvedAudioTrack[] | undefined {
  const body = bodyBeats(input as unknown as Record<string, unknown>) ?? 0;
  return input.audioTracks?.map((track) => ({ id: track.id, gain: track.gain ?? 0, pan: track.pan ?? 0,
    sends: { reverb: track.sends?.reverb ?? 0, delay: track.sends?.delay ?? 0 }, fx: inserts(track.fx),
    duck: track.duck ? { by: track.duck.by, amount: track.duck.amount, releaseMs: track.duck.releaseMs ?? 180 } : null,
    clips: track.clips.map((clip) => ({ tick: beatsToTicks(clip.start), lengthTicks: beatsToTicks(clip.length), file: clip.file,
      offsetSeconds: clip.offset ?? 0, gainDb: clip.gain ?? 0, pitchSemitones: clip.pitch ?? 0,
      stretch: clip.stretch ?? { mode: "none" }, fadeInSeconds: clip.fadeIn ?? 0.002, fadeOutSeconds: clip.fadeOut ?? 0.002,
    })).sort((a, b) => a.tick - b.tick),
    ...(track.automation === undefined ? {} : { automation: resolveLanes(track.automation, { path: "", bodyBeats: body, inserts: inserts(track.fx) })! }),
  }));
}
