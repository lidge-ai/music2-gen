# music2-gen current state (read 2026-09-28, commit 1da22d7, public clone)

- `src/analyze/analyze.tool.ts:110-111` — `LOW_END_DOMINANCE` fires when `bands[0].share + bands[1].share > .55` (sub+low), single threshold for all genres.
- `EMPTY_HIGH_BAND` — air share < .001 on non-silent audio.
- `LUFS_OFF_TARGET` — |integrated - target| > 3 LU. All recipe cards currently set `mixTargets.lufs = -14`, `truePeak = -1`.
- `SECTION_LOUDNESS_FLAT` — hook vs verse (dance: hook/groove vs breakdown) mean LUFS.
- Bands (`src/analyze/bands.tool.ts`): mono sum (L+R)/2, 8192 FFT Hann, hop 2048, power share over 20 Hz-20 kHz. Six bands sub 20-60 / low 60-250 / lowMid 250-500 / mid 500-2k / presence 2k-8k / air 8k-20k. NOTE: shares are raw power (not pink-weighted), so any music naturally concentrates power in low bands; thresholds must be empirical in this metric, not "equal share".
- Lint (`src/recipes/lint-*.tool.ts`): generic/empty_track, unknown_genre, out_of_key, 808_polyphony, clipping_risk (static onset sum > CLIP_RISK_SUM), hook_too_late, no_density_contrast (hook vs verse distinct active tracks >=1; dance >=2). Genre rules trap/1..7, drill_uk/1..7, drill_ny/1..7, boom_bap/1..7, lofi_hiphop/1..6, house/1..7, techno/1..6 (grid, hats, 808 transitions, motifs, density).
- No current lint for: register/octave ranges, low-interval limits, pan of low instruments, kick/808 onset collisions vs duck, duck release vs tempo, simultaneous melodic layer counts, send HPF.
- Song format: track `pan` -1..1, `gate` 0.05-1, `glide` 0-500 ms, `duck {by, amount 0-1, releaseMs default 180}`.
- Devlog 000_plan.md:123 already noted drill sub+low 0.90 and asked for genre-aware targets.
