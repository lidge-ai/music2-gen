# 040 — Delivery record

**Conclusion.** Issues #1 and #2 are fixed, and five problems found while composing sample-based tracks are hardened in the harness. Every work-phase head passed the full hosted CI matrix; the local test suite was not run, at the user's request.

## Commits (branch `codex/harness-hardening`, PR #4)

| Work-phase | Commit | CI run (pull_request) | Result |
|---|---|---|---|
| wp0 roadmap | `aa04880`, `084c1c0` | (docs only; checked by the wp1 run) | — |
| wp1 issue #1 | `17ffc89` | 36440032722 | 8/8 success |
| wp2 issue #2 | `cb0646b` | 36442221532 | 8/8 success |
| wp3 hardening | `6548f76` | 36444837538 | 8/8 success |
| wp4 archive | this commit | `main` push run | recorded in the goalplan receipt |

Each run: `checks` (typecheck, lint, build, audit:structure, docs:genres:check, privacy:scan, pack), `npm test` on ubuntu/macos/windows × Node 22/24, and the `ci` aggregate.

## What changed

- Lint: motif rules check every focal or sampled melody track (order and id independent); `drill_ny/5` counts 808 moves per hook and `drill_uk/6` per contiguous run; `clipping_risk` threshold 2 with √n chord weighting and slow-attack weighting; `register_collision` on unique 16th onsets; `generic/automation_gain_jump` and `generic/automation_send_jump` for lanes far above the static level.
- Analyze: 2:3 and 3:2 tempo labels, `tempoDeclaredMatch`, report and overview headline prefer it.
- Audio and render: unpadded final WAV chunks load; `validate` applies render's voice rules; `revcymbal` and cut kit notes end with a 5 ms fade; kit `startMs` trims late-attack samples.
- Docs: replace semantics for automation lanes; mixing guidance for an open top end, limiter headroom at phrase ends, and sampled-melody timing.

## Evidence

Issue repros were run with the CLI (`node src/cli/index.ts lint|validate`) before and after: repro 1 gives identical results in both track orders, repro 2 warns `drill_ny/5` (0 moves), repro 3 no longer warns clipping (1.6), repro 4 no longer collides, the issue #2 lane warns `automation_gain_jump` (0 vs static −27), and an epiano `releaseMs: 600` song fails `validate` with exit 2. Pinned darwin/Node 24 digests changed only where intended: `minimal` lint (clipping warning gone) and `cinematic-cue` master and `fx` stem (revcymbal taper); they were recaptured with the same CLI calls the replay test makes.

## What did not change, and limits

- A declared-tempo match needs a candidate scoring ≥ 0.9; the sparse repro 3 groove scores 0.655 at 142 BPM, so it gets the `three_halves` label but no match.
- Kits still fold stereo samples to mono; the open-top guidance works around it with width on upper layers. Stereo kits are a follow-up.
- Relative (`offset`) automation lanes and analyze per-track bed-vs-focal loudness (issue #2 items 3–4) are deferred.
- The clipping weights (10 ms onset, 250 ms for bundled beds) are calibrated on the issue repros and examples, not on measured pre-master peaks across many songs.

