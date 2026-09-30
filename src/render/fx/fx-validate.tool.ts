import { Music2Error } from "../../shared/index.ts";
import { DELAY_BUS_SPEC, INSERT_SPECS, MASTER_INSERT_TYPES, MAX_MASTER_INSERTS, MAX_TRACK_INSERTS, REVERB_SPEC } from "./fx.schema.ts";
import type { InsertInput, ParamSpec, ResolvedInsert } from "./fx.schema.ts";

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
export const trackFxRule = insertRule(Object.keys(INSERT_SPECS) as (keyof typeof INSERT_SPECS)[], MAX_TRACK_INSERTS);
export const masterFxRule = insertRule(MASTER_INSERT_TYPES, MAX_MASTER_INSERTS);
const busRule = (specs: Record<string, ParamSpec>): Record<string, unknown> =>
  ({ type: "object", additionalProperties: false, properties: paramProperties(specs) });
export const fxRule = { type: "object", additionalProperties: false,
  properties: { reverb: busRule(REVERB_SPEC), delay: busRule(DELAY_BUS_SPEC) } };
export const MAX_LAYER_INSERTS = 6;
export const layerFxRule = insertRule(Object.keys(INSERT_SPECS) as (keyof typeof INSERT_SPECS)[], MAX_LAYER_INSERTS);

interface Issue { path: string; message: string }
type Rule = Record<string, unknown>;
const object = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export function checkFields(value: unknown, rule: Rule, path: string, issues: Issue[]): void {
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
      if (matching) { checkFields(value, matching, path, issues); return; }
      issues.push({ path: `${path}.type`, message: "unknown effect type" }); return;
    }
    if (!branches.some((branch) => { const found: Issue[] = []; checkFields(value, branch, path, found); return found.length === 0; })) {
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
      const sub = Object.hasOwn(props, key) ? props[key] : rule["additionalProperties"];
      if (sub === false || sub === undefined) issues.push({ path: `${path}.${key}`, message: "unknown key" });
      else if (object(sub)) checkFields(child, sub, `${path}.${key}`, issues);
    }
    return;
  }
  if (type === "array") {
    if (!Array.isArray(value)) { issues.push({ path, message: "must be an array" }); return; }
    if (value.length < Number(rule["minItems"]) || value.length > Number(rule["maxItems"])) {
      issues.push({ path, message: path.endsWith(".automation") && rule["maxItems"] === 32 ? "at most 32 lanes" :
        `item count must be ${String(rule["minItems"])}..${String(rule["maxItems"])}` });
    }
    value.forEach((item: unknown, index) => checkFields(item, rule["items"] as Rule, `${path}[${index}]`, issues));
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

export function checkFxOrder(input: Record<string, unknown>, issues: Issue[]): void {
  const checkCuts = (raw: unknown, path: string): void => {
    if (!object(raw)) return;
    if (typeof raw["lowCutHz"] === "number" && typeof raw["highCutHz"] === "number" && raw["lowCutHz"] >= raw["highCutHz"])
      issues.push({ path: `${path}.lowCutHz`, message: "must be below highCutHz" });
  };
  const tracks = Array.isArray(input["tracks"]) ? input["tracks"] : [];
  const chains = tracks.map((track: unknown, i: number) => ({ fx: object(track) ? track["fx"] : null, path: `$.tracks[${i}].fx` }));
  tracks.forEach((track: unknown, i: number) => {
    if (!object(track) || !Array.isArray(track["layers"])) return;
    track["layers"].forEach((layer: unknown, j: number) =>
      chains.push({ fx: object(layer) ? layer["fx"] : null, path: `$.tracks[${i}].layers[${j}].fx` }));
  });
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
export function resolvedInserts(input: InsertInput[] | undefined): ResolvedInsert[] {
  return (input ?? []).map((insert) => ({ type: insert.type, ...withDefaults(INSERT_SPECS[insert.type], insert) } as ResolvedInsert));
}
export function resolvedBus<T>(specs: Record<string, ParamSpec>, input: Partial<T> | undefined): T | null {
  return input === undefined ? null : withDefaults(specs, input) as T;
}

/** Validate FX on direct resolved-song calls as well as raw song input. */
export function validateFxFields(input: unknown): void {
  const issues: Issue[] = [];
  if (!object(input)) return;
  const tracks = Array.isArray(input["tracks"]) ? input["tracks"] : [];
  tracks.forEach((track: unknown, i: number) => {
    if (!object(track)) return;
    if (track["fx"] !== undefined) checkFields(track["fx"], trackFxRule, `$.tracks[${i}].fx`, issues);
    if (Array.isArray(track["layers"])) track["layers"].forEach((layer: unknown, j: number) => {
      if (object(layer) && layer["fx"] !== undefined)
        checkFields(layer["fx"], layerFxRule, `$.tracks[${i}].layers[${j}].fx`, issues);
    });
  });
  if (Array.isArray(input["audioTracks"])) input["audioTracks"].forEach((track: unknown, i: number) => {
    if (object(track) && track["fx"] !== undefined) checkFields(track["fx"], trackFxRule, `$.audioTracks[${i}].fx`, issues);
  });
  if (input["fx"] !== undefined && input["fx"] !== null) checkFields(input["fx"], fxRule, "$.fx", issues);
  if (object(input["master"]) && input["master"]["fx"] !== undefined)
    checkFields(input["master"]["fx"], masterFxRule, "$.master.fx", issues);
  checkFxOrder(input, issues);
  if (issues.length) throw new Music2Error("E_SCHEMA", `song FX has ${issues.length} issue(s)`, { details: { issues } });
}

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
