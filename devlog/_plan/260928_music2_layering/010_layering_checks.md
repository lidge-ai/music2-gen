# 010 — Source layering lint and measured balance warnings

`music2 lint` will flag six deterministic arrangement risks from expanded song events, while `music2 analyze` will judge four balance conditions from rendered six-band power. Static findings remain advisory warnings that fail `lint --strict`; audio warnings remain measurements, not claims that a mix was heard. This unit implements the binding choices in `evidence/main-decisions.md:3-13` without changing Song v1 or the FFT band definitions.

Depends on: `evidence/main-decisions.md`, `evidence/architect-proposal.md`, `evidence/sol-tonal-balance.md`, `evidence/aside-notes/A_register_lowmids.md` through `E_verification_and_calibration.md`, and `evidence/baseline-bands-1da22d7.txt`.
Consumed by: 020 cards/examples/skill, `music2 lint --strict`, `music2 analyze`, `analysis.json`, `analysis.md`, overview verdicts, and downstream warning readers.

## Scope

IN: L1–L6 static warnings, A1–A4 measured warnings, genre routing, exact boundary tests, JSON/report/overview propagation, and unchanged existing warning meaning. OUT: kick/808 coincidence warnings for hip-hop, melodic track-count limits, relative-gain rules, per-instrument HPF, stem attribution, and per-section spectral shares. The last is unavailable because flow stores summaries rather than raw band power (`evidence/main-decisions.md:10`).

Use fixed song seeds, half-open event intervals, and deterministic traversal. `TimedEvent` already carries track, pitch, time, duration, velocity, and order (`src/song/timeline.tool.ts:8-14,64-77`); placement boundaries and occurrence indexes are explicit (`src/song/arrange.tool.ts:3-23`). Mixer event stops are clamped at the next onset for a mono track (`src/render/mixer.tool.ts:22-59`). Static results describe source risk, not measured frequency masking; an 808's harmonics, synth envelopes, and mastering can change rendered balance (`evidence/architect-proposal.md:10-14`).

## File map

`Op` describes implementation work planned by this document. Each new `*.tool.ts` has a colocated test row with a fire and non-fire oracle at its exact boundary.

