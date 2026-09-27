# 020 — Real-world cases, use-case presets, checks, and examples

wp3 turns the labelled evidence in `evidence/aside-real-world-report.md` into named recipe arrangements, deterministic use-case songs, two static checks, two rendered checks, and six inspectable examples. Case-study metadata remains an estimate or a source-labelled observation, never a transcription. wp2's flow and overview artifacts land first; wp4 consumes the new example paths through repeatable `prepare --case` arguments (`030_eval_docs_release.md:11-16`).

Depends on: `evidence/aside-real-world-report.md` Parts A/B and R1–R6, `004_architecture.md`, wp2 `010_overview_image.md`, current song/recipe/render/analyze contracts.
Consumed by: `music2 new`, lint/analyze/overview readers, the composition skill, generated genre docs, and wp4's extra evaluation corpus.

## Scope

IN: named arrangements and traceable card changes; `new --arrangement` and `new --use [--seconds]`; whole-song loop-tail wrapping and sample points; four advisory checks; six source songs; case/use-case guidance and feature docs. OUT: separate game intro/loop files or nonzero loop start, tempo-changing beat switch, per-track numeric swing, `nudgeMs`, 6/8 denominator, R2 move DSL, automatic stems/podcast pack/batch delivery, voice-band spectral check, publisher-specific loudness guarantees, and reproducing any reference lyric, melody, or sample.

The report's V/M/S/I/U labels mean verified statement, estimated metadata, public section-header order, inference, and unverified. Preserve those labels and source URLs in the reader reference. The A.0 lyric-line counts only suggest relative section length; exact bars below are original recipe choices, not asserted transcriptions. Keep fixed `seed` and `src/shared/prng.tool.ts` for generated choices; no `Math.random` or `Date` in pattern/audio decisions. Same Node major/platform must yield the same source song, events, PCM, and JSON.

## File map

`Op` describes future implementation, not edits made by this document. Every NEW `*.tool.ts` has a colocated test row with a concrete oracle. Existing lines cited below were inspected before writing; wp2 may shift them, so rebind at implementation.

