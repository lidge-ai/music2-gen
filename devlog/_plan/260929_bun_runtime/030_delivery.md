# 030 — wp4: stack delivery and hosted CI

## Branches and PRs

| # | Head | Base | Title |
|---|---|---|---|
| 1 | `dev` | `main` | docs(devlog): candidate audition proposal and Bun runtime roadmap |
| 2 | `codex/bun-runtime` | `dev` | feat!: Bun is the only runtime; npm package runs on bundled Bun |
| 3 | `codex/render-loudness` | `codex/bun-runtime` | perf(render): skip the unused true-peak pass when mastering to LUFS |

Each body carries the stack map (DEV-STACK-03), states what the layer proves and "review this PR's diff only". Ordinary PRs; no GitHub native stack.

## Before the first push

- Privacy: `bun run privacy:scan` at each tip, and `git diff main..<tip> | rg -i -f /tmp/m2t/private-ids.txt` prints nothing. The identifier file (home path prefix, account names, private project and song names used in this session) lives outside the repo.
- Stage only intended files; inspect `git diff --stat <base>..<head>` for each layer.

## Byte comparison script (outside the repo, /tmp/m2t/render-sha.sh)

For every `examples/**/*.song.json` that is not a template needing fixtures, render with `--json` into a temp dir and print `sha256  name`. Run once at `dev` with Node 24 (`node bin/music2.js`), once at the wp2 tip and once at the wp3 tip with Bun (`bun bin/music2.js`); the three lists must be identical.

## CI receipt

CI runs on `pull_request` for every PR regardless of base (ci.yml `on.pull_request` has no branch filter). For each PR: read the PR head SHA, list check runs for that SHA, and require the expected jobs to have run and succeeded: at `dev` (old workflow) `checks`, six `test` legs and `ci`; at the wp2 and wp3 heads `checks`, three `test` legs, three `install-smoke` legs and `ci`. Pending, skipped, cancelled or missing jobs are not a pass. `gh` auth is invalid on this host, so the receipt reads check runs through the GitHub connector (commit workflow runs and jobs) and records run id, event, head SHA and conclusion per job.

## Out of scope

Merging, npm publish, tags, releases, dispatching release.yml.
