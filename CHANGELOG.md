# Changelog

## Unreleased

- Add a production effect system in song JSON: per-track insert chains (`eq`, `filter` with LFO sweep, `drive` with 2x oversampling, stereo-linked RMS `compressor`, `chorus`, `phaser`, `width` with Linkwitz–Riley mono lows, `crush`, `tremolo`, tempo-synced `delay`), configurable send buses (`song.fx.reverb` plate after Dattorro or room/hall FDN with pre-delay and return filtering; `song.fx.delay` tempo-synced filtered ping-pong) and `master.fx` (eq, compressor, drive, width) before loudness targeting. Songs without these fields render byte-identically to before.
- Add a band-limited `supersaw` voice and optional polyBLEP unison, detune and filter envelopes on `lead`, `bass` and `pad`.
- Add advisory effect lint (reverb on low tracks, runaway delay feedback, widened lows) and an effects reference with genre chains.
- Add layering lint rules L1–L6 for low ownership, chord spacing, low pan, kick/bass ducking, focal register collision, and sub-floor notes.
- Add genre-aware rendered balance warnings A1–A4 for dominant low end, low-mid buildup, sub without body, and thin high end.
- Add a layering reference and composition workflow pass, with rebalanced recipe starters and example songs checked by strict lint and song-backed analysis.

## 0.2.0

- Add `overview.png` to `music2 analyze`: one labelled image with header metrics, a section band and rail, an ungated loudness curve, per-bar activity lanes, a 3-band waveform, novelty and brightness lines, global band share and a self-similarity inset. It is byte-identical on repeat for song-backed and WAV-only input.
- Add a `flow` object to analysis.json (interval loudness, onsets and brightness, 1 Hz short-term loudness, per-section ungated means and deltas, novelty peaks, repeats, verdicts) and a `## Flow` section to analysis.md.
- Ground genre recipes in reference tracks: named arrangement variants (`music2 new --arrangement`), hook-first trap, pre-hook NY drill, verse-led boom bap, moving-snare UK drill, radio and extended house, and Detroit-linear and plateau techno.
- Add delivery presets (`music2 new --use`) for exact 15, 30 and 60 s cues, voice-over beds, podcast stings and themes, game loops, type beats and study lo-fi. Add `song.loop` rendering that wraps the tail onto the loop start.
- Add checks for late hooks, missing hook/verse density contrast, flat section loudness and loop-seam discontinuity.
- Add reference guides for case studies, delivery use cases and reading the overview, plus six new example songs.
- Record an image-only evaluation: a vision model shown only `overview.png` recovered section order, boundaries within one bar and the loudest section for 4 of 4 core examples at 1600, 1280 and 1024 px. The same prompt on spectrograms recovered 0 of 4.

## 0.1.0

- Add a clean-room Song v1 and mini-notation engine with validation and timed events.
- Render deterministic offline WAV audio with synthesized voices and optional ffmpeg MP3, OGG, and loudness mastering.
- Analyze WAV or song sources with DSP metrics, spectrogram and piano-roll images, and song-grid or audio-estimated beat maps.
- Add genre recipes, editable starter songs, and static genre linting.
- Add optional advisory audio critique through a Responses-compatible route.
- Add a model-neutral composition skill, documentation, examples, and CI checks.