| Path | Op | Exact content |
| --- | --- | --- |
| `src/recipes/lint-layering-low.tool.ts` | NEW | Export one internal `lowLayeringRules(g)` returning L1, L3, L6 results. Build L1 audible pitched note intervals, clamp mono notes to the next same-track onset, intersect distinct track intervals inside each placement, and preserve first offending track IDs/bar. Check L3 pan and L6 sub floor from all pitched notes separately. No FFT or render dependency. |
| `src/recipes/lint-layering-low.test.ts` | NEW | L1 section overlap `0.2500` fires, `0.2499` does not; MIDI 46 counts and 47 does not; gain `-24` skips and `-23.99` counts. L3 `abs(pan)=0.1000` passes and `0.1001` fires; 25% low notes qualifies, 24% does not. L6 MIDI 22 fires and 23 passes. Two repeats produce separate L1 occurrence findings, one per occurrence. |
| `src/recipes/lint-layering-harmony.tool.ts` | NEW | Export internal `harmonyLayeringRules(g)` for L2 and L5. Detect simultaneous within-track chord pairs by actual intervals, with the named interval-floor table below; exclude bass/808. Compare focal track median MIDI and 8th-note onset slots within each placement of at least two bars; exclude pad/bass/808. |
| `src/recipes/lint-layering-harmony.test.ts` | NEW | For each of 11 L2 intervals, lower pitch one semitone below its table floor fires and exactly at floor passes; interval 12 and a sequential pair do not fire. L5 median distance 7 plus 75% shared slots fires, distance 8 or 74% does not; a one-bar placement and pad-only pair skip. |
| `src/recipes/lint-layering-rhythm.tool.ts` | NEW | Export internal `rhythmLayeringRules(g)` for L4. In house/techno only, find kick atom `bd` onsets and bass/808 sounding intervals or attacks within ±30 ms; warn per bass track when at least half of kick onsets match and it has no duck whose `by` track has a `bd` event with `amount >= 0.1`. Do not infer kick from track ID. |
| `src/recipes/lint-layering-rhythm.test.ts` | NEW | At 50% matching kick onsets and ±30 ms, no duck fires; 49% or ±30.1 ms does not. Duck by an actual `bd` track with amount 0.1 passes; amount 0 and 0.099 fire; duck by hats alone fires. Same un-ducked fixture tagged trap/drill/boom_bap/lofi emits no L4. |
| `src/recipes/lint.tool.ts` | MODIFY | At `:101-110`, append the three rule groups after existing generic/genre rules, then keep the current severity/id/path sort. Do not hide their results behind genre-known checks except L4's genre condition. Preserve the parse-only error path. |
| `src/recipes/lint-geometry.tool.ts` | MODIFY if needed | Reuse `isKick` at `:23-35` and `placements` at `:98-122`; add only shared timing primitives that reduce duplicate code. The `events` map is by bar, so overlap checks must still use absolute event seconds. |
| `src/recipes/lint.test.ts` | MODIFY | A valid synthetic song yields stable warning IDs, paths, observed/expected/fix, deterministic sort, and no duplicate result per cause. Strict CLI returns one JSON object with `E_QA` and exit 6 (`src/cli/commands/lint.ts:17-36`). |
| `src/analyze/balance-warnings.tool.ts` | NEW | Export internal `balanceWarnings(bands, genre)` in A1–A4 order. Read `BandValue.share`, select low-end threshold by known genre, guard silence where relevant, and return existing `{code,observed,threshold,message}` shape with specific fixes. Keep new codes additive. |
| `src/analyze/balance-warnings.test.ts` | NEW | A1 known trap `0.9200` passes, `0.9201` fires; boom_bap `0.8500` passes, `0.8501` fires; unknown/WAV-only `0.5500` passes, `0.5501` fires. A2 `0.2500` passes, `0.2501` fires. A3 ratio `0.6500` passes, `0.6501` fires only when low total `>0.50`; `0.5000` skips. A4 `0.0200` passes, `0.0199` fires, while lofi skips. Silent six-zero bands do not claim dominance, lack of body, or thin highs. |
| `src/analyze/analyze.tool.ts` | MODIFY | At `:100-119`, move only `LOW_END_DOMINANCE` to the new helper and append A1–A4 after unchanged existing warnings, before song/flow warnings. At `:151-172`, pass `opts.song?.genre` (including WAV plus `--song`) and use the measured `bands.bands`; WAV-only passes unknown. Keep older warning order among themselves. |
| `src/analyze/analysis.schema.ts` | MODIFY | At `:42-49`, extend `AnalysisWarning.code` with `LOW_MID_BUILDUP`, `SUB_WITHOUT_BODY`, `HIGH_END_THIN`; retain numeric/null `observed` and `threshold`, optional `fix` and `details`, and version 1. Band edges remain `[20,60,250,500,2000,8000,20000]` (`:9`). |
| `src/analyze/bands.tool.ts` | NO CHANGE | Keep 8192-point Hann FFT, 2048 hop, mono `(L+R)/2`, bin-power accumulation and sum-normalized shares (`:6-10,20-25,28-68`). Do not equate power share with LUFS or a section-specific measurement. |
| `src/analyze/flow/annotate.tool.ts` | MODIFY | At `:16-18`, replace "first array item" fallback with an explicit priority list used only for the overview verdict: `CLIPPING`, `LUFS_OFF_TARGET`, `LOW_END_DOMINANCE`, `LOW_MID_BUILDUP`, `SUB_WITHOUT_BODY`, `HIGH_END_THIN`, then every other code in serialized array order. The serialized `warnings` array order is defined separately (existing codes in their current order, then A1–A4, then song/flow codes) and is not changed by this priority. The verdict uses the selected code and its observed value. |
| `src/analyze/flow/annotate.test.ts` | MODIFY | With clipping, LUFS, all four balance warnings and a seam warning, verdict starts `CLIPPING`; remove clipping for `LUFS_OFF_TARGET`; remove both for `LOW_END_DOMINANCE`; then A2, A3, A4 in order. An array `[EMPTY_HIGH_BAND, LOW_END_DOMINANCE, HIGH_END_THIN]` selects `LOW_END_DOMINANCE` even though `EMPTY_HIGH_BAND` is first; `[EMPTY_HIGH_BAND, HIGH_END_THIN]` selects `HIGH_END_THIN`; `[EMPTY_HIGH_BAND]` alone selects it. No warning yields `NO FLAGS`. |
| `src/analyze/report.tool.ts` | MODIFY | Existing warning table at `:23-26` already emits code, observed, threshold, message, and fix; verify all four rows appear verbatim in Markdown. Keep overview and JSON wording aligned. |
| `src/analyze/analyze.test.ts` | MODIFY | Test genre known/unknown/WAV-only routing, whole-file six-band warnings, additive JSON code order, Markdown rows, summary warnings, and overview verdict from one fixture render. Assert old `EMPTY_HIGH_BAND`, meter and key warning behavior remains intact. |