| Path | Op | Exact content |
| --- | --- | --- |
| `src/recipes/recipe.schema.ts` | MODIFY | At `:10-20`, add `RecipeArrangement {id,title,blocks:RecipeArrangementBlock[],basis:string[]}`, `arrangements`, `defaultArrangement`; retain `arrangement` equal by value to default blocks. Validate unique ids, nonempty basis, positive bars, and `starterSong` parity in card tests. |
| `src/recipes/cards/trap.ts` | MODIFY | At `:73-99,223-263`, add `hook_first` default 4/8/16/8/16/8/4, `long_hook` 4/16/24/16/24/16/4, `interlude` 4/8/16/8/4-breakdown/16/8/4. Change starter order to hook-first; basis: A.0/A.3 `Mask Off`, `Black Beatles`, `Bad and Boujee`. |
| `src/recipes/cards/trap.test.ts` | MODIFY | Assert the three IDs, totals 64/104/68, first hook B05, and `arrangement === default.blocks` by deep equality. |
| `src/recipes/cards/drill_uk.ts` | MODIFY | At `:7-19,74-102,118-296`, keep current 64-bar default; add `short_single` 4/8/16/8/4 (40) and `posse` 8 + 3×(24/8) + 8 (112). Raise BPM max to 146; default snare pattern alternates step 9/13 with `<... ...>` and hats use 3+3+2 positions, swing 0.5. Basis: A.1 `Doja`, `Kennington`, NI drill guide (V/S/M/I distinguished). |
| `src/recipes/cards/drill_uk.test.ts` | MODIFY | Query two bars: snare onset steps 9 then 13; hat accents at 1/4/7/9; card max 146, swing .5, variant totals 40/64/112. |
| `src/recipes/cards/drill_ny.ts` | MODIFY | At `:73-99,227-266`, add `pre_hook` default 4/4-build/16-hook/16-verse/4-build/16-hook/16-verse/16-hook/4-outro (96), using section id `prehook`, role `build`, bass muted; preserve a hook-first alternative only if backed by `Welcome to the Party`. Basis A.2 `Dior`, `Welcome to the Party` (S/M). |
| `src/recipes/cards/drill_ny.test.ts` | MODIFY | Assert 96 bars, `prehook` is build at B05, first hook B09, and no new role enum value. |
| `src/recipes/cards/boom_bap.ts` | MODIFY | At `:73-99,223-262`, `verse_led` default 4/24/4/24/4/16/8/4 (88) and `hook_first` 2/4 + 3×(16/4) + 4 (70). Starter verses 24 bars and first hook 4; retain boolean track swing. Basis A.0/A.4 `N.Y. State of Mind`, `C.R.E.A.M.`, `Shook Ones Pt. II`, `Mass Appeal` (S/M/I). |
| `src/recipes/cards/boom_bap.test.ts` | MODIFY | Assert first hook B29 in `verse_led`, 24-bar first verse, 4-bar first hook, B03 in `hook_first`; no numeric track swing. |
| `src/recipes/cards/lofi_hiphop.ts` | MODIFY | At `:7-11,89-111,249-289`, raise max BPM to 95; add `vignette` as intro 2/groove 16/breakdown 2/groove 16/outro 2 (38), one layer toggle at each boundary. Basis A.5 `Time: The Donut of the Heart`, `Don't Cry` (M/I) and NI lo-fi 4–8-bar advice (V). |
| `src/recipes/cards/lofi_hiphop.test.ts` | MODIFY | Assert max 95, vignette 38 bars, intro 2, and no 6/8 or off-grid timing claim. |
| `src/recipes/cards/house.ts` | MODIFY | At `:88-114,251-301`, add `radio` default 8/16-groove/8-breakdown/8-build/32-hook/8-breakdown/8-build/32-hook/8-outro (128) and `extended` 32/16-breakdown/8-build/32-hook/16-breakdown/8-build/32-hook/8-breakdown/8-build/32-hook/32-outro (224). `hook` represents drop without changing `Section.role`. Derived build mutes bass; derived breakdown mutes kick and bass. Basis A.6 EDMProd, FISHER, `Around the World`, `Your Love` (V/M/I). |
| `src/recipes/cards/house.test.ts` | MODIFY | Assert 128/224 bars, first extended hook B57 ≤65, and breakdown-to-hook section mute difference. |
| `src/recipes/cards/techno.ts` | MODIFY | At `:86-112,248-300`, add `detroit_linear` default sequence intro8/build8/groove16/breakdown2/groove32/bridge4/groove32/breakdown4/groove32/outro16 =154 bars: kick+motif from B01; hats B09; clap/bell B17/33; short mutes; later bass-led passage. Add `plateau` intro32/build32/groove32/breakdown32/groove32/outro32 =192. Use role/length-specific derived sections and section mutes, no move DSL. Basis A.7 `The Bells` (V bar map), Track Sensei (V tutorial), `Spastik` (M/I). |
| `src/recipes/cards/techno.test.ts` | MODIFY | Assert Detroit first kick B01, B09 hat, B17 clap, 2/4-bar reductions, 154 bars; plateau 192 bars and 32-bar blocks. |
| `src/recipes/new.tool.ts` | MODIFY | At `:9,60-96`, add `arrangement?:string` to `NewSongOptions`; clone starter, select default or named variant, rebuild `sections`/`arrangement` by the same builder for **every** variant, including default, before transposition/validation. Unknown id throws `E_INPUT` with sorted valid IDs. |
| `src/recipes/new.test.ts` | MODIFY | Same seed/variant twice deep-equal; `hook_16`, `verse_24`, `prehook` IDs; every arrangement reference resolves; unknown id exit 2 and lists valid choices; original default compatibility. |
| `src/recipes/recipes.tool.ts` | MODIFY | At `:19-30`, registry cloning includes additive variant data; preserve existing `getRecipe`/`listRecipes` order and mutation isolation. |
| `src/recipes/recipes.test.ts` | MODIFY | Mutating a returned variant cannot change registry; each card's legacy `arrangement` equals selected default blocks. |
| `src/recipes/index.ts`, `src/index.ts` | MODIFY | At `src/recipes/index.ts:1-7` and `src/index.ts:14-15`, export additive arrangement and use-case types/functions; retain existing exports. |
| `src/usecases/usecase.schema.ts` | NEW | `UseCaseId` union, `UseCasePreset {id,title,allowedGenres?,defaultSeconds?,targetLufs,ceilingDb}` and stable `USE_CASES`; keep numeric rules in the tool. |
| `src/usecases/usecase.tool.ts` | NEW | Export `recommendedArrangement(id:UseCaseId, genre:RecipeId):string` and `applyUseCase(song:Song,id:UseCaseId,opts?:{seconds?:number;lockedBpm?:number}):Song`. The first runs before `newSong`; the second purely clones the already-built song, searches BPM/bar/tail frames (only `lockedBpm` if provided), sets structure/mutes/master/useCase/whole-song loop. No I/O or runtime dependency. |
| `src/usecases/usecase.test.ts` | NEW | `short_30` on 140-BPM UK drill selects 144 BPM/18 bars/30 s and hook B01 with tail 0; equal-distance BPM ties choose lower; no exact frame solution or `lockedBpm:140` yields `E_INPUT`; `vo_bed` has target −22 and muted lead; `game_loop` gives 16 bars/no intro and `loop:true`; seeded repeated outputs deep-equal. |
| `src/usecases/index.ts` | NEW | Export preset list/type, selector and `applyUseCase` at the feature boundary. |
| `src/song/song.schema.ts` | MODIFY | At `:5-11,34-41,63-91,239-256`, add optional `loop?:boolean` and `useCase?:UseCaseId` (validated enum, resolved defaults `false`/`null`); retain version 1, swing boolean on tracks, numerator 2–12/denominator 4, section role enum and tail range. |
| `src/song/song.test.ts` | MODIFY | Missing loop/useCase resolves to false/null; true and valid preset round-trip; invalid useCase/loop type rejected; old songs still validate. |
| `src/song/timeline.tool.ts` | MODIFY | At `:31-35,76-77`, keep bar duration as the authority for exact-cut and loop boundaries; no tempo map or per-track numeric swing (`:25-29`). Add no timing jitter. |
| `src/render/mixer.tool.ts` | MODIFY | At `:228-275`, allocate music+tail as now, sum post-FX tail onto the **first** body frames before mastering, trim to the exact body frame count, then master; trim dry stems to that count. Reject `--bars` with loop songs. Whole song is one loop body, so start sample is 0. |
| `src/render/mixer.test.ts` | MODIFY | Impulse with release after end folds into frame 0 exactly once; stereo/channel sums and tail longer than body modulo wrap; exact timeline frame length, mastering ceiling held, non-loop tail unchanged, partial loop render rejected. |
| `src/render/render.schema.ts` | MODIFY | At `:4-6,23`, add nullable `{startSample,endSample}` to `RenderResult` and optional `loopStartSample`,`loopEndSample` to `RenderData`; sample indexes are zero-based and end-exclusive. |
| `src/render/render.tool.ts` | MODIFY | At `:9-28`, pass loop metadata/timeline to mixer and preserve validation errors as `E_INPUT`/`E_RENDER` per boundary. |
| `src/cli/commands/new.ts` | MODIFY | At `:22-55`, register `--arrangement`, `--use`, `--seconds`; require `--genre`, parse positive finite seconds, reject `--seconds` without a use preset; resolve genre → `recommendedArrangement` → explicit arrangement → explicit BPM/key in `newSong`, then call `applyUseCase` with `lockedBpm` iff `--bpm` was explicit. Return selected IDs/duration in one-object JSON. |
| `src/cli/commands/new.test.ts` | MODIFY | Human/JSON flags, exact 30 s, default and unknown arrangement/preset, impossible duration, one JSON object, exit 2. |
| `src/cli/commands/render.ts` | MODIFY | At `:53-88,124-134`, add loop sample points in `data` and reject `--bars` for loop song; WAV frames equal loop end. No separate `--loop` flag is needed because source `song.loop` is authoritative. |
| `src/cli/commands/render.test.ts` | MODIFY | Full loop WAV frame count and JSON points match source timeline; one-object JSON; partial loop exit 2; non-loop still includes tail. |
| `src/recipes/lint-generic.tool.ts` | MODIFY | At `:48-64`, append warning results `generic/hook_too_late` and `generic/no_density_contrast` with formulas below, using occurrence geometry rather than section declarations alone. House's drop-equivalent is hook or first groove after breakdown. |
| `src/recipes/lint-generic.test.ts` | MODIFY | Fire and non-fire vectors per threshold, short preset B02 fire/B01 pass, house groove-after-breakdown fallback, absent-role skip; preserve existing rules. |
| `src/recipes/lint.tool.ts`, `src/recipes/lint.test.ts` | MODIFY | At `lint.tool.ts:101-109`, run genre rules, then suppress generic density result if `trap/7`, `house/6`, or `techno/5` already reports the same placement/cause; keep all unrelated findings and stable sort. Test both collision and independent failures. |
| `src/analyze/flow/flow.schema.ts`, `src/analyze/flow/loudness-curve.tool.ts` | VERIFY after wp2 | Consume wp2's required JSON-safe `flow.sectionMeans: {id,role,startBar,bars,meanLufs:number|null}[]`; the means are exact, ungated per occurrence. Preserve `sectionDeltas` separately. If wp2 omitted this field, repair the wp2 producer before wp3 check wiring. |
| `src/analyze/flow/loudness-curve.test.ts` | VERIFY after wp2 | Two hook occurrences −16/−18 and verse −21 produce three ID-keyed ungated means with start bars/bars; silence gives null; delta remains next minus previous. |
| `src/analyze/loop-seam.tool.ts` | NEW | `loopSeam(pcm:StereoBuffer)` calculates 50 ms endpoint jump, first/last-window RMS step, and 20–200/200–2000/2000–20000 Hz band-energy steps from a Hann FFT (`fft.tool.ts:28-36,89-108`); no file I/O. |
| `src/analyze/loop-seam.test.ts` | NEW | Periodic equal ends pass all three; .11 endpoint jump fires jump, 4 dB RMS fires RMS, 7 dB one-band change fires spectral alone; both silent gives zero, one silent window produces a JSON-safe null field plus warning. |
| `src/analyze/analysis.schema.ts` | MODIFY | At `:41-56`, extend `AnalysisWarning.code` with `SECTION_LOUDNESS_FLAT`/`LOOP_SEAM_DISCONTINUITY`, preserve `{code,observed,threshold,message}`. Add optional structured `details` for loop `{jumpFs,rmsFirstDbfs,rmsLastDbfs,rmsStepDb,bandStepDb:{low,mid,high}}` and section `{loudRole,quietRole}`; `fix` string additive. |
| `src/analyze/analyze.tool.ts` | MODIFY after wp2 | At `:96-149`, compute existing warnings, then flow numbers, then section and seam warnings, then shared annotations/JSON/PNG in that order; never leave stale verdicts. At `:201-207`, expect loop WAV length from timeline body only. WAV-only has neither check. |
| `src/analyze/analyze.test.ts` | MODIFY | Fire/non-fire section and seam vectors; loop WAV+song alignment; `analysis.json`, `analysis.md`, overview verdict agree; WAV-only has no song-backed warnings. |
| `src/analyze/report.tool.ts` | MODIFY after wp2 | At `:23-37`, warnings table prints code, observation, threshold, message, fix; `## Flow` prints new section occurrence means and same verdict strings. |
| `src/analyze/report.test.ts` | MODIFY | Exact warning and fix text appears; flow section means and verdict match JSON; old warning order retained. |
| `examples/trap-hook-first-142.song.json` | NEW | 4 intro > 8 hook > 16 verse > 8 hook > 16 verse > 8 hook > 4 outro; snare step 9, eighth hats `hh ~ hh ~ ...`, sparse 808 with phrase-end transition, two-bar pre-hook kick/808 dropout encoded as distinct existing-role section overrides. |
| `examples/drill-uk-moving-snare-144.song.json` | NEW | 4 intro > 8 hook > 16 verse > 8 hook > 16 verse > 8 hook > 4 outro; `<~×8 sd ~×7 ~×12 sd ~×3>` expanded into valid 16-step alternation, tresillo hats at 1/4/7/9 and straight swing .5; dark keys ducked by kick, occasional 808 glide. No filter automation claim. |
| `examples/boom-bap-verse-led-90.song.json` | NEW | 4 intro > 24 verse > 4 hook > 24 verse > 4 hook > 16 verse > 8 hook > 4 outro; kick steps 1/11, snare 5/13, eighth hats, song swing .57 on enabled tracks, short hook scratch-like stab built from original keys. No 74% hat swing or clap nudge claim. |
| `examples/game-loop-16bar.song.json` | NEW | One 16-bar `groove` loop body at 120 BPM, no intro; motif returns to root in final bar, with kick quarters `bd ~ ~ ~` and sparse offbeat hats; `loop:true`, `tailSeconds:2`, reverb/delay release wrapped onto sample 0; sample end is the 16-bar timeline duration. |
| `examples/short-30-bed.song.json` | NEW | 144 BPM, 18-bar hook-first (B01) source, 30.000 s music, final-bar accent and hard ending, lead `null` in every section, target −22 LUFS and ceiling −1. It is a short_30 composition with VO-bed mix choices, not a second simultaneous `--use` flag; `useCase: "short_30"`. |
| `examples/type-beat-trap-140.song.json` | NEW | `useCase: "type_beat"`, trap card, `hook_first` variant reshaped by the type_beat preset: intro 8 (kick and 808 `null`, B.6 "intros often have no kick or snare") > hook 8 > verse 16 > hook 8 > verse 16 > hook 8 > outro 8 = 72 bars at 140 BPM (about 2:03), master `targetLufs -12`, `ceilingDb -2`. Hook adds the melody and an open-hat layer over the verse (hook 5 active tracks, verse 4; the verse keeps the lead out of the vocal pocket), and the loudness step comes from Song v1 pattern overrides only: verses mute the open-hat and melody tracks and thin the 808 pattern (`null` or sparser mini-notation in `sections.verse.patterns`), while hooks play every track, so no section gain field is needed. Each targeted check applies and must pass at a stated margin: `generic/hook_too_late` first hook B09 equals the trap limit 9 (boundary pass); `generic/no_density_contrast` difference 1 equals the limit (boundary pass); `SECTION_LOUDNESS_FLAT` loudest hook minus quietest verse `>= 1` LU from `flow.sectionMeans`. |
| `tests/e2e/examples.test.ts` | MODIFY | At `:20-27,75-125`, add all six files; each validates, strict-lints empty, renders, song-backed analyzes, and asserts target warnings absent. Check 30 s exact WAV frames, hook B01, game loop points and seam metrics below thresholds, type beat 72 bars with first hook B09 and a measured hook-minus-verse LU gap >= 1; the three use-case songs (`short-30-bed`, `game-loop-16bar`, `type-beat-trap-140`) assert their `useCase` field, plus wp2 overview assertion already owned by 010. |
| `skills/music2/references/case-studies.md` | NEW | Seven genre summaries with V/M/S/I/U labels, ranges/numbers for recipes, and trace table `recipe change → case ids → source URLs` drawn from report Sources. No lyrics/melody or unlabelled exact-bar claims. |
| `skills/music2/references/use-cases.md` | NEW | Part B.0/B.8 destination, duration, LUFS/TP, delivery and preset choice table; distinguish official Apple/Spotify statements from unofficial social-platform estimates; explain exact duration, beds, loop point semantics and unsupported outputs. |
| `skills/music2/SKILL.md` | MODIFY | At `:10-25,51-62`, link both references; apply R6: trap/NY drill early hook, boom-bap 24–32-bar verses, one-layer 4–8-bar changes, pre-hook mutes, VO beds near −22. Say keys/BPM may be estimates, no hearing inference from metrics. |
| `skills/music2/references/genres.md` | REGENERATE | Run `npm run docs:genres` after card edits; never hand-edit generated rows. `package.json:61-62` owns generator/check commands. |
| `docs/cli.md` | MODIFY | At `:14-20,27-46`, document new flags, preset constraints, loop points, two checks, one-object JSON and exits; reconcile wp2 overview wording first. |
| `devlog/str_func/recipes.md`, `song.md`, `render.md`, `analyze.md`, `cli.md` | MODIFY | Update file trees, exports, contracts, tests and dependents for the touched features; preserve wp2's new analyze flow responsibility. |
| `devlog/str_func/usecases.md`, `devlog/str_func/AGENTS.md` | NEW/MODIFY | Add the required new feature document and index row (`devlog/str_func/AGENTS.md:3-19`): file tree, responsibility, signatures, dependencies, dependents, sync checklist. |

