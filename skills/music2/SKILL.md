---
name: music2
description: Compose original songs with the offline music2 CLI when asked to make a beat, compose music, or produce a 140 BPM drill track; use recipe cards, mini-notation, validation, rendering, and measured revision.
---

# Compose with music2

Use this source-first workflow for a requested beat or instrumental. Run commands from the repository root with Bun 1.4.0 (`bun install` once), or use the installed `music2` command in place of `bun bin/music2.js`. `bun bin/music2.js` is the CLI; composition needs no network. MP3 export needs ffmpeg. Audio critique is optional and needs an audio-capable Responses route. `bun bin/music2.js skill path` prints this skill's directory for a host that wants to load it; it does not install anything.

Store a request's files together in `~/.music2/projects/<name>/` (the music2 storage home; `MUSIC2_HOME` overrides it). Without an explicit path, `render` writes `~/.music2/renders/`, `analyze` writes `~/.music2/analysis/<name>/`, and `sfx` writes `~/.music2/sfx/`; the `/tmp` paths below are illustrations.

Read [prompt decisions](references/prompts.md), [genre recipes](references/genres.md), [case studies](references/case-studies.md), [use cases](references/use-cases.md), [mini-notation](references/mini-notation.md), [instruments](references/instruments.md), [Logic and GarageBand libraries](references/logic-library.md), [mixing](references/mixing.md), [layering](references/layering.md), [effects](references/effects.md), and [sound effects](references/sfx.md) as needed. The instrument reference lists twelve virtual instruments (piano, epiano, organ, strings, brass, flute, choir, marimba, vibraphone, glockenspiel, kalimba, guitar), five drum-kit characters, and the `sfx` transition voice; `music2 sfx` makes standalone one-shots for videos and games. The recipe cards are starting points; explicit user constraints win. Case-study keys and BPM can be estimates; never infer what a recording sounds like from metadata or analysis alone.

Run `bun bin/music2.js instruments --json` to inspect voice sources, acoustic emulations, and the built-in sampled library. Saw-based synth voices are normal when a synth sound is wanted: `lead` or `bass` with `wave: 0`, `supersaw`, and `pad` are valid choices. Do not use the saw-based `strings` or `brass` voices as acoustic instruments. Use `lib:strings` / `lib:strings-staccato` or `lib:brass` / `lib:brass-staccato` for acoustic parts; keep the synth voices only when a synth-strings or synth-brass sound is explicitly requested. `choir` is also saw-based and has no bundled sampled alternative, so use it sparingly. The sampled library ships with the package; its licenses and ranges are in [instruments](references/instruments.md).

## Workflow

For a DAW handoff, read the [DAW bridge guide](references/daw-bridge.md) and [experimental ALS details](references/ableton-als.md). Start from a source Song v1 file, run `validate` and `events`, then `lint --strict`, render and song-backed analyze before choosing MIDI, stems, ALS or DAWproject. In a source checkout, the SFZ/clip example `examples/daw-bridge/audio-sfz.song.json` needs `bun examples/daw-bridge/make-fixtures.mjs /tmp/music2-daw-example` in a fresh directory; use its copied song. The npm package does not ship examples. An analysis or render result does not establish that an agent listened to the audio.