## 1. Evidence and measurement contract

The public research is a guide, not a published six-band standard for these genres. `V` means the cited source explicitly says it; `I` means this unit's operational threshold or translation. iZotope uses broad genre-dependent tonal ranges (`evidence/aside-notes/C_tonal_balance.md:7-10`); TrackScore publishes provisional electronic linear-power examples (`:23-25`); no primary source provides music2-compatible six-band percentiles for every named hip-hop subgenre (`:58-63`).

The six bands are sub 20–60, low 60–250, lowMid 250–500, mid 500–2000, presence 2000–8000, and air 8000–20000 Hz (`src/analyze/analysis.schema.ts:9`; `src/analyze/bands.tool.ts:8-10`). Shares are whole-file normalized linear FFT power after rendering, not perceived loudness or a track's fundamental. `evidence/sol-tonal-balance.md:3,18-31` shows why extrapolating midrange slopes to the sub band is sensitive and is only an I model.

The baseline measured at `1da22d7` is frozen in `evidence/baseline-bands-1da22d7.txt:1-13`. It calibrates review: `trap-150` already has sub+low `0.955`; `boom-bap-90` has lowMid `0.534`; `lofi-75` has lowMid `0.603`. Changing a threshold merely to hide those measurements violates the binding decision (`evidence/main-decisions.md:12-13`).

## 2. L1 — `generic/low_end_overlap`

For each section occurrence, form audible pitched event intervals at MIDI ≤46 (Bb2, about 116.5 Hz). An event must have velocity >0 and track gain >-24 dB; the gain cutoff is an I noise filter, not a loudness estimate. Count time covered by at least two *distinct* qualifying track IDs, unioning simultaneous pair overlaps so triple overlap counts once. Divide by occurrence duration. Emit one warning for that occurrence when share ≥0.25, with section occurrence, first bar, fraction, and the first contributing track IDs.

Use `[time,time+duration)` and clip to occurrence span. For a mono track, clamp end to the next same-track onset before the overlap sweep as `src/render/mixer.tool.ts:42-47` does. For polyphonic tracks, keep each note's nominal gate; ignore unmodeled release/reverb tails. Half-open endpoints make just-touching notes non-overlapping. The threshold 46/25% is I: a conservative proxy for SOS choosing one main low owner and iZotope allocating the kick/bass low range (`evidence/aside-notes/E_verification_and_calibration.md:4-9`; `evidence/aside-notes/B_low_end.md:7-10`).

## 3. L2 — `generic/low_chord_spacing`

Within one non-bass pitched track, find note pairs simultaneously sounding in the same section occurrence. Compute simple interval `abs(midiA-midiB) % 12` only for actual 1..11-semitone separation; do not fold a compound interval into a misleading simple collision. Emit once per track, first bar and offending pair, when lower MIDI is strictly below the table floor. The rule is a voicing prompt and has no genre exemption.

