import { isAbsolute } from "node:path";
import { Music2Error } from "../shared/errors.tool.ts";

export const PLUGIN_PROTOCOL = "music2-plugin-bridge/1" as const;
export const MAX_PLUGIN_FRAMES = 67108864;
export const MAX_PLUGIN_JSON_BYTES = 65536;
export type PluginValue = number | string | boolean;
export interface PluginUse { id: string; params?: Readonly<Record<string, PluginValue>> }
export interface PluginEntry { path: string; pluginName: string | null; command?: readonly string[]; timeoutMs: number; root?: string }
export interface PluginConfig { version: 1; plugins: Readonly<Record<string, PluginEntry>> }
export type PluginRequest =
  | { protocol: typeof PLUGIN_PROTOCOL; op: "probe" | "selftest" }
  | { protocol: typeof PLUGIN_PROTOCOL; op: "render"; sampleRate: 44100 | 48000; channels: 2; bufferSize: 512;
      durationSec: number; tailSec: 0; input: { kind: "wav"; wavPath: string };
      chain: [{ path: string; pluginName: string | null; params: Readonly<Record<string, PluginValue>>; initTimeoutSec: 10 }];
      output: { wavPath: string; format: "f32" }; seed: number };
export type PluginResponse =
  | { protocol: typeof PLUGIN_PROTOCOL; ok: true; op: "probe"; hostVersion: string; capabilities: { audioEffect: true }; pedalboard?: string }
  | { protocol: typeof PLUGIN_PROTOCOL; ok: true; op: "selftest"; hostVersion: string; frames: 48000; sampleRate: 48000; peak: number; correlation: number }
  | { protocol: typeof PLUGIN_PROTOCOL; ok: true; wavPath: string; frames: number; sampleRate: 44100 | 48000;
      channels: 2; peak: number; rms: number; latencySamples: [number]; hostVersion: string; warnings: string[] }
  | { protocol: typeof PLUGIN_PROTOCOL; ok: false; error: { code: string; message: string } };

function fail(message: string): never { throw new Music2Error("E_INPUT", message); }
function record(value: unknown, label: string): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) fail(`${label} must be an object`);
  return value as Record<string, unknown>;
}
function keys(value: Record<string, unknown>, allowed: readonly string[], required: readonly string[], label: string): void {
  for (const key of Object.keys(value)) if (!allowed.includes(key)) fail(`${label} has unknown key ${key}`);
  for (const key of required) if (!Object.hasOwn(value, key)) fail(`${label} is missing ${key}`);
}
function text(value: unknown, label: string, max = 256): string {
  if (typeof value !== "string" || !value || Buffer.byteLength(value) > max || /[\0\r\n]/u.test(value)) fail(`invalid ${label}`);
  return value;
}
function finite(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) fail(`invalid ${label}`);
  return value;
}
function int(value: unknown, label: string, min: number, max: number): number {
  const n = finite(value, label);
  if (!Number.isInteger(n) || n < min || n > max) fail(`invalid ${label}`);
  return n;
}

/** JSON parser that rejects duplicate object keys at every nesting level. */
export function parseStrictJson(source: string): unknown {
  let i = 0;
  const space = (): void => { while (/\s/u.test(source[i] ?? "")) i++; };
  const string = (): string => {
    const start = i++;
    while (i < source.length) {
      if (source[i] === "\\") { i += 2; continue; }
      if (source[i++] === '"') return JSON.parse(source.slice(start, i)) as string;
    }
    return fail("unterminated JSON string");
  };
  const value = (): unknown => {
    space();
    const ch = source[i];
    if (ch === '"') return string();
    if (ch === "{") {
      i++; space(); const out: Record<string, unknown> = Object.create(null) as Record<string, unknown>;
      if (source[i] === "}") { i++; return out; }
      for (;;) {
        space(); if (source[i] !== '"') fail("invalid JSON object key");
        const key = string(); space(); if (source[i++] !== ":") fail("invalid JSON object separator");
        if (Object.hasOwn(out, key)) fail(`duplicate JSON key ${key}`);
        out[key] = value(); space();
        const next = source[i++]; if (next === "}") return out; if (next !== ",") fail("invalid JSON object");
      }
    }
    if (ch === "[") {
      i++; space(); const out: unknown[] = [];
      if (source[i] === "]") { i++; return out; }
      for (;;) { out.push(value()); space(); const next = source[i++]; if (next === "]") return out; if (next !== ",") fail("invalid JSON array"); }
    }
    const match = /^(?:true|false|null|-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?)/u.exec(source.slice(i));
    if (!match) fail("invalid JSON value");
    i += match[0].length;
    return JSON.parse(match[0]) as unknown;
  };
  try { const result = value(); space(); if (i !== source.length) fail("trailing JSON data"); return result; }
  catch (cause) { if (cause instanceof Music2Error) throw cause; throw new Music2Error("E_INPUT", "invalid JSON", { cause }); }
}

