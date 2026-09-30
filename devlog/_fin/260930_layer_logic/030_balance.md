# 030 — wp4: `music2 balance`

## Outcome

`music2 balance song.json --section drop --reference kick --target bass=-2 --target hats=-12 --target bass.growl=-8 --apply --json` measures every track and layer in the window, computes clamped gain changes toward the targets, writes them into the song and reports before/after, replacing hand-written `rms.mjs` + `calib-trim.mjs`.

## Diff-level contract

NEW `src/balance/balance.schema.ts`: `BalanceTarget {track, layer?, db}`, `BalanceRow {id, kind:"track"|"layer", rmsDb: number|null, peakDb: number|null, activeRatio, targetDb?, deltaDb?, applied?: boolean, skipped?: string}`, `BalanceReport {window:{startBar,endBar,section?}, reference?, rows, changes}`; target parser `id=dB` / `id.layer=dB`.
NEW `src/balance/measure.tool.ts` (+ test): `gatedLevel(stereo, start, end, rate)` — 50 ms blocks, stereo mean-square, blocks below −60 dBFS excluded; returns rms dB of active blocks, peak dB, active ratio; null when no active block.
NEW `src/balance/balance.tool.ts` (+ test): `resolveWindow(song, timeline, {section, occurrence, bars})` (first arrangement occurrence by default, bars `a:b` 0-based end-exclusive like `render --bars`); `measureSong(song, songPath, window)` renders once with `{stems:true, layerTaps}` over the window's bars; `planChanges(rows, targets, {reference, maxStep})` (target semantics as in B5 below; step clamped ±maxStep default 12; resulting gain clamped −60..12); `applyChanges(rawSongJson, changes)` edits `tracks[i].gain` or `tracks[i].layers[j].gain`, skips tracks with a `gain` automation lane (reported), preserves other fields, writes 2-space JSON + newline; after apply re-measures and reports `after`.
NEW `src/balance/index.ts`, `src/cli/commands/balance.ts` (+ test), register.
Options: `--section`, `--occurrence`, `--bars`, `--target` (multiple), `--targets <file.json>` (`{"kick":-14,"bass.sub":-18}`), `--reference`, `--max-step`, `--apply`, `--json`. Errors: unknown track/layer/section → E_INPUT (2).
MOD `docs/cli.md`, `devlog/str_func/balance.md` (new), `skills/music2/references/mixing.md` (short section, detail in 040).

## Tests

Gate excludes silence (a half-silent tone measures the tone level); two-track song where one track is 6 dB louder measures ~6 dB apart; relative targets; clamping; layer target writes layer gain; automation-lane track skipped; apply is idempotent within 0.5 dB on a second run; JSON single object; unknown ids exit 2.


## Audit fold (A round 1)

- **B5 coordinates.** `balance` renders only the window's bars (`bars: {start, end}`), so stems and taps share the window origin. Track rows use post-fader stems; `<track>.main` and `<track>.<layer>` rows use pre-track-FX taps. Target semantics: a track target is absolute dBFS, or relative to the `--reference` track row when set; a layer target is always relative to its own track's `.main` tap (`bass.growl=-6` = growl 6 dB under the bass main source) and changes only that layer's `gain`. Parent and layer targets can be set together: layer deltas apply first, the track delta is computed from a re-measure. Tests: repeated layer ids across tracks, a window that does not start at bar 0, simultaneous parent and layer targets.