## 1. Arrangement and evidence contracts (D1–D3; c-4)

Card `arrangements` contains only the evidence-backed IDs above. Each `basis` item is a stable report case id such as `A.3/Mask Off`, with the source URL in `case-studies.md`. Set `defaultArrangement` to `hook_first` trap, `pre_hook` NY drill, `verse_led` boom bap, `radio` house, `detroit_linear` techno; retain UK drill's existing default under id `default` and lo-fi's existing default under id `default`, plus their listed alternatives. Keep `card.arrangement` deeply equal to the default blocks for older readers (`recipe.schema.ts:10-20`, `recipes.tool.ts:19-30`). Card version stays 1 because fields are additive. The named variant alone generates both `song.sections` and `song.arrangement`; even the default uses the builder, never a copied starter arrangement.

Block-to-section mapping (`new.tool.ts:60-96`; `song.schema.ts:20-24,57-62`; `timeline.tool.ts:45-77`): for each `{role,bars}`, use the starter section with that role if its `bars` match. If length differs, clone its patterns and role under id `<role>_<bars>`; reuse that id on later equal blocks. If the role is absent, derive from the following table, apply role and length, then validate all IDs and pattern track keys. `pre_hook` is the sole stable special id `prehook`, role `build`, with bass muted; it cannot be inferred from a new enum case. If a variant needs two distinct mute states for equal role/length, use distinct roles or lengths in that variant; do not silently conflate them. Preserve block order as one arrangement entry per block, with repeats default 1.

