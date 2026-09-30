# 000 — Layer stacking and Logic library as first-class music2 features (master plan)

**Summary.** Two composition sessions on 2026-09-30 (a 20-minute dubstep set and a Logic-sourced techno track) show agents doing by hand what music2 should do. To use Apple Logic Pro and GarageBand samples, the agent wrote project scripts that copied pitch-named multisample WAVs, measured each file's real pitch because Alchemy names are off by whole octaves, cancelled the `smpl` fine-tune, wrote SFZ key zones and kit manifests, rendered scales to verify the octave, then measured stem RMS in a section window and nudged track gains toward per-role targets. To stack sounds it duplicated a track four times with the same pattern (sub, mid growl, octave-up growl, screech). This unit turns those steps into CLI features and makes the skill ask for them by default.

## Loop spec

| Field | Value |
|---|---|
| Loop archetype | Satisfy-spec, multi-cycle HOTL (cxc-loop), one PABCD per work-phase wp1..wp6 |
| Trigger | User request 2026-09-30: layering and active Logic use are still weak; use chat search, run cxc-loop, dispatch sol subagents, push to dev and publish to npm |
| Goal | `music2 library` (scan, find, import, verify), `user:<id>` instruments, Song v1 `track.layers[]`, `music2 balance`, skill workflow that plans layers per role and sources Logic content first; released as 0.4.0 |
| Non-goals | Committing or packaging Apple samples; CAF/AAC decoding; EXS zone-map import; relative automation lanes; recipe card changes; new runtime dependencies |
| Verifier | Local `bun run typecheck`, `lint`, `test`, `build`, `audit:structure`, `docs:genres:check`, `privacy:scan` in the worktree; hosted CI on the pushed dev head and main head; npm registry and temp install for the release |
| Stop condition | Goalplan criteria c-1..c-8 met with captured evidence, or an exact BLOCKED/NEEDS_HUMAN record |
| Terminal outcomes | DONE; BLOCKED (npm environment approval or trusted publishing unavailable); NEEDS_HUMAN (required reviewer this account cannot satisfy); UNSAFE (private paths or Apple audio in the push range) |
| Escalation | A breaking change to existing Song v1 fields, removing a public export, a destructive git operation |

HOTL bounds: no token or time budget was stated. Write scope: this worktree (`codex/layer-logic` from `origin/dev`). External writes authorized by the request: push to `origin/dev`, promotion to `main` (the only branch whose release job may publish), release workflow dispatch, npm publish of 0.4.0. Sol subagents (`gpt-6.1-sol`) implement bounded slices with disjoint write scopes; the coordinator owns plan, FSM, integration, commits, push and release.

## Work-phase map

| Work-phase | Doc | Builds | Proves |
|---|---|---|---|
| wp1 | 000–001, 010–050 | this roadmap | c-1 |
| wp2 | 010_library.md | AIFF decoder, `src/library/`, `music2 library`, `user:<id>` resolution, instruments/doctor listing | c-2 |
| wp3 | 020_layers.md | `track.layers[]` schema, validation, layered render in every mixer path, export warnings, lint `info` severity plumbing | c-3 |
| wp4 | 030_balance.md | `src/balance/`, `music2 balance`, optional layer taps | c-4 |
| wp5 | 040_guidance.md | skill workflow, references (carry PR #5 Logic guide), `generic/thin_peak_layers` info rule, layered example | c-5 |
| wp6 | 050_release.md | merge main, 0.4.0, dev push, main promotion, npm publish | c-6..c-8 |

Order: wp3 depends on wp2 because a layer may name a `user:` instrument; wp4 reads layer taps from wp3; wp5 documents all three; wp6 ships.

## Architect consultation

Explorers (sol): render/song map and Apple library/sampler map. Architect (sol, read-only): verdict "proceed with revisions"; dispositions in 001.

## Audit log

- A round 1 (sol reviewer): VERDICT fail, 10 blockers. Folded: B1 lint roles for `user:` (010, 040), B2 ProjectIR `user` variant + shared resolver (010), B3 reusable smpl reader and loop carry (010), B4 valid example values (020), B5 tap identity and coordinates (020, 030), B6 indexed variants instead of round-robin (010), B7 pre-change oracles and pre-master stems (020), B8 asset provenance audit (010, 050), B9 exact-head CI via workflow_dispatch and SHA checks (050), B10 end-to-end CLI flow test and agent exercise (010, 040).
- A round 2: VERDICT fail, 3 blockers (ProjectIR user kind, push-range asset audit, agent exercise pass criteria) folded in 010/040; superseded prose in 010/020/030/050 consolidated.
- A round 3: VERDICT fail, 2 blockers (sync planners, merge-parent traversal) folded in 010 with superseded wording cleaned.
