import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { Music2Error } from "../../shared/index.ts";
import { lintSong } from "../../recipes/lint.tool.ts";
import type { LintResult } from "../../recipes/lint.tool.ts";
import type { CommandSpec } from "../registry.ts";

const line = (result: LintResult): string => `${result.severity} ${result.id} ${result.path}: ${result.observed} vs ${result.expected} — ${result.fix}`;
function displayResults(results: LintResult[]): LintResult[] {
  const generic = results.find((result) => result.id === "generic/out_of_key");
  const drill = results.find((result) => result.id === "drill_uk/7");
  if (!generic || !drill) return results;
  const genericCount = /^(\d+)\//.exec(String(generic.observed))?.[1];
  const drillCount = /^(\d+) notes/.exec(String(drill.observed))?.[1];
  return genericCount !== undefined && genericCount === drillCount ? results.filter((result) => result !== generic) : results;
}
export const lint: CommandSpec = {
  name: "lint", summary: "Check static song and genre rules",
  usage: "music2 lint <song.json> [--genre id] [--strict] [--json] (QA findings exit 6)",
  options: { genre: { type: "string", description: "Override declared genre recipe id" }, strict: { type: "boolean", description: "Treat warnings as QA failures" } },
  async run({ args, values, cwd }) {
    if (args.length !== 1) throw new Music2Error("E_INPUT", "lint requires one song path");
    const path = resolve(cwd, args[0]!);
    let source: string;
    try { source = await readFile(path, "utf8"); }
    catch (error) {
      const code = error && typeof error === "object" && "code" in error ? error.code : undefined;
      throw new Music2Error(code === "ENOENT" ? "E_NOT_FOUND" : "E_INPUT", `cannot read song: ${path}`, { details: { path }, cause: error });
    }
    let raw: unknown;
    try { raw = JSON.parse(source) as unknown; }
    catch (error) { throw new Music2Error("E_INPUT", `invalid JSON in ${path}`, { details: { path }, cause: error }); }
    const report = lintSong(raw, typeof values["genre"] === "string" ? { genre: values["genre"] } : {});
    if (report.errors > 0 || (values["strict"] === true && report.warnings > 0)) throw new Music2Error("E_QA", `${report.errors} errors, ${report.warnings} warnings`,
      { details: { report }, fix: displayResults(report.results).map(line).join("\n") });
    return { command: "lint", data: { ...report }, text: report.results.length ? displayResults(report.results).map(line).join("\n") : "No lint findings." };
  },
};
