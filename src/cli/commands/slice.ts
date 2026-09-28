import { mkdir, rmdir, stat, unlink, writeFile } from "node:fs/promises";
import { dirname, extname, join, resolve } from "node:path";
import { readWav, writeWav } from "../../audio-io/index.ts";
import type { StereoBuffer } from "../../audio-io/buffer.schema.ts";
import { resample, sliceTransients } from "../../sampler/index.ts";
import type { AudioSlice } from "../../sampler/index.ts";
import { Music2Error } from "../../shared/index.ts";
import { validateSong } from "../../song/index.ts";
import type { Song } from "../../song/index.ts";
import { assertDistinct, commitNoReplace, commitReplace, stage } from "../files.ts";
import type { CommandSpec } from "../registry.ts";

const invalid = (message: string): Music2Error => new Music2Error("E_INPUT", message);

function numericFlag(value: unknown, flag: string, min: number, max: number, integer: boolean): number {
  if (value === undefined) throw invalid(`--${flag} requires a value`);
  if (typeof value !== "string" || !/^(?:\d+)(?:\.\d+)?$/.test(value))
    throw invalid(`--${flag} must be ${integer ? "an integer" : "a number"} in ${min}..${max}`);
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < min || parsed > max || (integer && !Number.isSafeInteger(parsed)))
    throw invalid(`--${flag} must be ${integer ? "an integer" : "a number"} in ${min}..${max}`);
  return parsed;
}

function options(values: Record<string, unknown>): { sensitivity: number; minGapMs: number; maxSlices: number; bpm: number } {
  return {
    sensitivity: values["sensitivity"] === undefined ? 0.5 : numericFlag(values["sensitivity"], "sensitivity", 0, 1, false),
    minGapMs: values["min-gap-ms"] === undefined ? 50 : numericFlag(values["min-gap-ms"], "min-gap-ms", 1, 1000, true),
    maxSlices: values["max-slices"] === undefined ? 64 : numericFlag(values["max-slices"], "max-slices", 1, 128, true),
    bpm: values["bpm"] === undefined ? 120 : numericFlag(values["bpm"], "bpm", 40, 240, false),
  };
}

/** One one-bar section per sixteen variants; each index appears once in the timeline. */
export function sliceSong(count: number, bpm: number, sampleRate: 44100 | 48000): { song: Song; pattern: string[] } {
  if (!Number.isSafeInteger(count) || count < 1 || count > 128) throw invalid("slice count must be in 1..128");
  const sections: Song["sections"] = [];
  const arrangement: Song["arrangement"] = [];
  const pattern: string[] = [];
  for (let bar = 0; bar < Math.ceil(count / 16); bar++) {
    const id = `slice_${bar}`;
    const slots = Array.from({ length: 16 }, (_, slot) => {
      const index = bar * 16 + slot;
      return index < count ? `slice:${index}` : "~";
    });
    const text = `[${slots.join(" ")}]`;
    pattern.push(text);
    sections.push({ id, bars: 1, patterns: { slices: text } });
    arrangement.push({ section: id });
  }
  const song: Song = { version: 1, title: "Sliced audio", bpm, meter: { numerator: 4, denominator: 4 },
    seed: 1, sampleRate, tracks: [{ id: "slices", kind: "drums", instrument: "kit:." }], sections, arrangement };
  try { validateSong(song); }
  catch (cause) { throw new Music2Error("E_INTERNAL", "slice generated invalid Song v1", { cause }); }
  return { song, pattern };
}

function outputRate(audio: StereoBuffer): StereoBuffer {
  if (audio.sampleRate === 44100 || audio.sampleRate === 48000) return audio;
  const rate = 44100;
  const count = Math.round(audio.left.length * rate / audio.sampleRate);
  const converted = resample(audio, audio.sampleRate / rate, { frames: count });
  return { ...converted, sampleRate: rate };
}

