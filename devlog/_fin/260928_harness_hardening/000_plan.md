# 000 — Harness hardening from a sampling session, issues #1 and #2 (master plan)

**Summary.** A long composition session (sample-based drill, trap and pop-leaning mixes at 87–142 BPM) and two open issues exposed gaps where music2 either misreported the music or failed late. Lint motif rules follow track order, the drill 808 rule counts jumps between separate hooks, `clipping_risk` fires on grooves that never clip, and `register_collision` ignores 16th-note staggering (issue #1). Gain automation lanes silently replace the static gain (issue #2). `validate` accepts voice parameters that `render` then rejects. The WAV reader refuses odd-sized files whose writer omitted the final pad byte. The `revcymbal` transition and cut kit notes end in a hard step, which is audible as a click right before a downbeat. Kit samples with a slow attack sound late and cannot be trimmed. The composition skill also has no guidance on opening the top end, limiter headroom at phrase ends, or sample timing. This unit fixes all of them in dependency order.

## Loop spec

| Field | Value |
|---|---|
| Loop archetype | Satisfy-spec, multi-cycle HOTL (cxc-loop), one PABCD per work-phase wp0..wp4 |
| Trigger | User request 2026-09-28: fold what the session learned into the harness, resolve the open issues, run cxc-loop and push |
| Goal | Issue #1 and #2 behavior fixed with tests; session findings fixed or documented; gates green; pushed; issues closed |
| Non-goals | Stereo-preserving kits (kits still fold to mono), relative/offset automation lanes, new runtime dependencies, recipe card changes, any copyrighted material or personal paths in the repository |
| Verifier | Hosted CI on the exact pushed head SHA (`.github/workflows/ci.yml` job `checks`: typecheck, lint, build, audit:structure, docs:genres:check, privacy:scan, pack; 6-leg `test` matrix running `npm test`; `ci` aggregate), read by the receipt script below; local evidence is limited to `music2` CLI runs on /tmp repros and the digest recapture in 010 |
| Stop condition | Goalplan criteria c-1..c-13 met with captured evidence, or an exact BLOCKED record |
| Memory artifact | This unit and the session-bound goalplan under `.codexclaw/goalplans/` (gitignored) |
| Terminal outcomes | DONE (pushed, CI inspected, issues closed); BLOCKED (push rejected and no PR possible); UNSAFE (private material in the push range) |
| Escalation | A breaking song-schema change, removing a public export, or a destructive git operation |

HOTL bounds: the user asked for cxc-loop and a push, and for the issues to be resolved; no token or time budget was stated. Write scope: this repository only. External writes: `git push` to `origin` and GitHub issue comments/closure for #1 and #2, both authorized in the request. The sibling worktree `music2-gen-strings` is out of scope.

## Work-phase map

Dependency order: wp1 and wp2 both edit `docs/cli.md`, `devlog/str_func/recipes.md` and the recipes lint family, and wp2 wires into `src/recipes/lint.tool.ts` after wp1 changes the rules beside it, so wp2 builds on wp1. wp3 is independent of lint but its skill guidance cites the rules wp1 and wp2 change, so it runs after them. wp4 publishes.

| Work-phase | Doc | Builds | Proves |
|---|---|---|---|
| wp0 | 000–001, evidence/ | roadmap, architect dispositions, diff-level 010/020/030 | c-1 |
| wp1 | 010_issue1_lint_analyze.md | focal-set motif rules, per-hook 808 transitions, calibrated clipping risk, 16th-grid register collision, declared-tempo match in analyze | c-2..c-6 |
| wp2 | 020_issue2_automation_lanes.md | `generic/automation_gain_jump`, `generic/automation_send_jump`, replace-semantics docs | c-7 |
| wp3 | 030_session_hardening.md | WAV pad tolerance, validate voice checks, revcymbal and kit-note declick, kit `startMs`, skill guidance | c-8..c-11 |
| wp4 | (this doc) | full gates on the final SHA, push to `origin/main`, hosted CI inspection, issue closure | c-12, c-13 |

wp4 procedure: confirm the final head SHA's CI receipt; re-run the privacy grep over the whole range; list private identifiers for DEV-PRIVACY-01 (personal home paths, the session's commercial reference songs and artists) and grep the push range for them; push `main`; read `gh run list --commit <sha>` and the jobs of each run; close #1 and #2 via `Fixes #N` commit trailers, or comment with the fixing commits when the trailer did not close them.

