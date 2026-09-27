import { execFile } from "node:child_process";
import { constants } from "node:fs";
import { access } from "node:fs/promises";
import { delimiter, join } from "node:path";
import { promisify } from "node:util";
import { Music2Error } from "../shared/index.ts";
import type { FfmpegInfo } from "./ffmpeg.schema.ts";

const execFileAsync = promisify(execFile);
const PROBE_TIMEOUT_MS = 5_000;
const PROBE_MAX_BUFFER = 1024 * 1024;

async function executable(path: string): Promise<boolean> {
  try {
    await access(path, constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

async function candidate(env: NodeJS.ProcessEnv): Promise<string | null> {
  if (env.MUSIC2_FFMPEG !== undefined) {
    return env.MUSIC2_FFMPEG && await executable(env.MUSIC2_FFMPEG) ? env.MUSIC2_FFMPEG : null;
  }
  const filename = process.platform === "win32" ? "ffmpeg.exe" : "ffmpeg";
  for (const dir of (env.PATH ?? "").split(delimiter)) {
    if (!dir) continue;
    const path = join(dir, filename);
    if (await executable(path)) return path;
  }
  return null;
}

async function probe(path: string, arg: string): Promise<string> {
  try {
    const { stdout, stderr } = await execFileAsync(path, [arg], {
      timeout: PROBE_TIMEOUT_MS, maxBuffer: PROBE_MAX_BUFFER, encoding: "utf8", shell: false,
    });
    return `${stdout}\n${stderr}`;
  } catch (cause) {
    throw new Music2Error("E_CAPABILITY", `ffmpeg ${arg} probe failed`, { cause, details: { path, arg } });
  }
}

export async function discoverFfmpeg(env: NodeJS.ProcessEnv = process.env): Promise<FfmpegInfo | null> {
  const path = await candidate(env);
  if (path === null) return null;
  const output = await probe(path, "-version");
  const firstLine = output.split(/\r?\n/, 1)[0] ?? "";
  const version = /^ffmpeg version (\S+)/.exec(firstLine)?.[1];
  if (!version) throw new Music2Error("E_CAPABILITY", "ffmpeg returned a malformed version", { details: { path } });
  const encoderOutput = await probe(path, "-encoders");
  const encoders = new Set<string>();
  for (const line of encoderOutput.split(/\r?\n/)) {
    const name = /^\s*[A-Z.]{6}\s+(\S+)(?:\s|$)/.exec(line)?.[1];
    if (name) encoders.add(name);
  }
  return { path, version, encoders: {
    libmp3lame: encoders.has("libmp3lame"), libvorbis: encoders.has("libvorbis"),
  } };
}
