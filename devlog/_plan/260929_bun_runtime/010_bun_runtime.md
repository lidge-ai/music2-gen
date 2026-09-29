# 010 — wp2: Bun-only runtime and npm packaging

Consumes 001 D1–D6, D9, D10. Stale check at wp2 P: re-read every cited line before editing. Branch `codex/bun-runtime` from `dev`.

## Commit order

1. `test: key golden digests to the pinned Bun version` (D6/D10) — gates, fixture rename, `pinnedBunVersion`.
2. `build: run scripts and tests on Bun` — package.json, bun.lock, tsconfig, scripts/test.mjs, JSON error location, test adaptations.
3. `feat(cli): npm launcher that runs music2 on the bundled Bun` — bin/, version output, package-boundary and launcher tests.
4. `ci: Bun matrix, install smoke and dry-run-first npm release` — ci.yml, release.yml.
5. `docs: Bun is the only supported runtime` — README, docs, skill, AGENTS, CHANGELOG, str_func.

## File change map

| Path | Op | Change |
|---|---|---|
| `package.json` | MODIFY | engines, packageManager, dependencies, main/exports, files, scripts, devDependencies |
| `bun.lock` | NEW | from `bun install` |
| `package-lock.json` | DELETE | replaced by bun.lock |
| `tsconfig.json` | MODIFY | `types: ["bun"]` |
| `tsconfig.build.json` | MODIFY | `emitDeclarationOnly: true`, drop `sourceMap` |
| `bin/music2.js` | MODIFY | Node launcher (below) |
| `bin/bun-binary.mjs` | NEW | `isRealBunBinary`, `resolveBun` |
| `bin/package-main.mjs` | NEW | non-Bun import target that throws a clear error |
| `scripts/test.mjs` | MODIFY | spawn `bun test --parallel=4 --timeout=600000` |
| `scripts/record-daw-legacy.mjs` | MODIFY | require the pinned Bun instead of Node 24 |
| `src/shared/paths.tool.ts`, `src/shared/index.ts` | MODIFY | export `pinnedBunVersion()` |
| `src/song/json-location.tool.ts` | NEW | engine-independent JSON syntax error offset |
| `src/song/json-location.test.ts` | NEW | offsets for trailing comma, bad escape, truncation, bad number, valid input |
| `src/song/load.tool.ts` | MODIFY | use `jsonErrorLocation` |
| `src/cli/commands/version.ts` | MODIFY | `data.bun`, `data.bunSource` |
| `src/render/mixer.test.ts:26`, `tests/e2e/legacy-render.test.ts:15`, `tests/e2e/daw-legacy.test.ts:14-15` | MODIFY | digest gate on darwin + pinned Bun |
| `tests/fixtures/daw-legacy/darwin-node24.json` | RENAME | → `darwin-bun.json` |
| `src/analyze/flow/flow.bench.test.ts:38,43` | MODIFY | drop `--input-type=module`, report `bun` |
| `tests/e2e/package-boundary.test.ts` | MODIFY | exactly one dependency `bun`; bun.lock; pack contains launcher and src without tests |
| `tests/e2e/skill-docs.test.ts:49` | MODIFY | example regex `bun bin/music2.js` |
| `tests/e2e/launcher.test.ts` | NEW | Node launcher → bundled Bun, override, bad override, `--json` failure shape |
| `.github/workflows/ci.yml` | MODIFY | Bun jobs + install-smoke |
| `.github/workflows/release.yml` | NEW | dry-run-first npm publish |
| `README.md`, `docs/cli.md`, `docs/song-format.md`, `skills/music2/SKILL.md`, `skills/music2/references/*.md`, `AGENTS.md`, `CHANGELOG.md`, `devlog/str_func/{cli,shared,song,recipes,sfx}.md` | MODIFY | Bun wording; `node bin/music2.js` → `bun bin/music2.js`; `npm run` → `bun run`; `npm ci` → `bun install --frozen-lockfile` |

`devlog/_fin/` is history and stays unchanged.

## Diffs

### package.json

