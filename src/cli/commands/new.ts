import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { newSong, isRecipeId } from "../../recipes/index.ts";
import { applyUseCase, isUseCaseId, recommendedArrangement, USE_CASE_IDS } from "../../usecases/index.ts";
import { Music2Error } from "../../shared/index.ts";
import type { CommandSpec } from "../registry.ts";

function scalar(values: Record<string, unknown>, name: string): string | undefined {
  const value = values[name];
  if (value === undefined) return undefined;
  if (typeof value !== "string" || value.length === 0) throw new Music2Error("E_INPUT", `${name} requires a value`);
  return value;
}
function integer(values: Record<string, unknown>, name: string): number | undefined {
  const raw = scalar(values, name);
  if (raw === undefined) return undefined;
  if (!/^(?:0|[1-9]\d*)$/.test(raw)) throw new Music2Error("E_INPUT", `${name} must be an integer`);
  const value = Number(raw);
  if (!Number.isSafeInteger(value)) throw new Music2Error("E_INPUT", `${name} must be a safe integer`);
  return value;
}
function secondsValue(values: Record<string, unknown>): number | undefined {
  const raw = scalar(values, "seconds");
  if (raw === undefined) return undefined;
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) throw new Music2Error("E_INPUT", "seconds must be positive and finite");
  return value;
}
function songDuration(song: ReturnType<typeof newSong>): number {
  const bars = song.arrangement.reduce((sum, entry) => sum +
    (song.sections.find((section) => section.id === entry.section)?.bars ?? 0) * (entry.repeats ?? 1), 0);
  return bars * (song.meter?.numerator ?? 4) * 60 / song.bpm + (song.loop ? 0 : (song.tailSeconds ?? 2));
}

export const newCommand: CommandSpec = {
  name: "new", summary: "Create a song from a genre recipe",
  usage: "music2 new --genre <id> [--arrangement id] [--use preset] [--seconds n] [--bpm n] [--key 'C minor'] [--seed n] [--title text] [-o song.json] [--json] (input exits 2; existing output exits 4)",
  options: {
    genre: { type: "string", description: "Genre recipe id (required)" },
    arrangement: { type: "string", description: "Named arrangement variant" },
    use: { type: "string", description: "Use-case preset" },
    seconds: { type: "string", description: "Exact duration for duration presets" },
    bpm: { type: "string", description: "Override recipe BPM" },
    key: { type: "string", description: "Override key in the same mode" },
    seed: { type: "string", description: "Uint32 seed" },
    title: { type: "string", description: "Song title" },
    out: { type: "string", short: "o", description: "Write a new JSON file" },
  },
  async run({ args, values, cwd }) {
    if (args.length) throw new Music2Error("E_INPUT", "new takes no positional arguments");
    const genre = scalar(values, "genre");
    if (!genre) throw new Music2Error("E_INPUT", "new requires --genre");
    if (!isRecipeId(genre)) throw new Music2Error("E_NOT_FOUND", `unknown recipe: ${genre}`, { fix: "choose an id from music2 recipes" });
    const bpm = integer(values, "bpm");
    const seed = integer(values, "seed");
    const key = scalar(values, "key");
    const title = scalar(values, "title");
    const out = scalar(values, "out");
    const use = scalar(values, "use");
    const seconds = secondsValue(values);
    if (use !== undefined && !isUseCaseId(use)) throw new Music2Error("E_INPUT", `unknown preset ${use}; valid choices: ${USE_CASE_IDS.join(", ")}`);
    if (seconds !== undefined && use === undefined) throw new Music2Error("E_INPUT", "--seconds requires --use");
    const arrangement = scalar(values, "arrangement") ?? (use === undefined ? undefined : recommendedArrangement(use, genre));
    const base = newSong({ genre, ...(arrangement === undefined ? {} : { arrangement }),
      ...(bpm === undefined ? {} : { bpm }), ...(seed === undefined ? {} : { seed }),
      ...(key === undefined ? {} : { key }), ...(title === undefined ? {} : { title }) });
    const song = use === undefined ? base : applyUseCase(base, use,
      { ...(seconds === undefined ? {} : { seconds }), ...(bpm === undefined ? {} : { lockedBpm: bpm }) });
    if (out === undefined) return { command: "new", data: { song, arrangement: arrangement ?? null,
      useCase: song.useCase ?? null, durationSeconds: songDuration(song) }, text: JSON.stringify(song, null, 2) };
    const path = resolve(cwd, out);
    try { await writeFile(path, `${JSON.stringify(song, null, 2)}\n`, { flag: "wx" }); }
    catch (cause) {
      throw new Music2Error("E_ACCESS", `cannot write output: ${path}`, { details: { path }, cause,
        fix: "choose a new writable path" });
    }
    return { command: "new", data: { written: path, genre: song.genre, bpm: song.bpm, key: song.key, seed: song.seed,
      arrangement: arrangement ?? null, useCase: song.useCase ?? null,
      durationSeconds: songDuration(song) },
      artifacts: [path], text: path };
  },
};
