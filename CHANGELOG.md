# Changelog

## Unreleased

- Breaking: Bun 1.4.0 is the only supported runtime. The package depends on the pinned `bun` npm package, and the `music2` launcher (`bin/music2.js`) is a small Node script that runs the CLI on that bundled Bun, honors `MUSIC2_BUN_PATH`, repairs a skipped Bun postinstall once, and keeps the JSON error contract when no Bun is available. Golden-digest tests now run on the pinned Bun, which renders the same bytes as Node 24 did. `version --json` reports `bun` and `bunSource`. Malformed song JSON reports its line and column on any engine. CI runs on Bun across Linux, macOS and Windows and installs the packed tarball with npm; a dry-run-first `release.yml` publishes through npm Trusted Publishing.

- Bundle five sampled SFZ instruments (`lib:grand-piano`, `lib:strings`, `lib:strings-staccato`, `lib:brass`, `lib:brass-staccato`) with per-instrument confinement, manifest validation, license notices, and a new `music2 instruments` inventory. MIDI/ALS/DAWproject keep notes editable and warn when sampled sound is not portable.
- Add opt-in triangle waves to bass and lead without changing their defaults. Saw-based lead, bass, supersaw, and pad remain normal synth choices. Recipes avoid synthesized acoustic `strings` and `brass`; lint warns on those voices, while sampled strings/brass serve acoustic parts. The saw-based `choir` has no bundled sampled replacement and should be used sparingly.

- Extend Song v1 with optional absolute note lists, SFZ instruments, audio clips and automation while retaining legacy render behavior for songs that omit them.
- Add ProjectIR, MIDI import/export, aligned track and bus-return stems, sample slicing, and experimental Ableton Live 12 and DAWproject exports. MIDI and frozen-audio routes have documented loss boundaries; generated ALS files still require a manual Live-open check.
- Add an optional out-of-process plugin bridge with explicit render/audio-export opt-in, plus DAW examples, deterministic sample-fixture generation and user/agent guidance.

- Store default outputs under `~/.music2` (or `MUSIC2_HOME`): `render` without `-o` writes `renders/<song>.wav`, `analyze` without `--out` writes `analysis/<name>/`, and `sfx` no longer requires `-o` and writes `sfx/<preset>-<seed>.wav`, adding `-2`, `-3`, … instead of overwriting. Explicit paths are unchanged. `doctor` reports the active home, and an empty `MUSIC2_HOME` now falls back to `~/.music2`.
- Add an `sfx` voice for in-song transitions: `riser`, `pitchriser`, `downlifter`, `impact`, `whoosh`, `revcymbal`, `noisebuild`, `subdrop`, `zap` and `crackle`, each with four timbre variants. An atom fills its whole weighted slot, and `impact`/`subdrop` ring out to `impactDecay`. `render` now checks every drum-kind atom against the voice's declared names, including unplaced section overrides. Lint never counts `sfx` tracks as kick, snare or hat.
- Add a `tapestop` track insert that slows playback to a stop from an absolute, meter-aware bar; partial `--bars` renders pre-roll tape-stop tracks so crops match the full render.
- Add `music2 sfx`, a standalone generator for the ten transition presets and eleven game/UI presets (pickup, laser, explosion, powerup, hit, jump, blip, alert, click, confirm, error). It writes a deterministic 16-bit WAV and a `.sfx.json` sidecar, never overwrites existing files, and accepts validated `--params` overrides.
- Add twelve synthesized virtual instruments: `piano`, `epiano`, `organ` (nine drawbars), `strings`, `brass`, `flute`, `choir` (five vowels), `marimba`, `vibraphone`, `glockenspiel`, `kalimba` and `guitar` (nylon or steel). Add `drums` `params.kit` for 909-style, 808-style, acoustic-ish and lo-fi characters; kit 0 or an omitted kit renders byte-identically to before. The new focal voices join the register-collision lint, and strings, choir and organ count as beds.
- Add four example songs, `pop-transition`, `lofi-textures`, `cinematic-cue` and `game-spark-loop`, that pass strict lint and song-backed analysis with no balance warnings.
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