```diff
-  "engines": { "node": ">=22.18" },
+  "engines": { "node": ">=18" },
+  "packageManager": "bun@1.4.0",
+  "dependencies": { "bun": "1.4.0" },
+  "main": "./bin/package-main.mjs",
   "exports": {
-    ".": { "types": "./dist/index.d.ts", "default": "./dist/index.js" },
+    ".": { "types": "./dist/index.d.ts", "bun": "./src/index.ts", "default": "./bin/package-main.mjs" },
   "files": [
     "bin",
     "dist",
+    "src",
+    "!src/**/*.test.ts",
   "scripts": {
-    "test": "node scripts/test.mjs",
-    "schema:json": "node bin/music2.js schema --out schema/song.v1.json",
-    "audit:structure": "node scripts/structure-audit.mjs",
-    "prepack": "npm run build",
-    "music2": "node src/cli/index.ts",
-    "docs:genres": "node scripts/gen-genre-docs.mjs",
-    "docs:genres:check": "node scripts/gen-genre-docs.mjs --check",
-    "privacy:scan": "node scripts/privacy-scan.mjs"
+    "test": "bun scripts/test.mjs",
+    "schema:json": "bun bin/music2.js schema --out schema/song.v1.json",
+    "audit:structure": "bun scripts/structure-audit.mjs",
+    "prepack": "bun run build",
+    "music2": "bun src/cli/index.ts",
+    "docs:genres": "bun scripts/gen-genre-docs.mjs",
+    "docs:genres:check": "bun scripts/gen-genre-docs.mjs --check",
+    "privacy:scan": "bun scripts/privacy-scan.mjs"
   "devDependencies": {
     "@types/node": "^22.20.1",
+    "@types/bun": "1.4.0",
+  },
+  "overrides": { "@types/node": "^22.20.1" },
-    "build": "tsc -p tsconfig.build.json",
-    "typecheck": "tsc -p tsconfig.json --noEmit",
-    "lint": "eslint .",
+    "build": "bun --bun tsc -p tsconfig.build.json",
+    "typecheck": "bun --bun tsc -p tsconfig.json --noEmit",
+    "lint": "bun --bun eslint .",
```

`engines.node` covers only the launcher that npm's global shim runs; the CLI itself never runs on Node. `bun --bun` runs the node-shebang `tsc` and `eslint` bins on Bun without changing what `node` means for other processes (A1). `@types/node` stays pinned to 22 and `overrides` stops `bun-types` from installing its own 26.x copy (A2); acceptance checks that `node_modules` holds exactly one `@types/node`.

### bin/bun-binary.mjs (NEW)

```js
import { existsSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

/** The npm `bun` package leaves a small placeholder at bin/bun.exe until its postinstall downloads the binary. */
export const REAL_BUN_MIN_BYTES = 1_000_000;
export const BUN_PATH_ENV = "MUSIC2_BUN_PATH";

export function isRealBunBinary(path) {
  try { return existsSync(path) && statSync(path).size >= REAL_BUN_MIN_BYTES; } catch { return false; }
}

function bundledBun(bunDir) {
  for (const name of ["bun.exe", "bun"]) {
    const path = join(bunDir, "bin", name);
    if (isRealBunBinary(path)) return path;
  }
  return null;
}

/** Returns { path, source } or { error } without exiting, so tests can call it. */
export function resolveBun({ env = process.env, from = import.meta.url, warn = (m) => console.error(m) } = {}) {
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
  if (!path && existsSync(join(bunDir, "install.js"))) {
    spawnSync(process.execPath, [join(bunDir, "install.js")], { stdio: "inherit" });
    path = bundledBun(bunDir);
  }
  return path ? { path, source: "bundled" } : { error: "the bundled Bun binary is missing after one install attempt" };
}
```

### bin/music2.js (MODIFY, whole file)

```js
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
    console.log(JSON.stringify({ ok: false, command: args.find((a) => !a.startsWith("-")) ?? "unknown",
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
```

`fileURLToPath` decodes percent-escapes and Windows drive letters, so paths with spaces or non-ASCII characters work.

### bin/package-main.mjs (NEW)

```js
export const packageName = "music2-gen";
throw new Error("music2-gen's library entry needs the Bun runtime (the \"bun\" export condition). Use the music2 CLI from Node.");
```

### tsconfig

```diff
-    "types": ["node"],
+    "types": ["bun"],
```
```diff
     "declaration": true,
-    "sourceMap": true
+    "emitDeclarationOnly": true
```

### scripts/test.mjs:86

```diff
-    delete env.NODE_TEST_CONTEXT;
-    const child = spawnSync(process.execPath, ["--test", "--test-concurrency=4", ...files], {
+    const child = spawnSync(process.execPath, ["test", "--parallel=4", "--timeout=600000", ...files], {
```