| Missing role | Source section | Deterministic pattern overrides |
| --- | --- | --- |
| `build` | `verse`, else `groove` | Clone source and set every bass/808 track ID to `null`; retain drums and melody. NY `prehook` uses this. |
| `breakdown` | `verse`, else `groove` | Clone and mute every kick and bass/808 track; house additionally mutes the snare if needed for ≥2-layer contrast. |
| `bridge` | `groove`, else `verse` | Clone and mute hats and bass; techno's four-bar kick+motif break retains kick and melody. |
| `hook` | `groove`, else `verse` | Clone; restore all source track patterns, then add one existing percussion/lead layer only where the card already has it. |
| `intro`/`outro`/`groove`/`verse` | First section with a musical pattern | Clone, set requested role; intro/outro mute bass and lead, groove/verse retain source, with card-specific overrides declared in the card. |

Every card change gets a trace row: UK snare 9→13 and tresillo hats → A.1 NI drill/Attack UK Drill (V tutorial); swing .5 and BPM 146 → A.1 Attack/NI (V); NY pre-hook → A.2 `Dior` (S); trap hook-first → A.0/A.3 `Mask Off`, `Black Beatles`, `Bad and Boujee` (S); boom-bap verse 24/hook 4 → A.0/A.4 `N.Y. State of Mind`, `C.R.E.A.M.`, `Shook Ones Pt. II` (S/I); lo-fi max 95 → A.5 Lunacy range (V tutorial); house radio/extended → A.6 EDMProd/FISHER plus long-track duration metadata (V/M/I); Detroit/plateau → A.7 `The Bells` bar map and Track Sensei tutorial (V). The `<...>` alternation is supported by `parse.tool.ts:38-42,126-147` and selects one item per bar in `query.tool.ts:81-83`; test the exact two-bar event grid. Do not encode line counts as verified bar maps.

