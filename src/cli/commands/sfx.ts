import { lstat, mkdir, rm, writeFile } from "node:fs/promises";
import { basename, dirname, extname, join, resolve } from "node:path";
import { writeWav } from "../../audio-io/index.ts";
import { fnv1a32, Music2Error, storageDir } from "../../shared/index.ts";
import { generateSfx, parseParamsFlag, resolveSfx } from "../../sfx/index.ts";
import type { ResolvedSfx } from "../../sfx/index.ts";
import { commitNoReplace, stage } from "../files.ts";
import type { CommandSpec } from "../registry.ts";

function inputError(message: string): Music2Error { return new Music2Error("E_INPUT", message); }

function stringFlag(value: unknown, name: string): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "string" || value.length === 0) throw inputError(`--${name} requires a value`);
  return value;
}

function seedFlag(value: string | undefined): number | undefined {
  if (value === undefined) return undefined;
  if (!/^(0|[1-9]\d*)$/.test(value)) throw inputError("--seed must be an unsigned integer 0..4294967295");
  const seed = Number(value);
  if (!Number.isSafeInteger(seed) || seed > 0xffffffff) throw inputError("--seed must be an unsigned integer 0..4294967295");
  return seed;
}

function secondsFlag(value: string | undefined): number | undefined {
  if (value === undefined) return undefined;
  if (!/^\d+(\.\d+)?$/.test(value)) throw inputError("--seconds must be a number in 0.05..30");
  return Number(value);
}

function rateFlag(value: string | undefined): number | undefined {
  if (value === undefined) return undefined;
  if (value !== "44100" && value !== "48000") throw inputError("--sample-rate must be 44100 or 48000");
  return Number(value);
}

async function exists(path: string): Promise<boolean> {
  try { await lstat(path); return true; } catch { return false; }
}

function sidecarPath(wav: string): string {
  return join(dirname(wav), basename(wav, extname(wav)) + ".sfx.json");
}

/** First unused $MUSIC2_HOME/sfx/<preset>-<seed>[-n].wav, so repeated default runs never collide. */
async function defaultWav(preset: string, seed: number): Promise<string> {
  for (let n = 1; ; n++) {
    const wav = join(storageDir("sfx"), `${preset}-${seed}${n === 1 ? "" : `-${n}`}.wav`);
    if (!await exists(wav) && !await exists(sidecarPath(wav))) return wav;
  }
}

/** Sidecar bytes with a fixed key order; no clock, path or machine data. */
export function sidecarJson(resolved: ResolvedSfx): string {
  const ordered = {
    generatorVersion: resolved.generatorVersion, preset: resolved.preset, seed: resolved.seed,
    seconds: resolved.seconds, frames: resolved.frames, sampleRate: resolved.sampleRate, params: resolved.params,
  };
  return JSON.stringify(ordered, null, 2) + "\n";
}

export const sfx: CommandSpec = {
  name: "sfx", summary: "Generate a deterministic sound effect WAV and JSON sidecar",
  usage: "music2 sfx --preset <name> [-o out.wav] [--seed n] [--seconds s] [--sample-rate 44100|48000] [--params k=v,...] [--json] (default output: $MUSIC2_HOME/sfx/<preset>-<seed>.wav)",
  options: {
    preset: { type: "string", description: "Preset name (transition or game/UI)" },
    out: { type: "string", short: "o", description: "Output WAV path (default $MUSIC2_HOME/sfx/<preset>-<seed>.wav); <basename>.sfx.json is written next to it" },
    seed: { type: "string", description: "Unsigned 32-bit seed (default 1)" },
    seconds: { type: "string", description: "Length in seconds, 0.05..30 (default per preset)" },
    "sample-rate": { type: "string", description: "44100 or 48000 (default 44100)" },
    params: { type: "string", description: "Comma-separated numeric overrides, e.g. sweepFromHz=250,sweepToHz=8000" },
  },
  async run({ args, values, cwd }) {
    if (args.length !== 0) throw inputError("sfx takes no positional arguments");
    const preset = stringFlag(values["preset"], "preset");
    if (preset === undefined) throw inputError("--preset is required");
    const outFlag = stringFlag(values["out"], "out");
    const explicitWav = outFlag === undefined ? undefined : resolve(cwd, outFlag);
    if (explicitWav !== undefined && extname(explicitWav).toLowerCase() !== ".wav") throw inputError("out must end in .wav");
    const paramsText = stringFlag(values["params"], "params");
    const seed = seedFlag(stringFlag(values["seed"], "seed"));
    const seconds = secondsFlag(stringFlag(values["seconds"], "seconds"));
    const sampleRate = rateFlag(stringFlag(values["sample-rate"], "sample-rate"));
    const resolved = resolveSfx({
      preset,
      ...(seed === undefined ? {} : { seed }),
      ...(seconds === undefined ? {} : { seconds }),
      ...(sampleRate === undefined ? {} : { sampleRate }),
      ...(paramsText === undefined ? {} : { params: parseParamsFlag(paramsText) }),
    });
    const wav = explicitWav ?? await defaultWav(resolved.preset, resolved.seed);
    const sidecar = sidecarPath(wav);
    for (const path of [wav, sidecar]) {
      if (await exists(path)) throw new Music2Error("E_ACCESS", `output already exists: ${path}`, { details: { path } });
    }
    if (explicitWav === undefined) {
      try { await mkdir(dirname(wav), { recursive: true }); } catch (cause) {
        throw new Music2Error("E_ACCESS", `cannot create output directory: ${dirname(wav)}`, { details: { path: dirname(wav) }, cause });
      }
    }
    let stereo;
    try { stereo = generateSfx(resolved); } catch (cause) {
      if (cause instanceof Music2Error) throw cause;
      throw new Music2Error("E_RENDER", `cannot synthesize ${resolved.preset}`, { cause });
    }
    const stagedWav = stage(wav);
    const stagedJson = stage(sidecar);
    try {
      await writeWav(stagedWav.temporary, { sampleRate: resolved.sampleRate, left: stereo.left, right: stereo.right, sourceChannels: 2 },
        { bits: 16, seed: fnv1a32(resolved.seed, resolved.preset, resolved.frames, "sfx-wav") });
      await writeFile(stagedJson.temporary, sidecarJson(resolved), { flag: "wx" });
      // link() never replaces an existing path, so a destination created after the early check is refused, not overwritten.
      await commitNoReplace([stagedWav, stagedJson]);
    } catch (cause) {
      if (cause instanceof Music2Error) throw cause;
      throw new Music2Error("E_ACCESS", `cannot write output: ${wav}`, { details: { path: wav }, cause });
    } finally {
      await rm(stagedWav.temporary, { force: true });
      await rm(stagedJson.temporary, { force: true });
    }
    return {
      command: "sfx",
      data: { wav, sidecar, generatorVersion: resolved.generatorVersion, preset: resolved.preset, seed: resolved.seed,
        seconds: resolved.seconds, frames: resolved.frames, sampleRate: resolved.sampleRate, params: resolved.params },
      artifacts: [wav, sidecar],
      text: `wrote ${wav} (${resolved.preset}, ${resolved.seconds.toFixed(3)} s)`,
    };
  },
};