Header comment says the runner is `bun test`. `--parallel` implies `--isolate`, so each file gets a fresh global as it did under `node --test`.

### Digest gates (commit 1)

`src/shared/paths.tool.ts`, next to `packageVersion`:

```ts
/** Bun version pinned by the package's single runtime dependency; the determinism promise is keyed to it. */
export function pinnedBunVersion(): string {
  const pj = JSON.parse(readFileSync(join(packageRoot(), "package.json"), "utf8")) as { dependencies?: Record<string, string> };
  return pj.dependencies?.["bun"] ?? "";
}
```

Commit 1 lands before package.json gains the dependency, so it also adds `"dependencies": { "bun": "1.4.0" }` and `"packageManager": "bun@1.4.0"`; commit 2 adds the rest of package.json.

```diff
// src/render/mixer.test.ts:26 (imports pinnedBunVersion from ../shared/index.ts at line 10)
-const digestPlatform = process.platform === "darwin" && process.versions.node.startsWith("24.");
+const digestPlatform = process.platform === "darwin" && process.versions.bun === pinnedBunVersion();
// tests/e2e/legacy-render.test.ts:15 (line 8 imports { packageRoot, pinnedBunVersion })
-const legacyPlatform = process.platform === "darwin" && process.versions.node.startsWith("24.");
+const legacyPlatform = process.platform === "darwin" && process.versions.bun === pinnedBunVersion();
// tests/e2e/daw-legacy.test.ts:14-15
-const fixture = JSON.parse(readFileSync(join(fixtureDir, "darwin-node24.json"), "utf8")) as Manifest;
-const nodeMajor = Number(process.versions.node.split(".")[0]);
+const fixture = JSON.parse(readFileSync(join(fixtureDir, "darwin-bun.json"), "utf8")) as Manifest;
+const digestPlatform = process.platform === "darwin" && process.versions.bun === pinnedBunVersion();
// scripts/record-daw-legacy.mjs:109-110
-const nodeMajor = Number(process.versions.node.split(".")[0]);
-if (nodeMajor !== 24) fail(`Node 24 required; found ${process.version}`);
+if (process.versions.bun !== pinnedBun) fail(`Bun ${pinnedBun} required; found ${process.versions.bun ?? process.version}`);
```

The rename keeps content; any `node` field inside the fixture is updated to name Bun. Proof: under Bun on darwin the 18 legacy tests and the no-FX digest test run and pass (they are skipped before this commit).

### src/song/json-location.tool.ts (NEW)

A strict RFC 8259 scanner that returns the offset of the first syntax error. JavaScriptCore's `JSON.parse` message has no position, so the location must not depend on the engine.

```ts
class At extends Error { constructor(readonly offset: number) { super("json syntax"); } }
const WS = new Set([" ", "\t", "\n", "\r"]);
const NUMBER = /-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/y;
const MAX_DEPTH = 10_000;

/** Offset of the first JSON syntax error, or null when the text is valid JSON. */
export function jsonErrorOffset(source: string): number | null {
  let i = 0;
  const fail = (at = i): never => { throw new At(at); };
  const ws = () => { while (i < source.length && WS.has(source[i]!)) i++; };
  const string = () => {
    i++;
    while (i < source.length) {
      const c = source.charCodeAt(i);
      if (c === 34) { i++; return; }
      if (c < 32) fail();
      if (c !== 92) { i++; continue; }
      const next = source[i + 1];
      if (next === "u") { if (!/^[0-9a-fA-F]{4}$/.test(source.slice(i + 2, i + 6))) fail(i + 1); i += 6; }
      else if (next !== undefined && "\"\\/bfnrt".includes(next)) i += 2;
      else fail(i + 1);
    }
    fail();
  };
  const value = (depth: number): void => {
    if (depth > MAX_DEPTH) fail();
    ws();
    const c = source[i];
    if (c === "{") {
      i++; ws();
      if (source[i] === "}") { i++; return; }
      for (;;) {
        ws(); if (source[i] !== "\"") fail(); string();
        ws(); if (source[i] !== ":") fail(); i++;
        value(depth + 1); ws();
        if (source[i] === ",") { i++; continue; }
        if (source[i] === "}") { i++; return; }
        fail();
      }
    }
    if (c === "[") {
      i++; ws();
      if (source[i] === "]") { i++; return; }
      for (;;) {
        value(depth + 1); ws();
        if (source[i] === ",") { i++; continue; }
        if (source[i] === "]") { i++; return; }
        fail();
      }
    }
    if (c === "\"") return string();
    for (const word of ["true", "false", "null"]) if (source.startsWith(word, i)) { i += word.length; return; }
    NUMBER.lastIndex = i;
    const match = NUMBER.exec(source);
    if (!match || match[0] === "-") fail();
    i += match![0].length;
  };
  try { value(0); ws(); return i === source.length ? null : i; }
  catch (error) { if (error instanceof At) return error.offset; throw error; }
}

export function jsonErrorLocation(source: string): { line?: number; column?: number; offset?: number } {
  const offset = jsonErrorOffset(source);
  if (offset === null) return {};
  const lines = source.slice(0, offset).split(/\r\n|\r|\n/);
  return { offset, line: lines.length, column: (lines.at(-1)?.length ?? 0) + 1 };
}
```