## 2. Preset, time and loop contracts (D4–D5; c-5)

`--genre` remains required; `--use` never implies a genre. Resolve in this order: genre card → preset's recommended variant for that genre → explicit `--arrangement` → explicit `--bpm` and `--key` → preset structure, duration, and mix. The `newSong` builder receives the resolved variant for both default and overrides; preset logic may shorten/reorder its blocks, but it must keep the declared roles and deterministic section derivation. Pass an explicit BPM as `lockedBpm` to the preset tool; without it, the card range remains searchable. For shorts, recommend `hook_first` on trap, `default` on UK drill, `pre_hook` on NY drill, `verse_led` on boom bap, `radio` on house, `default` on lo-fi, `detroit_linear` on techno; then move/create a hook at B01. For `vo_bed`, `podcast_*`, and `type_beat`, recommend the card default; for `study_lofi`, recommend `vignette`; for `game_loop`, recommend `default` on UK drill/lo-fi and the card default otherwise, then reduce to one groove body. An explicit arrangement always wins the recommendation, but unsupported genre/use, missing role derivation, or an impossible explicit BPM is `E_INPUT`, not silent fallback. Apply `--key` transposition after the structure is built (`new.tool.ts:73-94`).

`--seconds` is positive and finite only for duration presets. Fixed `short_*` require the named duration; a conflicting value is `E_INPUT`. Let `targetFrames = seconds*sampleRate`; require a positive safe integer, so a duration between samples is invalid. For each integer BPM in the inclusive card range (or only the explicit BPM), each positive integer bar count, and tail choice `0`, `0.5`, or `1` seconds, retain only candidates satisfying **exactly** `ceil((bars*meter.numerator*60/bpm + tailSeconds)*sampleRate) === targetFrames`. This uses the current renderer's frame rule (`mixer.tool.ts:228-239`), so no post-render trimming or padding is allowed. Prefer the BPM nearest the card default, tie to lower BPM; then prefer tail 0 for a hard-ending short/bed or 0.5 then 1 for a sting/theme; then prefer bar count nearest the requested form. Reject no-solution combinations with `E_INPUT` naming genre, duration, BPM constraint, and tail choices. The `bars=seconds*bpm/240` formula is only the 4/4, zero-tail special case. Ensure final events/releases fit the allocated frames; a nonzero tail fills the stated total rather than adding to it. `timeline.secondsPerBar` uses meter numerator (`timeline.tool.ts:31-35`).

| Preset | Source | Structure and deterministic choice | `targetLufs` / `ceilingDb` |
| --- | --- | --- | --- |
| `short_15`, `short_30`, `short_60` | B.1/B.8, Epidemic Adapt; B.0 social targets unofficial | Hook at B01, exact 15/30/60 s via frame search, final-bar ending accent; prefer zero tail, allow 0.5/1 s only when needed and include it in the target. Mute lead for an authored bed edit. | −14 / −1 |
| `vo_bed` | B.1/B.8, ducking and voice-band guidance | User `--seconds` uses the same exact frame search; no lead on any section and lower remaining melodic gain by at least 6 dB; constant groove, no automatic loop. | −22 / −1 |
| `podcast_sting` | B.3/B.8, Apple Podcasts/SOS | About 4 s: search exact 4 s if feasible for genre, else `E_INPUT`; motif hit, no long intro, and any 0.5/1 s release tail fits inside 4 s. | −16 / −1 |
| `podcast_theme` | B.3/B.8, Apple Podcasts/Mubert | About 10 s: exact 10 s when feasible, motif plus resolved ending; any release tail fits inside 10 s. One song per invocation, not an automatic theme pack. | −16 / −1 |
| `game_loop` | B.4/B.8, FMOD/Wwise cues | One 8/16/32-bar body, default 16, no intro; `loop:true`; final bar leads into B01. Separate intro/loop points are deferred. | −16 advisory / −1 |
| `type_beat` | B.6/B.8, BeatPass/BeatStars | 72–88 bars, default 80; intro 8 with kick null, hook/verse 8/16 repeats, early full-energy hook; no producer tag. | −12 / −2 (Spotify louder-than-−14 guidance B.0) |
| `study_lofi` | B.7/B.8, NI lo-fi/Spotify | 90–150 s, choose bar count nearest 120 s within card range; one track toggled per 4–8 bars, no sudden stop/roll. | −14 / −1 |

