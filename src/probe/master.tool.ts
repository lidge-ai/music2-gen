import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { Music2Error } from "../shared/index.ts";
import type { EncodeOptions, FfmpegInfo, LoudnormOptions } from "./ffmpeg.schema.ts";

const execFileAsync = promisify(execFile);
const STDERR_LIMIT = 2_000;
const PROCESS_MAX_BUFFER = 8 * 1024 * 1024;

async function run(ffmpeg: FfmpegInfo, args: string[]): Promise<string> {
  try {
    const { stderr } = await execFileAsync(ffmpeg.path, args, {
      shell: false, encoding: "utf8", maxBuffer: PROCESS_MAX_BUFFER,
    });
    return stderr;
  } catch (cause) {
    const stderr = (cause as NodeJS.ErrnoException & { stderr?: string }).stderr ?? "";
    throw new Music2Error("E_RENDER", "ffmpeg processing failed", {
      cause, details: { stderr: stderr.slice(-STDERR_LIMIT) },
    });
  }
}

export async function encodeAudio(
  wavPath: string, outputPath: string, ffmpeg: FfmpegInfo, options: EncodeOptions,
): Promise<void> {
  const encoder = options.format === "mp3" ? "libmp3lame" : "libvorbis";
  if (!ffmpeg.encoders[encoder]) throw new Music2Error("E_CAPABILITY", `${encoder} encoder unavailable`);
  const quality = options.format === "mp3"
    ? ["-b:a", `${options.bitrateKbps ?? 192}k`] : ["-q:a", "5"];
  await run(ffmpeg, ["-y", "-i", wavPath, "-map_metadata", "-1", "-c:a", encoder,
    ...quality, "-f", options.format, outputPath]);
}

interface Measured { input_i: string; input_tp: string; input_lra: string; input_thresh: string; target_offset: string }

function measured(stderr: string): Measured {
  const matches = [...stderr.matchAll(/\{[^{}]*\}/gs)];
  const raw = matches.at(-1)?.[0];
  let data: unknown;
  try { data = raw === undefined ? null : JSON.parse(raw); } catch { data = null; }
  if (data === null || typeof data !== "object") throw new Music2Error("E_RENDER", "ffmpeg loudnorm measurements missing");
  const record = data as Record<string, unknown>;
  for (const key of ["input_i", "input_tp", "input_lra", "input_thresh", "target_offset"]) {
    const value = record[key];
    if ((typeof value !== "string" && typeof value !== "number") || !Number.isFinite(Number(value))) {
      throw new Music2Error("E_RENDER", `ffmpeg loudnorm measurement ${key} is invalid`);
    }
  }
  return record as unknown as Measured;
}

export async function loudnormWav(
  wavPath: string, outputPath: string, ffmpeg: FfmpegInfo, options: LoudnormOptions,
): Promise<void> {
  if (!Number.isFinite(options.targetLufs) || !Number.isFinite(options.ceilingDb)) {
    throw new Music2Error("E_INPUT", "loudnorm targets must be finite");
  }
  const target = `I=${options.targetLufs}:TP=${options.ceilingDb}:LRA=11`;
  const first = await run(ffmpeg, ["-hide_banner", "-i", wavPath, "-af",
    `loudnorm=${target}:print_format=json`, "-f", "null", "-"]);
  const stats = measured(first);
  const filter = `loudnorm=${target}:measured_I=${stats.input_i}:measured_TP=${stats.input_tp}`
    + `:measured_LRA=${stats.input_lra}:measured_thresh=${stats.input_thresh}`
    + `:offset=${stats.target_offset}:linear=true:print_format=json`;
  await run(ffmpeg, ["-y", "-hide_banner", "-i", wavPath, "-af", filter,
    "-map_metadata", "-1", "-f", "wav", outputPath]);
}