| Interval | m2 | M2 | m3 | M3 | P4 | TT | P5 | m6 | M6 | m7 | M7 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Lower MIDI floor | 52 | 51 | 48 | 46 | 46 | 47 | 34 | 43 | 41 | 41 | 41 |

The table uses scientific C4=MIDI 60 (`evidence/aside-notes/E_verification_and_calibration.md:30-31`). Sweetwater's low-interval chart is a timbre-dependent guide and its page could not be directly fetched here; its octave naming differs from scientific pitch. Therefore the *chosen integer cells are I policy*, not verbatim V measurements (`evidence/aside-notes/A_register_lowmids.md:24,64-68`; `evidence/sol-tonal-balance.md:59-62`). Explicit examples one semitone below/equal to each floor anchor the tests.

## 4. L3 — `generic/low_pan`

Warn on any 808/bass track with `abs(pan)>0.1`, or another pitched track with at least 25% of its note events at MIDI ≤46 and `abs(pan)>0.1`. Count notes, not duration, for the 25% classifier; L1's `-24 dB` cutoff does not apply here. Track pan affects the entire mono-generated voice (`src/render/mixer.tool.ts:62-76`); it does not certify frequency-specific mono compatibility. Low-center guidance is V, while 0.1 and 25% are I tolerances (`evidence/aside-notes/B_low_end.md:22-23`; `evidence/sol-tonal-balance.md:76`). Suggest centering or splitting the low voice; keep intentional upper stereo width.

## 5. L4 — `generic/kick_bass_unducked`

Only for house and techno, count kick events where `isKick` sees drum atom `bd` (`src/recipes/lint-geometry.tool.ts:23-26`). A kick matches a bass/808 note if the note is sounding at its onset or its note onset is within ±0.030 s. If at least 50% of kick onsets match one bass track and that bass has no `duck` whose `by` source contains `bd` events **and** whose `amount` is at least 0.1 (about 0.9 dB; an inferred **I** product-policy floor for "near-zero" ducking; the mixer does apply smaller positive amounts, and `amount: 0`, allowed by Song v1, attenuates nothing), warn for that bass track. Amendment to main-decisions L4 (audit round 1): a zero or near-zero duck does not count as managed. Tests: the same house song with `amount 0` fires, `amount 0.099` fires, `amount 0.1` passes. Zero kicks skip. An explicit duck source with kicks satisfies the rule even if it also contains hats; documentation should mention that mixer ducking follows every source event (`src/render/mixer.tool.ts:257-260`). The tolerance and 50% are I; V sources describe sidechain or leaving kick space in rolling techno, and 50–150 ms bass recovery is guidance rather than a required duck parameter (`evidence/aside-notes/E_verification_and_calibration.md:20-21`; `evidence/aside-notes/B_low_end.md:15-18`). Trap, drill, boom bap and lo-fi coincidence is deliberately deferred.

## 6. L5 — `generic/register_collision`

For a placement of at least two bars, consider two distinct pitched tracks whose instrument is lead, bell, pluck, or keys. Ignore pad, bass and 808. If their placement median MIDIs differ by ≤7 semitones and at least 75% of the *sparser track's* onsets land in an 8th-note slot also occupied by the other, warn once for that pair/occurrence. Ties in sparse choice use track order; quantize to the declared beat grid after swing. The 7/75% values are I proxies for V call-and-response pitch contrast and limited focal attention (`evidence/aside-notes/A_register_lowmids.md:22-23,38`). A matching register/onset pattern predicts competition, not actual spectral masking.

## 7. L6 — `generic/sub_floor`

Any pitched event at MIDI ≤22 triggers one track finding with first bar and note; MIDI 22 is about 29.1 Hz. Splice and MusicRadar advise rolling off content under roughly 30–40 Hz (V), while MIDI 22 and an event-level warning are I implementation choices (`evidence/aside-notes/B_low_end.md:12-14`). This is not a validator rejection: some sound systems and intentional effects can use lower frequencies.