Use `master.targetLufs` as a mastering request, not a promise of measured output; analyze remains the oracle. The B.0 platform table has official Spotify normal −14 LUFS/−1 dBTP, with −2 dBTP if louder than −14, and Apple Podcasts −16 LKFS ±1/−1 dBFS TP. Social −14 is third-party guidance; games have no official LUFS target in the report. Explain delivery limitations in `use-cases.md`.

`loop:true` makes the **whole song** one loop body. `loopStartSample=0`; `loopEndSample=ceil(timeline.durationSeconds*sampleRate)` is end-exclusive and equals output frames. Allocate current music+tail, mix dry and FX, then for every tail frame `i >= loopEndSample` add L/R samples to `(i-loopEndSample) % loopEndSample`; trim to exactly `loopEndSample` frames **before** master/limiter (`mixer.tool.ts:228-275`). JSON reports start 0 and end sample; `durationSeconds` is frames/rate. Keep stems dry and trimmed to the same length. `--bars` on loop songs is `E_INPUT`. Song-backed WAV analysis expects this exact length (`analyze.tool.ts:192-211`); normal songs retain the current music+tail length. The loop body must be at least one bar; no separate intro, loop-region file, or nonzero cue is produced in wp3.

## 3. Advisory checks and overview order (D6)

Static checks return the existing `LintResult {id,severity,path,observed,expected,fix}` (`lint.tool.ts:11-12`), with `severity:"warning"`; strict lint maps them to `E_QA` exit 6 (`lint.tool.ts:101-109`, `docs/cli.md:18,37-46`). A section occurrence is a `timeline.placement`, with zero-based `startBar` (`arrange.tool.ts:3-20`), so reported start is `startBar+1`.

| Check, owner | Fire/skip and observation | Message/fix; activation and non-activation oracle |
| --- | --- | --- |
| `generic/hook_too_late`, `lint-generic.tool.ts:48-64` | First hook starts at 1-based bar > trap 9, NY drill 9, UK drill 13, house 65, boom bap 41. House without a hook uses the first `groove` after a `breakdown` as drop-equivalent; skip if neither exists. Lo-fi/techno exempt. A `short_*` `song.useCase` overrides threshold to 1. `observed` is first full-entry bar, `expected` is max. | Message via `observed/expected`: `First hook starts after the genre/use-case limit.` Fix `Move the first hook earlier or choose an intentional alternate arrangement.` Fire trap B10/short B02/house post-breakdown groove B66; pass trap B09/short B01/house B65; exempt techno no result. A.0/A.3/A.6 are heuristics. |
| `generic/no_density_contrast`, `lint-generic.tool.ts:48-64` | For each occurrence, count distinct track IDs with ≥1 onset inside its half-open time span; mean counts across hook occurrences minus verse occurrences <1 for trap/drill/boom-bap. House/techno compare hook-or-groove mean against breakdown mean <2. Skip missing comparison role; lo-fi exempt. `observed` numeric difference, `expected` 1 or 2. | `Hook/full section has too few additional active layers.` Fix `Mute a layer in verse/breakdown or restore one in hook/groove; rerender to confirm.` Fire 4–4 hip-hop (difference 0) and 5–4 dance (difference 1); pass 5–4 hip-hop (difference 1) and 6–4 dance (difference 2). Suppress if `trap/7`, `house/6`, or `techno/5` reports the same cause (`lint-rules.tool.ts:84-87`, `lint-rules-dance.tool.ts:28-29,48-50`). |
| `SECTION_LOUDNESS_FLAT`, `analyze.tool.ts:96-149` | Song-backed only. Use wp2 **ungated occurrence** `flow.sectionMeans[].meanLufs` with `id,role,startBar,bars`, never gated `sections.integratedLufs` or adjacent `sectionDeltas`. Loudest finite hook minus quietest finite verse <1 LU for hip-hop; house/techno loudest hook-or-groove minus quietest breakdown <3 LU. Skip absent roles/null-only side. `observed` LU gap, `threshold` 1 or 3. | `Section loudness contrast is below the genre guide.` Fix `Change section layers or gain, then rerender and compare ungated section means.` Fire .9/2.9 LU; pass 1.0/3.0; absent or WAV-only skips. |
| `LOOP_SEAM_DISCONTINUITY`, `loop-seam.tool.ts` + `analyze.tool.ts:116-149` | Song-backed `loop:true` only. Compare last/first 50 ms. Fire if per-channel endpoint jump >.1 FS, absolute window RMS step >3 dB, **or** any 20–200/200–2000/2000–20000 Hz band-energy step >6 dB. Hann-window each segment, sum bin powers per band with `realSpectrum` (`fft.tool.ts:89-108`), stereo mean; floor band power at −60 dBFS to avoid noise-only flags. Both silent measures zero; one silent window fires when the other exceeds floor. `observed` is first firing metric, `threshold` its limit; `details` records all metrics separately. | `Loop seam has a click, level step, or spectral change.` Fix `Shorten the final release or return harmony to bar 1; rerender and inspect the seam.` Fire .11 FS, 3.1 dB RMS, or 6.1 dB spectral alone; pass .1/3/6; non-loop/WAV-only skips. |

