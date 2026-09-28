import { readFileSync } from "node:fs";
import { basename, extname, join, resolve } from "node:path";
import { analyzeFile } from "../../analyze/analyze.tool.ts";
import { Music2Error, storageDir } from "../../shared/index.ts";
import type { CommandSpec } from "../registry.ts";

/** Default analysis folder: $MUSIC2_HOME/analysis/<input name without .wav/.song.json>. */
function defaultOutDir(input: string): string {
  return join(storageDir("analysis"), basename(input, extname(input)).replace(/\.song$/i, ""));
}

export const analyze: CommandSpec = {
  name: "analyze",
  summary: "Measure audio and write visual analysis artifacts",
  usage: "music2 analyze <audio.wav|song.json> [--song song.json] [--out dir] [--json] (default output: $MUSIC2_HOME/analysis/<name>/)",
  options: {
    song: { type: "string", description: "Song timeline for a matching WAV" },
    out: { type: "string", description: "Analysis output directory (default $MUSIC2_HOME/analysis/<name>)" },
  },
  async run({ args, values, cwd, json }) {
    if (args.length !== 1) throw new Music2Error("E_INPUT", "analyze requires one input path");
    const song = values["song"];
    const out = values["out"];
    if (song !== undefined && (typeof song !== "string" || song.length === 0)) throw new Music2Error("E_INPUT", "song requires a path");
    if (out !== undefined && (typeof out !== "string" || out.length === 0)) throw new Music2Error("E_INPUT", "out requires a directory");
    const input = resolve(cwd, args[0]!);
    const result = await analyzeFile(input, {
      ...(typeof song === "string" ? { songPath: resolve(cwd, song) } : {}),
      outDir: typeof out === "string" ? resolve(cwd, out) : defaultOutDir(input),
    });
    const artifacts = [result.analysisJson, result.analysisMd, result.spectrogramPng, result.overviewPng,
      ...(result.pianoRollPng ? [result.pianoRollPng] : []), ...(result.beatsJson ? [result.beatsJson] : [])];
    const text = json ? undefined : `${readFileSync(result.analysisMd, "utf8").trimEnd()}\n\nArtifacts:\n${artifacts.map((path) => `  ${path}`).join("\n")}`;
    return { command: "analyze", data: { ...result }, artifacts, ...(text === undefined ? {} : { text }) };
  },
};