`src/song/load.tool.ts`: delete `parseLocation` (lines 6–13), import `jsonErrorLocation`, and replace line 28 with `const location = jsonErrorLocation(source);`. The existing test (`load.test.ts:14-22`, line 3 for a trailing comma) then passes on any engine. `json-location.test.ts` pins: `{\n"a": 1,\n}` → line 3 column 1; `{"a":"\q"}` → offset of `q`; `[1,2` → offset 4; `{"a": 01}` → offset 7; `[-]` → offset 1; valid JSON → null.

### src/cli/commands/version.ts

```diff
-    return Promise.resolve({ command: "version", data: { version: packageVersion() } });
+    return Promise.resolve({ command: "version", data: { version: packageVersion(),
+      bun: process.versions.bun ?? null, bunSource: process.env["MUSIC2_BUN_SOURCE"] ?? "direct" } });
```

`docs/cli.md` documents both fields. `bunSource` is `bundled`, `override` or `direct` (started by Bun without the launcher).

### Test adaptations

- `flow.bench.test.ts:43`: `[ "-e", child, mode ]` (Bun's `-e` is ESM); line 38 reports `bun: process.versions.bun`.
- `package-boundary.test.ts`: `assertRuntimeDependencies(manifest)` asserts `{ bun: <exact semver> }` and rejects any other key; the lock test reads `bun.lock` (JSON with trailing commas; strip them with `/,(\s*[}\]])/g`) and asserts `workspaces[""].dependencies` equals the manifest's; `package-lock.json` must not exist. The pack test additionally asserts `bin/music2.js`, `bin/bun-binary.mjs`, `src/cli/index.ts` are packed, no `src/**/*.test.ts` is packed, and runs the forbidden-import scan over packed `src/` files instead of `dist/*.js` (dist now holds declarations only).
- `skill-docs.test.ts:49` (commit 5): `/bun bin\/music2\.js ([^\n`]+)/g`.
- `tests/e2e/launcher.test.ts` (NEW). A preflight runs `node -p "typeof process.versions.bun"`: when `node` is missing or is Bun's own shim (`bun run` injects one when Node is absent), every test is skipped with that reason, unless `MUSIC2_REQUIRE_NODE=1`, which turns the skip into a failure; CI `test` and the release job set it. Tests: `node bin/music2.js version --json` → `data.bunSource === "bundled"` and `data.bun === pinnedBunVersion()`; `MUSIC2_BUN_PATH=process.execPath` → `override`; `MUSIC2_BUN_PATH` at a 10-byte file → stderr warning and `bundled`; `isRealBunBinary` false for that file; `bin/music2.js` and `bin/bun-binary.mjs` copied to a temp dir without `node_modules` → with `--json` and separately with `MUSIC2_JSON=1`, exactly one JSON object with `error.code === "E_CAPABILITY"` and exit 3 (`meta.music2` is `null` there because no package.json sits beside the copy); `node bin/music2.js render /nonexistent.json --json` exits 2 with one JSON object (exit forwarding).

### .github/workflows/ci.yml (MODIFY, jobs section; header, triggers, permissions and concurrency unchanged)

```yaml
jobs:
  checks:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
      - uses: oven-sh/setup-bun@v2
        with:
          bun-version-file: package.json
      - run: bun install --frozen-lockfile
      - run: bun run typecheck
      - run: bun run lint
      - run: bun run build
      - run: bun run audit:structure
      - run: bun run docs:genres:check
      - run: bun run privacy:scan
      - run: npm pack --dry-run

  test:
    strategy:
      fail-fast: false
      matrix:
        os: [ubuntu-latest, macos-latest, windows-latest]
    runs-on: ${{ matrix.os }}
    steps:
      - uses: actions/checkout@v7
      - uses: oven-sh/setup-bun@v2
        with:
          bun-version-file: package.json
      - if: runner.os == 'Linux'
        run: sudo apt-get update && sudo apt-get install -y ffmpeg libxml2-utils
      - run: bun install --frozen-lockfile
      - run: bun run test
        env:
          MUSIC2_REQUIRE_FFMPEG: ${{ runner.os == 'Linux' && '1' || '' }}
          MUSIC2_REQUIRE_XMLLINT: ${{ runner.os == 'Linux' && '1' || '' }}
          MUSIC2_REQUIRE_NODE: '1'
