import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { analyzeFile } from "../../analyze/analyze.tool.ts";
import { Music2Error } from "../../shared/index.ts";
import type { CommandSpec } from "../registry.ts";

export const analyze: CommandSpec = {
  name: "analyze",
  summary: "Measure audio and write visual analysis artifacts",
  usage: "music2 analyze <audio.wav|song.json> [--song song.json] [--out dir] [--json]",
  options: {
    song: { type: "string", description: "Song timeline for a matching WAV" },
    out: { type: "string", description: "Analysis output directory" },
  },
  async run({ args, values, cwd, json }) {
    if (args.length !== 1) throw new Music2Error("E_INPUT", "analyze requires one input path");
    const song = values["song"];
    const out = values["out"];
    if (song !== undefined && (typeof song !== "string" || song.length === 0)) throw new Music2Error("E_INPUT", "song requires a path");
    if (out !== undefined && (typeof out !== "string" || out.length === 0)) throw new Music2Error("E_INPUT", "out requires a directory");
    const result = await analyzeFile(resolve(cwd, args[0]!), {
      ...(typeof song === "string" ? { songPath: resolve(cwd, song) } : {}),
      ...(typeof out === "string" ? { outDir: resolve(cwd, out) } : {}),
    });
    const artifacts = [result.analysisJson, result.analysisMd, result.spectrogramPng, result.overviewPng,
      ...(result.pianoRollPng ? [result.pianoRollPng] : []), ...(result.beatsJson ? [result.beatsJson] : [])];
    const text = json ? undefined : `${readFileSync(result.analysisMd, "utf8").trimEnd()}\n\nArtifacts:\n${artifacts.map((path) => `  ${path}`).join("\n")}`;
    return { command: "analyze", data: { ...result }, artifacts, ...(text === undefined ? {} : { text }) };
  },
};
