# 000 — Bun-only runtime, npm packaging and render loudness (master plan)

**Summary.** music2 runs on Node 22/24 today and is not published. The owner decided (2026-09-29) that Bun becomes the only supported runtime, that music2 ships on npm the way opencodex does (the package depends on the npm `bun` package and a small Node launcher hands the TypeScript CLI to that bundled Bun), and that the render path stops computing a true-peak value it never uses. Bun 1.4.0 already renders every measured example byte-identical to Node 24 and about 30% faster, and the existing `node:test` files run under `bun test` unmodified. The work is delivered as a manual chain of three ordinary PRs.

## Loop spec

| Field | Value |
|---|---|
| Loop archetype | Satisfy-spec, multi-cycle HOTL (cxc-loop), one PABCD per work-phase wp1..wp4 |
| Trigger | User request 2026-09-29: "stack pr 로 올려놔 … bun 기본 런타임 … node 지원을 빼고 … ../opencodex npm 배포 방식 참고" with cxc-loop |
| Goal | Bun is the only runtime; npm packaging and a dry-run-first release workflow exist; render mastering skips unused true-peak work; three stacked PRs open with exact-head CI green |
| Non-goals | npm publish, tags, GitHub releases, running the release workflow for real, merging, candidate-audition implementation (see ../260929_music2_candidates), multicore or WASM work, any change to rendered audio, adopting `Bun.*` APIs in src |
| Verifier | Local: `bun run typecheck`, `bun run lint`, `bun run test`, `bun run build`, `bun run audit:structure`, `bun run docs:genres:check`, `bun run privacy:scan`, `npm pack --dry-run`, and sha256 render comparison (030). Hosted: CI on each PR head SHA (030) |
| Stop condition | Goalplan criteria c-1..c-7 met with captured evidence, or an exact BLOCKED / NEEDS_HUMAN record |
| Memory artifact | This unit and the session goalplan under `.codexclaw/goalplans/` (gitignored) |
| Terminal outcomes | DONE; BLOCKED (push or PR creation denied); NEEDS_HUMAN (npm name claim, first publish, Trusted Publisher setup); UNSAFE (private data in a push range) |
| Escalation | A Song v1 change, a change to rendered bytes, a second runtime dependency, a destructive git operation on shared branches |

HOTL bounds: write scope is this repository plus scratch under `/tmp/m2t`. External writes authorized by the request: pushing `dev`, `codex/bun-runtime` and `codex/render-loudness` to `origin` and opening three PRs. Not authorized: merge, npm publish, tags, releases, workflow dispatch of `release.yml`. No token or time budget was stated. `gh` CLI auth on this host is invalid (2026-09-29); PR creation uses the GitHub connector, and CI is read through it.

## Work-phase map and PR stack

Dependency order: the runtime is the foundation every later check runs on, so it sits below the loudness change. wp2 also re-keys the golden-digest tests from Node 24 to the pinned Bun version (001 D6); without that gate the byte-identity proof in wp3 would silently skip.

| Work-phase | Doc | Branch / PR base | Builds | Proves |
|---|---|---|---|---|
| wp1 | 000–001, 010, 020, 030 | `dev` → `main` | this roadmap (plus the already committed ../260929_music2_candidates proposal) | c-1 |
| wp2 | 010_bun_runtime.md | `codex/bun-runtime` → `dev` | Bun-only scripts and tests, launcher, npm packaging, CI and release workflows, docs | c-2, c-3, c-4, c-5 |
| wp3 | 020_render_loudness.md | `codex/render-loudness` → `codex/bun-runtime` | `integratedLoudness`, render and analyze call sites | c-3, c-5 |
| wp4 | 030_delivery.md | — | push, three PRs with stack maps, exact-head CI | c-6, c-7 |

## Architect consultation

Read-only architect proposal D1–D10 and main dispositions: 001_architect_dispositions.md. Reflection result is appended there.

## Audit log

| Round | Reviewer | Verdict | Findings and disposition |
|---|---|---|---|
| 1 | independent read-only reviewer | GO-WITH-FIXES (blockers=7) | bunfig turns nested node into Bun; @types/bun breaks typecheck; flow-style YAML invalid; MUSIC2_JSON; install.js retry untested; CI aggregate and smoke script not diffed; legacy gate name → folded A1–A7 (010), A1 rechecked by the architect (added overrides) |
| 2 | same reviewer | GO-WITH-FIXES (blockers=2) | superseded Diffs blocks left in place; Node preflight fails on Bun-only machines → edited in place, preflight skips unless MUSIC2_REQUIRE_NODE=1 |
| 3 | same reviewer | PASS | four lows folded (legacy gate block, failCapability arity, package-manager-cache, privacy rule) |