```

followed by the `install-smoke` and `ci` jobs exactly as written in "Audit round 1 folds" (A5, A6). Hosted runners ship real Node, so `MUSIC2_REQUIRE_NODE` holds there and `npm pack` has npm.

### .github/workflows/release.yml (NEW)

```yaml
name: Release

on:
  workflow_dispatch:
    inputs:
      version:
        description: Version to publish; must equal package.json
        required: true
        type: string
      tag:
        description: npm dist-tag
        required: true
        default: latest
        type: choice
        options: [latest, next]
      dry-run:
        description: Build and pack without publishing
        required: true
        default: true
        type: boolean

permissions:
  contents: read
  id-token: write

concurrency:
  group: release
  cancel-in-progress: false

jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
      - uses: oven-sh/setup-bun@v2
        with:
          bun-version-file: package.json
      - uses: actions/setup-node@v7
        with:
          node-version: '24'
          registry-url: https://registry.npmjs.org
          package-manager-cache: false
      - run: sudo apt-get update && sudo apt-get install -y ffmpeg libxml2-utils
      - run: bun install --frozen-lockfile
      - name: Version matches package.json and is unpublished
        env:
          RELEASE_VERSION: ${{ inputs.version }}
        run: |
          set -euo pipefail
          test "$(node -p "require('./package.json').version")" = "$RELEASE_VERSION"
          if npm view "music2-gen@$RELEASE_VERSION" version >/dev/null 2>&1; then
            echo "::error::music2-gen@$RELEASE_VERSION is already published"
            exit 1
          fi
      - run: bun run typecheck
      - run: bun run lint
      - run: bun run test
        env:
          MUSIC2_REQUIRE_FFMPEG: '1'
          MUSIC2_REQUIRE_XMLLINT: '1'
          MUSIC2_REQUIRE_NODE: '1'
      - run: bun run build
      - run: npm pack --dry-run
      - name: Publish
        env:
          DRY_RUN: ${{ inputs.dry-run }}
          NPM_DIST_TAG: ${{ inputs.tag }}
        run: |
          set -euo pipefail
          if [ "$DRY_RUN" = "true" ]; then
            npm publish --dry-run --tag "$NPM_DIST_TAG" --access public
          else
            npm publish --tag "$NPM_DIST_TAG" --access public
          fi
