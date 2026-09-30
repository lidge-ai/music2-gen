import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { balanceSong, parseTarget, readError } from "../../balance/index.ts";
import type { BalanceReport, BalanceTarget } from "../../balance/index.ts";
import { Music2Error } from "../../shared/index.ts";
import type { CommandSpec } from "../registry.ts";

function numeric(value: unknown, name: string): number | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "string" || value.trim() === "" || !Number.isFinite(Number(value)))
    throw new Music2Error("E_INPUT", `${name} must be finite`);
  const result = Number(value);
  if (result < 0 || (name === "occurrence" && (!Number.isSafeInteger(result) || result < 1)))
    throw new Music2Error("E_INPUT", `${name} must be ${name === "occurrence" ? "a positive integer" : ">= 0"}`);
  return result;
}
async function fileTargets(path: string): Promise<BalanceTarget[]> {
  let input: unknown;
  let text: string;
  try { text = await readFile(path, "utf8"); }
  catch (cause) { throw readError("targets JSON", path, cause); }
  try { input = JSON.parse(text) as unknown; }
  catch (cause) { throw new Music2Error("E_INPUT", "cannot read targets JSON", { cause }); }
  if (!input || typeof input !== "object" || Array.isArray(input))
    throw new Music2Error("E_INPUT", "targets JSON must be an object mapping ids to dB numbers");
  return Object.entries(input).map(([id, db]) => {
    if (typeof db !== "number" || !Number.isFinite(db))
      throw new Music2Error("E_INPUT", `target ${id} must be a finite number`);
    return parseTarget(`${id}=${db}`);
  });
}
function table(report: BalanceReport): string {
  const db = (value: number | null | undefined): string => value == null ? "—" : value.toFixed(2);
  const header = `Window ${report.window.startBar}:${report.window.endBar}${report.window.section ? ` (${report.window.section}, occurrence ${report.window.occurrence})` : ""}`;
  const rows = report.rows.map((row) => [row.id, db(row.rmsDb), db(row.peakDb),
    `${(row.activeRatio * 100).toFixed(1)}%`, db(row.targetDb), db(row.deltaDb), row.skipped ?? (row.applied ? "applied" : "")].join("\t"));
  const changes = report.changes.map((change) => `${change.path}: ${db(change.before)} → ${db(change.after)} dB`);
  return [header, "ID\tRMS dBFS\tPeak dBFS\tActive\tTarget dBFS\tDelta dB\tStatus", ...rows,
    ...(changes.length ? ["Gain changes", ...changes] : ["No gain changes"]), ...report.warnings].join("\n");
}

export const balance: CommandSpec = {
  name: "balance", summary: "Measure and match track and layer levels in a song window",
  usage: "music2 balance <song.json> [--section ID] [--occurrence N] [--bars A:B] [--target ID=DB]... [--targets FILE] [--reference TRACK] [--max-step DB] [--apply] [--json]",
  options: {
    section: { type: "string", description: "Measure one arrangement section placement" },
    occurrence: { type: "string", description: "1-based section occurrence (default 1; requires --section)" },
    bars: { type: "string", description: "Zero-based half-open bar range; cannot combine with --section" },
    target: { type: "string", multiple: true, description: "track=dBFS or track.layer=dB relative to its main source; repeatable" },
    targets: { type: "string", description: "JSON object of targets; loaded before --target flags" },
    reference: { type: "string", description: "Read-only track for relative track targets" },
    "max-step": { type: "string", description: "Maximum absolute gain adjustment in dB (default 12; >= 0)" },
    apply: { type: "boolean", description: "Apply gains and reformat the whole song JSON with two-space indentation" },
  },
  async run({ args, values, cwd }) {
    if (args.length !== 1 || !args[0]) throw new Music2Error("E_INPUT", "balance requires one song path");
    const path = resolve(cwd, args[0]);
    const targets = values["targets"] === undefined ? [] : await fileTargets(resolve(cwd, values["targets"] as string));
    for (const text of values["target"] as string[] ?? []) targets.push(parseTarget(text));
    const occurrence = numeric(values["occurrence"], "occurrence");
    const maxStep = numeric(values["max-step"], "max-step");
    const report = await balanceSong(path, { targets,
      ...(values["section"] === undefined ? {} : { section: values["section"] as string }),
      ...(values["bars"] === undefined ? {} : { bars: values["bars"] as string }),
      ...(values["reference"] === undefined ? {} : { reference: values["reference"] as string }),
      ...(occurrence === undefined ? {} : { occurrence }), ...(maxStep === undefined ? {} : { maxStep }),
      apply: values["apply"] === true });
    return { command: "balance", data: { ...report }, warnings: report.warnings,
      artifacts: values["apply"] === true && report.changes.length ? [path] : [], text: table(report) };
  },
};
