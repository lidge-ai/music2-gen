# 051 — wp6 stale check

Previous D (wp5): guidance shipped, balance supports loops, fresh-agent exercise passed; full suite 1141 pass at df446e7. Direction unchanged: release per 050 with folds B8/B9.

Live state (read-only, 2026-09-30): `origin/dev` = 3f69134 (our branch base), `origin/main` = a497c97 (`chore(release): 0.3.0`, only `package.json` and `CHANGELOG.md` differ from dev). Neither branch is protected. npm `latest` = 0.3.0. The `npm` environment has one required reviewer, `lidge-jun` (the authenticated `gh` account), `prevent_self_review: false`, custom branch policy; 0.3.0 was published by `release.yml` run 36528234786 from main.

Order: merge `origin/main` into `codex/layer-logic` → bump 0.4.0 + CHANGELOG + move this unit to `devlog/_fin/` → local gates → `asset-audit --range origin/dev..HEAD` → push `HEAD:dev` (fast-forward) → `gh workflow run ci.yml --ref dev` and confirm headSha + all jobs green → PR dev→main → CI green → promotion asset audit on captured SHAs (fold) → merge commit → main push CI green on the merge SHA → `gh workflow run release.yml --ref main -f version=0.4.0 -f tag=latest -f dry-run=false` → confirm run headSha = validated main SHA → approve the `npm` environment deployment as the required reviewer (the user asked for the npm release) → `npm view music2-gen@0.4.0`, dist-tags, and a temp-dir `npx -y music2-gen@0.4.0 --version`.

## Audit fold (A round 1)

- **SHA before approval.** After dispatching `release.yml`, read the run's `headSha` and require it to equal the validated main merge SHA before approving the `npm` environment. On mismatch, reject the deployment and gather fresh CI and gate evidence for the new SHA.
- **Promotion audit before merge, with concrete SHAs.** Before merging the dev→main PR, capture `OLD_MAIN=$(git rev-parse origin/main)` and `CANDIDATE=$(git rev-parse origin/dev)` after a fetch and run `asset-audit --range $OLD_MAIN..$CANDIDATE`; rerun it if either ref moves before the merge. After the merge, `asset-audit --range $OLD_MAIN..<merge sha>` confirms the merge commit adds nothing new.