export function parseHostArgv(source: string): readonly string[] {
  if (Buffer.byteLength(source) > 4096) fail("host argv exceeds 4096 bytes");
  const value = parseStrictJson(source);
  if (!Array.isArray(value) || value.length < 1 || value.length > 16) fail("host argv must contain 1..16 strings");
  const argv: string[] = value.map((item, index) => text(item, `host argv[${index}]`, 1024));
  if (!isAbsolute(argv[0] ?? "")) fail("host executable must be absolute");
  if (argv.slice(1).some(arg => arg === "-c" || arg === "-m")) fail("inline host commands are forbidden");
  return argv;
}

export function validatePluginConfig(input: unknown): PluginConfig {
  const top = record(input, "plugin config"); keys(top, ["version", "plugins"], ["version", "plugins"], "plugin config");
  if (top["version"] !== 1) fail("plugin config version must be 1");
  const entries = record(top["plugins"], "plugins");
  const plugins: Record<string, PluginEntry> = Object.create(null) as Record<string, PluginEntry>;
  for (const [id, raw] of Object.entries(entries)) {
    if (!/^[a-z][a-z0-9_-]{0,31}$/u.test(id)) fail("invalid plugin ID");
    const item = record(raw, `plugin ${id}`);
    keys(item, ["path", "pluginName", "command", "timeoutMs", "root"], ["path"], `plugin ${id}`);
    const path = text(item["path"], "plugin path", 4096);
    if (!isAbsolute(path)) fail("plugin path must be absolute");
    const pluginName = item["pluginName"] == null ? null : text(item["pluginName"], "plugin name");
    const timeoutMs = item["timeoutMs"] === undefined ? 60000 : int(item["timeoutMs"], "timeoutMs", 1000, 120000);
    const command = item["command"] === undefined ? undefined : parseHostArgv(JSON.stringify(item["command"]));
    const root = item["root"] === undefined ? undefined : text(item["root"], "plugin root", 4096);
    if (root !== undefined && !isAbsolute(root)) fail("plugin root must be absolute");
    plugins[id] = { path, pluginName, timeoutMs, ...command === undefined ? {} : { command }, ...root === undefined ? {} : { root } };
  }
  return { version: 1, plugins };
}

export function validatePluginUse(input: unknown): PluginUse {
  const item = record(input, "plugin use"); keys(item, ["id", "params"], ["id"], "plugin use");
  const id = text(item["id"], "plugin ID", 32);
  if (!/^[a-z][a-z0-9_-]{0,31}$/u.test(id)) fail("invalid plugin ID");
  const params = item["params"] === undefined ? {} : record(item["params"], "plugin params");
  if (Object.keys(params).length > 32) fail("too many plugin parameters");
  const sorted: Record<string, PluginValue> = Object.create(null) as Record<string, PluginValue>;
  for (const key of Object.keys(params).sort()) {
    if (!/^[A-Za-z][A-Za-z0-9_]{0,63}$/u.test(key)) fail("invalid plugin parameter name");
    const val = params[key];
    if (typeof val === "number") sorted[key] = finite(val, key);
    else if (typeof val === "string") sorted[key] = text(val, key);
    else if (typeof val === "boolean") sorted[key] = val;
    else fail("invalid plugin parameter value");
  }
  return { id, params: sorted };
}

