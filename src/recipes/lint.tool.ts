import { Music2Error } from "../shared/index.ts";
import { noteToMidi, parseMini, parseNumber, parseSampleRef } from "../pattern/index.ts";
import type { Node } from "../pattern/index.ts";
import { buildTimeline, validateSong } from "../song/index.ts";
import type { Track } from "../song/index.ts";
import { isRecipeId } from "./recipe.schema.ts";
import { createGeometry } from "./lint-geometry.tool.ts";
import { genericRules } from "./lint-generic.tool.ts";
import { fxRules } from "./lint-fx.tool.ts";
import { automationRules } from "./lint-automation.tool.ts";
import { genreRules } from "./lint-rules.tool.ts";
import { lowLayeringRules } from "./lint-layering-low.tool.ts";
import { harmonyLayeringRules } from "./lint-layering-harmony.tool.ts";
import { rhythmLayeringRules } from "./lint-layering-rhythm.tool.ts";
import { thinPeakLayerRules } from "./lint-layers.tool.ts";

export interface LintResult { id: string; severity: "error" | "warning" | "info"; path: string; observed: string | number; expected: string | number; fix: string }
export interface LintReport { genre: string | null; barsChecked: number; results: LintResult[]; errors: number; warnings: number; infos: number }
export interface LintOptions { genre?: string }

/** Shared aggregation for validated-song and parse-only findings. */
export function summarizeLint(genre: string | null, barsChecked: number, findings: LintResult[]): LintReport {
  const rank = { error: 0, warning: 1, info: 2 };
  const results = [...findings].sort((a, b) => rank[a.severity] - rank[b.severity] ||
    a.id.localeCompare(b.id) || a.path.localeCompare(b.path));
  return { genre, barsChecked, results, errors: results.filter((r) => r.severity === "error").length,
    warnings: results.filter((r) => r.severity === "warning").length,
    infos: results.filter((r) => r.severity === "info").length };
}

function visitAtoms(node: Node, visit: (raw: string, offset: number) => void): void {
  switch (node.type) {
    case "atom": visit(node.atom.raw, node.atom.offset); break;
    case "seq": node.steps.forEach(({ node: child }) => visitAtoms(child, visit)); break;
    case "stack": node.branches.forEach((child) => visitAtoms(child, visit)); break;
    case "alt": node.items.forEach((child) => visitAtoms(child, visit)); break;
    case "choose": node.options.forEach((child) => visitAtoms(child, visit)); break;
    case "fast": case "slow": case "euclid": case "degrade": visitAtoms(node.node, visit); break;
    case "rest": break;
  }
}
function patternFailure(value: string, kind: Track["kind"]): { message: string; offset: number } | null {
  try {
    const node = parseMini(value);
    visitAtoms(node, (raw, offset) => {
      try {
        if (kind === "notes") {
          if (/^-?\d+(?:\.\d+)?$/.test(raw)) {
            const midi = parseNumber(raw);
            if (!Number.isInteger(midi) || midi < 0 || midi > 127) throw new Music2Error("E_PARSE", "MIDI number must be 0..127", { details: { offset } });
          } else noteToMidi(raw);
        } else {
          if (/^[a-gA-G](?:#|b|s)?-?\d$/.test(raw) || /^-?\d/.test(raw)) throw new Music2Error("E_PARSE", "drum atom must be a sample name", { details: { offset } });
          parseSampleRef(raw);
        }
      } catch (error) {
        if (error instanceof Music2Error && error.code === "E_PARSE") throw new Music2Error("E_PARSE", error.message, { details: { offset } });
        throw error;
      }
    });
  } catch (error) {
    if (error instanceof Music2Error && error.code === "E_PARSE") return { message: error.message, offset: typeof error.details?.["offset"] === "number" ? error.details["offset"] : 0 };
    throw error;
  }
  return null;
}
function parseOnly(input: unknown, error: Music2Error, genre: string | null): LintReport | null {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  const raw = input as Record<string, unknown>;
  const tracks = Array.isArray(raw["tracks"]) ? raw["tracks"] : [];
  const sections = Array.isArray(raw["sections"]) ? raw["sections"] : [];
  const failures = new Map<string, { message: string; offset: number }>();
  const kinds = new Map<string, Track["kind"]>();
  tracks.forEach((track, index) => {
    if (!track || typeof track !== "object" || Array.isArray(track)) return;
    const value = track as Record<string, unknown>;
    if (typeof value["id"] === "string" && (value["kind"] === "drums" || value["kind"] === "notes")) kinds.set(value["id"], value["kind"]);
    if (typeof value["pattern"] === "string" && (value["kind"] === "drums" || value["kind"] === "notes")) {
      const failed = patternFailure(value["pattern"], value["kind"]);
      if (failed) failures.set(`$.tracks[${index}].pattern`, failed);
    }
  });
  sections.forEach((section, index) => {
    if (!section || typeof section !== "object" || Array.isArray(section)) return;
    const patterns = (section as Record<string, unknown>)["patterns"];
    if (!patterns || typeof patterns !== "object" || Array.isArray(patterns)) return;
    for (const [id, value] of Object.entries(patterns)) {
      const kind = kinds.get(id);
      if (typeof value === "string" && kind) {
        const failed = patternFailure(value, kind);
        if (failed) failures.set(`$.sections[${index}].patterns.${id}`, failed);
      }
    }
  });
  const issues = error.details?.["issues"];
  if (!Array.isArray(issues) || !issues.length || !failures.size ||
      !issues.every((issue: unknown) => issue && typeof issue === "object" &&
        failures.has((issue as { path?: string }).path ?? ""))) return null;
  const results: LintResult[] = [...failures].map(([path, failure]) => ({ id: "generic/pattern_parse", severity: "error", path,
    observed: `${failure.message} (offset ${failure.offset})`, expected: "valid mini-notation", fix: "Correct mini-notation at caret." }));
  return summarizeLint(genre, 0, results);
}
export function lintSong(input: unknown, options: LintOptions = {}): LintReport {
  if (options.genre !== undefined && !isRecipeId(options.genre)) throw new Music2Error("E_NOT_FOUND", `unknown recipe: ${options.genre}`, { fix: "choose an id from music2 recipes" });
  const rawGenre = input && typeof input === "object" && !Array.isArray(input) ? (input as { genre?: unknown }).genre : undefined;
  const genre = options.genre ?? (typeof rawGenre === "string" ? rawGenre : null);
  let song;
  try { song = validateSong(input); }
  catch (error) {
    if (error instanceof Music2Error && error.code === "E_SCHEMA") {
      const report = parseOnly(input, error, genre);
      if (report) return report;
    }
    throw error;
  }
  const timeline = buildTimeline(song);
  const g = createGeometry(song, timeline, genre);
  const unknown = options.genre === undefined && genre !== null && !isRecipeId(genre);
  const generic = genericRules(g, unknown);
  const genreResults = genre !== null && isRecipeId(genre) ? genreRules(g, genre, generic) : [];
  // Suppress the generic density warning only when a genre rule reports the same cause (hook vs verse, groove vs breakdown).
  // house/6 checks 8-bar phrase changes inside grooves, a different cause, so both can appear.
  const duplicateDensity = genreResults.some((result) => ["trap/7", "techno/5"].includes(result.id));
  const results = [...generic.filter((result) => result.id !== "generic/no_density_contrast" || !duplicateDensity), ...genreResults,
    ...lowLayeringRules(g), ...harmonyLayeringRules(g), ...rhythmLayeringRules(g), ...thinPeakLayerRules(g), ...fxRules(song), ...automationRules(song)];
  return summarizeLint(genre, timeline.bars, results);
}
