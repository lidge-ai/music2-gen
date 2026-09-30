import type { InsertInput, ResolvedInsert } from "../render/fx/fx.schema.ts";
import { checkFields, checkFxOrder, layerFxRule, resolvedInserts } from "../render/fx/fx-validate.tool.ts";
import { checkLayerVoice } from "../render/voices/registry.tool.ts";
import { isSampleInstrument } from "../render/instrument.tool.ts";
import { validateDawFields } from "./song-daw.schema.ts";
import type { Track } from "./song.schema.ts";

export interface Layer {
  id: string; instrument: string; transpose?: number; gain?: number; pan?: number; velocity?: number;
  params?: Record<string, number>; fx?: InsertInput[]; only?: string[];
}
export interface ResolvedLayer {
  id: string; instrument: string; transpose: number; gain: number; pan: number; velocity: number;
  params: Record<string, number>; fx: ResolvedInsert[]; only: string[] | null;
}
export const MAX_LAYERS = 8;
export { MAX_LAYER_INSERTS } from "../render/fx/fx-validate.tool.ts";
export const LAYER_JSON_SCHEMA: Record<string, unknown> = {
  type: "array", minItems: 0, maxItems: MAX_LAYERS, items: {
    type: "object", required: ["id", "instrument"], additionalProperties: false,
    properties: {
      id: { type: "string", pattern: "^[a-z0-9][a-z0-9_-]{0,31}$" },
      instrument: { type: "string", minLength: 1 },
      transpose: { type: "integer", minimum: -36, maximum: 36 },
      gain: { type: "number", minimum: -60, maximum: 12 },
      pan: { type: "number", minimum: -1, maximum: 1 },
      velocity: { type: "number", minimum: 0, maximum: 2 },
      params: { type: "object", additionalProperties: { type: "number" } },
      fx: layerFxRule,
      only: { type: "array", minItems: 1, maxItems: 16,
        items: { type: "string", pattern: "^[A-Za-z][A-Za-z0-9#.-]*$" } },
    },
  },
};

interface Issue { path: string; message: string }
const object = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** Shape and cross-field validation; drum vocabularies are checked at the render boundary. */
export function checkLayers(value: unknown, path: string, kind: "drums" | "notes", issues: Issue[]): void {
  if (value === undefined) return;
  checkFields(value, LAYER_JSON_SCHEMA, path, issues);
  if (!Array.isArray(value)) return;
  const fxIssues: Issue[] = [];
  checkFxOrder({ tracks: [{ layers: value }] }, fxIssues);
  issues.push(...fxIssues.map((issue) => ({ ...issue, path: issue.path.replace("$.tracks[0].layers", path) })));
  const ids = new Set<string>();
  value.forEach((raw: unknown, index: number) => {
    if (!object(raw)) return;
    const layerPath = `${path}[${index}]`;
    const id = raw["id"];
    if (typeof id === "string") {
      if (id === "main") issues.push({ path: `${layerPath}.id`, message: "main is reserved for the track instrument" });
      if (ids.has(id)) issues.push({ path: `${layerPath}.id`, message: "duplicate layer id" });
      ids.add(id);
    }
    if (kind === "drums" && raw["transpose"] !== undefined)
      issues.push({ path: `${layerPath}.transpose`, message: "transpose is only allowed on notes layers" });
    if (kind === "notes" && raw["only"] !== undefined)
      issues.push({ path: `${layerPath}.only`, message: "only is only allowed on drums layers" });
    const instrument = raw["instrument"];
    if (typeof instrument !== "string") return;
    const params = object(raw["params"]) ? raw["params"] : {};
    checkLayerVoice(instrument, kind, params, layerPath, issues);
    if (isSampleInstrument(instrument) && raw["params"] !== undefined && Object.keys(params).length === 0)
      issues.push({ path: `${layerPath}.params`, message: "sampled layers do not support params" });
    // Reuse the track reference policy, including SFZ confinement, library ids and user ids.
    const referenceIssues: Issue[] = [];
    validateDawFields({ tracks: [{ kind, instrument }] }, referenceIssues);
    issues.push(...referenceIssues.map((issue) => ({ ...issue,
      path: issue.path.replace("$.tracks[0]", layerPath) })));
  });
}

/** Preserve the legacy resolved shape and retain only explicit voice parameters. */
export function resolveLayers(track: Track): ResolvedLayer[] | undefined {
  if (!track.layers?.length) return undefined;
  return track.layers.map((layer) => ({
    id: layer.id, instrument: layer.instrument, transpose: layer.transpose ?? 0,
    gain: layer.gain ?? 0, pan: layer.pan ?? 0, velocity: layer.velocity ?? 1,
    params: { ...layer.params }, fx: resolvedInserts(layer.fx), only: layer.only === undefined ? null : [...layer.only],
  }));
}
