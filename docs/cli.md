# CLI reference

Run commands from a source checkout as `node bin/music2.js <command>`. `--json` is global; `MUSIC2_JSON=1` has the same effect. `--help` or `-h` prints a command's usage, and `help <command>` does the same. Except for `critique`, commands work locally without a network service. WAV rendering and analysis do not require ffmpeg.

The examples below use the tracked `examples/drill-140.song.json` and illustrative `/tmp` output paths. Run `render` before either WAV analysis or critique example. `new -o` refuses to replace an existing file; choose a fresh output path on a repeated run.

## Commands

| Command and example | Arguments, flags, defaults, and result |
| --- | --- |
| `node bin/music2.js help render --json` | `help [command]`: list registered commands or show one command. `data.usage` and `data.commands` include usage and options. `node bin/music2.js help --json` lists all commands. |
| `node bin/music2.js version --json` | No positional arguments. `data.version` is the package version. |
| `node bin/music2.js schema --out /tmp/music2-schema.json --json` | `--out file` optionally writes Song v1 JSON Schema and returns `data.written` plus an artifact path. Without `--out`, `data.schema` contains the schema and no file is written. |
| `node bin/music2.js recipes drill_uk --json` | Optional recipe ID. Without it, `data.recipes` lists ID, title, BPM range, default keys, and roles. With it, `data.recipe` is the full card, including starter song and lint rule IDs. |
| `node bin/music2.js instruments --json` | No positional arguments. `data.voices` lists synthesized voice IDs, kinds, numeric parameter rules, oscillator sources, and `emulates` (`strings`, `brass`, `choir`, or `null`); `data.library` lists bundled `lib:` instruments with families, titles, ranges, roles, sources and licenses. Without `--json`, prints a compact table. |
| `node bin/music2.js new --genre drill_uk --use short_30 -o /tmp/music2-new.song.json --json` | `--genre id` is required. `--arrangement id` selects a named card form; `--use preset` applies a delivery preset; `--seconds n` requests an exact duration where the preset allows it. Optional `--bpm n`, `--key 'C minor'`, `--seed n`, `--title text` override card defaults; `-o path`/`--out path` writes a new file. The result includes selected arrangement, use case, and duration. Without `-o`, `data.song` is the editable JSON song. Existing output returns `E_ACCESS`. |
| `node bin/music2.js validate examples/drill-140.song.json --json` | One song path. Returns title, BPM, total bars, duration in seconds, and event count per track. Checks Song v1 structure and mini-notation. |
| `node bin/music2.js events examples/drill-140.song.json --bars 0:1 --track kick --json` | One song path. `--bars start:end` selects a zero-based half-open range; default is all bars. `--track id` selects one track; default is all. `data.events` contains timed events with track, bar, time, duration, pitch/sample, and velocity fields. |
| `node bin/music2.js lint examples/drill-140.song.json --json` | One song path. `--genre id` overrides `song.genre`; `--strict` treats warnings as QA failure. `data` is `{genre,barsChecked,results,errors,warnings}`. Each result includes ID, severity, path, observed, expected, and fix. Non-strict warnings can exit 0; errors or strict warnings return `E_QA` exit 6 with the report under `error.details.report`. FX warnings flag heavy low-track reverb, high delay feedback, and low-track widening. `generic/synthetic_acoustic` warns when a notes track uses synthesized `strings` or `brass`; use sampled `lib:` strings/brass for acoustic parts. Saw-based lead, bass, supersaw, and pad are normal synth choices; `choir` is saw-based but has no bundled sample and does not trigger this warning. `generic/clipping_risk` is a static onset proxy (threshold 2; chord tones on one notes track add as the square root of their count and slow attacks are weighted down) and ignores compression/limiting, so inspect rendered peaks. `generic/register_collision` compares unique 16th-note onsets of two focal lines. Motif rules (`drill_ny/6`, `boom_bap/6`, `boom_bap/7`, `lofi_hiphop/4`) pass when any focal or sampled melody track satisfies them, independent of track order; beds and bass never count as the melody. `drill_ny/5` counts 808 moves inside each hook. `generic/automation_gain_jump` and `generic/automation_send_jump` flag gain or send lanes more than 12 dB above the static level, because lanes replace it. |
| `node bin/music2.js render examples/drill-140.song.json -o /tmp/music2-cli.wav --json` | One song path. `-o`/`--out` defaults to `$MUSIC2_HOME/renders/<song name>.wav` (home `~/.music2`), creating that folder when needed; `--bits 16\|24` defaults to 16. `--bars start:end` is zero-based half-open, default all bars. `--stems dir` writes dry track WAVs. `--mp3`, `--ogg`, and `--loudnorm` are off by default and require ffmpeg; MP3/OGG copies share the WAV basename. Returns WAV/encoded/stem paths, rendered bars, sample rate, frames, duration, peak, true peak, ceiling, and event count. |
| `node bin/music2.js analyze /tmp/music2-cli.wav --song examples/drill-140.song.json --out /tmp/music2-cli-analysis --json` | Input is a WAV or song JSON. `--song path` is only for a matching, full-song WAV and enables declared-song context and `pianoroll.png`; a WAV without it has no piano roll. Song JSON is rendered internally and gets a piano roll. `--out dir` defaults to `$MUSIC2_HOME/analysis/<input name>/`. Returns paths for `analysis.json`, `analysis.md`, `spectrogram.png`, `overview.png` (one labelled flow image: section band and rail, loudness curve, activity lanes, 3-band waveform, novelty, brightness and a self-similarity inset; WAV-only input gets a beat or 0.5 s axis and no declared sections), optional `pianoroll.png`, optional `beats.json`, and a summary. With a song, `beats.json` uses the declared song grid. For WAV alone, it uses the audio tempo estimate when available; otherwise `data.beatsJson` is null with `NO_BEATS`. Key estimation is advisory (`KEY_UNCERTAIN` can appear); declared key and `generic/out_of_key` lint are the reliable pitch checks. Tempo estimates include half/double alternatives and label unrelated peaks at 2:3 or 3:2 of the chosen tempo in `analysis.json`. With `--song`, `tempoDeclaredMatch` is the best candidate within 1.5 BPM of the declared tempo (score ≥ 0.9), and the report and overview headline use it when the audio top estimate differs; `estimatedBpm` stays audio-only. |
| `node bin/music2.js doctor --json` | No positional arguments. `data.ffmpeg` is path/version/encoders or null; `data.required` reflects `MUSIC2_REQUIRE_FFMPEG`; `data.ready` means both MP3 and OGG encoders are available; `data.home` is the storage home described below. Missing optional ffmpeg returns 0 with `ready:false`. |
| `node bin/music2.js critique /tmp/music2-cli.wav --excerpt 1 --json` | Input is WAV or song JSON. `--model id` defaults to `MUSIC2_CRITIC_MODEL` or `google-antigravity/gemini-3.8-flash`; `--base-url url` defaults to `MUSIC2_CRITIC_BASE_URL` or `http://127.0.0.1:10100`; `--excerpt seconds` defaults to 30 and accepts 1–120. Uses ffmpeg MP3 when available and WAV otherwise. With a working audio-capable Responses route, returns `{review,dsp,audio,model}`; use model advice only when `review.heard_audio` is true. The critic cannot reliably hear sub-bass. A missing route returns `E_PROVIDER`; unsupported audio or `heard_audio:false` returns `E_CAPABILITY`. |
| `node bin/music2.js sfx --preset pickup --seed 41 -o /tmp/music2-pickup.wav --json` | No positional arguments. `--preset` is one of the ten transition atoms (`riser`, `pitchriser`, `downlifter`, `impact`, `whoosh`, `revcymbal`, `noisebuild`, `subdrop`, `zap`, `crackle`) or the game/UI presets `pickup`, `laser`, `explosion`, `powerup`, `hit`, `jump`, `blip`, `alert`, `click`, `confirm`, `error`; `-o`/`--out` is a `.wav` path; without it the WAV goes to `$MUSIC2_HOME/sfx/<preset>-<seed>.wav`, or `-2`, `-3`, … when that name is taken, so a default run never overwrites an earlier one. `--seed` 0–4294967295 (default 1), `--seconds` 0.05–30 (default per preset), `--sample-rate 44100\|48000` (default 44100), `--params k=v,...` numeric overrides allowed for that preset. Writes a 16-bit stereo WAV and `<basename>.sfx.json` (generator version, preset, seed, seconds, frames, sample rate, resolved params); `artifacts` lists both. An existing WAV or sidecar returns `E_ACCESS` exit 4 and nothing is overwritten; invalid flags or params return `E_INPUT` exit 2. See [sound effects](../skills/music2/references/sfx.md). |
| `node bin/music2.js skill path --json` | Exact subcommand `skill path`; no other positional argument or file write. `data.path` is the absolute directory of the packaged `skills/music2/SKILL.md`. Human mode prints one path line. |