1. Extract requested genre, BPM, key, mood, length, and instruments. Run `bun bin/music2.js recipes --json`, then `bun bin/music2.js recipes boom_bap --json` with your selected ID. Choose the closest card when no exact genre exists. Record any unspecified key or instrument choice as an assumption.
2. **Source sounds.** Run `bun bin/music2.js library scan --json`. When roots exist, use `library find` for a kick/snare/clap/hat kit and the needed pads, keys, bass, plucks or vocal textures. Import each selected folder with `library import <folder> --id <id>` (drums: add `--as kit`), run `library verify <id>` for pitched imports, then use `user:<id>` in the song. See the [library walkthrough](references/logic-library.md) for commands and pitch checks. When content is absent or unsuitable, use built-in voices and `lib:`. Never commit Apple samples or share the imported folders; read the installed licence before using that content.
3. Create a source song: `bun bin/music2.js new --genre boom_bap --arrangement verse_led --bpm 90 --key 'D minor' --seed 901 -o /tmp/music2-song.song.json --json`. For a destination, choose one preset, for example `new --genre trap --use type_beat` or `new --genre drill_uk --use short_30`; `--seconds` is available for compatible presets such as `vo_bed`. Replace the example ID, values, and output path for the task. The destination must not already exist. Inspect the generated JSON for the full Song v1 shape, then edit its patterns, instruments, sections, and arrangement to make an original piece. Keep a fixed numeric seed. Do not copy an existing example song wholesale.
4. **Plan layers.** After writing the song, give each role a main source and supporting `layers`; use the table below and the [stack examples](references/layering.md#stack-layers-inside-a-role). Keep one low owner: only the sub source carries the sustained fundamental, with kick providing its transient. Start layer `gain` at −6 to −12 dB relative to the main, then measure; different instruments need different gain offsets. Put a `filter` insert with `mode: "highpass"` on the bass mid layer; an octave-up voicing alone does not remove its lows.
5. Check structure and actual onsets: `bun bin/music2.js validate /tmp/music2-song.song.json --json` and `bun bin/music2.js events /tmp/music2-song.song.json --json`. Correct `E_SCHEMA` or `E_PARSE` issues before rendering. Check track IDs, note pitches, snare positions, and section changes in the event list.
6. Run `bun bin/music2.js lint /tmp/music2-song.song.json --json`. Fix errors and warnings relevant to the request; aim for zero errors and warnings in a delivered example. Keep an advisory warning only for a conscious musical choice, and explain it. `--strict` turns warnings into exit code 6.
7. Run `bun bin/music2.js render /tmp/music2-song.song.json -o /tmp/music2-song.wav --json`, then `bun bin/music2.js analyze /tmp/music2-song.wav --song /tmp/music2-song.song.json --out /tmp/music2-analysis --json`. Read `/tmp/music2-analysis/analysis.md` and `analysis.json`, then follow the [overview reading guide](references/overview.md) to inspect `overview.png` for section order, boundaries, loudness, density, and warning markers. A text-only agent uses the reports and `events`; an agent with vision may also inspect `spectrogram.png` and `pianoroll.png`. Metrics and images are not evidence that you heard the audio.
8. **Balance.** Choose a representative peak section and run `bun bin/music2.js balance /tmp/music2-song.song.json --section drop --reference kick --target bass=-2 --target bass.mid=-8 --apply --json`; replace `drop`, `kick`, `bass` and `mid` with actual IDs. Track targets are relative to the reference; layer targets are relative to their own main source. Omit `--apply` to preview. Then rerender and analyze as in step 7. Loop songs are measured without the tail wrap (warning `BALANCE_LOOP_UNWRAPPED`); check the loop seam in the analysis afterwards.
9. Do a named [layering pass](references/layering.md): rerun `lint --strict` on the source, then inspect the song-backed `analysis.json` bands from the render. Fix the low owner, low-mid voicing, focal mids, and high support as needed; rerun lint, render, and analyze after each change. A warning is a prompt to inspect the arrangement, not proof that it sounds bad.
10. Make one concrete change for a warning, rerun validate, events, lint, render, and analyze, then compare the new measurements. Preserve intentional syncopation and chromatic notes. The audio key estimate is advisory: `KEY_UNCERTAIN` may reflect weak evidence. The declared `key`, event pitches, and lint `generic/out_of_key` are the dependable source checks. Tempo analysis reports half/double and 2:3 alternatives plus `tempoDeclaredMatch` when a candidate agrees with the declared BPM, so compare its candidates with the declared BPM and onset grid.
11. If an audio-capable route is available, optionally run `bun bin/music2.js critique /tmp/music2-song.wav --excerpt 30 --json`. Use timbre, groove, or arrangement advice only when `data.review.heard_audio === true`. The tested critic could not reliably hear sub-bass or 808 weight, so judge low end with analysis and a capable listening route. Genre guesses are advisory. On `E_CAPABILITY` or `E_PROVIDER`, continue without invented hearing feedback.
12. Check `bun bin/music2.js doctor --json`. If ffmpeg is ready, `bun bin/music2.js render /tmp/music2-song.song.json -o /tmp/music2-final.wav --mp3 --json` writes WAV and MP3. Otherwise deliver WAV; `E_FFMPEG_MISSING` is a capability boundary, not a song defect.

| Role | Main + supporting sources |
| --- | --- |
| Kick | Punch/click + body or short sub. |
| Snare/clap | Body + crack + clap. |
| Bass | Mono, centered sine/triangle-like sub + high-passed drive or supersaw mid + optional top. |
| Lead | Main + octave or unison texture + sampled double. |
| Chords/pad | Synth + sampled pad or strings; leave the sustained low fundamental to bass. |
| Hats | Closed hat + shaker/texture. |

## Song v1 in one view

`version: 1`; `bpm` is 40–240; `key` is a declared label such as `D minor`; `seed` is a fixed unsigned integer. `tracks` hold `id`, `kind` (`drums` or `notes`), `instrument`, and a one-bar `pattern`. `sections` give IDs, bar counts, optional roles, and per-track pattern overrides or `null` mutes. `arrangement` orders section IDs with optional repeats. A pattern restarts with each section repeat. The generated song also shows optional `meter`, `swing`, `master`, voice controls, and defaults. See [mini-notation](references/mini-notation.md) for pattern timing and [instruments](references/instruments.md) for controls.

This tiny song is complete and can be saved as `/tmp/music2-tiny.song.json`:

```json
{
  "version": 1,
  "title": "Two-bar sketch",
  "genre": "boom_bap",
  "bpm": 90,
  "key": "D minor",
  "seed": 901,
  "tracks": [
    { "id": "beat", "kind": "drums", "instrument": "drums", "pattern": "bd ~ sd ~" },
    { "id": "keys", "kind": "notes", "instrument": "keys", "pattern": "d4 ~ f4 a4", "gain": -6 }
  ],
  "sections": [
    { "id": "intro", "bars": 1, "role": "intro", "patterns": { "keys": null } },
    { "id": "main", "bars": 1, "role": "verse" }
  ],
  "arrangement": [{ "section": "intro" }, { "section": "main" }]
}
```

Use `validate` and `events` on this sketch before expanding it. Its four-step beat is deliberately only a starting grid; compose a fuller, prompt-specific phrase and section contrast.

## Revision cues

| Signal | Edit to try | Recheck |
| --- | --- | --- |
| `CLIPPING` or true peak above the intended ceiling | Lower the loudest track gain 2–3 dB; shorten overlapping kick/808; inspect `master.ceilingDb`. | `clippedSamples` reaches zero and the measured true peak is controlled. |
| `LUFS_OFF_TARGET` | If quiet, adjust `master.gainDb` only after checking headroom; if loud, reduce dense layers or limiting. | LUFS approaches the chosen target without a peak problem. |
| `LOW_END_DOMINANCE` | Shorten or lower 808/bass; try `duck` keyed to the kick; move keys up. | Compare sub+low share and the kick transient. |
| `EMPTY_HIGH_BAND`, or a mix that sounds closed | Restore or raise a quiet hat, add real cymbal/shaker samples, relax melodic lowpasses, use a bright plate return; see "Open the top end" in mixing.md. | Air share rises without harshness or clipping. |
| Audible limiting at phrase ends | Ramp roll velocities, lower risers under the hit, keep one downbeat marker; see "Limiter headroom at phrase ends" in mixing.md. | Stem peaks over the phrase and the rendered true peak. |
| `KEY_UNCERTAIN` or `generic/out_of_key` | Inspect `events`, declared key, and note names; fix mistakes and keep intentional passing tones. | Lint and source pitches agree with the requested key; treat estimated key as advisory. |
| Sparse hook, crowded verse, or a bright bell spike | Change section mutes/density; lower bell `index`, hat velocity, or send. | Inspect section metrics, piano roll, and spectrogram. |

`generic/clipping_risk` sums simultaneous onset velocity and track gain (threshold 2; chord tones add as a square root and slow attacks count less) without master normalization. It is a static proxy, not measured clipping; confirm with rendered `CLIPPING` and peak metrics before changing the master.

For trap and NY drill, try a hook by bar 9. Boom bap often benefits from 24–32-bar verses and short hooks. Change one layer at a time every 4–8 bars; a two-bar kick/bass mute can create a pre-hook lift. Keep a voice-over bed sparse around −22 LUFS as a starting request, then measure the render and check it beneath the actual voice. These are composition choices, not claims that a reference song used exact bars or levels.