Analysis warnings remain the current `{code,observed,threshold,message}` shape (`analysis.schema.ts:41-44`) plus additive `fix` and optional `details`; no `NaN`/`Infinity` in JSON. `details` has `jumpFs`, `rmsFirstDbfs`, `rmsLastDbfs`, `rmsStepDb`, and `bandStepDb:{low,mid,high}`, with null for unavailable/infinite values; the warning still fires for one-sided silence. Preserve order `CLIPPING`, `LUFS_OFF_TARGET`, `LOW_END_DOMINANCE`, `EMPTY_HIGH_BAND`, `NO_BEATS`, `METER_ASSUMED`, `KEY_UNCERTAIN` from `analyze.tool.ts:96-114`, then `SECTION_LOUDNESS_FLAT`, then `LOOP_SEAM_DISCONTINUITY`. In wp2's `annotate.tool.ts` warning verdict priority, keep `CLIPPING` and `LUFS_OFF_TARGET` first, then existing order, then section-flat, then seam. Execute existing warnings → flow numbers → new warnings → shared annotations → JSON/Markdown/PNG. `analysis.md` repeats identical strings under `## Warnings` and `## Flow` (`010_overview_image.md:35,51-52,164-176`; current `report.tool.ts:23-37`). No warning claims audio was heard.

## 4. Amendments and compatibility decisions

1. **wp2 flow payload amendment (A2):** 010's draft computes exact ungated section means but its declared `FlowLoudnessData`/`FlowAnalysis` showed only `sectionDeltas` (`010_overview_image.md:27,79-112`). wp2 will add `flow.sectionMeans[] {id,role,startBar,bars,meanLufs}` before wp3. Consume this exact field; keep existing deltas and gated `SectionMetrics` untouched. If the handoff lacks it, complete that producer contract before adding the warning.
2. **Preset identity amendment:** D6's short threshold cannot be recovered reliably from duration or genre. Add optional `song.useCase` alongside D5's `loop`, default null; this is additive to Song v1 and lets lint identify `short_*` without guessing (`song.schema.ts:5-11,63-91`).
3. **Unsupported arrangement moves:** R1's `beat_switch` requires a tempo map, so omit it from trap variants as D1 directs. Per-track numeric swing, nudge, and 6/8 remain deferred because `song.schema.ts:7,15,51,66-70` and `timeline.tool.ts:25-35` currently represent a single tempo, song-level swing and denominator 4. A.7's Detroit map becomes role/length blocks and static mutes; it is an inspired pattern, not an exact Mills reconstruction.
4. **Whole-song game loop (A1/A6):** wp3 `game_loop` has no intro. Wrap post-FX tail onto file sample 0 before mastering and end at the 16-bar body frame count. Report start 0/end frames; separate intro and engine cue outputs are deferred. Song-backed alignment accepts the loop length while normal songs keep tail length.
5. **Short VO fixture:** a single `--use` flag selects one preset. `short-30-bed` combines a `short_30` structure with hand-authored VO-bed gain/mutes and −22 LUFS; this demonstrates both use cases without claiming the CLI supports preset stacking.
6. **Default generator and option precedence (A3/A4):** build the default from `arrangements[defaultArrangement].blocks`, not an independently ordered starter. Keep legacy `card.arrangement` equal to those blocks. `--genre` is still required; preset recommendation precedes explicit arrangement and explicit BPM/key. Unsatisfied exact-duration constraints are input failures.
7. **Frame-exact duration (A5):** the search includes `tailSeconds` and the renderer's `ceil` frame equation, with no trim/pad step. Zero tail is preferred for hard endings; 0.5/1 second endings are options only when their body+tail frame count equals the requested total.
8. **Density and spectral checks (A7/A8):** house hook or post-breakdown groove counts as drop-equivalent. Suppress a generic density warning when a genre rule already reports that same cause. The loop warning records separate sample, RMS and three-band observations with explicit .1 FS/3 dB/6 dB thresholds.

## Focused vectors and handoff details

The implementation tests below are small contract vectors, not copies of the example songs.
They make activation and non-activation observable before the six public examples are rendered.

1. **Default builder:** call `newSong({genre:"trap",seed:7})` twice.
   Both outputs deep-equal, have first hook at bar 5, and carry only section IDs present in their arrangements.
   Calling the same card with `arrangement:"hook_first"` gives the same sections and arrangement.
2. **Variant selection:** `trap/long_hook` has 104 bars and `hook_16` reused on every 16-bar hook.
   `boom_bap/verse_led` has a 24-bar `verse_24`, and its first hook is bar 29.
   `drill_ny/pre_hook` has `prehook` at bar 5 and its first hook at bar 9.
3. **Card trace:** a test enumerates every variant's `basis`, checks nonempty case IDs, and checks that
   `case-studies.md` maps each changed card pattern/range/form to the report's source URLs.
   The generated `genres.md` check catches a card/docs mismatch.
4. **Moving snare:** query the first two bar cycles with fixed seed.
   Bar 1 has only snare step 9 and bar 2 only step 13; a second query is byte-identical.
   Hat steps 1, 4, 7, 9, 12 and 15 show the repeated 3+3+2 cell.
5. **Exact short:** UK drill `short_30`, card default BPM 140, searches 138..146 and finds
   144 BPM × 18 bars × 4 beats / 60 = 30 seconds with zero tail.
   At 44,100 Hz the WAV must contain exactly 1,323,000 stereo frames.
6. **Explicit conflict:** `--genre drill_uk --use short_30 --bpm 140` has no allowed bar/tail
   candidate under the declared 0/.5/1-second choices; it exits 2 with `E_INPUT`.
   An unsupported preset ID also exits 2 and lists valid IDs.
7. **Frame rounding:** test both 44,100 and 48,000 Hz with a candidate whose fractional
   music-frame count causes `ceil` to differ from naive rounded seconds.
   Only an exact `targetFrames` equality passes; never trim a mismatch after rendering.
8. **Preset precedence:** `--use short_30 --arrangement short_single` builds UK drill's
   explicit `short_single` source variant, then moves its hook to B01 and searches time.
   `--bpm 144 --key 'D minor'` is applied after variant selection and yields the same
   transposed note names as `newSong` at that key.
