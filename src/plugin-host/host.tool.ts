import { spawn } from "node:child_process";
import { constants } from "node:fs";
import { lstat, mkdtemp, open, readFile, realpath, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, isAbsolute, join, relative, sep } from "node:path";
import type { StereoBuffer } from "../audio-io/buffer.schema.ts";
import { Music2Error } from "../shared/errors.tool.ts";
import { music2Home } from "../shared/paths.tool.ts";
import { fnv1a32 } from "../shared/prng.tool.ts";
import { MAX_PLUGIN_FRAMES, MAX_PLUGIN_JSON_BYTES, PLUGIN_PROTOCOL, parseStrictJson, parseHostArgv,
  validatePluginConfig, validatePluginRequest, validatePluginResponse, validatePluginUse } from "./contract.schema.ts";
import type { PluginConfig, PluginEntry, PluginRequest, PluginResponse, PluginUse } from "./contract.schema.ts";

const MAX_WAV_BYTES = 512 * 1024 * 1024 + 58;
const STDERR_BYTES = 2048;
const HEADROOM_LIMIT = 64;
export interface PluginContext { bpm: number; seed: number; startSeconds: number; signal?: AbortSignal }
export interface ExternalProcessor {
  readonly warnings: readonly string[];
  process(trackId: string, plugins: readonly PluginUse[], audio: StereoBuffer, context: PluginContext): Promise<StereoBuffer>;
}
export interface PluginRunResult { response: PluginResponse; stderrTail: string }

function invalid(message: string): never { throw new Music2Error("E_RENDER", message); }
function capability(message: string): never { throw new Music2Error("E_CAPABILITY", message); }
function isWithin(root: string, target: string): boolean {
  const rel = relative(root, target);
  return rel === "" || (rel !== ".." && !rel.startsWith(`..${sep}`) && !isAbsolute(rel));
}

/** A missing file is an empty configuration. Existing malformed or inaccessible files fail. */
export async function loadPluginConfig(home = music2Home()): Promise<PluginConfig> {
  const file = join(home, "plugins.json");
  let info;
  try { info = await lstat(file); }
  catch (cause) {
    if ((cause as NodeJS.ErrnoException).code === "ENOENT") return { version: 1, plugins: {} };
    throw new Music2Error("E_ACCESS", "cannot inspect plugin config", { cause });
  }
  if (!info.isFile()) throw new Music2Error("E_ACCESS", "plugin config must be a regular file");
  if (info.size > MAX_PLUGIN_JSON_BYTES) throw new Music2Error("E_INPUT", "plugin config exceeds 64 KiB");
  let source: string;
  try { source = await readFile(file, "utf8"); }
  catch (cause) { throw new Music2Error("E_ACCESS", "cannot read plugin config", { cause }); }
  if (Buffer.byteLength(source) > MAX_PLUGIN_JSON_BYTES) throw new Music2Error("E_INPUT", "plugin config exceeds 64 KiB");
  return validatePluginConfig(parseStrictJson(source));
}

async function existingExecutable(path: string): Promise<string> {
  if (!isAbsolute(path)) throw new Music2Error("E_INPUT", "host executable must be absolute");
  try {
    const resolved = await realpath(path);
    if (!(await stat(resolved)).isFile()) capability("plugin host executable is unavailable");
    return resolved;
  } catch (cause) {
    if (cause instanceof Music2Error) throw cause;
    return capability("plugin host executable is unavailable");
  }
}

async function resolvedPlugin(entry: PluginEntry): Promise<string> {
  try {
    const root = await realpath(entry.root ?? dirname(entry.path));
    const target = await realpath(entry.path);
    const info = await stat(target);
    if (!isWithin(root, target) || (!info.isFile() && !(info.isDirectory() && /\.(?:vst3|component)$/iu.test(target)))) {
      throw new Music2Error("E_ACCESS", "plugin path escapes configured root or is not a file/bundle");
    }
    return target;
  } catch (cause) {
    if (cause instanceof Music2Error) throw cause;
    throw new Music2Error("E_ACCESS", "cannot access configured plugin path", { cause });
  }
}

export async function resolveHostArgv(entry: PluginEntry, override?: readonly string[]): Promise<readonly string[]> {
  const selected = override ?? (process.env["MUSIC2_PLUGIN_HOST"] === undefined
    ? entry.command : parseHostArgv(process.env["MUSIC2_PLUGIN_HOST"]));
  if (selected === undefined) capability("plugin host is not configured");
  const checked = parseHostArgv(JSON.stringify(selected));
  return [await existingExecutable(checked[0] ?? ""), ...checked.slice(1)];
}

