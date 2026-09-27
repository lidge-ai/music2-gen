#!/usr/bin/env node
import { readdirSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

function options(args) {
  const result = { root: resolve(dirname(fileURLToPath(import.meta.url)), ".."), unit: false, e2e: false };
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--root" && args[i + 1]) result.root = resolve(args[++i]);
    else if (arg === "--unit") result.unit = true;
    else if (arg === "--e2e") result.e2e = true;
    else throw new Error(`Unknown or incomplete option: ${arg}`);
  }
  if (result.unit && result.e2e) throw new Error("--unit and --e2e cannot be combined");
  return result;
}

function filesIn(root, subdir, suffix, recursive) {
  const dir = join(root, subdir);
  try {
    return readdirSync(dir, { recursive, withFileTypes: true })
      .filter((entry) => entry.isFile() && entry.name.endsWith(suffix))
      .map((entry) => join(entry.parentPath, entry.name));
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw error;
  }
}

try {
  const { root, unit, e2e } = options(process.argv.slice(2));
  const files = [
    ...(!e2e ? filesIn(root, "src", ".test.ts", true) : []),
    ...(!unit ? filesIn(root, "tests/e2e", ".test.ts", false) : []),
  ].sort();
  if (files.length === 0) {
    console.error("music2 test: no test files found");
    process.exitCode = 1;
  } else {
    const home = mkdtempSync(join(tmpdir(), "music2-test-"));
    const env = { ...process.env, MUSIC2_HOME: home };
    delete env.NODE_TEST_CONTEXT;
    const child = spawnSync(process.execPath, ["--test", "--test-concurrency=4", ...files], {
      cwd: root,
      env,
      encoding: "utf8",
      maxBuffer: 32 * 1024 * 1024,
    });
    if (child.error) throw child.error;
    if (child.stdout) process.stdout.write(child.stdout);
    if (child.stderr) process.stderr.write(child.stderr);
    process.exitCode = child.status ?? 1;
  }
} catch (error) {
  console.error(`music2 test: ${error.message}`);
  process.exitCode = 1;
}
