# 001 — Real-world practice: what the research found and what music2 takes from it

Two Aside research runs fed this unit. The real-world run (`evidence/aside-real-world-report.md`) read public production breakdowns, BPM/key databases, Genius section headers and platform delivery documents for 30 reference tracks across seven genres and seven use cases. The flow-image run (`evidence/aside-flow-image-report.md`) surveyed MIR structure views, DJ/DAW displays and published evidence on how vision models read charts. Sol research turned the second run into formulas (002) and a layout plus evaluation protocol (003). This document records main's disposition of every recommendation and names the work-phase that implements it.

Evidence labels from the report carry through: **V** verified by a cited page, **M** database metadata (estimates, often half/double time), **S** section order from Genius headers (line counts only, no lyric text), **I** inferred arithmetic, **U** unverified. music2 treats M and I values as ranges and never as a copy target. No melody, lyric or specific drum grid of a commercial record enters the repository; step grids come from tutorials (Attack Magazine, Native Instruments, Audeobox, EDMProd) that publish them as teaching idioms.

## Findings that change music2

1. **Hook placement depends on genre.** 8 of 12 hip-hop references open with the hook right after a short intro. All three trap references (Mask Off, Black Beatles, Bad and Boujee) and all three NY drill references (Dior, Welcome to the Party, Big Drip) are hook-first. Boom bap goes the other way: 3 of 4 are verse-first with verses of roughly 24–40 bars and 4-line hooks (N.Y. State of Mind, Shook Ones Pt. II, C.R.E.A.M.). The current `trap` and `boom_bap` cards both use `intro 4 > verse 16 > hook 8`, which contradicts every trap reference and undersizes boom bap verses (report A.0, A.8).
2. **UK drill has a concrete, documented idiom.** 138–146 BPM, 0% swing, a 3+3+2 hat cell, snare on step 9 that moves to step 13 in alternate bars, 808 glides at phrase ends, dark low-passed keys sidechained to the kick, and a filter move every 8 bars (Attack UK Drill, NI drill guide; V). Streaming singles run 56–64 bars with the hook inside the first 4–8 bars (Doja; M/S/I).
3. **NY drill uses a pre-hook and long hooks.** Dior has an 8-line pre-hook before the hook; Welcome to the Party's hooks are as long as its verses (16 bars) (S). The 808 is a melodic lead (808Melo credits; V).
4. **Dance forms are longer and change by mutes.** The Bells is the only fully published bar map found: full kick from bar 1, a new element at bars 9, 17 and 33, breaks of 1–4 bars, and "no programmed drum fills... all energy is directed by muting and unmuting looping patterns" (Attack; V). FISHER's Losing It removes the bass before every drop and plays snare rolls only while hats and claps are muted (Top Music Arts; V). The current house card (88 bars, about 2:50) is shorter than a radio edit (about 128 bars).
5. **Use cases need different deliverables, not different genres.** Short-form beds need exact 15/30/60 s lengths with a real ending; a bed under voice should sit about 6 LU below dialogue, around -22 LUFS, and keep 1–4 kHz clear; podcast episodes normalize to -16 LUFS ±1 with true peak ≤ -1 dBFS (Apple Podcasts; V); game loops need integer-bar loop bodies with the tail wrapped onto the start and no seam discontinuity (FMOD, Wwise, OCRemix; V). -14 LUFS / -1 dBTP stays correct for standalone streaming (Spotify; V), and Spotify asks for -2 dBTP when a master is louder than -14.
6. **Vision models read printed numbers better than pixels.** The flow-image report found that models misread dense or unfamiliar encodings such as spectrograms and do much better when the verdict is printed as text on the chart. That is why the overview image burns its verdicts, section labels, bar numbers and LUFS values into the picture and why wp4 tests it with an image-only evaluation.

## Dispositions for the one-image overview (flow-image report §3.3, §4, §4.5)

