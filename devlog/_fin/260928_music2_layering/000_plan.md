# 000 — Instrument layering (master plan)

**Summary.** music2 can arrange and render a song, but it had no idea whether its layers fight each other. Every 808-led trap and drill example measured 0.90–0.97 of its power in 20–250 Hz with 1–5% above 2 kHz, boom bap and lo-fi put more than half their power in the 250–500 Hz mud zone, and the only balance check was one `sub+low > 0.55` threshold that fires on every 808 song. This unit teaches the harness how producers stack instruments: one low-end owner at a time, chord voicings that respect low interval limits, centered lows, sidechained club bass, call-and-response registers, and genre-aware tonal balance. wp2 adds the static lint and rendered-audio checks plus a cited layering reference; wp3 rebalances cards and examples until they pass and teaches the skill a layering pass. Research: 001 (synthesis and dispositions); evidence/ holds the Aside notes, the sol tonal-balance note, the architect proposal, main's binding decisions and the measured baseline.

## Loop spec

| Field | Value |
|---|---|
| Loop archetype | Satisfy-spec, multi-cycle HOTL (cxc-loop), one PABCD per work-phase wp1..wp3 |
| Trigger | User request 2026-09-28: production-grade work needs instrument stacking; research how to avoid clashes, keep the bass from getting too big and build the low-mids, and put it in the harness |
| Goal | music2 lint and analyze catch layering collisions and genre-inappropriate tonal balance; references and the skill teach the fixes; all non-fixture examples pass |
| Non-goals | Push, publish, tags; new synth DSP (EQ/HPF fields), per-section band shares, relative-gain lint, trap/drill kick-808 coincidence rule, melodic layer count (deferred in 001) |
| Verifier | `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`, `npm run audit:structure`, `npm run docs:genres:check`, `npm run privacy:scan`, plus the per-phase commands in 010 and 020 |
| Stop condition | Goalplan criteria c-1..c-6 met with fresh evidence, or an exact BLOCKED record |
| Memory artifact | This unit and the goalplan `.codexclaw/goalplans/add-production-grade-instrument-layering-knowled/` (gitignored) |
| Terminal outcomes | DONE (local commits, all criteria); BLOCKED; UNSAFE (private data in the commit range) |
| Escalation | A breaking song schema change, a new runtime dependency, or changing thresholds to make examples pass instead of fixing the mix |

HOTL bounds: the user asked for cxc-loop with research through search, Aside and subagents; no budget was stated. Write scope: this repository and the Aside artifact directory `music2-layering-260928`. No external writes: this request did not ask for a push.

## Work-phase map

| Work-phase | Doc | Builds | Proves |
|---|---|---|---|
| wp1 | 000–001, evidence/ | research synthesis, dispositions, architect proposal, diff-level 010 and 020 | audited docs |
| wp2 | 010_layering_checks.md | six lint rules, four balance warnings, layering reference | c-2, c-3 (c-4 threshold logic) |
| wp3 | 020_cards_examples_skill.md | card and example rebalancing, render-path bass-heavy fixture, skill layering pass, docs, gates, local commit | c-1, c-4, c-5, c-6 |

## Architect consultation

Architect: sol subagent, proposal F1–F8 in evidence/architect-proposal.md. Dispositions are recorded in 001. Main's binding decisions for the writer are in evidence/main-decisions.md.

## Audit log

Independent sol reviewer (read-only), two rounds. Round 1 FAIL: L4 accepted a zero-amount duck (BLOCKER, now amount ≥ 0.1); the exact low-interval table was presented as sourced (now labelled I); overview verdict priority conflicted with serialized order (explicit priority list added); the c-4 fixture was unspecified (concrete render-path trap fixture added); the "every hip-hop example" claim was too broad. Round 2 NEAR-PASS: aligned the L4 floor in 020 and 010 file-map rows, moved c-4 acceptance to wp3, relabelled 0.1 as an I policy floor, separated sequence equality from overview priority. All fixed before B.

## Attestation log

| Edge | Work-phase | Evidence |
|---|---|---|
| IDLE→P→A→B→C→D | wp1 | `69d5924`: research synthesis, architect F1–F8, binding decisions, 010/020; audit FAIL then NEAR-PASS, fixed; unit receipt |
| IDLE→P→A→B→C→D | wp2 | `57aaafc`, `8900176`: L1–L6 lint, A1–A4 balance warnings, overview priority, layering.md; drill-140 pad reopened above the low interval limits; unit-test receipt 376 pass, 0 fail (e2e examples deferred to wp3 on purpose) |
| IDLE→P→A→B | wp3 | Rebalanced 13 example/starter songs by mix and voicing only (evidence/wp3-example-scan.txt): trap examples sub+low 0.955–0.968 → 0.857–0.897 with presence+air 0.035–0.105; boom-bap-90 lowMid 0.534 → 0.130; lofi-75 lowMid 0.603 → 0.194; house/techno and game-loop basses now duck by the kick. c-4 render-path fixture in tests/e2e/examples.test.ts. The core eval examples drill-140, trap-150 and boom-bap-90 changed audio, so the archived overview evaluation in devlog/_fin/260928_music2_flow_practice/ describes the earlier renders |