```

Trusted Publishing needs npm ≥ 11.5.1 (Node 24), `id-token: write` and a GitHub-hosted runner; provenance is automatic for a public repository and package. NEEDS_HUMAN before the first real release: claim `music2-gen` on npm (currently unpublished), do the first publish or configure the Trusted Publisher for `lidge-ai/music2-gen` + `release.yml` on npmjs.com, and choose the version (0.3.0 signals the runtime break). None of this is done in this unit.

### Documentation

- README "Requires Node.js 22.18 or newer" → "Install with `npm install -g music2-gen` (the package brings its own Bun 1.4.0) or run from a clone with Bun 1.4.0: `bun install`, then `bun bin/music2.js …`". Quick start uses `bun install --frozen-lockfile` and `bun bin/music2.js`. The determinism sentence becomes "Given the same song, seed, music2 version (which pins Bun 1.4.0) and platform, music2 promises byte-identical WAV output; `MUSIC2_BUN_PATH` or another Bun voids that promise."
- AGENTS.md stack line: "Use Bun 1.4.0 (pinned in package.json), ESM TypeScript with erasable syntax and `.ts` endings. The only runtime dependency is the pinned `bun` package; add no others." Checks use `bun run …`. Determinism: "under the same Bun version and platform".
- CHANGELOG Unreleased: "Breaking: Bun 1.4.0 is the only supported runtime; Node runs only the npm launcher." plus launcher, `version --json` fields, release workflow.
- str_func: `cli.md` (launcher, version fields), `shared.md` (`pinnedBunVersion`), `song.md` (`jsonErrorOffset`, `jsonErrorLocation`).

## Acceptance (wp2)

| Check | Command | Reads the change |
|---|---|---|
| Suite | `bun run test` exits 0; the digest and legacy tests report pass, not skip | scripts/test.mjs runs every `src/**/*.test.ts` and `tests/e2e/*.test.ts` |
| Static | `bun run typecheck`, `lint`, `build`, `audit:structure`, `docs:genres:check`, `privacy:scan` exit 0 | tsconfig include `src, scripts, tests, bin` |
| Pack | `npm pack --dry-run --json` lists bin/, src/ without tests, dist/*.d.ts; package-boundary test | pack output |
| Launcher | launcher.test.ts; local `npm install -g` of the packed tarball into a temp prefix, then `music2 version --json` | bin/ |
| Bytes | sha256 of every `examples/**/*.song.json` render under Node 24 at `dev` equals the Bun render at the wp2 tip (030 script) | render output |
| Hosted | 030 CI receipt | workflows |

## Reflection amendments (same architect, MISALIGNED → folded)

- R1 `tests/e2e/daw-legacy.test.ts`: the fixture field `nodeMajor: 24` becomes `runtime: "bun@1.4.0"` (`Manifest.runtime: string`, line 29). Line 14 reads `darwin-bun.json`; lines 15–16 become `const runtime = "bun@" + pinnedBunVersion();` and `hostFixturePath = join(fixtureDir, process.platform + "-bun.json")`; line 104 asserts `fixture.runtime === runtime`; line 125 `matchingPlatform = hostFixture !== null && process.platform === hostFixture.platform && process.versions.bun === pinnedBunVersion() && hostFixture.runtime === runtime`; the skip text at 133 names platform and runtime. The comment at line 12 says the digests were captured on Node 24 and are replayed on the pinned Bun, which renders the same bytes.
- R1 `scripts/record-daw-legacy.mjs`: import `pinnedBunVersion` from `../src/shared/index.ts` (`const pinnedBun = pinnedBunVersion()`); lines 109–110 gate on it; line 114 compares `previous.runtime` with `"bun@" + pinnedBun`; line 132 writes `runtime` instead of `nodeMajor`.
- R2 the launcher uses `fileURLToPath(cli)` in the code block (folded above).
- R3 `scripts/test.mjs`: after the child exits, parse `/Ran (\d+) tests? across (\d+) files?/` from its combined output and fail with "music2 test: bun test ran M of N files" when M ≠ `files.length`, so a filter that matches nothing fails loudly.
- R4 the launcher `--json` failure sets `meta.music2` from `../package.json` (folded above).
- R5 the `skill-docs.test.ts:49` regex change moves to commit 5 with the docs sweep, so every commit passes.
- R6 020: 15 example files set a numeric `targetLufs`, not 9.


## Audit round 1 folds (reviewer GO-WITH-FIXES, blockers=7)

- A1 (High, design change to D1): **no `bunfig.toml`.** With `[run] bun = true` every `node` inside a `bun run` script, including grandchildren, becomes Bun, so the launcher tests would never exercise Node. Only the two node-shebang dev tools are forced onto Bun, per script: `"build": "bun --bun tsc -p tsconfig.build.json"`, `"typecheck": "bun --bun tsc -p tsconfig.json --noEmit"`, `"lint": "bun --bun eslint ."`. Remove the bunfig.toml row from the file map. `launcher.test.ts` first runs `node -p "typeof process.versions.bun"`: absent `node` → skip with reason; `node` that is Bun (Bun injects a shim when Node is absent) → skip with reason, or fail when `MUSIC2_REQUIRE_NODE=1` (set in CI `test` and release). Superseded text in Diffs was edited in place.
- A2 (High, amended after architect recheck): keep `"@types/node": "^22.20.1"` beside `"@types/bun": "1.4.0"` and add `"overrides": { "@types/node": "^22.20.1" }` so `bun-types` does not install a nested 26.x copy; acceptance: `find node_modules -path '*/@types/node/package.json' | wc -l` prints 1 in devDependencies (bun-types pulls `@types/node: "*"`, which resolves 26.x and breaks typecheck with TS7022). `tsconfig.json` `types: ["bun"]`.
- A3 (High): every workflow `env` and `with` that contains `${{ }}` uses block mappings (no `{ }` flow style). Example: 

```yaml
      - name: Version matches package.json and is unpublished
        env:
          RELEASE_VERSION: ${{ inputs.version }}
