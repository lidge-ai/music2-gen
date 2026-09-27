# 020 — Repair cards and examples; teach the layering pass

The new lint and balance warnings need usable starters and demonstrably clean example songs. This unit changes arrangement and mix choices in source JSON/cards, documents how to read the two check surfaces, and extends the example contract. The measured `1da22d7` baseline remains evidence, not a target: edits are complete only after strict lint and a fresh song-backed render/analyze show no L1–L6 or A1–A4 warnings. The four original core examples whose audio changes here will no longer match archived overview-eval hashes.

Depends on: 010, `evidence/main-decisions.md:11-13`, `evidence/baseline-bands-1da22d7.txt:1-13`, the example songs, and current card starters.
Consumed by: `music2 new`, `skills/music2`, generated genre docs, users of `examples/`, and `tests/e2e/examples.test.ts`.

## Scope

IN: starter source repairs, all non-fixture example repairs, one cited layering reference, workflow/CLI guidance, feature responsibility records, CHANGELOG, and c-4/c-5 integration tests. OUT: changing 010 thresholds to clear fixtures, changing the instrument library or analyzer FFT, promising that any warning proves bad sound, publishing or pushing, and altering `minimal.song.json` or `wrong-genre.song.json`. Their fixture intent remains visible (`evidence/main-decisions.md:13`).

Song JSON and cards are source of truth; `genres.md` is generated from cards. The baseline uses 20 Hz–20 kHz whole-file power shares, not loudness, and `gain` is not comparable stem level across synths (`src/analyze/bands.tool.ts:10-11,51-68`; `evidence/sol-tonal-balance.md:35-41`). Hold seed, section form, key, use-case length, and loop contract constant unless an actual fix requires a local arrangement adjustment. Change one cause at a time, rerender, and inspect all warning codes.

## File map

The `Op` column describes implementation work; no listed code or example is edited by this plan file. New source `*.tool.ts` files and their tests belong to 010, so this file introduces none.

