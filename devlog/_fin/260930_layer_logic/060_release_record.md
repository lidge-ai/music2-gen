# 060 — Release record (0.4.0)

**Result.** `music2-gen@0.4.0` is on npm as `latest` (published 2026-09-30T14:17:41Z, shasum `28f6f52bdba2417a8ec18e48f03cc35492332b9a`, 791 files). A fresh `npm install -g --prefix <tmp> music2-gen@0.4.0 --allow-scripts=bun` runs `music2 version` on the bundled Bun 1.4.0, and on the developer Mac `music2 library scan` finds 72 instrument folders and 22 kits.

## Chain

| Step | Evidence |
|---|---|
| Lane head pushed to `dev` (fast-forward) | `c26b444` → fixes → `f7d721e` |
| Exact-head CI on dev | workflow_dispatch run 36721743449 on `f7d721e`: checks, 3× test, 3× install-smoke, ci all success; PR run 36721747047 also success |
| Promotion audit before merge | `asset-audit --range a497c97..f7d721e`: 0 audio, 0 findings |
| Merge PR #10 dev → main (merge commit) | `aba897a`; tree identical to `f7d721e`; post-merge range audit 0 findings |
| Main push CI | run 36723679685 on `aba897a`: all jobs success |
| Release workflow | run 36724989784 on `aba897a` (headSha checked before approval): build job success (typecheck, lint, full tests, pack; shasum `28f6f52b…`); npm environment approved by the required reviewer; publish job **failed with E404 on PUT**: the package has no Trusted Publisher registered on npm, so OIDC publishing cannot authenticate |
| Publish | same path as 0.3.0: Aside (npm user `bitkyc08`) created a granular token limited to `music2-gen`, read/write, expiring 2026-10-01; the CI-built tarball artifact (same shasum) was published with an isolated npmrc; the token file and npmrc were emptied right after |
| Verification | registry `dist-tags.latest = 0.4.0`; downloaded tarball shasum matches; temp global install runs `version`, `library scan`, `balance --help`; skill references include `logic-library.md` |

## CI hang found during the release

On ubuntu, `bun run test` intermittently never finished (dispatch runs stalled at 17–26 minutes while the same tree passed elsewhere). Streaming the runner output showed the stall moving between files (`library-flow`, then `examples`/`daw-legacy`) with tests waiting in `spawnSync` on CLI subprocesses under `bun test --parallel=4`. Three debug runs of direct streaming `bun test` passed. Fixes: `scripts/test.mjs` streams output, finishes on process exit with a 30-minute hard limit, and runs serially on Linux (`MUSIC2_TEST_PARALLEL` overrides); `library-flow` and `lint-layers` call the source CLI with kill timers. After that, dev dispatch, PR, main push and release build runs all passed. The root cause inside Bun was not isolated.

## Remaining human step

Register the npm Trusted Publisher for `music2-gen` (GitHub Actions, `lidge-ai/music2-gen`, workflow `release.yml`, environment `npm`). npm asked for a security-key tap when this was attempted for 0.3.0, so it needs the account owner. Until then `release.yml` builds and packs correctly but its publish step returns E404, and bypass-2FA publish tokens stop working in January 2027 according to npm's notice.