```

  C parses both workflows locally (`bun -e` with `Bun.YAML.parse`, plus actionlint when it is already on the machine); GitHub accepting and running the workflow on the PR head is the final proof. No new CI step.
- A4 (Medium): launcher JSON mode is `const json = args.includes("--json") || process.env.MUSIC2_JSON === "1";`. Both failure paths (resolve error, `child.on("error")`) go through one `failCapability(message)` that prints the envelope when `json` and plain text otherwise, then `process.exit(3)`. launcher.test.ts adds `MUSIC2_JSON=1` with an empty `MUSIC2_BUN_PATH` and `from` a dir without the dependency (via a copied launcher in a temp dir) → exactly one JSON object, `error.code === "E_CAPABILITY"`, exit 3.
- A5 (Medium): install-smoke also installs with `--ignore-scripts` into a temp prefix, which leaves the 450-byte placeholder, and asserts that the first `music2 version --json` runs `install.js` once and reports `bunSource: "bundled"`.
- A6 (Medium): full diffs below for the `ci` aggregate and `scripts/install-smoke.mjs`.
- A7 (Medium): `tests/e2e/legacy-render.test.ts:15` keeps its name: `const legacyPlatform = process.platform === "darwin" && process.versions.bun === pinnedBunVersion();` and line 8 imports `{ packageRoot, pinnedBunVersion }`. `src/render/mixer.test.ts:10` imports `pinnedBunVersion` from `../shared/index.ts`; `daw-legacy.test.ts` imports it from `../../src/shared/index.ts`. Comments at `mixer.test.ts:25`, `legacy-render.test.ts:10-11`, `daw-legacy.test.ts:12,127` say the digests were recorded on Node 24 / macOS and are replayed on the pinned Bun, which renders the same bytes.
- Low, folded: the docs sweep includes `devlog/str_func/{render,audio-io,analyze,pattern,critic,probe,plugin-host}.md`; `scripts/privacy-scan.mjs:36` drops its `package-lock.json` rule (the real `bun.lock` holds no tarball URLs); `record-daw-legacy.mjs:32` usage says `bun scripts/…`; 020 cites `loudness.tool.ts:90-117`.

### ci.yml aggregate (A6)

```yaml
  ci:
    if: always()
    needs: [checks, test, install-smoke]
    runs-on: ubuntu-latest
    steps:
      - name: Require all jobs
        env:
          CHECKS: ${{ needs.checks.result }}
          TEST: ${{ needs.test.result }}
          INSTALL_SMOKE: ${{ needs.install-smoke.result }}
        run: test "$CHECKS" = success && test "$TEST" = success && test "$INSTALL_SMOKE" = success
```

### install-smoke job (A5, A6)

```yaml
  install-smoke:
    strategy:
      fail-fast: false
      matrix:
        os: [ubuntu-latest, macos-latest, windows-latest]
    runs-on: ${{ matrix.os }}
    steps:
      - uses: actions/checkout@v7
      - uses: oven-sh/setup-bun@v2
        with:
          bun-version-file: package.json
      - uses: actions/setup-node@v7
        with:
          node-version: '24'
      - run: bun install --frozen-lockfile
      - run: npm pack
      - run: bun scripts/install-smoke.mjs
