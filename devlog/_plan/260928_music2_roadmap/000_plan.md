# 000 — music2-gen roadmap (master plan)

**Summary.** Coding agents can write code but cannot hear, and the music tools they know (Strudel, Sonic Pi) need a
browser or a GPL/AGPL runtime. music2-gen (binary `music2`) closes that gap: an agent writes a JSON song whose tracks
are mini-notation strings, music2 renders it offline and deterministically to WAV with its own synth voices, then
shows the result back to the agent as numbers (analysis.json, analysis.md), pictures (spectrogram.png,
pianoroll.png) and, for audio-capable models such as Gemini through opencodex, an optional listening critique.
Genre recipe cards and lint rules turn a prompt like "140 BPM hip-hop drill" into idiomatic starting points.
Research is in 001–006; each implementation phase has a decade doc (010–050).

## Loop spec

| Field | Value |
|---|---|
| Loop archetype | Satisfy-spec, multi-cycle HOTL (cxc-loop), one PABCD per work-phase wp1..wp6 |
| Trigger | User request 2026-09-28: research open source with Aside exec, make music2 usable by text+image-only models, probe audio-capable models (Gemini) through opencodex, scaffold with dev-scaffolding, run cxc-loop with unlimited sol subagents, finish and push |
| Goal | Public repo lidge-ai/music2-gen with a working, tested, documented `music2` CLI (render, analyze, new, lint, recipes, critique, doctor, schema, validate, events), an agent skill, examples incl. a 140 BPM drill demo, green hosted CI |
| Non-goals | npm publish, tags or GitHub releases (not requested); vocals / neural text-to-music; bundled third-party audio; browser or Web Audio runtime; DAW plugins; tempo or meter changes inside a song; polymeter |
| Verifier | Per phase: `npm run typecheck`, `npm run lint`, `npm test` (node:test, colocated unit tests + tests/e2e), `npm run build`, plus the phase commands in each decade doc; wp6: GitHub Actions run on the pushed `main` SHA (jobs checks, test × 6, ci) |
| Stop condition | Goalplan criteria c-1..c-8 met with fresh evidence, or an exact BLOCKED/NEEDS_HUMAN record (GitHub repo creation/push denied, org policy) |
| Memory artifact | This unit (devlog/_plan/260928_music2_roadmap/, attestation log below) + goalplan `.codexclaw/goalplans/build-and-push-lidge-ai-music2-gen-an-mit-licens*/` (native cwd = repo root, gitignored) |
| Terminal outcomes | DONE (pushed + CI green + all criteria); BLOCKED (push/CI denied); NEEDS_HUMAN (auth/MFA); UNSAFE (secret or private data in push range) |
| Escalation | Anything destructive outside this repo, a change to the public song schema after push, secrets in history, a new runtime dependency. Delegation: after two distinct agents fail the same packet, main reclaims it |

HOTL bounds: user granted unlimited sol subagents and Aside research; no explicit token/time budget was set. Write
scope: this repository, scratch under /tmp/music2-poc and the Aside artifact directory
(<aside-account>/artifacts/music2-gen-research-260928). External writes allowed: create lidge-ai/music2-gen
(public, like lidge-ai/vid2-gen) and push `main`. Credentials: the operator's existing GitHub CLI login (checked at execution time)
and the local opencodex proxy for live critic checks.

## Mechanics

- Repo: ., own git repository (`git init -b main` on 2026-09-28), nested
  inside the parent workspace but independent of it (parent repo untouched; Phase-3 standalone rules apply).
- Commits: conventional commits (`feat(pattern): ...`), one or more per work-phase, local until wp6 (the user asked
  for a push at the end; wp6 pushes once CI files exist).
- Lanes: bounded sol subagents with disjoint write scopes inside this checkout; main integrates and owns all FSM edges.

## Work-phase map (dependency order)

