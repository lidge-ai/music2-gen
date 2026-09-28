# 000 — Sound effects and virtual instruments (master plan)

**Summary.** music2 could arrange, balance and process a song, but its palette was nine synth voices and one drum kit, and it had no way to make the transition effects every modern production uses or the one-shot sounds games and videos need. This unit adds an in-song `sfx` voice (noise and pitched risers, downlifter, impact, whoosh, reverse cymbal, noise build, sub drop, zap, vinyl crackle), a tape-stop insert, a standalone `music2 sfx` generator with transition and game/UI presets (pickup, laser, explosion, powerup, hit, jump, blip, alert, click, confirm, error) that writes a WAV and a reproducible JSON sidecar, twelve new virtual instruments (piano, electric piano, strings, brass, organ, marimba, vibraphone, glockenspiel, kalimba, guitar, flute, choir) and four new drum-kit characters. Everything is synthesized clean-room from public descriptions and is deterministic; songs that use none of it render byte-identically.

## Loop spec

| Field | Value |
|---|---|
| Loop archetype | Satisfy-spec, multi-cycle HOTL (cxc-loop), one PABCD per work-phase wp1..wp4 |
| Trigger | User request 2026-09-28: harness other effects too, run cxc-loop with Aside research, add real sound-effect and virtual-instrument generation, and upload |
| Goal | New SFX voice, tape stop, `music2 sfx`, twelve voices and drum kits with tests, docs, skill guidance and examples, pushed to `main` with green hosted CI |
| Non-goals | npm publish, tags, sample playback or bundled audio, neural synthesis, per-note string parameters (selectors stay numeric) |
| Verifier | typecheck, lint, test, build, audit:structure, docs:genres:check, privacy scan; per-phase focused oracle tests; hosted CI on the pushed SHA |
| Stop condition | Criteria c-1..c-6 met with fresh evidence, or an exact BLOCKED record |
| Memory artifact | This unit and goalplan `.codexclaw/goalplans/extend-lidge-ai-music2-gen-music2-cli-repo-at-thi*/` (gitignored) |
| Terminal outcomes | DONE (pushed, CI green); BLOCKED (push or CI denied); UNSAFE (private data in the push range) |
| Escalation | A breaking song schema change, a new runtime dependency, or copying non-public or GPL code |

HOTL bounds: the user asked for cxc-loop, Aside research and an upload; push of `main` is authorized. No budget stated.

## Research

| Track | Output |
|---|---|
| Aside exec: transition SFX practice, game/UI SFX vocabulary, instrument synthesis practice, DSP references | evidence/aside-notes/A1, B1, B2, C (the game/UI note A2 was excluded; see A2_EXCLUDED.md) |
| sol DSP researcher: implementation recipes with ranges and oracles | evidence/sol-synthesis-methods.md |
| sol architect: contracts, boundaries, compatibility, lint interplay | evidence/architect-proposal.md (F1–F9) |
| Main | evidence/main-decisions.md (D1–D10, binding) |

sfxr, bfxr and jsfxr are used only through their public parameter descriptions. One Aside note (A2) transcribed control mappings from a generator's source; it was excluded from the repository and from implementation input (evidence/aside-notes/A2_EXCLUDED.md:3), and no implementation code from any SFX generator or GPL/AGPL project is used.

## Work-phase map

| Work-phase | Doc | Builds | Proves |
|---|---|---|---|
| wp1 | 000, evidence/, 010–030 | research synthesis and diff-level docs | audited docs |
| wp2 | 010_sfx.md | voice-declared atoms, `sfx` voice, `tapestop`, `src/sfx`, `music2 sfx` | c-2 (SFX part), c-3, c-4 |
| wp3 | 020_instruments.md | twelve voices, `drums.kit`, lint classification | c-2 (voice part), c-3 |
| wp4 | 030_examples_release.md | example songs, docs, skill, gates, push, CI | c-1, c-5, c-6 |

## Architect consultation

Architect F1–F9 are accepted as recorded in evidence/main-decisions.md, which also fixes parameter ranges, preset lists and the tape-stop contract.

## Audit log

| Round | Reviewer | Verdict | Findings and disposition |
|---|---|---|---|
| 1 | independent sol reviewer (read-only, HEAD 9863d39) | FAIL | BLOCKER tapestop needs meter-aware bar length → `FxContext.secondsPerBar`, 3/4 vector; MAJOR partial-render pre-roll → explicit mixer pre-roll rule for tape-stop tracks; MAJOR preset draw ranges exceed validator (hit slide, click sustain) → ranges widened; MAJOR A2 provenance wording and bad line refs → corrected; MAJOR undefined 180 s gate → 60 s reference target named; MINOR `kit:4` spelling and ineffective `riserSemitones` example → fixed. |
| 2 | independent sol reviewer (read-only) | FAIL | round-1 fixes verified; MAJOR in-place tapestop reader would read overwritten output → snapshot from stop start; MINOR `sfx:5` → `riser:5`. |
| 3 | independent sol reviewer (read-only) | NEAR-PASS | all prior fixes verified; MINOR tapestop test row conflated before/after windows → split into bypass-before / silent-after (fixed). |

## Attestation log

| Edge | Work-phase | Evidence |
|---|---|---|