```

### scripts/install-smoke.mjs (NEW)

```js
#!/usr/bin/env bun
// CI only: install the packed tarball the way users do and check that the Node launcher runs music2 on
// the bundled Bun, including after an install that skipped lifecycle scripts.
import { spawnSync } from "node:child_process";
import { mkdtempSync, readdirSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const pinned = JSON.parse(readFileSync(join(root, "package.json"), "utf8")).dependencies.bun;
const tarball = readdirSync(root).find((name) => /^music2-gen-.*\.tgz$/.test(name));
if (!tarball) throw new Error("run npm pack first");
const win = process.platform === "win32";
const run = (cmd, args, env = {}) => {
  const result = spawnSync(cmd, args, { encoding: "utf8", shell: win, env: { ...process.env, ...env } });
  if (result.status !== 0) throw new Error(cmd + " " + args.join(" ") + " exited " + result.status + "\n" + result.stderr);
  return result.stdout;
};
// Use real Node for the launcher even though this script runs on Bun.
const node = run(win ? "where" : "which", ["node"]).split(/\r?\n/)[0].trim();
if (run(node, ["-p", "typeof process.versions.bun"]).trim() !== "undefined") throw new Error("node on PATH is Bun");

for (const flags of [[], ["--ignore-scripts"]]) {
  const prefix = mkdtempSync(join(tmpdir(), "music2-prefix-"));
  run("npm", ["install", "-g", "--prefix", prefix, ...flags, join(root, tarball)]);
  const bin = win ? join(prefix, "music2.cmd") : join(prefix, "bin", "music2");
  const version = JSON.parse(run(bin, ["version", "--json"]));
  if (!version.ok || version.data.bunSource !== "bundled" || version.data.bun !== pinned)
    throw new Error("unexpected version output " + JSON.stringify(version));
  const out = mkdtempSync(join(tmpdir(), "music2-smoke-"));
  run(bin, ["render", join(root, "examples/minimal.song.json"), "-o", join(out, "installed.wav"), "--json"]);
  run(process.execPath, [join(root, "bin/music2.js"), "render", join(root, "examples/minimal.song.json"), "-o", join(out, "repo.wav"), "--json"]);
  if (!readFileSync(join(out, "installed.wav")).equals(readFileSync(join(out, "repo.wav"))))
    throw new Error("installed render differs from the repository render");
  console.log("install smoke ok " + (flags.join(" ") || "default") + " bun " + version.data.bun);
}
```

The script lives under `scripts/`, which the existing pack rule excludes, so it never ships.


## Stale check (wp2 P, branch codex/bun-runtime at c332383)

No file under src, tests, scripts, bin, package.json or .github changed since the audited plan (git diff 08e78c9..c332383 touches devlog only). Re-read: src/render/mixer.test.ts:26, tests/e2e/legacy-render.test.ts:15, scripts/test.mjs:86, tests/e2e/skill-docs.test.ts:49, src/song/load.tool.ts:7 match the plan. Architect proposal and reflection from wp1 stand; no amendment.

## Check round folds (wp2 C, fresh reviewer GO-WITH-FIXES, blockers=1)

- C1 (Medium, folded): `release.yml` split into a read-only `build` job (all checks, `npm pack`, tarball uploaded as an artifact) and a `publish` job that alone has `id-token: write`, runs only on `main`, sits behind `environment: npm`, installs nothing and publishes the downloaded tarball (npm runs no lifecycle scripts for a tarball). Actions in that workflow are pinned to commit SHAs (checkout v7.0.1, setup-bun v2.2.0, setup-node v7.0.0, upload-artifact v7.0.1, download-artifact v8.0.1). The npm Trusted Publisher must name environment `npm`; required reviewers and a `main`-only deployment rule on that environment are repository settings (NEEDS_HUMAN).
- C2 (Low, folded): the launcher follows `process.kill(process.pid, signal)` with `process.exit(128 + n)` for signals Node ignores or repurposes.
- C4 (Low, folded): CI `test` installs Node 24 with setup-node, since it sets `MUSIC2_REQUIRE_NODE=1`.
- C6 (Low, folded): `build` clears `dist` before emitting declarations, so stale JS cannot ship from a developer checkout.
- C7 (Style, folded): repository scripts use `#!/usr/bin/env bun`.
- C3 (Low, residual): two first runs after an `--ignore-scripts` install can both start `install.js`. The bun package's installer is its own code; the launcher only retries once. Left as a documented residual.
- C5 (Low, rebutted): the fixture's `runtime` field names the runtime that must replay it; the comments at `daw-legacy.test.ts:13,130` state the bytes were recorded on Node 24. A Bun bump must re-prove the digests in its own PR, so failing on every platform after a bump is intended.
- C8 (Note): Windows absolute paths passed to `bun test` are covered by the file-count guard; hosted CI on windows-latest is the proof.
- Local gate runs set `TMPDIR` to a fresh directory: this host's default `$TMPDIR` holds ~449k entries, which makes every Bun start with a cwd inside it take 300–500 ms (Node: 20 ms) and pushed the plugin-host 1 s timeout test over its limit. CI runners start with a clean temp directory.