| Work-phase | Decade doc | Builds | Proves |
|---|---|---|---|
| wp1 | 000–006 | research, probe, architecture, this roadmap | audited docs (A gate) |
| wp2 | 010_foundations.md | package, tooling, CI file, errors, rational, PRNG, mini-notation parser + query, song schema + validator, arrangement timeline, CLI (version/help/schema/validate/events) | `music2 validate` / `events` on examples; conformance vectors from 004 |
| wp3 | 020_render_engine.md | audio-io, voices, kit sampler, mixer/fx/duck/master, render command, ffmpeg probe + encode, doctor, drill example | byte-identical renders (c-2) |
| wp4 | 030_analysis_visuals.md | FFT, LUFS/LRA/true peak, tempo/beats, key, bands, PNG, spectrogram, piano roll, beats.json, analysis.md, analyze command | BPM ±2 on drill + valid PNGs (c-3) |
| wp5 | 040_recipes_lint_critic.md | 7 recipe cards, recipes/new/lint commands, wrong-genre example, critic transport + critique command | lint pass/fail (c-4), critique (c-5) |
| wp6 | 050_agent_layer_release.md | skill + references, README/docs, more examples, dogfood by a text-only subagent, privacy scan, GitHub repo + push, hosted CI | c-6, c-7, c-8, c-1 on hosted CI |

Criteria mapping: c-1 every phase (hosted in wp6); c-2 wp3; c-3 wp4; c-4 wp5; c-5 wp5; c-6 wp6; c-7 wp6; c-8 wp2
(package.json has no `dependencies`) and re-checked in wp6.

## Global conventions (every phase)

Defined in 010 "Global conventions": Node ≥ 22.18 type stripping, erasable TS only, `.ts` import specifiers, zero
runtime dependencies, Lidge Standard file suffixes with colocated tests, files under ~400 lines, `--json` single
object on stdout, exit codes 0–7, determinism rules (003 D6). Structure SoT: `devlog/str_func/` (one doc per feature,
index in devlog/str_func/AGENTS.md); each phase updates the docs of the features it touches (SOT-SYNC-01).

## Architect consultation (formal P)

Architect: sol subagent `01a0e37e-3635-72b2-a410-a984adb4532a`, proposal D1–D13 (evidence/architect-proposal.md).
Dispositions: 003_architecture.md (all accepted; D1, D3 amended; D2, D5–D8 accepted with resolved assumptions).
Reflection (same architect, 2026-09-28): **MISALIGNED** with 7 gaps, all accepted and fixed: (1) LUFS owner moved to
`src/audio-io/loudness.tool.ts` with a 030 MODIFY row for `render/mixer.tool.ts` (no render↔analyze cycle); (2) PCM type unified on
020's `StereoBuffer` with `sourceChannels: 1 | 2` so mono loudness vectors hold; (3) D2 top-level `bars` and D5 track `fx` withdrawn,
mixer reads `track.gain` (dB); (4) `lint --genre`/`--strict` passed into `lintSong` with a CLI test; (5) WAV-only analyze writes an
audio-sourced beats.json (050 aligned to 030); (6) one filename `pianoroll.png`, five skill references; (7) `E_TIMEOUT` → exit 7 stated in
010's error map and 040, stale `060` references → 050. Main also found and fixed a fixture collision: 030 now reuses 020's
`examples/drill-140.song.json`. beats.json writes `meter` as a number for the vid2-gen reader (vid2-gen src/timeline/resolve.ts:64-65)
plus `timeSignature`. Devlog paths were made repo-relative for the public push.

## Audit log (A phase)

