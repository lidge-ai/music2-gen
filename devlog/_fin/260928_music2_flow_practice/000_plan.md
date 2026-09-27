# 000 — Flow overview and real-world practice (master plan)

**Summary.** The first roadmap (devlog/_fin/260928_music2_roadmap/) shipped a working music2 CLI, but its genre knowledge came from tutorials and textbooks alone, and an agent had no single picture of how a rendered song moves from section to section. This unit adds both. wp2 gives `music2 analyze` a deterministic `overview.png` (loudness flow, 3-band waveform, activity lanes, novelty, brightness, a labeled self-similarity inset and burned-in verdicts) plus a `flow` object in analysis.json. wp3 folds real reference tracks and delivery use cases into recipe arrangement variants, use-case presets, new checks and example songs. wp4 tests whether a vision model can read the overview alone, updates agent docs, pushes `main` and verifies hosted CI. Research: 001 (real-world practice and dispositions), 002 (flow formulas), 003 (layout and vision evaluation), 004 (architecture); evidence/ holds both Aside reports and the architect proposal.

## Loop spec

| Field | Value |
|---|---|
| Loop archetype | Satisfy-spec, multi-cycle HOTL (cxc-loop), one PABCD per work-phase wp1..wp4 |
| Trigger | User request 2026-09-28: still lacking; analyze real-world music use cases closely with Aside, find a way to show a song's flow in one image, research methods with sol subagents and Aside exec, and put them in |
| Goal | lidge-ai/music2-gen `main` carries overview.png, flow analysis, case-studies/use-cases references, arrangement variants, use-case presets, new checks and examples, with green hosted CI |
| Non-goals | npm publish, tags or releases; neural models; bundled audio; per-track numeric swing, nudge, 6/8 meters, beat switches, arrangement-move schema (deferred in 001) |
| Verifier | Per phase: `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`, `npm run audit:structure`, `npm run docs:genres:check`, `npm run privacy:scan`, plus the phase commands in each decade doc; wp4: image-only evaluation record and GitHub Actions on the pushed `main` SHA |
| Stop condition | Goalplan criteria c-1..c-7 met with fresh evidence, or an exact BLOCKED/UNSAFE record |
| Memory artifact | This unit and the goalplan `.codexclaw/goalplans/deepen-lidge-ai-music2-gen-music2-cli-repo-at-th/` (gitignored) |
| Terminal outcomes | DONE (pushed, CI green, all criteria); BLOCKED (push or CI denied); UNSAFE (secret or private data in the push range) |
| Escalation | A breaking change to song schema v1 or an existing CLI contract, a new runtime dependency, anything destructive outside this repository. Delegation: after two distinct agents fail the same packet, main reclaims it |

HOTL bounds: the user granted unlimited sol subagents and Aside exec research; no token or time budget. Write scope: this repository, scratch under a task-owned temp directory and the Aside artifact directories `music2-flow-image-260928` and `music2-real-world-260928`. External write: push `main` of the existing public repository. Credentials: the operator's GitHub CLI login, checked at push time.

## Work-phase map (dependency order)

| Work-phase | Decade doc | Builds | Proves |
|---|---|---|---|
| wp1 | 000–004 | Aside and sol research synthesis, dispositions, architecture, diff-level docs 010–030 | audited docs (A gate) |
| wp2 | 010_overview_image.md | shared K-weighting scan, flow intervals/loudness/3-band/features/SSM/novelty/repeats/annotations, overview canvas and panels, analysis.json `flow`, analysis.md `## Flow`, CLI artifact | c-2 (song and WAV overview, byte-identical) |
| wp3 | 020_real_world_checks.md | case-studies.md, use-cases.md, arrangement variants and `new --arrangement`, use-case presets and `new --use`, `song.loop` render wrap, four new checks, six examples (three of them use-case songs) | c-4, c-5, c-6 |
| wp4 | 030_eval_docs_release.md | image-only evaluation harness and record, overview reading docs, skill/README/CLI docs, privacy and identity checks, push, hosted CI, archive | c-3, c-7, c-1 on hosted CI |

Criteria mapping: c-1 every phase (hosted in wp4); c-2 wp2; c-3 wp4; c-4, c-5, c-6 wp3; c-7 wp4.

## Global conventions

Unchanged from the first roadmap and AGENTS.md: Node ≥ 22.18 type stripping, erasable TypeScript, `.ts` import specifiers, zero runtime dependencies, `*.tool.ts` with colocated tests, files near 400 lines or fewer, `--json` prints one object, exit codes 0–7, fixed seeds and `src/shared/prng.tool.ts` only. Song schema v1 changes are additive (`loop?: boolean`, `useCase?: UseCaseId`). analysis.json keeps `version: 1` and adds `flow` after `bands`. Structure docs in `devlog/str_func/` follow every export change.

## Architect consultation