## 8. A1–A4 — measured warning contract

Compute from `measureBands` without altering band edges, normalization, or FFT (`src/analyze/bands.tool.ts:28-68`). Use strict comparison `>` for upper guards and `<` for thin highs. `observed` and `threshold` remain numeric; messages name the genre guide and explain what to inspect. Silence has all zero shares and should not fabricate tonal faults. Analysis warnings do not make `analyze` exit 6 by themselves (`src/analyze/analyze.tool.ts:100-119`; `src/cli/commands/lint.ts:33-36`).

| ID/code | Fire threshold | Source and reason |
| --- | --- | --- |
| A1 `LOW_END_DOMINANCE` | `sub+low>0.92` trap, drill_uk, drill_ny, house, techno; `>0.85` boom_bap, lofi_hiphop; `>0.55` unknown genre/WAV-only | TrackScore's house/techno combined low examples span about 0.79–0.89 (V), and iZotope separates bass-heavy material (V); 0.92 is observed upper area plus margin, 0.85/0.55 are I policy (`evidence/aside-notes/C_tonal_balance.md:23-25`; `evidence/main-decisions.md:11`). Preserve the code and report the selected guide. |
| A2 `LOW_MID_BUILDUP` | `lowMid>0.25` for every genre and WAV-only | TrackScore electronic examples give 3–7% (V); the slope calculation is about 9–10% (I), and a pop LTAS model reaches about 22% (I). The 25% guard sits above that model, not a universal mix target (`evidence/aside-notes/E_verification_and_calibration.md:22-26,50-55`; `evidence/main-decisions.md:12`). |
| A3 `SUB_WITHOUT_BODY` | `sub/(sub+low)>0.65` AND `sub+low>0.50` | iZotope and MusicRadar describe 808 harmonics/saturation for translation (V); both numbers are I and mean inspect body, not mandate saturation (`evidence/aside-notes/B_low_end.md:19-21`; `evidence/sol-tonal-balance.md:70-71`). `observed` is the ratio, `threshold` is 0.65; message also gives total low share. |
| A4 `HIGH_END_THIN` | `presence+air<0.02`, except lofi_hiphop | TrackScore gives nonzero high-band electronic examples (V); 2% is I. NI's lo-fi drum low-pass near 3.12 kHz makes exemption reasonable (`evidence/aside-notes/C_tonal_balance.md:23-25`; `evidence/aside-notes/E_verification_and_calibration.md:18-19`). `observed` is the sum and `threshold` is 0.02. WAV-only applies. |

Existing `EMPTY_HIGH_BAND` remains based on air `<0.001`, and may coexist with A4; it is not renamed or suppressed (`src/analyze/analyze.tool.ts:110-114`). Keep the existing warning sequence, append A1–A4 in that order, then flow warnings (`src/analyze/analyze.tool.ts:167-172`). Verify the warning sequence is identical across `analysis.json`, report Markdown and the artifact summary; verify separately that the overview verdict shows the code chosen by the priority rule in the `annotate.tool.ts` row (`src/analyze/report.tool.ts:23-26`; `src/analyze/flow/annotate.tool.ts:16-18`; `src/analyze/analysis.schema.ts:61-71`).

## 9. Handoff and limits

L1 duration occupancy and A1 whole-file power answer different questions. A bass-heavy idiomatic song can exceed the old 0.55 guard without having two low note owners. A synthetic trap render above 0.92 must still trigger A1; curated trap examples are edited to fall below it in 020. Do not add a generic warning merely for coincident trap kick and 808 (`evidence/architect-proposal.md:26-37`; `evidence/main-decisions.md:3-12`).

If an example or starter fails, change source arrangement or mix before changing thresholds. For L2, move offending chord tones into a higher voicing. For L4, assign a bass duck whose `by` track contains `bd`, or separate notes in time. For A1/A4, rebalance the rendered arrangement and remeasure; JSON `gain` alone is not a cross-instrument peak rule (`evidence/sol-tonal-balance.md:35-41,77-80`).