For `analyze`, use `node bin/music2.js analyze /tmp/music2-cli.wav --out /tmp/music2-wav-only --json` to inspect a WAV without song context. That output has metrics and a spectrogram; `pianoRollPng` is null. Any saved `beats.json` comes from the audio tempo estimate and labels its meter assumption.

Analyze warnings are advisory measurements of whole-file six-band power. `LOW_END_DOMINANCE` uses a sub+low guide of 0.92 for trap, drill_uk, drill_ny, house and techno; 0.85 for boom_bap and lofi_hiphop; and 0.55 for unknown genres or a WAV without `--song`. Its message names the selected guide. `LOW_MID_BUILDUP` flags lowMid share above 0.25. `SUB_WITHOUT_BODY` flags sub/(sub+low) above 0.65 when sub+low exceeds 0.50. `HIGH_END_THIN` flags presence+air below 0.02, except for lofi_hiphop. All four skip silence. Existing `EMPTY_HIGH_BAND` can appear alongside `HIGH_END_THIN`. Inspect the rendered mix before changing the arrangement; these shares are linear FFT power, not LUFS.

`new` resolves genre, the preset's recommended arrangement, an explicit `--arrangement`, and explicit BPM/key in that order; the preset then adjusts structure and mix. `short_15`, `short_30`, and `short_60` require their named length. `vo_bed` accepts `--seconds` for an exact bed; `podcast_sting` and `podcast_theme` target 4 and 10 seconds. `study_lofi` accepts an exact `--seconds` override from 90 to 150. `game_loop` creates a 16-bar whole-song loop; `type_beat` creates an 80-bar form. `--seconds` without `--use`, unsupported preset/genre pairs, invalid arrangement IDs, and durations without an exact integer-frame solution return `E_INPUT` (exit 2), listing choices where applicable. An explicit BPM restricts the exact-duration search to that BPM. Preset LUFS values are mastering requests; analyze the rendered WAV to check the result.

