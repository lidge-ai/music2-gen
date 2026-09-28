# Read measurements, then revise the mix

For insert chains, configurable wet buses, master effects, parameter bounds, and style starting points, see [effects](effects.md).

Render a WAV, then run `node bin/music2.js analyze /tmp/music2-song.wav --song /tmp/music2-song.song.json --out /tmp/music2-analysis --json`. Read `analysis.md` for a text-only summary and `analysis.json` for exact values and warnings. Read [overview.png](overview.md) first for section order, bar boundaries, loudness flow, density, and warning markers. `spectrogram.png` shows time and frequency; `pianoroll.png` shows the supplied song's note and drum timeline. None is a listening test. Without `--song`, WAV analysis has no piano roll or declared section labels; its overview uses an inferred beat or 0.5 s axis.

Compare `flow.sectionMeans` for a hook and verse occurrence when the overview shows little loudness contrast. Check which instruments and gains differ in those sections, change the source song, then rerender and remeasure. A small gap is an editorial cue; the structured `SECTION_LOUDNESS_FLAT` warning applies only at its documented threshold.

An integrated loudness near -14 LUFS and true peak at or below -1 dBTP are streaming-oriented starting points, not required exact scores. If you aim louder, consider a ceiling at or below -2 dBTP. The song's `master.targetLufs` only creates an advisory `LUFS_OFF_TARGET` warning when measured loudness differs by more than 3 LU. `truePeakEstimateDbtp` is a 4x oversampled estimate, not an exact intersample guarantee; verify the final encode if the delivery format matters. LRA on material under 60 seconds is provisional.

The six `bands` in `analysis.json` are shares of measured 20 Hz–20 kHz spectral energy. Fixed ratios are not universal pass/fail rules; compare a revision against the same song and target sound. Use the [layering pass](layering.md) to assign band owners, voice chords, and interpret genre-aware balance warnings.

| Band | Range | What an excess or absence may suggest | First edit to try |
| --- | --- | --- | --- |
| `sub` | 20–60 Hz | Sub masks the kick or disappears on small speakers. | Shorten or lower 808 notes, keep `pan: 0`, and separate kick/808 onsets. |
| `low` | 60–250 Hz | Kick/bass body overwhelms the rest. | Reduce overlapping bass, try a modest `duck` from kick. |
| `lowMid` | 250–500 Hz | Keys and bass feel muddy. | Raise keys register or lower keys gain; shorten bass tails. |
| `mid` | 500 Hz–2 kHz | Melody lacks body or competes with snare. | Balance keys/bell gain and section density. |
| `presence` | 2–8 kHz | Hats, clap, or metallic bell are harsh. | Lower hat velocity, bell `index`, or send level. |
| `air` | 8–20 kHz | A nearly empty band can sound dull; too much can hiss. | Restore quiet hats or reduce bright noise by velocity. |

Use track `gain`, `sends`, `duck`, note length, and voice parameters before raising `master.gainDb`. Keep sub and kick centered. `LOW_END_DOMINANCE` compares sub+low with the declared genre's guide: above 0.92 for trap/drill/house/techno, 0.85 for boom bap/lo-fi, or 0.55 only for unknown genre and WAV-only analysis. `EMPTY_HIGH_BAND` means air share is below 0.001 on non-silent audio; these are investigation prompts. `CLIPPING` counts PCM samples at full scale. Inspect `clippedSamples`, sample peak, and true peak after each edit.

Lint's `generic/clipping_risk` is a static sum of coincident onset velocity and track gain (threshold 2; chord tones on one notes track add as the square root of their count, and slow attacks such as strings, pad and choir count less). It ignores master normalization and does not prove rendered clipping. Check the rendered peak and `CLIPPING` before changing the master because of this warning. Audio key estimation is also advisory: `KEY_UNCERTAIN` signals weak evidence, and an apparent mismatch can come from percussion or sparse harmony. Use the declared key, `events` note pitches, and lint `generic/out_of_key` for source pitch checks. Tempo estimation may prefer half-time, double-time or a 2:3 relation (triplet hat rolls pull it there); compare `tempoCandidates` and `tempoDeclaredMatch` with the declared BPM and event grid.

Optional audio critique can help with timbre, groove, and arrangement only after `data.review.heard_audio` is true. The tested route failed to assess solo sub-bass/808 reliably, so never use its bass-weight claim to override band analysis. On `E_CAPABILITY` or `E_PROVIDER`, report the missing audio opinion and continue with local measurements. Rerender and remeasure after each meaningful edit; compare the new values to the preceding render, not to a fixed genre-wide ratio.

## Automation lanes replace static levels

Automation lanes are absolute: while a lane is active its value replaces the track's static `gain` or send; it is not added to it. A track with `"gain": -27` that should dip 8 dB into a build uses points like `-27 → -35 → -27`; writing `0 → -8 → 0` plays it 27 dB above its static level. `music2 lint` reports `generic/automation_gain_jump` when a gain lane rises more than 12 dB above the static gain and `generic/automation_send_jump` when a send lane rises more than 12 dB above a nonzero static send.
