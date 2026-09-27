import { resolve } from "node:path";
import { critique } from "../../critic/index.ts";
import { Music2Error } from "../../shared/index.ts";
import type { CommandSpec } from "../registry.ts";

export const critiqueCommand: CommandSpec = {
  name: "critique", summary: "Hear an excerpt with an audio critic and pair it with local DSP",
  usage: "music2 critique <audio.wav|song.json> [--model id] [--base-url url] [--excerpt s] [--json] (exits: 2 input, 3 capability, 4 provider, 5 render, 7 timeout)",
  options: {
    model: { type: "string", description: "Responses audio-capable model" },
    "base-url": { type: "string", description: "Responses API base URL" },
    excerpt: { type: "string", description: "Seconds from start, 1–120 (default 30)" },
  },
  async run({ args, values, cwd, json }) {
    if (args.length !== 1) throw new Music2Error("E_INPUT", "critique requires one input path");
    const model = values["model"];
    const baseUrl = values["base-url"];
    const rawExcerpt = values["excerpt"];
    if (model !== undefined && (typeof model !== "string" || !model)) throw new Music2Error("E_INPUT", "model requires an id");
    if (baseUrl !== undefined && (typeof baseUrl !== "string" || !baseUrl)) throw new Music2Error("E_INPUT", "base-url requires a URL");
    if (rawExcerpt !== undefined && (typeof rawExcerpt !== "string" || !/^(?:\d+\.?\d*|\.\d+)$/.test(rawExcerpt))) {
      throw new Music2Error("E_INPUT", "excerpt requires seconds between 1 and 120");
    }
    const report = await critique(resolve(cwd, args[0]!), {
      ...(typeof model === "string" ? { model } : {}),
      ...(typeof baseUrl === "string" ? { baseUrl } : {}),
      ...(typeof rawExcerpt === "string" ? { excerpt: Number(rawExcerpt) } : {}),
    });
    const { review, dsp } = report;
    const lines = [review.overall, ...review.timbre.map((item) => `Timbre: ${item}`),
      ...review.groove.map((item) => `Groove: ${item}`), ...review.mix.map((item) => `Mix: ${item}`),
      ...review.arrangement.map((item) => `Arrangement: ${item}`),
      `Genre fit ${review.genre_fit.score}/5: ${review.genre_fit.notes}`,
      ...review.top_fixes.map((item) => `Fix: ${item}`),
      `DSP: estimated BPM ${dsp.estimatedBpm ?? "unknown"}, key ${dsp.estimatedKey ?? "unknown"}, LUFS ${dsp.integratedLufs ?? "unknown"}, true peak dBTP ${dsp.truePeakEstimateDbtp ?? "unknown"}.`];
    return { command: "critique", data: { ...report }, ...(json ? {} : { text: lines.join("\n") }) };
  },
};