export function validatePluginRequest(input: unknown): PluginRequest {
  const request = record(input, "plugin request");
  if (request["protocol"] !== PLUGIN_PROTOCOL) fail("invalid plugin request protocol");
  const op = request["op"];
  if (op === "probe" || op === "selftest") {
    keys(request, ["protocol", "op"], ["protocol", "op"], "plugin request");
    return request as unknown as PluginRequest;
  }
  if (op !== "render") fail("unsupported plugin operation");
  keys(request, ["protocol", "op", "sampleRate", "channels", "bufferSize", "durationSec", "tailSec", "input", "chain", "output", "seed"],
    ["protocol", "op", "sampleRate", "channels", "bufferSize", "durationSec", "tailSec", "input", "chain", "output", "seed"], "render request");
  const rate = request["sampleRate"];
  if (rate !== 44100 && rate !== 48000 || request["channels"] !== 2 || request["bufferSize"] !== 512 || request["tailSec"] !== 0) {
    fail("invalid plugin audio parameters");
  }
  const duration = finite(request["durationSec"], "durationSec");
  if (duration < 0 || Math.round(duration * rate) > MAX_PLUGIN_FRAMES) fail("invalid plugin duration");
  int(request["seed"], "seed", 0, 0xffffffff);
  const inputObject = record(request["input"], "plugin input");
  keys(inputObject, ["kind", "wavPath"], ["kind", "wavPath"], "plugin input");
  if (inputObject["kind"] !== "wav" || !isAbsolute(text(inputObject["wavPath"], "input WAV path", 4096))) fail("invalid plugin input");
  const output = record(request["output"], "plugin output");
  keys(output, ["wavPath", "format"], ["wavPath", "format"], "plugin output");
  if (output["format"] !== "f32" || !isAbsolute(text(output["wavPath"], "output WAV path", 4096))) fail("invalid plugin output");
  if (!Array.isArray(request["chain"]) || request["chain"].length !== 1) fail("render request requires one plugin stage");
  const stage = record(request["chain"][0], "plugin stage");
  keys(stage, ["path", "pluginName", "params", "initTimeoutSec"], ["path", "pluginName", "params", "initTimeoutSec"], "plugin stage");
  if (!isAbsolute(text(stage["path"], "plugin path", 4096)) || stage["initTimeoutSec"] !== 10) fail("invalid plugin stage");
  if (stage["pluginName"] !== null) text(stage["pluginName"], "plugin name");
  validatePluginUse({ id: "stage", params: stage["params"] });
  return request as unknown as PluginRequest;
}

export function validatePluginResponse(input: unknown, op: "probe" | "selftest" | "render"): PluginResponse {
  const response = record(input, "plugin response");
  if (response["protocol"] !== PLUGIN_PROTOCOL || typeof response["ok"] !== "boolean") fail("invalid plugin response protocol");
  if (response["ok"] === false) {
    keys(response, ["protocol", "ok", "error"], ["protocol", "ok", "error"], "plugin response");
    const error = record(response["error"], "plugin error"); keys(error, ["code", "message"], ["code", "message"], "plugin error");
    text(error["code"], "error code", 64); text(error["message"], "error message", 1024);
    return response as unknown as PluginResponse;
  }
  if (op === "probe") {
    keys(response, ["protocol", "ok", "op", "hostVersion", "capabilities", "pedalboard"],
      ["protocol", "ok", "op", "hostVersion", "capabilities"], "probe response");
    if (response["op"] !== "probe") fail("wrong probe operation");
    text(response["hostVersion"], "host version");
    const caps = record(response["capabilities"], "capabilities"); keys(caps, ["audioEffect"], ["audioEffect"], "capabilities");
    if (caps["audioEffect"] !== true) fail("host lacks audio effect capability");
    if (response["pedalboard"] !== undefined) text(response["pedalboard"], "pedalboard version");
  } else if (op === "selftest") {
    keys(response, ["protocol", "ok", "op", "hostVersion", "frames", "sampleRate", "peak", "correlation"],
      ["protocol", "ok", "op", "hostVersion", "frames", "sampleRate", "peak", "correlation"], "selftest response");
    if (response["op"] !== "selftest" || response["frames"] !== 48000 || response["sampleRate"] !== 48000) fail("invalid selftest result");
    text(response["hostVersion"], "host version");
    if (finite(response["peak"], "peak") < 0 || Math.abs(finite(response["correlation"], "correlation")) > 1) fail("invalid selftest measurement");
  } else {
    keys(response, ["protocol", "ok", "wavPath", "frames", "sampleRate", "channels", "peak", "rms", "latencySamples", "hostVersion", "warnings"],
      ["protocol", "ok", "wavPath", "frames", "sampleRate", "channels", "peak", "rms", "latencySamples", "hostVersion", "warnings"], "render response");
    text(response["wavPath"], "output path", 4096);
    int(response["frames"], "frames", 0, MAX_PLUGIN_FRAMES);
    if (response["sampleRate"] !== 44100 && response["sampleRate"] !== 48000) fail("invalid sample rate");
    if (response["channels"] !== 2) fail("invalid channels");
    if (finite(response["peak"], "peak") < 0 || finite(response["rms"], "rms") < 0) fail("invalid render measurement");
    text(response["hostVersion"], "host version");
    if (!Array.isArray(response["latencySamples"]) || response["latencySamples"].length !== 1) fail("invalid latency");
    int(response["latencySamples"][0], "latency", 0, MAX_PLUGIN_FRAMES);
    if (!Array.isArray(response["warnings"]) || response["warnings"].length > 32) fail("invalid warnings");
    for (const warning of response["warnings"]) text(warning, "warning", 1024);
  }
  return response as unknown as PluginResponse;
}