The new source files should stay near 400 lines, use `.ts` relative imports, add no runtime dependency, and expose no unnecessary package-root API (`AGENTS.md:5-21`; `src/recipes/lint.tool.ts:1-12`).

## 10. Implementation details and boundary vectors

The following vectors are contract examples for the implementer, not measured claims about an existing song.

1. Resolve all section overrides before any layering check.
   `buildTimeline` already expands the effective pattern for each placement (`src/song/timeline.tool.ts:45-66`).
   Do not inspect raw pattern strings for overlap or co-onset claims.
2. Clamp every interval to its placement's `[start,end)` range.
   A note ending at the next occurrence boundary belongs to the former only.
   A note starting exactly at that boundary belongs to the latter only.
3. Sort sweep endpoints by time, then end before start on a tie.
   Two notes meeting exactly at `1.000 s` contribute zero overlap.
   Keep track ID as a stable tie-break when selecting the reported pair.
4. For L1, count the union of time when at least two distinct track IDs are active.
   Three overlapping notes from one chord track remain one owner.
   Two simultaneous chords on separate tracks are two owners.
5. For L1, one track at `-24 dB` plus one at `0 dB` does not qualify.
   Changing that first track to `-23.99 dB` makes it eligible.
   A velocity-zero note never makes an owner.
6. For L1, 1.000 seconds of covered overlap in a 4.000-second occurrence fires.
   0.9996 seconds in the same occurrence does not.
   Emit occurrence ID and fraction, not an unbounded list of every note intersection.
7. For mono note intervals, the next *same-track onset* ends the previous note.
   This applies even if the next note has a different pitch.
   Never clamp one track at another track's onset.
8. For L2, `[e3,f3]` is an m2 with lower MIDI 52 and passes.
   `[eb3,e3]` has lower MIDI 51 and fires.
   A pair sounding one after the other does not fire despite the same pitches.
9. For L2, `[bb2,d3]` M3 has lower MIDI 46 and passes.
   `[a2,db3]` M3 has lower MIDI 45 and fires.
   A bass/808 track using those notes is excluded from this chord rule.
10. For L2, keep the report to the first offending bar/pair per track.
    If one chord contains several offending intervals, report a deterministic first pair.
    Retain enough observed detail to distinguish interval and lower MIDI from the floor.
11. For L3, a `bass` track at pan `+0.1` passes and at `-0.1001` fires.
    A keys track with exactly one MIDI-46 note in four qualifying notes is low-rich.
    The same keys track with one such note in five does not meet its 25% classifier.
12. For L4, a kick at `1.000 s` and bass onset at `1.030 s` match.
    Moving bass to `1.0301 s`, with no bass sustaining across the kick, does not.
    The relation is temporal; MIDI pitch does not need to equal the kick fundamental.
13. For L4, two of four kick onsets matching a bass track fire at exactly 50%.
    One of four does not; zero kick onsets skip rather than divide by zero.
    Count kick onsets across the whole expanded song for each bass track.
14. For L4, `duck.by` must resolve to a real track containing a `bd` event.
    A duck from only `hh` or `sd` is not evidence of kick management.
    The mixer still applies a multi-drum source duck on every onset, so explain that risk.
15. For L5, compute the median from actual note MIDI values in that occurrence.
    A median at 60 against 67 passes the register distance guard; 60 against 68 skips.
    Do not take the median of track-wide notes when a section override changes melody.
16. For L5, 3 of 4 sparser onsets sharing an eighth slot fires at 75%.
    With 2 of 4 it does not; with zero onsets there is no pair to compare.
    Held pad notes and bass onsets are outside the focal set.
17. For L6, test the pitch conversion through song validation/timeline.
    MIDI 22 fires; MIDI 23 is above the 30 Hz implementation floor and passes.
    A drum sample name that looks like a note is not a pitched event.
18. For A1, use the genre from the validated optional song, never a guessed beat style.
    A WAV analyzed without `--song` uses 0.55 even if its file name contains `trap`.
    The same WAV with a matching trap song uses 0.92.