| Path | Op | Exact content |
| --- | --- | --- |
| `src/recipes/cards/house.ts` | MODIFY | Starter `bass` at `:222-240` receives `duck:{by:"kick",amount:<reviewed nonzero>,releaseMs:<reviewed positive>}`; verify `kick` contains `bd`. Keep bass pattern/key and card arrangement compatible with L4, then inspect rendered result for A1/A4. |
| `src/recipes/cards/techno.ts` | MODIFY | Starter `bass` at `:222-239` receives kick-sourced duck with validated amount/release; keep rolling groove, recheck L4 and output. |
| `src/recipes/cards/*.test.ts` | MODIFY | Enumerate every starter, invoke strict lint and assert no L1–L6 findings. House/techno tests check actual `duck.by` kick source contains `bd`; a copied duck pointing to hats fails the L4 fixture in 010. Preserve existing card IDs and generated-genre checks. |
| `examples/drill-140.song.json` | MODIFY | Raise pad voicing around `ab2,c3,eb3` and `g2,bb2,d3` into a clearer octave, preserving key/role. This is the only likely existing L2 trip; recheck L1 because pad and sub may overlap. Keep low owner with 808 (`:43-69`). |
| `examples/trap-150.song.json` | MODIFY | Reduce the dominant 808 contribution and/or raise hats/pluck/pad presence; A1 and A4 both need rendered repair. Prefer source balance over master gain, which largely leaves band shares unchanged. |
| `examples/boom-bap-90.song.json` | MODIFY | Move dense keys voicing higher and/or reduce keys level/low-mid body so A2 clears; keep bass as low owner and hook stab as a separate focal response. |
| `examples/lofi-75.song.json` | MODIFY | Lift low-mid keys voicing or rebalance keys/bass to clear A2; retain the intentional rolled-off top. A4 remains exempt, and existing `EMPTY_HIGH_BAND` is independent. |
| `examples/house-124.song.json` | REVIEW/MODIFY if measured | Existing bass ducks by `kick`; keep it (`examples/house-124.song.json`, bass object). Recheck A1–A4 after other edits; the recorded shares already meet new guards. |
| `examples/drill-uk-moving-snare-144.song.json`, `examples/short-30-bed.song.json` | MODIFY | Both exceed 0.92 combined low; reduce 808 dominance or add fitting upper support without spoiling moving snare or 30-second VO-bed structure. Preserve exact `short_30` frame/length contract for the latter. |
| `examples/trap-hook-first-142.song.json`, `examples/type-beat-trap-140.song.json` | MODIFY | Rebalance 808 versus hats/pluck and body to clear A1. `type-beat` also exceeds A3 ratio; retain harmonics or add 60–250 Hz body while controlling total low share. Preserve early-hook and type-beat use-case forms. |
| `examples/boom-bap-verse-led-90.song.json` | MODIFY | Its `0.860` sub+low is just above boom-bap's 0.85 guard; inspect bass versus melody/drums and make a measured small rebalance. Preserve verse-led sections. |
| `examples/game-loop-16bar.song.json` | MODIFY | Bass has no duck despite coincident house kick; add kick-sourced duck or arrange time separation. Preserve seamless 16-bar loop and recheck loop-seam warning (`:83-99`). |
| `examples/minimal.song.json`, `examples/wrong-genre.song.json` | NO CHANGE | Intentional fixtures remain excluded from c-5. Do not tune them into normal reference songs. |
| `tests/e2e/examples.test.ts` | MODIFY | Existing cases at `:24-36` already require strict lint and one JSON object (`:48-59,100-103`). After song-backed analyze at `:113-126`, assert no A1–A4 codes for all non-fixtures and no new L1–L6 IDs. Include `examples/dogfood/boom-bap-dogfood.song.json`; it lacks a `1da22d7` baseline, so measure it before deciding edits. Add the c-4 render-path fixture: a test-only trap song built in the test (genre `trap`, 140 BPM, 4 bars, one mono 808 track playing `f1@16` at gain 0 with drive 1.2, one kick track `bd ~ ~ ~ ~ ~ ~ ~ ~ ~ bd ~ ~ ~ ~ ~` at gain -12, no melodic or hat tracks). Render it through the public render and song-backed analyze path, assert the measured `sub+low` share in `analysis.json.bands` is above 0.92, then assert `LOW_END_DOMINANCE` is present with threshold 0.92. In the same test, the rebalanced `examples/trap-150.song.json` analyzes without it. |
| `skills/music2/references/layering.md` | NEW | Cite the V sources and mark I conventions. Include six-band owner table, low-end ownership/ducking, low-mid voicing table, mid/presence pocket, stereo low-center guidance, tentative gain staging, genre balance table, and measured-vs-static limitations described below. Link out to cited sources rather than quote charts. |
| `skills/music2/references/mixing.md` | MODIFY | Add the 010 warning meanings and diagnostic order to current band advice at `:9-24`; point to `layering.md`. Tell users to compare same-song renders and inspect `analysis.json`, not infer audio quality from source-only lint. |
| `skills/music2/SKILL.md` | MODIFY | At workflow steps `:17-19`, add a named layering pass: strict lint → render/analyze bands → fix low owner, low-mid voicing, focal mids, high support, then rerun. Link `references/layering.md` from the opening reference list at `:10`. |
| `docs/cli.md` | MODIFY | At lint/analyze command rows `:18-20`, list L1–L6 IDs and A1–A4 codes with terse thresholds/genre exceptions. Explain strict lint exit 6 versus advisory analyze warnings; retain one JSON object and current envelope. |
| `devlog/str_func/recipes.md`, `devlog/str_func/analyze.md` | MODIFY | Record new internal helper ownership, input/output warning contracts, source-vs-render split, and tests because feature responsibilities change. |
| `CHANGELOG.md` | MODIFY | Add an Unreleased note for layering lint, genre-aware balance warnings, repaired starters/examples and reference guidance. Do not call archived hashes current. |

## 1. Baseline-to-fix map

Every number below comes from `evidence/baseline-bands-1da22d7.txt:1-13`, measured at `1da22d7`. `A1` uses 0.92 for trap/drill/house/techno and 0.85 for boom bap/lo-fi; `A2` is lowMid >0.25; `A3` is ratio >0.65 with total low >0.50; `A4` is presence+air <0.02 except lo-fi (010 §8). Lint calls are **predictions from source reading**, not executed results.

