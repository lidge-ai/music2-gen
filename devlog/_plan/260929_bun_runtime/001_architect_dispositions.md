# 001 — Architect dispositions and P-phase probes

## P-phase probes (2026-09-29, macOS arm64, Bun 1.4.0, Node 24.17.0)

| Probe | Result |
|---|---|
| `render examples/drill-140.song.json` Node vs Bun | 1.48 s vs 0.97 s, `cmp` identical |
| 120-bar private test song, 5089 events | 20.9 s vs 15.0 s, `cmp` identical |
| CPU profile of that render under Node | `truePeakOf` 26.5%, `limitLookahead` 14.5%, `truePeakBounded` 14.1% of 19.8 s |
| `bun test src/audio-io src/automation src/pattern` | 51 pass, 0 fail, unmodified `node:test` files |
| `bun test src tests/e2e` | 925 tests / 198 files: 885 pass, 23 skip, 17 fail |

The 17 failures fall into three causes. Twelve example e2e tests and the plugin-host and ffmpeg timeout tests hit `bun test`'s 5 s per-test default; with `--timeout 600000` the plugin-host and ffmpeg files pass. `src/song/load.test.ts` fails because JavaScriptCore's `JSON.parse` message carries no `position N`, so `src/song/load.tool.ts:7` finds no location. `tests/e2e/package-boundary.test.ts` failed because this worktree had no `node_modules` (`tsc: command not found`). The 23 skips include every golden-digest test, because Bun reports `process.versions.node` as 26.3.0 and the gates at `src/render/mixer.test.ts:26`, `tests/e2e/legacy-render.test.ts:15` and `tests/e2e/daw-legacy.test.ts:15` require Node 24.

`bun test --help` (1.4.0) offers `--parallel=<N>`, which implies `--isolate` (fresh global per file), the closest match to `node --test --test-concurrency=4`.

## Dispositions

| ID | Proposal | Disposition |
|---|---|---|
| D1 | package.json: `dependencies.bun` pinned exactly, `engines.node >=18` for the launcher, exports `types`/`bun`/`default`, tsc for declarations only, `files` adds `src` without tests, bun scripts, `bun.lock` replaces `package-lock.json`, `@types/bun` replaces `@types/node` | Accept, amended at A: `@types/bun` 1.4.0 is added beside `@types/node` ^22.20.1 with an `overrides` pin, because bun-types would otherwise pull `@types/node` 26 and break typecheck. AGENTS.md changes "zero runtime dependencies" to "one runtime dependency, the pinned `bun` package". |
| D2 | Plain-Node launcher: in-process import under Bun, `MUSIC2_BUN_PATH` override, bundled binary with 1 MB placeholder check and one `install.js` retry, spawn with signal and exit forwarding, spawn failure exits 3 | Accept, amended: in JSON mode (`--json` or `MUSIC2_JSON=1`) every launcher failure prints one `{ok:false,error:{code:"E_CAPABILITY",…}}` object so the CLI JSON contract holds; the child gets `MUSIC2_BUN_SOURCE` = `bundled` or `override` so `version --json` can report it. |
| D3 | Keep `scripts/test.mjs`; spawn `bun test` instead of `node --test` | Accept, amended with the probe: `bun test --parallel=4 --timeout=600000`, which also isolates files. |
| D4 | CI: setup-bun, OS matrix × pinned Bun, keep all checks, new install-smoke job that installs the packed tarball with npm and runs it, aggregate needs all | Accept. Install-smoke compares a launcher render against an in-repo `bun bin/music2.js` render in the same job instead of a stored hash, because the determinism promise is per platform. |
| D5 | Minimal `release.yml`: `workflow_dispatch` with version/tag/dry-run (default true), `id-token: write`, checks, pack assertion, `npm publish` via Trusted Publishing | Accept. NEEDS_HUMAN items listed in 010. |
| D6 | Determinism wording to "music2 version (which pins Bun X.Y.Z) and platform"; re-key digest gates to darwin + `process.versions.bun === dependencies.bun`; rename `darwin-node24.json` | Accept; gate change is the first commit of wp2. |
| D7 | `integratedLoudness(pcm)` sharing a private prefix helper with `measureLoudness`; call sites `mixer.tool.ts:131` and `analyze.tool.ts:89`; `Object.is` unit test | Accept. The flag-argument alternative is rejected as control coupling. |
| D8 | Stack order main ← dev ← render-loudness ← bun-runtime ← npm-release | Rebut. The owner framed Bun as the base, and the loudness proof needs the Bun-keyed digest gate from D6 to run under Bun; below the runtime layer it would only be proven on Node. Packaging stays in the runtime PR because the owner asked for "bun 기본 + npm 배포" as one decision and the launcher is what makes Bun the default for installed users. Three PRs: main ← dev ← codex/bun-runtime ← codex/render-loudness. |
| D9 | No `Bun.*` APIs in src in this stack | Accept. |
| D10 | Digest gate first in wp2 | Accept. |

Architect unresolved assumptions and where they close: file isolation (closed by `--parallel` isolate); extensionless shebang fakes under Bun (wp2 full-suite run); node-shebang dev tools (`tsc`, `eslint`) under "Bun-only" (closed at A: per-script `bun --bun`; `bunfig.toml` `[run] bun = true` was rejected because it also turns every nested `node` into Bun); Windows binary resolution and signals (install-smoke job on windows-latest); install size (reported in the PR, not gated).

## Reflection


Same-architect reflection: MISALIGNED with 3 blocking gaps (daw-legacy `nodeMajor` references and fixture field, launcher URL pathname, silent `bun test` filter misses) and 3 minor (launcher `meta.music2`, skill-docs regex commit placement, example count). All folded as R1–R6 in 010 "Reflection amendments" and 020. The architect accepted the D8 rebuttal and verified: `bunfig.toml [run] bun = true` switches node-shebang bins to Bun 1.4.0 (later rejected at A, see 010 A1); `--parallel` implies `--isolate` and accepts absolute paths; setup-bun v2 reads `packageManager: bun@1.4.0`; npm pack honors `!src/**/*.test.ts`; the scanner returns the stated offsets with no false errors on the examples; `integratedLoudness` keeps the arithmetic order.
