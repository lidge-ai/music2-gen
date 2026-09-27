---
name: music2
description: Compose original songs with the offline music2 CLI when asked to make a beat, compose music, or produce a 140 BPM drill track; use recipe cards, mini-notation, validation, rendering, and measured revision.
---

# Compose with music2

Use this source-first workflow for a requested beat or instrumental. Run commands from the repository root with Node.js 22.18 or newer. `node bin/music2.js` is the CLI; no runtime package install or network is needed for composition. MP3 export needs ffmpeg. Audio critique is optional and needs an audio-capable Responses route. `node bin/music2.js skill path` prints this skill's directory for a host that wants to load it; it does not install anything.

Read [prompt decisions](references/prompts.md), [genre recipes](references/genres.md), [case studies](references/case-studies.md), [use cases](references/use-cases.md), [mini-notation](references/mini-notation.md), [instruments](references/instruments.md), [mixing](references/mixing.md), and [layering](references/layering.md) as needed. The recipe cards are starting points; explicit user constraints win. Case-study keys and BPM can be estimates; never infer what a recording sounds like from metadata or analysis alone.

## Workflow

1. Extract requested genre, BPM, key, mood, length, and instruments. Run `node bin/music2.js recipes --json`, then `node bin/music2.js recipes boom_bap --json` with your selected ID. Choose the closest card when no exact genre exists. Record any unspecified key or instrument choice as an assumption.
2. Create a source song: `node bin/music2.js new --genre boom_bap --arrangement verse_led --bpm 90 --key 'D minor' --seed 901 -o /tmp/music2-song.song.json --json`. For a destination, choose one preset, for example `new --genre trap --use type_beat` or `new --genre drill_uk --use short_30`; `--seconds` is available for compatible presets such as `vo_bed`. Replace the example ID, values, and output path for the task. The destination must not already exist. Inspect the generated JSON for the full Song v1 shape, then edit its patterns, instruments, sections, and arrangement to make an original piece. Keep a fixed numeric seed. Do not copy an existing example song wholesale.
3. Check structure and actual onsets: `node bin/music2.js validate /tmp/music2-song.song.json --json` and `node bin/music2.js events /tmp/music2-song.song.json --json`. Correct `E_SCHEMA` or `E_PARSE` issues before rendering. Check track IDs, note pitches, snare positions, and section changes in the event list.
4. Run `node bin/music2.js lint /tmp/music2-song.song.json --json`. Fix errors and warnings relevant to the request; aim for zero findings in a delivered example. Keep an advisory warning only for a conscious musical choice, and explain it. `--strict` turns warnings into exit code 6.
5. Run `node bin/music2.js render /tmp/music2-song.song.json -o /tmp/music2-song.wav --json`, then `node bin/music2.js analyze /tmp/music2-song.wav --song /tmp/music2-song.song.json --out /tmp/music2-analysis --json`. Read `/tmp/music2-analysis/analysis.md` and `analysis.json`, then follow the [overview reading guide](references/overview.md) to inspect `overview.png` for section order, boundaries, loudness, density, and warning markers. A text-only agent uses the reports and `events`; an agent with vision may also inspect `spectrogram.png` and `pianoroll.png`. Metrics and images are not evidence that you heard the audio.
6. Do a named [layering pass](references/layering.md): rerun `lint --strict` on the source, then inspect the song-backed `analysis.json` bands from the render. Fix the low owner, low-mid voicing, focal mids, and high support as needed; rerun lint, render, and analyze after each change. A warning is a prompt to inspect the arrangement, not proof that it sounds bad.
7. Make one concrete change for a warning, rerun validate, events, lint, render, and analyze, then compare the new measurements. Preserve intentional syncopation and chromatic notes. The audio key estimate is advisory: `KEY_UNCERTAIN` may reflect weak evidence. The declared `key`, event pitches, and lint `generic/out_of_key` are the dependable source checks. Tempo analysis reports half/double alternatives, so compare its candidates with the declared BPM and onset grid.
8. If an audio-capable route is available, optionally run `node bin/music2.js critique /tmp/music2-song.wav --excerpt 30 --json`. Use timbre, groove, or arrangement advice only when `data.review.heard_audio === true`. The tested critic could not reliably hear sub-bass or 808 weight, so judge low end with analysis and a capable listening route. Genre guesses are advisory. On `E_CAPABILITY` or `E_PROVIDER`, continue without invented hearing feedback.
9. Check `node bin/music2.js doctor --json`. If ffmpeg is ready, `node bin/music2.js render /tmp/music2-song.song.json -o /tmp/music2-final.wav --mp3 --json` writes WAV and MP3. Otherwise deliver WAV; `E_FFMPEG_MISSING` is a capability boundary, not a song defect.

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
| `EMPTY_HIGH_BAND` | Restore or raise a quiet hat, or brighten an allowed voice parameter. | Air share rises without harshness or clipping. |
| `KEY_UNCERTAIN` or `generic/out_of_key` | Inspect `events`, declared key, and note names; fix mistakes and keep intentional passing tones. | Lint and source pitches agree with the requested key; treat estimated key as advisory. |
| Sparse hook, crowded verse, or a bright bell spike | Change section mutes/density; lower bell `index`, hat velocity, or send. | Inspect section metrics, piano roll, and spectrogram. |

`generic/clipping_risk` sums simultaneous onset velocity and track gain without master normalization. It is a static proxy, not measured clipping; confirm with rendered `CLIPPING` and peak metrics before changing the master.

For trap and NY drill, try a hook by bar 9. Boom bap often benefits from 24–32-bar verses and short hooks. Change one layer at a time every 4–8 bars; a two-bar kick/bass mute can create a pre-hook lift. Keep a voice-over bed sparse around −22 LUFS as a starting request, then measure the render and check it beneath the actual voice. These are composition choices, not claims that a reference song used exact bars or levels.