function killTree(pid: number | undefined, signal: NodeJS.Signals): void {
  if (pid === undefined) return;
  try { process.kill(process.platform === "win32" ? pid : -pid, signal); }
  catch { /* already exited */ }
}

/** One request, one response. Neither host output nor stderr enters a user-facing error. */
export async function runPluginHost(argv: readonly string[], request: PluginRequest, timeoutMs: number, cwd?: string, signal?: AbortSignal): Promise<PluginRunResult> {
  validatePluginRequest(request);
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 120000) throw new Music2Error("E_INPUT", "invalid plugin host timeout");
  if (signal?.aborted) throw new Music2Error("E_INTERRUPTED", "plugin host interrupted");
  const encoded = JSON.stringify(request);
  if (Buffer.byteLength(encoded) > MAX_PLUGIN_JSON_BYTES) throw new Music2Error("E_INPUT", "plugin request exceeds 64 KiB");
  const checked = parseHostArgv(JSON.stringify(argv));
  const executable = await existingExecutable(checked[0] ?? "");
  const env: NodeJS.ProcessEnv = {};
  for (const key of ["SystemRoot", "WINDIR", "TMP", "TEMP", "TMPDIR", "HOME", "USERPROFILE", "LANG", "LC_ALL", "PYTHONHOME", "PYTHONPATH", "VIRTUAL_ENV", "LD_LIBRARY_PATH", "DYLD_LIBRARY_PATH"]) {
    if (process.env[key] !== undefined) env[key] = process.env[key];
  }
  return await new Promise<PluginRunResult>((resolve, reject) => {
    const child = spawn(executable, checked.slice(1), { cwd, env, shell: false, detached: process.platform !== "win32", stdio: ["pipe", "pipe", "pipe"] });
    let output = Buffer.alloc(0);
    let errorTail = Buffer.alloc(0);
    let excess = false;
    let timedOut = false;
    let aborted = signal?.aborted ?? false;
    const stop = (): void => {
      killTree(child.pid, "SIGTERM");
      setTimeout(() => killTree(child.pid, "SIGKILL"), 500).unref();
    };
    const abort = (): void => { aborted = true; stop(); };
    signal?.addEventListener("abort", abort, { once: true });
    if (aborted) stop();
    const timer = setTimeout(() => {
      timedOut = true;
      stop();
    }, Math.min(Math.max(timeoutMs, 1), 120000));
    child.stdout.on("data", (chunk: Buffer) => {
      if (excess) return;
      if (output.length + chunk.length > MAX_PLUGIN_JSON_BYTES) { excess = true; stop(); return; }
      output = Buffer.concat([output, chunk]);
    });
    child.stderr.on("data", (chunk: Buffer) => {
      errorTail = Buffer.concat([errorTail, chunk]).subarray(-STDERR_BYTES);
    });
    child.on("error", cause => { clearTimeout(timer); signal?.removeEventListener("abort", abort); reject(new Music2Error("E_CAPABILITY", "plugin host cannot start", { cause })); });
    child.on("close", code => {
      clearTimeout(timer);
      signal?.removeEventListener("abort", abort);
      if (aborted) { reject(new Music2Error("E_INTERRUPTED", "plugin host interrupted")); return; }
      if (timedOut) { reject(new Music2Error("E_TIMEOUT", "plugin host timed out")); return; }
      if (excess) { reject(new Music2Error("E_RENDER", "plugin host response exceeds 64 KiB")); return; }
      if (code === 5) { reject(new Music2Error("E_CAPABILITY", "plugin host library is unavailable")); return; }
      let response: PluginResponse;
      try { response = validatePluginResponse(parseStrictJson(output.toString("utf8")), request.op); }
      catch { reject(new Music2Error("E_RENDER", "plugin host returned invalid JSON")); return; }
      if (code !== 0 || !response.ok) { reject(new Music2Error("E_RENDER", "plugin host failed")); return; }
      resolve({ response, stderrTail: errorTail.toString("utf8") });
    });
    child.stdin.on("error", () => { /* close handler reports the process failure */ });
    child.stdin.end(encoded);
  });
}