| Example | Baseline and expected measured flag | Expected fix direction | New lint prediction |
| --- | --- | --- | --- |
| `boom-bap-90` | lowMid `0.534>0.25` A2; presence+air `0.0048<0.02` A4 | Voice keys higher or reduce keys low-mid gain/body; restore hat/stab presence while keeping swung identity. | None predicted: close keys intervals are above L2 floor; stab is sparse (`examples/boom-bap-90.song.json`, keys/hook). |
| `boom-bap-verse-led-90` | sub+low `0.860>0.85` A1; high `0.0325` passes A4 | Small bass/keys/drum balance adjustment after rerender. | None predicted; single bass owner and high melody. |
| `drill-140` | sub+low `0.902≤0.92`; high `0.0296≥0.02` | Move pad chord lows up to clear L2; watch A1 after revoicing. | **L2 predicted**: `ab2,c3` M3 lower MIDI 44<46 and `g2,bb2` m3 lower 43<48 (`examples/drill-140.song.json:62-69`). L1 possible only if expanded overlap reaches 25%; measure before claiming. |
| `drill-uk-moving-snare-144` | sub+low `0.934>0.92` A1 | Rebalance 808 against bell/hats; keep moving snare accents. | None predicted; trap/drill kick-808 rule deferred. |
| `game-loop-16bar` | sub+low `0.793≤0.92`; high `0.0932` | Keep tonal balance; add bass duck by kick or time separation and rerender seam. | **L4 predicted**: house bass lacks duck (`examples/game-loop-16bar.song.json:83-99`). Confirm ≥50% kick matches from expanded events. |
| `house-124` | sub+low `0.741≤0.92`; lowMid `0.142≤0.25`; high `0.0216≥0.02` | Preserve current balance, then rerender after card changes only if needed. | None predicted; bass already ducks by kick. |
| `lofi-75` | lowMid `0.603>0.25` A2; high `0.0002` is A4-exempt | Revoice/rebalance keys and bass; keep lo-fi dark top. Existing `EMPTY_HIGH_BAND` can remain unless separate c-5 policy expands. | None predicted: keys pairs stay above L2 floors. |
| `short-30-bed` | sub+low `0.944>0.92` A1; high `0.0448` | Reduce 808 share or add controlled upper support within voice-over space; retain exactly 30 seconds. | None predicted; pad is very quiet and high-voiced. |
| `trap-150` | sub+low `0.955>0.92` A1; high `0.0092<0.02` A4 | Raise hats/pluck/pad presence or lower 808; preserve sub role and hook contrast. | None predicted: pad begins A3 and is above L2 floors. |
| `trap-hook-first-142` | sub+low `0.968>0.92` A1; high `0.0270` | Rebalance 808 and brighter melody/hats without moving first hook. | None predicted; one low owner. |
| `type-beat-trap-140` | sub+low `0.964>0.92` A1; `0.638/0.964≈0.662>0.65` A3; high `0.0289` | Lower sub concentration, retain/add audible low-band 808 body, restore support without weakening the beat. | None predicted; one low owner and high pluck. |
| `minimal` | sub+low `0.990>0.55` A1 if analyzed unknown; high `0.0068` A4 | No edit; intentionally minimal fixture. | Outside clean-example gate. |
| `wrong-genre` | sub+low `0.727≤0.92`; high `0.0173<0.02` A4 | No edit; intentional wrong-genre fixture. | Existing genre warning is intentional; outside gate. |

`examples/dogfood/boom-bap-dogfood.song.json` is an e2e case (`tests/e2e/examples.test.ts:24-36`) but absent from the recorded root-example baseline. Measure its six bands and strict lint before making a source change; report the measurement alongside any fix. These predictions do not establish pass status. L1 requires actual occurrence overlap, and L4 requires actual expanded kick matches (`src/song/timeline.tool.ts:45-77`; 010 §§2,5).

## 2. Starter and example repair contract

The house and techno card text calls for low-end management, yet their starter bass objects at `src/recipes/cards/house.ts:221-240` and `src/recipes/cards/techno.ts:222-239` lack `duck`. Add a relation to the actual kick source, then verify that its event stream contains `bd`. Mixer ducking follows every event of that `by` track (`src/render/mixer.tool.ts:257-260`), so prefer the dedicated kick track. Choose amount/release by render and loop/groove behavior; L4 requires `amount >= 0.1` (010 §5) and nothing more, so use a sourced starting point such as 0.2–0.35 (about 2–4 dB, SOS/EDMProd) with a release that recovers before the next kick. The predicate does not judge whether the reduction sounds sufficient.