Architect: sol subagent (proposal F1–F9 in evidence/architect-proposal.md); dispositions in 004. Research dispositions for both Aside reports are in 001. Reflection round: below.

Reflection round (same architect, read-only, after 000/001/004/010 were drafted). Every item was accepted and folded in:

| ID | Finding | Disposition |
|---|---|---|
| A1 | `song.loop` alone cannot express an intro plus a separate loop body | Accept: in this unit `loop: true` means the whole song is the loop body; intro file and loop points deferred (001 R3 row, 020) |
| A2 | Role-based section loudness needs per-occurrence values, while FlowAnalysis had only adjacent deltas | Accept: `FlowAnalysis.sectionMeans` added to 010; `SECTION_LOUDNESS_FLAT` reads it (020) |
| A3 | Light theme as the first fix for a failed image gate is premature | Accept: diagnose failed fields and the 1024 px image first (001) |
| A4 | Card `arrangement` and `starterSong.arrangement` are two sources | Accept: the named variant is the single generator, default included (020) |
| A5 | `--use` and `--arrangement` need a fixed resolution order | Accept: genre, use preset variant, explicit arrangement, explicit bpm/key; bad combinations exit 2 (020) |
| A6 | Exact 15/30/60 s needs frame-exact length, and render adds a ceil'd tail | Accept: frame-level search over bpm, bars and tail; no silent truncation (020) |
| A7 | Loop tail wrap changes the render length that `analyze --song` checks | Accept: wrap before mastering, export body frames, alignment accepts loop length; normal songs unchanged (020) |
| A8 | Generic density lint overlaps genre rules; warning order vs flow annotations; seam metric needs loop intent | Accept: suppress duplicates, fixed order (warnings, flow, new flow warnings, annotations), seam check only for `loop: true` songs with separately recorded observations (020) |

## Audit log

Independent sol reviewer (cxc-dev-code-reviewer skill, read-only), three rounds over 000–004, 010, 020, 030 and evidence/.

| Round | Verdict | Findings and fixes |
|---|---|---|
| 1 | FAIL | MAJOR: only two use-case examples for c-6 (added a third); c-2 lacked a WAV-only byte-identity test (added to 010); evaluation evidence path broke after archival (harness takes `--evidence-dir`, rescore after the move). MINOR: density oracle mislabelled `5–4`; 002/003 source links did not resolve |
| 2 | FAIL | MAJOR: evaluation commands omitted `--evidence-dir` (added everywhere); the third use-case fixture exercised only skip paths (replaced by a 72-bar trap type beat whose three targeted checks apply). MINOR: example counts and `useCase` in 000/001; architect evidence source links |
| 3 | NEAR-PASS | MINOR: architect evidence doc links (rebased); type-beat loudness step used a section gain Song v1 lacks (now pattern overrides only). Both fixed after the verdict |

## Attestation log

| Edge | Work-phase | Evidence |
|---|---|---|
| IDLE→P→A→B→C→D | wp1 | Docs unit committed `3a80a03`; unit audit FAIL, FAIL, NEAR-PASS with all findings folded in; receipt: files present, no personal paths, privacy 0 findings |
| IDLE→P→A→B→C→D | wp2 | `0edea01`: flow measurements and `overview.png`; independent code review FAIL (11.025 kHz 1 Hz point) then NEAR-PASS, fixed; receipt 354 tests, 351 pass, 0 fail, 3 skipped; c-2 met |
| IDLE→P→A→B→C→D | wp3 | `c8de8c5`: arrangements, presets, loop render, four checks, six examples, references; review FAIL (house/6 over-suppression) then NEAR-PASS, fixed; old core trap/boom-bap examples rearranged to pass the new checks; receipt 401 tests, 398 pass, 0 fail; c-4, c-5, c-6 met |
| IDLE→P→A→B | wp4 | Image-only evaluation, docs, version 0.2.0 entry, archive, push and hosted CI (below) |

## Image-only evaluation result (c-3)

Fresh gpt-6-sol subagents each received one prepared PNG and the fixed 003 prompt, nothing else. After the first pass exposed a label and scoring mismatch (see the 030 amendment; those captures are kept in `evidence/overview-eval/superseded-attempt1.json`), all cases were captured again against new image hashes. Result: native 1600 px overview **4/4** cases with exact order, every boundary within one bar and the correct loudest section; 1280 and 1024 px also 4/4 four-way correct. The spectrogram control scored 0/4 at every size: the models returned empty answers because a spectrogram carries no section labels. Trap and boom bap were recaptured once more after wp3 rearranged those two examples. The wp3 use-case examples were not dispatched as extra diagnostic cases in this run; they are covered by e2e assertions instead. Evidence: `evidence/overview-eval.md`, `evidence/overview-eval/summary.json`, raw answers under `evidence/overview-eval/answers/`.