function checkAudio(audio: StereoBuffer): number {
  const frames = audio.left.length;
  if (audio.sampleRate !== 44100 && audio.sampleRate !== 48000 || audio.right.length !== frames ||
      !Number.isInteger(frames) || frames < 0 || frames > MAX_PLUGIN_FRAMES ||
      8 * frames > 512 * 1024 * 1024 || 2 * (58 + 8 * frames) > 1024 * 1024 * 1024 ||
      50 + 8 * frames > 0xffffffff) invalid("plugin audio shape exceeds the WAV contract");
  for (let i = 0; i < frames; i++) {
    const left = audio.left[i] ?? NaN, right = audio.right[i] ?? NaN;
    if (!Number.isFinite(left) || !Number.isFinite(right) || Math.abs(left) > HEADROOM_LIMIT || Math.abs(right) > HEADROOM_LIMIT) {
      invalid("plugin audio contains an invalid sample");
    }
  }
  return frames;
}

/** Canonical 58-byte IEEE-float WAV used only by the external bridge. */
export function encodePluginWav(audio: StereoBuffer): Buffer {
  const frames = checkAudio(audio);
  const out = Buffer.allocUnsafe(58 + frames * 8);
  out.write("RIFF", 0, "ascii"); out.writeUInt32LE(50 + frames * 8, 4); out.write("WAVEfmt ", 8, "ascii");
  out.writeUInt32LE(18, 16); out.writeUInt16LE(3, 20); out.writeUInt16LE(2, 22);
  out.writeUInt32LE(audio.sampleRate, 24); out.writeUInt32LE(audio.sampleRate * 8, 28);
  out.writeUInt16LE(8, 32); out.writeUInt16LE(32, 34); out.writeUInt16LE(0, 36);
  out.write("fact", 38, "ascii"); out.writeUInt32LE(4, 42); out.writeUInt32LE(frames, 46);
  out.write("data", 50, "ascii"); out.writeUInt32LE(frames * 8, 54);
  for (let i = 0; i < frames; i++) {
    out.writeFloatLE(audio.left[i] ?? 0, 58 + i * 8);
    out.writeFloatLE(audio.right[i] ?? 0, 62 + i * 8);
  }
  return out;
}

export function decodePluginWav(bytes: Buffer, expectedRate: number, expectedFrames: number): { audio: StereoBuffer; headroomExceeded: boolean } {
  if (bytes.length < 58 || bytes.toString("ascii", 0, 4) !== "RIFF" || bytes.toString("ascii", 8, 12) !== "WAVE" ||
      bytes.readUInt32LE(4) + 8 !== bytes.length || bytes.length > MAX_WAV_BYTES) invalid("invalid plugin WAV RIFF size");
  let format = false, fact: number | undefined, dataOffset: number | undefined, dataSize = 0;
  for (let pos = 12; pos < bytes.length;) {
    if (pos + 8 > bytes.length) invalid("truncated plugin WAV chunk");
    const kind = bytes.toString("ascii", pos, pos + 4), size = bytes.readUInt32LE(pos + 4);
    const payload = pos + 8, end = payload + size;
    if (end + (size & 1) > bytes.length) invalid("truncated plugin WAV payload");
    if (kind === "fmt ") {
      if (format || ![16, 18, 40].includes(size)) invalid("invalid plugin WAV format chunk");
      const tag = bytes.readUInt16LE(payload);
      const subtype = tag === 0xfffe && size === 40 ? bytes.readUInt16LE(payload + 24) : tag;
      if (subtype !== 3 || (tag === 0xfffe && bytes.toString("hex", payload + 26, payload + 40) !== "000000001000800000aa00389b71")) invalid("plugin WAV must be IEEE float32");
      if (bytes.readUInt16LE(payload + 2) !== 2 || bytes.readUInt32LE(payload + 4) !== expectedRate ||
          bytes.readUInt32LE(payload + 8) !== expectedRate * 8 || bytes.readUInt16LE(payload + 12) !== 8 ||
          bytes.readUInt16LE(payload + 14) !== 32) invalid("plugin WAV format mismatch");
      format = true;
    } else if (kind === "fact") {
      if (fact !== undefined || size !== 4) invalid("invalid plugin WAV fact chunk");
      fact = bytes.readUInt32LE(payload);
    } else if (kind === "data") {
      if (dataOffset !== undefined) invalid("duplicate plugin WAV data chunk");
      dataOffset = payload; dataSize = size;
    }
    pos = end + (size & 1);
  }
  if (!format || fact !== expectedFrames || dataOffset === undefined || dataSize !== expectedFrames * 8) invalid("plugin WAV frame mismatch");
  const left = new Float32Array(expectedFrames), right = new Float32Array(expectedFrames);
  let headroomExceeded = false;
  for (let i = 0; i < expectedFrames; i++) {
    const l = bytes.readFloatLE(dataOffset + i * 8), r = bytes.readFloatLE(dataOffset + i * 8 + 4);
    if (!Number.isFinite(l) || !Number.isFinite(r) || Math.abs(l) > HEADROOM_LIMIT || Math.abs(r) > HEADROOM_LIMIT) invalid("plugin WAV contains invalid samples");
    if (Math.abs(l) > 1 || Math.abs(r) > 1) headroomExceeded = true;
    left[i] = l; right[i] = r;
  }
  return { audio: { sampleRate: expectedRate, left, right, sourceChannels: 2 }, headroomExceeded };
}