| Recommendation | Disposition | Where |
|---|---|---|
| Text verdict at the top, section names and bar/time ticks on the timeline, values printed on curves | **Accept** | 010 header, verdict slots, section rail |
| Short-term LUFS curve with section averages, 3-band RGB waveform (red low, green mid, blue high), activity lanes, novelty, brightness, small labeled SSM inset | **Accept** | 010 panels; formulas in 002 |
| White or very light background | **Amend: keep the dark background** from 010 so the overview matches the existing spectrogram and keeps Okabe–Ito colors at high contrast. If the wp4 image-only gate (c-3) fails, read the failed fields and the 1024 px image first; try a light theme only when the failure traces to contrast rather than text overlap, axis labels or downscaling (architect reflection) | 010, 030 |
| 1568 px long edge for standard-tier Claude | **Amend:** render 1600 px wide and evaluate at 1600, 1280 and 1024 long sides; 3× 5×7 text stays about 13 px at 1024 | 010, 030 |
| Repetition arcs above the section band | **Defer.** Repeats are printed as text (`BARS 5-12 REPEAT 21-28; SIM 0.93`) and visible in the SSM inset; arcs return only if the evaluation shows repeat reading fails | 010 |
| Warning strip with text markers | **Accept as verdict slots** (three fixed slots, text first) | 010 |
| Heuristic: hook later than 30 s or 25% of the song | **Amend to genre thresholds in bars**, because boom bap is verse-first by practice (finding 1): `generic/hook_too_late` | 020 |
| Heuristic: section loudness range under 3 LU | **Amend to genre thresholds**: under 1 LU hook-minus-verse for hip-hop, under 3 LU hook-or-groove-minus-breakdown for house/techno: `SECTION_LOUDNESS_FLAT` | 020 |
| Heuristic: identical layers in every section | **Accept** as `generic/no_density_contrast` (active-layer difference) | 020 |
| Heuristic: low share over 60% | Already covered by `LOW_END_DOMINANCE` | existing |
| Heuristic: centroid over 4 kHz as "harsh" | **Defer.** No practice source gives a threshold; the brightness line is drawn and printed without a verdict | 010 |

## Dispositions for the real-world recommendations (report R1–R6)

| Item | Disposition | Where |
|---|---|---|
| R1 named arrangement variants per card (trap hook_first default, long_hook, interlude; drill_uk short_single, posse; drill_ny pre_hook default; boom_bap verse_led default, hook_first; lofi vignette; house radio, extended; techno detroit_linear, plateau) | **Accept** with `new --arrangement`. Pre-hook maps to the existing `build` role; no Section role enum change | 020 |
| R1 trap beat switch (SICKO MODE) | **Defer**: needs mid-song tempo change, which the song model does not support | — |
| R1 drum variants: drill_uk moving snare and 3+3+2 hats; boom bap late kick answer | **Accept** inside card starter patterns, traced to cases | 020 |
| R1 per-track numeric swing, clap `nudgeMs`, 6/8 meter | **Defer**: schema changes with no wp3 check depending on them | — |
| R1 tempo ranges (drill_uk max 146, lofi max 95) | **Accept** | 020 |
| R1 keys often detected major | **Accept as documentation**; lint keeps checking declared key only and never forces minor | 020 docs |
| R2 arrangement moves as data (dropout, turnaround filter, rolls, stops) | **Defer as schema**; document as composition guidance in case-studies.md and SKILL.md, and express the dropout/mute moves through existing section pattern overrides in examples | 020 docs |
| R3 use-case presets | **Accept** `short_15/30/60`, `vo_bed`, `podcast_sting`, `podcast_theme`, `game_loop`, `type_beat`, `study_lofi` via `new --use`. `game_loop` in this unit means the whole song is the loop body (`song.loop: true`, tail wrapped onto the start); a separate intro file and loop-point export are deferred (architect reflection). **Defer** `stream_playlist` batch render and the multi-file theme pack | 020 |
| R4 checks: hook_too_late, no_density_contrast, SECTION_LOUDNESS_FLAT, LOOP_SEAM_DISCONTINUITY | **Accept** (these are c-5) | 020 |
| R4 checks: no_pre_hook_move, static_16, phrase_misaligned, snare_never_moves, verse_melody_in_vocal_band, duration_mismatch, TAIL_TRUNCATED, VOICE_BAND_BUSY, PLATFORM_TP_RISK, PLAYLIST_LOUDNESS_SPREAD | **Defer**, listed in case-studies.md as candidate checks | — |
| R5 example songs | **Accept six**: trap hook-first, UK drill moving snare, boom bap verse-led, and three use-case songs (16-bar game loop, 30 s voice-over bed, 72-bar trap type beat) | 020 |
| R6 agent guidance | **Accept** in SKILL.md and references (case-studies.md, use-cases.md) | 020, 030 |

## Limits carried forward

Almost no commercial rap record has a public bar map or MIDI grid, so per-track drum placements stay U and the cards cite tutorials for grids and tracks only for form and ranges. Genius line counts approximate section length. Several tracks have conflicting BPM or key readings (Homerton B 98/196, Around the World, Mask Off). TikTok and Instagram publish no loudness target; the -14 LUFS figures there are third-party. The audio critic cannot hear sub-bass, so the overview's red waveform band and `LOW_END_DOMINANCE` remain the low-end evidence.
