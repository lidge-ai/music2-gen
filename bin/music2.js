#!/usr/bin/env node
// music2 runs on Bun. npm and pnpm global installs start this file with Node, so it finds the
// Bun binary that the pinned `bun` dependency installed and hands the CLI to it. Under Bun
// (bunx, `bun bin/music2.js`, tests) the CLI is imported in-process.
import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolveBun } from "./bun-binary.mjs";

const cli = new URL("../src/cli/index.ts", import.meta.url);
const args = process.argv.slice(2);
const json = args.includes("--json") || process.env.MUSIC2_JSON === "1";
const FIX = "reinstall with: npm install -g --allow-scripts=bun music2-gen (pnpm: pnpm add -g --allow-build=bun music2-gen), or set MUSIC2_BUN_PATH to a Bun binary";

function packageVersion() {
  try { return JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).version ?? null; }
  catch { return null; }
}

/** Launcher failures keep the CLI contract: one JSON object in JSON mode, exit 3 (capability). */
function failCapability(message) {
  if (json) {
    console.log(JSON.stringify({ ok: false, command: args.find((arg) => !arg.startsWith("-")) ?? "unknown",
      error: { code: "E_CAPABILITY", message, fix: FIX, details: {}, retryable: false },
      meta: { music2: packageVersion() } }));
  } else console.error(`music2: ${message}\nFix: ${FIX}`);
  process.exit(3);
}

if (process.versions.bun) {
  await import(cli.href);
} else {
  const bun = resolveBun();
  if ("error" in bun) failCapability(`music2 needs Bun and ${bun.error}`);
  const child = spawn(bun.path, [fileURLToPath(cli), ...args],
    { stdio: "inherit", windowsHide: true, env: { ...process.env, MUSIC2_BUN_SOURCE: bun.source } });
  const signals = process.platform === "win32" ? ["SIGINT", "SIGTERM"] : ["SIGINT", "SIGTERM", "SIGHUP"];
  const forward = (signal) => { try { child.kill(signal); } catch { /* already exited */ } };
  for (const signal of signals) process.on(signal, forward);
  child.on("error", (error) => failCapability(`failed to start Bun: ${error.message}`));
  child.on("exit", (code, signal) => {
    for (const s of signals) process.removeListener(s, forward);
    if (signal) process.kill(process.pid, signal); else process.exit(code ?? 1);
  });
}