19. For A2–A4, use the same ordered `BandValue` names as the analyzer schema.
    A synthetic zero-energy array must not divide by zero in A3.
    All JSON observed values remain finite or null; no `NaN` or `Infinity`.
20. For A3, `sub=0.325`, `low=0.175` gives low total 0.50 and skips.
    Add a tiny positive low share without increasing the ratio past 0.65 and it still skips.
    A fixture with total 0.51 and ratio 0.651 fires.
21. For A4, `presence=0.010`, `air=0.010` passes at equality.
    `presence=0.010`, `air=0.0099` fires except under lofi_hiphop.
    WAV-only audio is not automatically lo-fi just because the highs are absent.
22. For warning order, test a song with an old `EMPTY_HIGH_BAND` and A4 together.
    Both codes should persist in JSON and Markdown.
    The overview first verdict follows the declared priority, not a freshly sorted string list.
23. For output compatibility, keep the `AnalysisJson.version` at 1.
    Adding code union members is additive; never silently rename `LOW_END_DOMINANCE`.
    Confirm `summary.warnings` and saved `analysis.json.warnings` have the same sequence.

## Binding-decision amendments

The L2 integer table remains exactly as bound. Its attribution is narrowed: the exact scientific-MIDI cells are I translations of a timbre-dependent low-interval guide, because the Sweetwater page was not directly fetched and independent examples differ (`evidence/aside-notes/E_verification_and_calibration.md:30-31`; `evidence/sol-tonal-balance.md:59-62`). No threshold changes.

For A1–A4, skip the four balance prompts when all six measured shares are zero. This is a narrow silence guard: a silent WAV has no interpretable tonal balance, even though literal `presence+air<0.02` would otherwise fire A4. All non-silent thresholds, genre choices, and WAV-only routing remain the binding values. Test this explicitly in `balance-warnings.test.ts`.

## Verification and acceptance

This docs unit does not run tests. The implementer records actual exit status and warning lists after source edits. A no-warning result is distinct from skipping the relevant path. Do not change the bound thresholds to make examples green.

| Criterion | Command / test | Required observation |
| --- | --- | --- |
| c-1 | `npm run typecheck && npm run lint && npm test && npm run build && npm run audit:structure` | All five gates exit 0 on affected source changes; Node ≥22.18. `npm run docs:genres:check` also exits 0 when card data changes. |
| c-2 | Review this unit against `evidence/main-decisions.md` and the cited Aside/Sol paths; `rg -n 'L[1-6]|A[1-4]|V|I' devlog/_plan/260928_music2_layering/010_layering_checks.md` | Every threshold is labeled V source guidance or I product rule; band math, genre routing, and deferrals trace to evidence. |
| c-3 | `node --test src/recipes/lint-layering-low.test.ts src/recipes/lint-layering-harmony.test.ts src/recipes/lint-layering-rhythm.test.ts src/analyze/balance-warnings.test.ts` | Each rule fires and does not fire at exact boundary values above, including exemptions, silence, and deterministic occurrence deduplication. |
| c-4 | `node --test src/analyze/balance-warnings.test.ts src/analyze/analyze.test.ts` (wp2, threshold logic and routing) and `node --test tests/e2e/examples.test.ts` (wp3, render-path fixture) | wp2 proves the genre thresholds on band vectors; c-4 is **met in wp3** when the rendered test-only trap fixture measures sub+low above 0.92 and fires A1 while rebalanced hip-hop examples do not. |
| c-5 | `node --test tests/e2e/examples.test.ts` plus full `lint --strict` and song-backed analyze over non-fixture `examples/*.song.json` | All examples except `minimal.song.json` and `wrong-genre.song.json` have zero lint findings and no A1–A4 warnings; outputs still contain one JSON object. 020 owns source adjustments. |
| c-6 | `git log -1 --format='%h %an <%ae> %s'` after the parent's local commits | Parent records local conventional commits with public identity and no push; this delegated docs writer makes no Git mutations. |
