import { PLUGIN_PROTOCOL, parseHostArgv } from "./contract.schema.ts";
import { runPluginHost } from "./host.tool.ts";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { PluginConfig, PluginEntry } from "./contract.schema.ts";
import { Music2Error } from "../shared/errors.tool.ts";

export interface PluginProbe {
  configured: boolean;
  probed: true;
  available: boolean;
  hostVersion?: string;
  pedalboard?: string;
  reason?: "E_CAPABILITY" | "E_TIMEOUT" | "E_RENDER" | "E_INPUT";
}

function supportedPedalboard(version: string): boolean {
  const parts = /^(\d+)\.(\d+)\.(\d+)(?:\+.*)?$/u.exec(version);
  if (!parts) return false;
  const [major, minor, patch] = parts.slice(1).map(Number);
  return (major ?? 0) > 0 || (minor ?? 0) > 7 || ((minor ?? 0) === 7 && (patch ?? 0) >= 6);
}

export async function probePluginHost(argv: readonly string[], timeoutMs = 20000): Promise<PluginProbe> {
  let cwd: string | undefined;
  try {
    const selected = parseHostArgv(JSON.stringify(argv));
    cwd = await mkdtemp(join(tmpdir(), "music2-plugin-probe-"));
    const { response } = await runPluginHost(selected, { protocol: PLUGIN_PROTOCOL, op: "probe" }, Math.min(timeoutMs, 20000), cwd);
    if (!response.ok || !("op" in response) || response.op !== "probe") return { configured: true, probed: true, available: false, reason: "E_RENDER" };
    if (response.pedalboard !== undefined && !supportedPedalboard(response.pedalboard)) {
      return { configured: true, probed: true, available: false, reason: "E_CAPABILITY" };
    }
    return { configured: true, probed: true, available: true, hostVersion: response.hostVersion,
      ...response.pedalboard === undefined ? {} : { pedalboard: response.pedalboard } };
  } catch (cause) {
    const code = cause instanceof Music2Error ? cause.code : "E_RENDER";
    const reason = code === "E_CAPABILITY" || code === "E_TIMEOUT" || code === "E_INPUT" ? code : "E_RENDER";
    return { configured: true, probed: true, available: false, reason };
  } finally {
    if (cwd !== undefined) await rm(cwd, { recursive: true, force: true });
  }
}

/** Doctor-facing view. Distinct argv are probed once within this call only. */
export async function probeConfiguredPlugins(config: PluginConfig, override?: readonly string[]): Promise<Record<string, PluginProbe>> {
  const results: Record<string, PluginProbe> = {};
  const cache = new Map<string, PluginProbe>();
  for (const [id, entry] of Object.entries(config.plugins)) {
    const selected = override ?? (process.env["MUSIC2_PLUGIN_HOST"] === undefined
      ? entry.command : parseHostArgv(process.env["MUSIC2_PLUGIN_HOST"]));
    if (!selected) { results[id] = { configured: false, probed: true, available: false, reason: "E_CAPABILITY" }; continue; }
    const key = JSON.stringify(selected);
    let probe = cache.get(key);
    if (!probe) { probe = await probePluginHost(selected); cache.set(key, probe); }
    results[id] = probe;
  }
  return results;
}

export function pluginConfigured(entry: PluginEntry, override?: readonly string[]): boolean {
  return Boolean(override ?? process.env["MUSIC2_PLUGIN_HOST"] ?? entry.command);
}
