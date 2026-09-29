import { spawnSync } from "node:child_process";
import { existsSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";

/** The npm `bun` package leaves a small placeholder at bin/bun.exe until its postinstall downloads the binary. */
export const REAL_BUN_MIN_BYTES = 1_000_000;
export const BUN_PATH_ENV = "MUSIC2_BUN_PATH";

/** @param {string} path */
export function isRealBunBinary(path) {
  try { return existsSync(path) && statSync(path).size >= REAL_BUN_MIN_BYTES; } catch { return false; }
}

/** @param {string} bunDir */
function bundledBun(bunDir) {
  for (const name of ["bun.exe", "bun"]) {
    const path = join(bunDir, "bin", name);
    if (isRealBunBinary(path)) return path;
  }
  return null;
}

/**
 * Find the Bun that runs music2: a valid MUSIC2_BUN_PATH, else the binary installed by the pinned `bun` dependency.
 * Returns { path, source } or { error } without exiting, so tests can call it.
 * @param {{ env?: NodeJS.ProcessEnv, from?: string, warn?: (message: string) => void }} [options]
 * @returns {{ path: string, source: "override" | "bundled" } | { error: string }}
 */
export function resolveBun({ env = process.env, from = import.meta.url, warn = (message) => console.error(message) } = {}) {
  const override = env[BUN_PATH_ENV]?.trim();
  if (override) {
    const path = resolve(override);
    if (isRealBunBinary(path)) return { path, source: "override" };
    warn(`music2: ${BUN_PATH_ENV} is not a complete Bun binary; using the bundled Bun.`);
  }
  let bunDir;
  try { bunDir = dirname(createRequire(from).resolve("bun/package.json")); }
  catch { return { error: "the bun dependency is not installed" }; }
  let path = bundledBun(bunDir);
  // --ignore-scripts or a blocked postinstall leaves the placeholder; run the package's own installer once.
  if (!path && existsSync(join(bunDir, "install.js"))) {
    spawnSync(process.execPath, [join(bunDir, "install.js")], { stdio: ["ignore", "ignore", "inherit"] });
    path = bundledBun(bunDir);
  }
  return path ? { path, source: "bundled" } : { error: "the bundled Bun binary is missing after one install attempt" };
}