**020 integration note — loop render and analyze checks:** A song with `loop:true` renders the whole song as one loop body: the effects tail wraps onto its start, `loopStartSample` is 0, and `loopEndSample` is the exclusive output-frame count. `render --bars` is invalid for a loop song. Song-backed analyze can report `SECTION_LOUDNESS_FLAT` from ungated `flow.sectionMeans` and `LOOP_SEAM_DISCONTINUITY` from the loop boundary; WAV-only analysis has neither song-backed check. These warnings are advisory measurements, not a claim that audio was heard.

## JSON and failures

## DAW bridge commands

`export` and `import` are each one registered command with a positional subverb. Every `--json` success or failure prints one object. Existing outputs return `E_ACCESS` (exit 4) unless `--force` is supplied; force replaces only planned files. Invalid option combinations return `E_INPUT` (exit 2). Use fresh output paths in these examples.

| Invocation | Output and options |
| --- | --- |
| `node bin/music2.js export ir examples/daw-notes-automation.song.json -o /tmp/music2-ir.json --json` | Optional `-o` writes ProjectIR; without it `data.ir` contains the 960-PPQ project. Quantization counters expose rounded pattern events. |
| `node bin/music2.js export midi examples/daw-notes-automation.song.json -o /tmp/music2.mid --json` | Required `.mid` output; SMF type 1 with conductor data and per-track notes. `data` reports PPQ, notes, channels, quantization and dropped material; inspect warnings for GM/CC losses. |
| `node bin/music2.js export stems examples/daw-notes-automation.song.json -o /tmp/music2-stems --premaster --json` | Required directory; aligned track/active return WAVs and `stems.json`. 24-bit by default; `--bits 16\|24`, `--no-master`, `--premaster`, and zero-based half-open `--bars a:b` are available. Loop songs cannot be cropped. Tracks plus returns sum to the pre-master signal (`premaster.wav`) within 1e-6 before encoding; `master.wav` has master inserts and limiting applied, so it does not equal that sum. |
| `node bin/music2.js export als examples/daw-notes-automation.song.json -o /tmp/music2-live --content both --json` | Required directory; **experimental** Live 12 `.als` and `Samples/Imported` WAVs for audio modes. `--content midi\|audio\|both` defaults to both; `--bits 16\|24` defaults to 24. Generated sets still require a manual Live-open check. |
| `node bin/music2.js export dawproject examples/daw-notes-automation.song.json -o /tmp/music2.dawproject --content both --json` | Required `.dawproject` ZIP. `--content midi\|audio\|both` defaults to both; entries include `metadata.xml`, `project.xml` and any audio media. |
| `node bin/music2.js import midi /tmp/music2.mid -o /tmp/music2-imported.song.json --json` | Required `.mid` input and `.json` output. `--title text` names the song; `--strict` rejects tempo/meter changes. Returns track, note and dropped counts. |
| `node bin/music2.js slice /tmp/clip.wav -o /tmp/music2-slices --bpm 120 --json` | Required WAV and directory; writes slice WAVs, `kit.json` and `slice.song.json`. Defaults: `--sensitivity 0.5`, `--min-gap-ms 50`, `--max-slices 64`, `--bpm 120`. |

