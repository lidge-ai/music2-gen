# 001 — Layering research: what the sources say and what music2 takes

Three research tracks fed this unit. An Aside exec run split the question into register slotting and low-mids (note A), low end (B), tonal balance (C), mids, levels and genre (D), and a verification pass that re-fetched key sources and measured every music2 example (E). A sol subagent researched genre tonal balance, gain staging, sidechain and voicing with web search (evidence/sol-tonal-balance.md). A sol architect read the lint, analyze, render and voice code and proposed where each check should live (evidence/architect-proposal.md). Labels: **V** a fetched page states it, **I** inference or a proposed convention, **U** unverified.

## What the measurements showed

The baseline (evidence/baseline-bands-1da22d7.txt) is the first finding. Band share is the fraction of summed 20 Hz–20 kHz linear power, as music2 computes it.

| Example | sub+low | lowMid | presence+air | Reading |
|---|---:|---:|---:|---|
| trap-150, trap-hook-first-142, type-beat-trap-140 | 0.955–0.968 | ≤0.023 | 0.009–0.029 | 808 swamps everything; top end nearly empty |
| drill-140, drill-uk-moving-snare-144, short-30-bed | 0.902–0.944 | ≤0.019 | 0.030–0.045 | bass-heavy but closer to club norms |
| house-124 | 0.741 | 0.142 | 0.022 | plausible; hats quiet |
| boom-bap-90 | 0.433 | **0.534** | 0.005 | low-mid mud from low keys voicings |
| lofi-75 | 0.382 | **0.603** | 0.000 | low-mid mud; top rolled off by design |

Two failure modes coexist: the 808 genres are too bass-heavy with thin tops, and the keys-driven genres are muddy. The old check caught only the first and caught it for every 808 song regardless of whether the balance was idiomatic.

## Findings that change music2