async function readOwnedOutput(path: string, dir: string): Promise<Buffer> {
  if (path !== join(dir, "out.wav")) invalid("plugin host returned an unexpected output path");
  let handle;
  try {
    const before = await lstat(path);
    if (!before.isFile() || before.isSymbolicLink() || before.size > MAX_WAV_BYTES) invalid("invalid plugin output file");
    handle = await open(path, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
    const after = await handle.stat();
    if (!after.isFile() || after.dev !== before.dev || after.ino !== before.ino || after.size !== before.size) invalid("plugin output changed during open");
    const bytes = await handle.readFile();
    if (bytes.length !== before.size || bytes.length > MAX_WAV_BYTES) invalid("plugin output changed during read");
    return bytes;
  } catch (cause) {
    if (cause instanceof Music2Error) throw cause;
    throw new Music2Error("E_RENDER", "cannot read plugin output", { cause });
  } finally { await handle?.close(); }
}

export function createExternalProcessor(config: PluginConfig, override?: readonly string[]): ExternalProcessor {
  const warnings: string[] = [];
  return {
    warnings,
    async process(trackId, plugins, audio, context) {
      if (plugins.length === 0) return audio;
      let current = audio;
      const ids = new Set<string>();
      if (plugins.length > 4) throw new Music2Error("E_INPUT", "plugin chain exceeds four stages");
      for (const [stage, raw] of plugins.entries()) {
        const use = validatePluginUse(raw);
        if (ids.has(use.id)) throw new Music2Error("E_INPUT", "duplicate plugin ID");
        ids.add(use.id);
        const entry = config.plugins[use.id];
        if (!entry) capability(`plugin ${use.id} is not configured`);
        const path = await resolvedPlugin(entry);
        const argv = await resolveHostArgv(entry, override);
        const frames = checkAudio(current);
        const dir = await mkdtemp(join(tmpdir(), "music2-plugin-"));
        try {
          const input = join(dir, "in.wav"), output = join(dir, "out.wav");
          const file = await open(input, "wx", 0o600);
          try { await file.writeFile(encodePluginWav(current)); } finally { await file.close(); }
          const request: PluginRequest = { protocol: PLUGIN_PROTOCOL, op: "render", sampleRate: current.sampleRate as 44100 | 48000,
            channels: 2, bufferSize: 512, durationSec: frames / current.sampleRate, tailSec: 0,
            input: { kind: "wav", wavPath: input }, chain: [{ path, pluginName: entry.pluginName,
              params: use.params ?? {}, initTimeoutSec: 10 }], output: { wavPath: output, format: "f32" },
            seed: fnv1a32(context.seed, trackId, "plugin", stage) };
          const { response } = await runPluginHost(argv, request, entry.timeoutMs, dir, context.signal);
          if (!response.ok || !("wavPath" in response) || response.wavPath !== output ||
              response.frames !== frames || response.sampleRate !== current.sampleRate || response.channels !== 2) {
            invalid(`plugin ${use.id} returned mismatched audio`);
          }
          const decoded = decodePluginWav(await readOwnedOutput(response.wavPath, dir), current.sampleRate, frames);
          if (decoded.headroomExceeded && !warnings.includes("PLUGIN_HEADROOM_EXCEEDED")) warnings.push("PLUGIN_HEADROOM_EXCEEDED");
          current = decoded.audio;
        } finally { await rm(dir, { recursive: true, force: true }); }
      }
      return current;
    },
  };
}
