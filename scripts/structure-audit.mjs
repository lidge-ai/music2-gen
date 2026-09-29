#!/usr/bin/env bun
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const REQUIRED = ["AGENTS.md", "devlog/_plan", "devlog/_fin", "devlog/str_func/AGENTS.md"];
const FORBIDDEN = new Set(["controllers", "models", "services", "views", "helpers"]);

function walk(dir, visit) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) walk(path, visit);
    else if (entry.isFile()) visit(path);
  }
}

/** Return named Lidge Standard violations for a repository root. */
export function audit(root) {
  const failures = [];
  for (const path of REQUIRED) {
    if (!existsSync(join(root, path))) failures.push(`required-path: missing ${path}`);
  }

  const trackedEnv = spawnSync("git", ["ls-files", "--cached", "--", ".env"], {
    cwd: root, encoding: "utf8",
  });
  if (trackedEnv.status === 0 && trackedEnv.stdout.split(/\r?\n/).includes(".env")) {
    failures.push("tracked-env: .env must not be tracked");
  }

  const src = join(root, "src");
  if (!existsSync(src)) {
    failures.push("required-path: missing src");
    return failures;
  }

  for (const entry of readdirSync(src, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const feature = entry.name;
    if (FORBIDDEN.has(feature)) failures.push(`forbidden-folder: src/${feature}`);
    if (!existsSync(join(src, feature, "index.ts"))) {
      failures.push(`feature-index: missing src/${feature}/index.ts`);
    }
    if (!existsSync(join(root, "devlog", "str_func", `${feature}.md`))) {
      failures.push(`str-func: missing devlog/str_func/${feature}.md`);
    }
  }

  walk(src, (path) => {
    const name = relative(root, path).replaceAll("\\", "/");
    if (path.endsWith(".tool.ts") && !existsSync(path.slice(0, -".tool.ts".length) + ".test.ts")) {
      failures.push(`colocated-test: missing ${name.slice(0, -".tool.ts".length)}.test.ts`);
    }
    const source = readFileSync(path, "utf8");
    const lines = source.length === 0 ? 0 : source.split(/\r\n|\r|\n/).length - (/[\r\n]$/.test(source) ? 1 : 0);
    if (lines > 500) failures.push(`src-file-lines: ${name} has ${lines} lines (max 500)`);
  });
  return failures;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = resolve(process.argv[2] ?? join(import.meta.dirname, ".."));
  const failures = audit(root);
  for (const failure of failures) console.error(failure);
  process.exitCode = failures.length === 0 ? 0 : 1;
}