9. **Whole-song loop:** a 16-bar, 120-BPM, 44,100-Hz song has 1,411,200 body frames.
   JSON says `loopStartSample:0`, `loopEndSample:1411200`; the WAV has exactly that many frames.
   A synthetic final tail impulse appears at frame 0 after wrapping; frame count never grows.
10. **Loop boundary negatives:** `--bars 0:8` on that loop exits 2.
    The same source with `loop:false` retains `tailSeconds` in frame count and has no loop points.
    Song-backed `analyze` accepts the loop WAV and rejects a WAV that is one bar longer.
11. **Hook placement:** compare trap hooks B09/B10, UK drill B13/B14, boom bap B41/B42,
    and house hook B65/B66. A house song with no hook uses first groove after breakdown;
    without either role, it emits no placement result.
12. **Short placement:** a `useCase:"short_30"` song with hook at B01 passes,
    while B02 fires regardless of genre. A techno song without a short preset stays exempt.
13. **Static density:** a hook with five distinct onset-bearing tracks and a verse with four
    passes hip-hop at difference 1; both four fires. For dance, 6 versus 4 passes at 2,
    while 5 versus 4 fires. Repeated placements count once each in the means.
14. **Collision suppression:** construct a trap pair with a thinner hook so `trap/7` fires.
    Keep the genre warning and remove only the matching generic density warning.
    Do the analogous house/6 and techno/5 collision tests; a separate clipping result remains.
15. **Ungated means:** use three `flow.sectionMeans` rows (hook −16, verse −21, hook −18).
    The check uses loudest hook −16 minus quietest verse −21 = 5 LU and passes.
    A null-only hook side skips; gated `AnalysisJson.sections` values never alter this result.
16. **Section boundary:** hip-hop .99 LU fires and 1.00 passes; dance 2.99 fires and 3.00 passes.
    WAV-only analysis has no section-flat warning even if beat estimates exist.
17. **Seam boundary:** independent vectors trigger exactly one of .11 FS jump,
    3.1 dB RMS step, or 6.1 dB band change. Exact .1/3/6 pass.
    The JSON `details` retains all three readings and per-band values when only one fires.
18. **Silent seam:** both 50 ms windows silent yields no flag and finite zeros.
    A one-sided silent window with active counterpart fires; JSON uses null for an
    unbounded dB step rather than writing `Infinity` or `NaN`.
19. **Verdict order:** simultaneous `CLIPPING`, `SECTION_LOUDNESS_FLAT`, and seam warnings
    choose `CLIPPING` for the first overview verdict. With clipping absent, the existing
    warning order wins before the two new codes. Markdown prints the same verdict string.
20. **Public examples:** `tests/e2e/examples.test.ts:75-125` already checks one JSON object,
    strict lint, WAV signature, and song-backed analysis for curated songs.
    Extend those assertions to all six wp3 examples without duplicating wp2's overview tests.

## Verification and acceptance

This is a docs-only unit; the writer does not execute the suite. The implementer runs the affected checks after source edits and records output. `npm run docs:genres` regenerates source-owned docs before `docs:genres:check` (`package.json:52-63`). Use temp outputs, no generated WAV/PNG in tracked examples. The six new paths are wp4 extras: `prepare --case examples/trap-hook-first-142.song.json --case examples/drill-uk-moving-snare-144.song.json --case examples/boom-bap-verse-led-90.song.json --case examples/game-loop-16bar.song.json --case examples/short-30-bed.song.json --case examples/type-beat-trap-140.song.json` (`030_eval_docs_release.md:11-16,170-173`).

| Gate | Command / focused test | Required observation |
| --- | --- | --- |
| c-4 traceability | `node --test src/recipes/cards/*.test.ts src/recipes/new.test.ts` plus review `case-studies.md` | Every changed card/variant has basis IDs and source URLs; exact totals and first-hook positions; moving snare query proves steps 9/13; no unlabelled per-track transcription. |
| c-5 presets/time | `node --test src/usecases/usecase.test.ts src/cli/commands/new.test.ts` | Short 15/30/60 exact integer-bar success where feasible; nearest BPM/lower tie; impossible duration exit 2 with choices; target/ceiling and source `useCase` match. |
| c-5 loop | `node --test src/render/mixer.test.ts src/cli/commands/render.test.ts src/analyze/loop-seam.test.ts` | Tail wraps onto sample 0 before mastering, WAV frames equal body end, JSON points are 0/end, ceiling retained, sample/RMS/spectral seam activation and non-activation. |
| c-5 checks | `node --test src/recipes/lint-generic.test.ts src/analyze/analyze.test.ts src/analyze/report.test.ts` | Every threshold boundary, exempt/missing-role skip, song-only warnings, JSON-safe details, Markdown/overview verdict order and fix text. |
| c-6 examples | `node --test tests/e2e/examples.test.ts` | All six validate, strict lint has no findings, render/analyze succeed; the three use-case songs (short_30, game_loop, type_beat) are clean of their targeted warnings; exact 30 s and loop seam below threshold; overview assets exist after wp2. |
| Full affected gates | `npm run typecheck && npm run lint && npm test && npm run build && npm run audit:structure && npm run docs:genres:check` | Node ≥22.18, zero runtime dependency growth, generated genres synchronized, no changed public-contract regression. |
| CLI boundary | `node bin/music2.js new --genre drill_uk --use short_30 --seed 1 --json` and focused invalid-flag calls | Exactly one JSON object in success/failure; exits 0 success, 1 internal, 2 input, 3 capability, 4 access/provider, 5 render, 6 QA, 7 interrupted/timeout as `docs/cli.md:27-46` and AGENTS prescribe. |