async function ensureDirectory(path: string, created: string[]): Promise<void> {
  try {
    const info = await stat(path);
    if (!info.isDirectory()) throw new Music2Error("E_ACCESS", `output is not a directory: ${path}`);
    return;
  } catch (cause) {
    if (cause instanceof Music2Error) throw cause;
    if ((cause as NodeJS.ErrnoException).code !== "ENOENT")
      throw new Music2Error("E_ACCESS", `cannot access output directory: ${path}`, { cause });
  }
  if (dirname(path) !== path) await ensureDirectory(dirname(path), created);
  try { await mkdir(path); created.push(path); }
  catch (cause) { throw new Music2Error("E_ACCESS", `cannot create output directory: ${path}`, { cause }); }
}

function sliceData(slices: readonly AudioSlice[], sourceRate: number):
  { index: number; startSample: number; sourceFrames: number; wavFrames: number }[] {
  return slices.map((slice) => ({ index: slice.index, startSample: slice.startSample,
    sourceFrames: slice.endSample - slice.startSample,
    wavFrames: Math.round((slice.endSample - slice.startSample) * (sourceRate === 44100 || sourceRate === 48000 ? 1 : 44100 / sourceRate)) }));
}

export const slice: CommandSpec = {
  name: "slice", summary: "Slice a WAV into a playable kit and Song v1",
  usage: "music2 slice <file.wav> -o <dir> [--sensitivity 0..1] [--min-gap-ms 1..1000] [--max-slices 1..128] [--bpm 40..240] [--force] [--json]",
  options: {
    out: { type: "string", short: "o", description: "Output directory for slices, kit.json and slice.song.json" },
    sensitivity: { type: "string", description: "Onset sensitivity 0..1 (default 0.5)" },
    "min-gap-ms": { type: "string", description: "Minimum onset gap 1..1000 ms (default 50)" },
    "max-slices": { type: "string", description: "Maximum slices 1..128 (default 64)" },
    bpm: { type: "string", description: "Snippet grid BPM 40..240 (default 120)" },
    force: { type: "boolean", description: "Replace this invocation's output files" },
  },
  async run({ args, values, cwd }) {
    if (args.length !== 1 || !args[0]) throw invalid("slice requires one input WAV");
    if (extname(args[0]).toLowerCase() !== ".wav") throw invalid("slice input must be .wav");
    if (typeof values["out"] !== "string" || values["out"].length === 0) throw invalid("slice requires -o <dir>");
    const input = resolve(cwd, args[0]);
    const output = resolve(cwd, values["out"]);
    const parsed = options(values);
    const source = await readWav(input);
    if (source.left.length === 0) throw invalid("cannot slice empty audio");
    const slices = sliceTransients(source, parsed);
    const rate = source.sampleRate === 44100 || source.sampleRate === 48000 ? source.sampleRate : 44100;
    const { song, pattern } = sliceSong(slices.length, parsed.bpm, rate);
    const names = slices.map((item) => item.name);
    const kit = { version: 1, samples: { slice: names } };
    const destinations = [...names.map((name) => join(output, name)), join(output, "kit.json"), join(output, "slice.song.json")];
    await assertDistinct([input], [output, ...destinations]);
    const created: string[] = [];
    const staged = destinations.map(stage);
    try {
      await ensureDirectory(output, created);
      for (let i = 0; i < slices.length; i++) {
        const audio = outputRate(slices[i]!.audio);
        await writeWav(staged[i]!.temporary, audio, { bits: 24, seed: 1 });
      }
      try {
        await writeFile(staged[slices.length]!.temporary, JSON.stringify(kit, null, 2) + "\n", { flag: "wx" });
        await writeFile(staged[slices.length + 1]!.temporary, JSON.stringify(song, null, 2) + "\n", { flag: "wx" });
      } catch (cause) { throw new Music2Error("E_ACCESS", "cannot stage slice manifests", { cause }); }
      if (values["force"] === true) await commitReplace(staged); else await commitNoReplace(staged);
    } finally {
      for (const item of staged) await unlink(item.temporary).catch(() => undefined);
      for (const dir of created.reverse()) await rmdir(dir).catch(() => undefined);
    }
    return { command: "slice", data: { kit: destinations[slices.length], song: destinations[slices.length + 1],
      slices: sliceData(slices, source.sampleRate), pattern, bpm: parsed.bpm },
    artifacts: destinations, warnings: [], text: `wrote ${output}` };
  },
};