Each writer above accepts `--force` when an output already exists. Plugin inserts require explicit opt-in for `render --allow-plugins --plugin-host '<JSON argv>'`. The GPLv3 pedalboard bridge runs separately via `scripts/music2-plugin-bridge.py`. `export stems` and ALS/DAWproject audio modes require the same opt-in for songs with plugin inserts; absent opt-in returns `E_CAPABILITY` (exit 3) with a fix hint. IR, MIDI and MIDI-only export do not run the host. `doctor --json` reports whether plugins are configured; `doctor --plugins --plugin-host '<JSON argv>' --json` probes the host and configured entries. `MUSIC2_PLUGIN_HOST` can provide the host command when an explicit flag is absent. See the [DAW bridge guide](../skills/music2/references/daw-bridge.md).

## JSON and failures

JSON mode writes exactly one JSON object to stdout, including on a failure:

```json
{"ok":true,"command":"version","data":{"version":"0.2.0"},"artifacts":[],"warnings":[],"meta":{"music2":"0.2.0"}}
```

The version values above illustrate the envelope. A failure has `{ "ok": false, "command": "...", "error": { "code": "...", "message": "...", "fix": null, "details": {}, "retryable": false }, "meta": { "music2": "..." }`. Human-mode failures print a message and fix to stderr. `error.details` varies by command; schema errors carry issue paths, and lint QA failures carry a report. A command's own result data may contain warning IDs; the envelope's `warnings` array is separate.

| Exit | Meaning | Error codes |
| --- | --- | --- |
| 0 | Success, including non-strict lint warnings. | — |
| 1 | Unexpected internal failure. | `E_INTERNAL` |
| 2 | Invalid argument, JSON/song/pattern, or missing input/asset. | `E_INPUT`, `E_SCHEMA`, `E_PARSE`, `E_NOT_FOUND` |
| 3 | Missing ffmpeg or unsupported capability. | `E_CAPABILITY`, `E_FFMPEG_MISSING` |
| 4 | File access or critic provider failure. | `E_ACCESS`, `E_PROVIDER` |
| 5 | Audio rendering failure. | `E_RENDER` |
| 6 | Lint QA failure. | `E_QA` |
| 7 | Interrupted operation or timeout. | `E_INTERRUPTED`, `E_TIMEOUT` |

## Environment

| Variable | Effect |
| --- | --- |
| `MUSIC2_JSON=1` | Make JSON mode the default for CLI calls. |
| `MUSIC2_HOME` | Storage home for default outputs; `~/.music2` when unset or empty. `render` without `-o` writes to `renders/`, `analyze` without `--out` to `analysis/<name>/`, and `sfx` without `-o` to `sfx/`. Explicit paths are used as given. `projects/` is the suggested place for a song's source, renders and analysis together. |
| `MUSIC2_FFMPEG` | Explicit ffmpeg executable path. If set to an unusable path, probing does not fall back to `PATH`. |
| `MUSIC2_REQUIRE_FFMPEG=1` | Make `doctor` fail if ffmpeg or required MP3/OGG encoders are unavailable. |
| `MUSIC2_CRITIC_BASE_URL` | Responses API base URL for `critique`; default `http://127.0.0.1:10100`. |
| `MUSIC2_CRITIC_MODEL` | Default critic model; overridable by `--model`. |
| `MUSIC2_CRITIC_API_KEY` | Bearer token for the critic route; default `local` for a local proxy. Do not put a real token in a song or committed file. |

`critique` posts a bounded audio excerpt to the configured route. Other commands do not call that provider. See [song format](song-format.md) for valid source fields and [README](../README.md) for the short workflow.
