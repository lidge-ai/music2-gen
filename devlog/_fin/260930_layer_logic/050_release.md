# 050 — wp6: release 0.4.0

1. `git merge origin/main` into `codex/layer-logic` (brings `chore(release): 0.3.0`); resolve `package.json`/`CHANGELOG.md`.
2. Bump `package.json` to 0.4.0, move Unreleased entries under `## 0.4.0` with the new features. `bun install` to confirm the lockfile is unchanged except version metadata if any.
3. Full local gates; privacy scan; `npm pack --dry-run` contains no `.wav` from Apple content (package ships only `instruments/` bundled libs).
4. Push `codex/layer-logic` → `origin/dev` (fast-forward). A push to dev triggers no CI and PR CI checks out the merge ref, so exact-head proof comes from `workflow_dispatch` on dev (see B9).
5. PR `dev` → `main`; CI green on the PR head; merge (merge commit, like #6). CI on `main` push must pass.
6. `gh workflow run release.yml --ref main -f version=0.4.0 -f tag=latest -f dry-run=false`; if the `npm` environment waits for review, approve it with the authorized account (the user requested npm publish); if approval is impossible → NEEDS_HUMAN.
7. Verify: `npm view music2-gen version dist-tags`, provenance if present, temp install `npm i -g`-free check (`npx -y music2-gen@0.4.0 --version` in a temp dir).
8. Move this unit to `devlog/_fin/` in a final docs commit on dev (and main if promoted together).


## Audit fold (A round 1)

- **B8.** `bun run audit:assets` runs on the final head and on the packed tarball before push.
- **B9 exact-head CI.** After pushing dev, run `gh workflow run ci.yml --ref dev` and confirm the run's `headSha` equals the pushed SHA with every job executed and green. After merging to main, the push-triggered CI run on the main merge SHA must be green. The release run's `headSha` must equal that validated main SHA.