## Architect consultation

Architect: read-only subagent, proposal D1–D10 summarized in evidence/architect-proposal.md. Main dispositions are in 001. Reflection (same architect): ALIGNED with 13 fixes R1–R13; all folded into 010/020/030 "Reflection amendments" sections.

## Audit log

(filled at A)

## Attestation log

| Edge | Work-phase | Evidence |
|---|---|---|


## Verification constraint and delivery path (user, 2026-09-28)

The user forbade running the local suite. Every gate runs in hosted CI instead. Delivery path: branch `codex/harness-hardening` from `main`, one draft PR to `main`; each work-phase pushes its commits and its Check reads the CI run for that exact head SHA (checks + 6-leg test matrix + `ci` aggregate). wp4 pushes the final green head to `origin/main` (fast-forward), confirms the `main` push run, and closes #1/#2. The sibling PR #3 branch is untouched.


## Audit round 1 folds (000)

- Privacy grep runs before the FIRST push (wp1 C) and again at wp4: scan content only, never commit headers: `{ git diff main..HEAD; git log --format=%B main..HEAD; } | rg -i -f <workspace>/private-ids.txt` must print nothing. The identifier file lives in the task workspace (personal home-path prefix, account email local part, and the commercial songs and artists referenced during the session); it is not committed. Draft PR opens at wp1's first push so the `pull_request` CI run exists.
- CI receipt (PLAN-VERIFIER-REAL-01). Script kept outside the repo at the task workspace (`ci-check.sh`): `gh run list -R lidge-ai/music2-gen --commit <sha> --workflow CI --event pull_request` selects the run whose `headSha` equals the pushed head; `gh run view <run> --json event,headSha,attempt,status,conclusion,jobs` must show status completed, conclusion success, headSha equal, and exactly the expected jobs `checks`, the six `test (<os>, <node>)` legs and `ci` (8) all success. A run cancelled by `cancel-in-progress` does not count; only the exact head SHA's run is read. The C>D receipt is `cxc receipt test --session <id> -- bash <workspace>/ci-check.sh <sha> pull_request`. For wp4 the event is `push` on `main`.


## Audit log (wp0)

Independent reviewer (read-only, no local suite). Round 1 FAIL, 6 blockers: lint-generic fixture under √n (F1), phrase test string arg (F2), pinned darwin/Node 24 digests (F3), stale 1.5 texts (F4), verifier/receipt/privacy order (F5), missing activation tests (F6); all folded (010/030 "Audit round 1 folds", 000 folds). Round 2 GO-WITH-FIXES (blockers=1): privacy grep matched commit headers and `JUNK`; folded as a content-only grep against a workspace identifier file. Notes folded: verifier wording, recapture split wp1 lint / wp3 render, draft PR at first push.

## wp4 P entry

Previous D (wp3): session hardening landed at `6548f76`, CI run 36444837538 8/8 green. wp4 B: move this unit to `devlog/_fin/260928_harness_hardening/` with `040_delivery.md` (commits, CI runs, criteria evidence, residual limits, follow-ups), commit, rerun the content privacy grep over `main..HEAD`, push the branch and fast-forward `origin/main` to the same SHA (`main` is unprotected; `git merge-base --is-ancestor origin/main HEAD` must hold). wp4 C: receipt on the `push` CI run for that SHA on `main`; confirm #1 and #2 closed by the `Fixes` trailers, else comment with the commits and close.