Round 1 (reviewer sol `01a0e398-dd2d-7071-b6e9-de17f1f11eaa`, 2026-09-28): **VERDICT: FAIL**, 11 High, all accepted, none rebutted.
Root causes: resolved-vs-authoring song types never defined; CLI registration shape not pinned; strict flag leaked into the lint API;
targetLufs blocked its own ffmpeg path; mono downmix doubled; section ids not unique across entries; WAV length ignored the tail;
str_func index had no creator; schema drift check blind to untracked files; placeholder audit command; account identity in a public doc.
Fixes: ResolvedSong/Track/Section (010), CommandSpec (010, 020), CLI-only strict (040), RenderOptions.mastering (020, 030), mono
downmix + test (030), Placement.occurrence (010, 030), tail-aware length check (030), str_func MODIFY row (010), byte schema test (010),
scripts/structure-audit.mjs (010), identity removed (000). Added the measured octave rule (evidence/tempo-probe.md).
Round 2 (same reviewer): **FAIL**, 4 High, accepted: newSong returned ResolvedSong (040), voice API took Track (020), octave rule could
double a real 70–75 BPM groove (030), tempo test named a nonexistent 8-bar fixture (030). Non-blocking: AnalysisJson.tailSeconds.
Round 3 (same reviewer): **FAIL**, 1 High, accepted: ≥50% sixteenth-grid occupancy admits 75 BPM eighth hats. Fix: promote only when
occ16 > 0.6 or off32 ≥ 0.10, with 75 BPM loud-hat and UK 3+3+2 vectors (030).
Round 4 (same reviewer): **VERDICT: PASS**. Architect recheck after round 1: D7/D8/D11/D12 ALIGNED, D2 gap (renderSong input type)
fixed before round 2.

## Attestation log

- **wp1 D (2026-09-28):** roadmap unit committed as c065cd5 and verified by the unit check (12 numbered docs, 0 failures, receipt
  .codexclaw/evidence/<session>/test-receipt.json). Conclusion: the roadmap is locked; implementation starts with wp2 from 010 as audited.
  Direction for wp2: main writes the package/tooling skeleton and src/shared first (every other feature imports it), then parallel sol
  lanes with disjoint write scopes: pattern (parse/query/euclid/values), song (schema/arrange/timeline/load + schema JSON), cli
  (registry/args/output/commands) and repo meta (AGENTS.md, README stub, CI, scripts/test.mjs, scripts/structure-audit.mjs).
  Still unproven (pessimist note): the drill tempo criterion rests on the guarded octave rule measured on one PoC render; the audio
  critic is n = 2; Windows byte-identity of renders is untested. Evidence that would show the direction is wrong: the 75 BPM vector
  promoting to 150, or a Windows CI render hash differing between two runs.


- **wp2 D (2026-09-28):** foundations committed as 8e56b98 (L0 main, lanes LA pattern, LC cli, LD meta/CI, LB song+commands, str_func
  docs). Fresh C: typecheck, lint, 61/61 tests, build, dist CLI, structure audit (receipt in the session evidence dir). Conclusion: the song
  contract (ResolvedSong, Timeline) and CLI contract are stable; all 004 vectors plus nested/stacked alternation and cross-cycle spans pass.
  Direction for wp3: re-verify 020 against the real song/timeline exports (TimedEvent fields, ResolvedTrack shape), then lanes: audio-io
  (buffer/wav) first by main or one lane, voices in two parallel lanes (drums+808+bass / bell+keys+pluck+pad+lead), fx+mixer+render+kit,
  probe+commands; drill-140 example written by main. Pessimist note: nothing is audible yet; the determinism promise is only as good as
  the float summation order the mixer fixes, and Windows float results are unmeasured.

- **wp3 D (2026-09-28):** render engine committed as 9477c2f (lanes R0, RP, V1, V2, FK, MX; main integration). Fresh C: 135/135 tests
  (+1 opt-in benchmark, 9.65 s for 180 s of audio), drill render 1.6 s, two renders byte-identical (c-2 met), ffmpeg mp3/ogg round trip,
  missing-ffmpeg path exits 3 with no output. Listening check: stem RMS showed the 808 19 dB above the kick and the mix at -9.4 LUFS; the
  808 voice now has an output-level constant (0.45) with a test, and the drill mix sits at -14.1 LUFS. The Gemini critic (4 runs so far)
  never hears the sub below 60 Hz and alternates between "no drums" and "no melody" on the same beat: advisory only, as 002 predicted.
  Direction for wp4: re-verify 030 against audio-io (StereoBuffer.sourceChannels, truePeakLinearOf) and render exports; loudness lives in
  audio-io; the tempo estimator must hit 140 on the rebalanced drill render. Pessimist note: the octave rule is still only measured on the
  PoC render, not on the music2 render with its different hat/kick balance.