1. **Genre balance norms are far bassier than 0.55.** TrackScore's linear-power analysis uses music2's first four band edges and reports sub+bass of 79–84% for house, 89% for peak-time techno and 76% for dubstep, with low-mids at 3–7% (V, [TrackScore](https://trackscore.ai/blog/frequency-balance-electronic-music)). iZotope's Tonal Balance Control curves are ranges, and its own analysis found more bass in club-oriented hip-hop and electronic music (V, [iZotope](https://www.izotope.com/community/blog/why-izotope-created-the-tonal-balance-control-plug-in)). A slope model puts a pop long-term spectrum near 0.44 sub+low in music2's metric (I, note E). So 0.55 is roughly "pop plus a little" and cannot be the rule for trap or house.
2. **One low-end owner at a time.** With more than one bass part, choose one main low source and high-pass the others near 100 Hz; kick versus bass is the most critical sub-100 Hz conflict, and kick-to-bass ducking rarely needs more than 2–3 dB per hit (V, [Sound On Sound, Mixing Bass](https://www.soundonsound.com/techniques/mixing-bass)). Kick and bass concentrate energy at 20–160 Hz, so one must win at each moment (V, [iZotope](https://www.izotope.com/community/blog/how-to-mix-kick-and-bass)).
3. **Club bass gets out of the kick's way.** Rolling techno leaves the first 16th of each beat to the kick and sidechains the bassline (V, [Attack](https://www.attackmagazine.com/technique/tutorials/warehouse-rolling-techno-bass)); sub sidechain release of 50–150 ms (V, [EDMProd](https://www.edmprod.com/sub-bass/)). In trap and drill, kick and 808 often start together on purpose, with a short kick giving punch and the 808 carrying sustain (V, [iZotope 808](https://www.izotope.com/community/blog/how-to-mix-808s)).
4. **Keep lows centered.** Mono below about 120 Hz, center below about 200 Hz (V, [EDMProd](https://www.edmprod.com/mono-vs-stereo/); [iZotope M/S](https://www.izotope.com/community/blog/what-is-midside-processing)).
5. **Low-mids are the mud zone and chords cause it.** Most sources encroach on 200–500 Hz (V, [Production Expert](https://www.production-expert.com/production-expert-1/6-eq-mistakes-to-avoid-when-mixing)); piano mud sits at 200–500 Hz (V, [iZotope EQ cheat sheet](https://www.izotope.com/community/blog/eq-cheat-sheet)). Low interval limits say how low each interval can sit before it turns to mud. Sources agree on the idea and roughly on the shape (seconds and thirds need a higher floor than fifths), but disagree on exact pitches; the Music SE answer is more conservative than the Berklee-style chart. The exact scientific-pitch table music2 uses (minor third ≥ C3, major third ≥ B♭2, fifth ≥ B♭1, and so on) is therefore a product-policy translation (**I**), not a value any single source establishes ([Sweetwater](https://www.sweetwater.com/insync/low-interval-limit/), [Robin Hoffmann](https://www.robin-hoffmann.com/dfsb/low-interval-limits/), [Music SE](https://music.stackexchange.com/questions/77173/lower-interval-limits/77176)). Note E corrected an octave-naming mix-up in the Sweetwater table before this unit used it.
6. **An 808 needs harmonics to translate.** Saturation adds 2nd/3rd harmonics so a sub-heavy 808 survives small speakers (V, [iZotope 808](https://www.izotope.com/community/blog/how-to-mix-808s); [MusicRadar](https://www.musicradar.com/tuition/tech/4-ways-to-process-a-roland-tr-808-bass-drum-633187)).
7. **Separate focal layers by register or rhythm.** Call and response works through contrast in pitch, intensity or sound, for example answering an octave lower (V, [EDMProd](https://www.edmprod.com/using-call-and-response/)); a listener follows about three elements at once (V, [EDMProd](https://www.edmprod.com/production-pyramid/)).
8. **Relative levels are conventions.** Trap starting sheets put hats 10–12 dB and melody 12–15 dB under the kick and 808 (V as one producer's sheet, [Louis Romani](https://louisromani.com/blog/how-to-mix-trap-drums)); a generic peak template has pads 10–14 dB under the kick (V as template, [Point Prime](https://pointprimerecordings.com/blog/volume-balancing-cheat-sheet/)). Because music2 voices differ in energy, a track's `gain` does not predict its rendered level, so relative levels belong in guidance, and the rendered band balance is the check.

## Dispositions

| Proposal | Disposition | Where |
|---|---|---|
| F1 low-end overlap (two low owners) | **Accept** as `generic/low_end_overlap` (≥25% of a section, MIDI ≤46, gain > −24 dB) | 010 |
| F2 kick/bass unmanaged | **Accept for house/techno** as `generic/kick_bass_unducked`; **defer** trap/drill (deliberate layering, finding 3) | 010 |
| F3 low chord spacing and low-mid density | **Accept spacing** as `generic/low_chord_spacing` with the low interval limit table; **defer** a static density count (the rendered `LOW_MID_BUILDUP` judges density better) | 010 |
| F4 register collision | **Accept a conservative version** as `generic/register_collision` (focal tracks only, median within 7 semitones, ≥75% shared 8th slots) | 010 |
| F5 centered lows | **Accept** as `generic/low_pan` (|pan| > 0.1) | 010 |
| F6 genre-aware balance | **Accept**: `LOW_END_DOMINANCE` keeps its code with genre thresholds (808/club 0.92, boom bap/lo-fi 0.85, unknown and WAV-only 0.55); add `LOW_MID_BUILDUP` (> 0.25), `SUB_WITHOUT_BODY` (sub/(sub+low) > 0.65 with sub+low > 0.5) and `HIGH_END_THIN` (presence+air < 0.02, lo-fi exempt) | 010 |
| F7 melodic layer count | **Defer**: "about three focal elements" is attention guidance, not a count law | 001 |
| F8 per-section band shares | **Defer**: flow discards raw band power; needs profiling first | 001 |
| Sub floor below 30 Hz (note B) | **Accept** as `generic/sub_floor` (MIDI ≤ 22) | 010 |
| Relative-gain lint, per-instrument HPF, mono side-energy analysis, kick tuning | **Defer**: no Song v1 field, or gain does not predict level for these synths | 001 |

## Limits carried forward

No public source gives measured six-band shares per hip-hop subgenre; the 0.92/0.85 limits combine the TrackScore club measurements, iZotope's qualitative ordering and music2's own renders, and are labelled I. Low interval limits depend on timbre; the table is guidance. Static lint predicts risk from notes and controls; only the rendered analysis measures the result.