Do not add an 808 duck to every trap/drill song just to preempt a nonexistent rule. Kick/808 unison and long tails can be deliberate; the binding decision defers that check (`evidence/main-decisions.md:3-10`). For `drill-140`, revoice the low pad pairs first; its `-16 dB` gain is above L1's ignore cutoff, but whether it crosses 25% occupancy requires expanded-event measurement. Fix any actual L1 with register, mute timing, or one clear low owner, not by lowering the threshold.

Use `analyze` on the exact WAV produced from each edited song. If A1 fires, compare sub and low separately and adjust the occupying stem or supporting upper layers; if A2 fires, start with keys/pad voicing and bass harmonics; if A3 fires, inspect 60–250 Hz body and speaker translation; if A4 fires, inspect hat/lead presence before adding indiscriminate treble. Validate loudness/peak, `SECTION_LOUDNESS_FLAT`, and loop seam as existing e2e checks do (`tests/e2e/examples.test.ts:113-130`). A master-gain-only change is not a band-share repair.

The four original core eval examples are `drill-140`, `trap-150`, `boom-bap-90`, and `lofi-75` (`tests/e2e/examples.test.ts:24-29`). Their archived overview-eval hashes describe the previous audio once their source changes; say so in the implementation record and recompute any current receipt. Do not rewrite historical evidence as if it were produced by the new songs.

## 3. Layering reference content

`skills/music2/references/layering.md` should start with `lint` source warnings versus `analyze` rendered measurements, their common advisory nature, and the exact six music2 bands. Cite the research paths and external URLs inline. Keep V claims and I practices visibly distinct; do not present TrackScore's vendor guide as a measured corpus for music2 genres (`evidence/aside-notes/C_tonal_balance.md:23-29,58-63`).

| Band / arrangement question | Default owner and action in the reference | Evidence status |
| --- | --- | --- |
| Sub 20–60 Hz | 808 or dedicated sub, with kick transient negotiated; one sustained low owner at a time. | V low ownership from `evidence/aside-notes/E_verification_and_calibration.md:4-9`; owner table I from `A_register_lowmids.md:26`. |
| Low 60–250 Hz | Kick/bass body; use timing or duck for house/techno, review harmonics before thinning every 808. | V from `evidence/aside-notes/B_low_end.md:7-10,19-21`; genre routing I. |
| LowMid 250–500 Hz | One body voice at a time; move compact keys/pad voicing upward if it clouds bass. The L2 MIDI floors are a conservative table, not acoustic law. | V mud range in `A_register_lowmids.md:9-18`; voicing policy I in 010 §3. |
| Mid 500–2000 Hz | Keys, pluck, lead articulation; leave a focal part space. | Owner allocation I, supported by call/response V (`A_register_lowmids.md:22-26`). |
| Presence 2000–8000 Hz | Lead/snare/hats share an intelligibility and attack pocket; shift timing, register or level before broad boosts. | V frequency claims in `A_register_lowmids.md:13-16`; allocation I. |
| Air 8000–20000 Hz | Hats/bell/reverb supply sparkle when wanted; lo-fi can intentionally roll off. | V cymbal and NI lo-fi references (`A_register_lowmids.md:14`; `E_verification_and_calibration.md:18-19`); allocation I. |

Include a low-mid voicing table showing L2's 11 interval floors in scientific MIDI notation and two concrete examples: `g2+bb2` flags m3 because 43<48; `c3+eb3` passes m3 because 48 is the floor. State why a fundamental note's register does not directly equal measured 250–500 Hz power. Cite `evidence/aside-notes/E_verification_and_calibration.md:30-31` and `src/analyze/bands.tool.ts:28-68`.

