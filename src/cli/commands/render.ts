import { randomUUID } from "node:crypto";
import { mkdir, realpath, rename, rm } from "node:fs/promises";
import { basename, dirname, extname, join, resolve } from "node:path";
import { writeWav } from "../../audio-io/index.ts";
import { discoverFfmpeg, encodeAudio, loudnormWav } from "../../probe/index.ts";
import { renderSong } from "../../render/index.ts";
import type { RenderData } from "../../render/render.schema.ts";
import { fnv1a32, Music2Error } from "../../shared/index.ts";
import { loadSong } from "../../song/index.ts";
import type { CommandSpec } from "../registry.ts";

function inputError(message: string): Music2Error { return new Music2Error("E_INPUT", message); }
function accessError(path: string, cause: unknown): Music2Error {
  return new Music2Error("E_ACCESS", `cannot write output: ${path}`, { details: { path }, cause });
}
function absolute(value: unknown, cwd: string, name: string): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "string" || value.length === 0) throw inputError(`${name} requires a path`);
  return resolve(cwd, value);
}
function bits(value: unknown): 16 | 24 {
  if (value === undefined || value === "16") return 16;
  if (value === "24") return 24;
  throw inputError("bits must be 16 or 24");
}
function bars(value: unknown): { start: number; end: number } | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "string") throw inputError("bars must be start:end");
  const match = /^(0|[1-9]\d*):(0|[1-9]\d*)$/.exec(value);
  if (!match) throw inputError("bars must be start:end");
  const start = Number(match[1]); const end = Number(match[2]);
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start >= end) {
    throw inputError("bars must be a nonempty, safe integer range");
  }
  return { start, end };
}
function tempPath(finalPath: string): string {
  const extension = extname(finalPath);
  return join(dirname(finalPath), `.${basename(finalPath, extension)}.${randomUUID()}.tmp${extension}`);
}
async function identity(path: string): Promise<string> {
  try { return await realpath(path); } catch { return path; }
}
async function checkCollisions(input: string, outputs: string[]): Promise<void> {
  const seen = new Set<string>();
  for (const path of [input, ...outputs]) {
    const key = await identity(path);
    if (seen.has(key)) throw inputError(`input/output path collision: ${path}`);
    seen.add(key);
  }
}

export const render: CommandSpec = {
  name: "render", summary: "Render a song to WAV and optional encoded copies",
  usage: "music2 render <song.json> [-o out.wav] [--bits 16|24] [--mp3] [--ogg] [--stems dir] [--bars a:b] [--loudnorm] [--json]",
  options: {
    out: { type: "string", short: "o", description: "Output WAV path" },
    bits: { type: "string", description: "WAV bit depth: 16 or 24" },
    mp3: { type: "boolean", description: "Encode an MP3 copy" },
    ogg: { type: "boolean", description: "Encode an Ogg Vorbis copy" },
    stems: { type: "string", description: "Write dry stems to directory" },
    bars: { type: "string", description: "Zero-based half-open bar range" },
    loudnorm: { type: "boolean", description: "Two-pass ffmpeg loudness mastering" },
  },
  async run({ args, values, cwd }) {
    if (args.length !== 1) throw inputError("render requires one song path");
    const songPath = resolve(cwd, args[0]!);
    const bitDepth = bits(values["bits"]);
    const range = bars(values["bars"]);
    const outputName = basename(songPath).replace(/(?:\.song)?\.json$/i, "") + ".wav";
    const wav = absolute(values["out"], cwd, "out") ?? join(dirname(songPath), outputName);
    if (extname(wav).toLowerCase() !== ".wav") throw inputError("out must end in .wav");
    const stemDir = absolute(values["stems"], cwd, "stems");
    const song = await loadSong(songPath);
    if (song.loop && range) throw inputError("--bars cannot render part of a loop song");
    const mp3 = values["mp3"] === true ? wav.slice(0, -4) + ".mp3" : undefined;
    const ogg = values["ogg"] === true ? wav.slice(0, -4) + ".ogg" : undefined;
    const stemPaths = stemDir ? song.tracks.map((track) => join(stemDir, `${track.id}.wav`)) : [];
    const outputPaths = [wav, ...(mp3 ? [mp3] : []), ...(ogg ? [ogg] : []), ...stemPaths];
    await checkCollisions(songPath, outputPaths);
    const needsFfmpeg = mp3 !== undefined || ogg !== undefined || values["loudnorm"] === true;
    const ffmpeg = needsFfmpeg ? await discoverFfmpeg() : null;
    if (needsFfmpeg && ffmpeg === null) throw new Music2Error("E_FFMPEG_MISSING", "ffmpeg executable not found");
    if (mp3 && !ffmpeg!.encoders.libmp3lame) throw new Music2Error("E_CAPABILITY", "libmp3lame encoder unavailable");
    if (ogg && !ffmpeg!.encoders.libvorbis) throw new Music2Error("E_CAPABILITY", "libvorbis encoder unavailable");
    const result = await renderSong(song, songPath, {
      ...(range ? { bars: range } : {}), stems: stemDir !== undefined,
      mastering: values["loudnorm"] === true ? "loudnorm" : song.master.targetLufs === null ? "peak" : "lufs",
    });
    const pending: { temporary: string; final: string }[] = [];
    const temporaryFiles: string[] = [];
    const stage = (final: string): string => {
      const temporary = tempPath(final);
      temporaryFiles.push(temporary);
      pending.push({ temporary, final });
      return temporary;
    };
    try {
      if (stemDir) await mkdir(stemDir, { recursive: true });
      let wavSource = stage(wav);
      await writeWav(wavSource, result.audio, { bits: bitDepth, seed: fnv1a32(song.seed, "master", "wav") });
      if (values["loudnorm"] === true) {
        const normalized = tempPath(wav);
        temporaryFiles.push(normalized);
        await loudnormWav(wavSource, normalized, ffmpeg!, {
          targetLufs: song.master.targetLufs ?? -14, ceilingDb: song.master.ceilingDb,
        });
        await rm(wavSource, { force: true });
        pending[0]!.temporary = normalized;
        wavSource = normalized;
      }
      for (let i = 0; i < stemPaths.length; i++) {
        await writeWav(stage(stemPaths[i]!), result.stems[i]!.audio,
          { bits: bitDepth, seed: fnv1a32(song.seed, song.tracks[i]!.id, "wav") });
      }
      if (mp3) await encodeAudio(wavSource, stage(mp3), ffmpeg!, { format: "mp3" });
      if (ogg) await encodeAudio(wavSource, stage(ogg), ffmpeg!, { format: "ogg" });
      for (const item of pending) await rename(item.temporary, item.final);
    } catch (cause) {
      if (cause instanceof Music2Error) throw cause;
      throw accessError(wav, cause);
    } finally {
      for (const path of temporaryFiles) await rm(path, { force: true });
    }
    const data: RenderData = {
      wav, ...(mp3 ? { mp3 } : {}), ...(ogg ? { ogg } : {}),
      ...(stemDir ? { stems: stemPaths } : {}), bars: result.bars,
      sampleRate: result.audio.sampleRate, frames: result.audio.left.length,
      durationSeconds: result.durationSeconds,
      peakDbfs: Number.isFinite(result.peakDbfs) ? result.peakDbfs : null,
      truePeakDbtp: Number.isFinite(result.truePeakDbtp) ? result.truePeakDbtp : null,
      ceilingDb: result.ceilingDb, events: result.events,
      ...(result.loop ? { loopStartSample: result.loop.startSample, loopEndSample: result.loop.endSample } : {}),
    };
    return { command: "render", data: { ...data }, artifacts: outputPaths };
  },
};