Add a small genre balance table with A1 combined-low guides (0.92 trap/drill/house/techno, 0.85 boom bap/lo-fi, 0.55 unknown/WAV-only), A2 0.25, A3 ratio 0.65 plus low total >0.50, and A4 high 0.02 with lo-fi exemption. Label all thresholds I; TrackScore's house/techno 0.79–0.89 combined-low figures are V vendor examples, not a universal target (`evidence/aside-notes/C_tonal_balance.md:23-25`; 010 §8). Do not include broad “ideal” per-genre vectors as if measured.

For stereo, explain that music2's `pan` centers or offsets the whole mono-generated track; `mono` means note behavior, not a frequency-selective bass mono filter (`src/render/mixer.tool.ts:42-47,62-76`; `evidence/sol-tonal-balance.md:49-53`). For gain staging, give relative starting conventions and require a render/peak check, citing the `evidence/sol-tonal-balance.md:35-41` V examples and labeling any consolidated dB relationship I. Do not promise fixed fader values produce fixed stem dBFS or impose unimplemented HPF cutoffs (`evidence/sol-tonal-balance.md:76-80`).

### Example QA sequence for the implementing lane

1. Copy the recorded baseline numbers into the work record before editing.
   Keep the baseline evidence file unchanged so the before/after comparison is checkable.
2. Repair an actual static finding first, starting with `drill-140` L2 and `game-loop-16bar` L4.
   Run `lint --strict` again after every arrangement change; do not infer a pass from JSON inspection.
3. Render each changed song at its declared sample rate with the same seed.
   Compare the six new measured shares to its own baseline row, not a different genre's row.
4. Fix A1 by identifying whether sub or 60–250 Hz low drives the combined share.
   Retain a useful low anchor; inspect clipping and master loudness after balancing support.
5. Fix A2 by listening or inspecting the keys/bass body source and raising a voicing where appropriate.
   A global master gain change scales all FFT bands and normally leaves shares unchanged.
6. Fix A3 in `type-beat-trap-140` with low-band body or reduced sub, then recalculate both its ratio and A1.
   Passing one of the two conditions is insufficient if the other remains above its guard.
7. Check `trap-150` and `boom-bap-90` for A4 after tonal changes.
   Use hats, lead or pluck contribution that fits the song; preserve lo-fi's intentional exemption.
8. Inspect the entire `warnings` array, not just a green exit from `analyze`.
   Keep the pre-existing clipping, LUFS, section-contrast and loop-seam checks in view.
9. Regenerate `genres.md` from card source, then check generated docs.
   Record the exact example names, measured shares, strict-lint result, and e2e exit status.

## 4. Verification and acceptance

This docs-only delegation executes no suite or Git command. The implementer uses fresh outputs under a temporary directory, records measured shares after each change, and regenerates source-owned genre docs before checking them. No generated WAV/PNG is committed in `examples/`.

| Criterion | Command / test | Required observation |
| --- | --- | --- |
| c-1 | `npm run typecheck && npm run lint && npm test && npm run build && npm run audit:structure && npm run docs:genres:check` | All gates exit 0 after edits; generated genre docs match changed cards. |
| c-2 | Review `skills/music2/references/layering.md` against 010 and the cited `evidence/aside-notes/` paths | Every threshold and V/I claim has a cited source or explicit product rationale; unsupported “ideal share” and fixed gain laws are absent. |
| c-3 | `node --test src/recipes/lint-layering-low.test.ts src/recipes/lint-layering-harmony.test.ts src/recipes/lint-layering-rhythm.test.ts src/analyze/balance-warnings.test.ts` | Exact fire/non-fire values from 010 stay stable after card/example repair. |
| c-4 | `node --test src/analyze/balance-warnings.test.ts tests/e2e/examples.test.ts` | Test-only synthetic trap with sub+low >0.92 emits A1; idiomatic hip-hop examples below their genre guard do not receive the old blanket >0.55 warning. |
| c-5 | `node --test tests/e2e/examples.test.ts`; `node bin/music2.js lint examples/<name>.song.json --strict --json`; `node bin/music2.js analyze examples/<name>.song.json --out <temp-dir> --json` for each non-fixture example | Strict lint has zero results, analyzer has no A1–A4, and preserved duration/loop/overview contracts pass. Exclude only `minimal` and `wrong-genre`; include dogfood. |
| c-6 | Parent inspects local commit log and remote state after implementation | Local conventional commits use a public identity; no push. The delegated writer creates no commit. |
