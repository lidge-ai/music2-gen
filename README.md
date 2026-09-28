# music2

music2 is a source-first music CLI for coding agents. An agent can compose in a JSON song file without a browser, render deterministic audio offline, and revise it using text measurements, images, or optional audio-model feedback. Songs and mini-notation remain readable and editable source.

Requires Node.js 22.18 or newer. The runtime has no npm dependencies, bundled samples, or required network service. WAV rendering and analysis work without ffmpeg; MP3, OGG, and ffmpeg loudness mastering use an optional local ffmpeg installation.

## 60-second quick start

From a fresh clone, run this sequence. `/tmp` paths are illustrative outputs; the heading describes the number of steps, not a render-time guarantee.

```sh
npm ci
node bin/music2.js recipes drill_uk --json
node bin/music2.js new --genre drill_uk -o /tmp/music2-demo.song.json --json
node bin/music2.js validate /tmp/music2-demo.song.json --json
node bin/music2.js render examples/drill-140.song.json -o /tmp/music2-drill.wav --json
node bin/music2.js analyze /tmp/music2-drill.wav --song examples/drill-140.song.json --out /tmp/music2-analysis --json
```

Open `/tmp/music2-analysis/analysis.md` or `analysis.json` for a text-only agent. A vision-capable agent can inspect `overview.png` for labeled section order, boundary bars, loudness flow, density, and warnings, then `spectrogram.png` and the song-backed `pianoroll.png`. The directory also contains `beats.json` with the declared song grid. An audio-capable model can use `critique` through a configured Responses route and should trust its comments only when `review.heard_audio` is true. The critic cannot reliably hear sub-bass; check the low-end measurements and listen separately if that matters. Text and image outputs are measurements and views, not proof of hearing.

The [composition skill](skills/music2/SKILL.md) gives agents a full edit-and-check workflow. `node bin/music2.js skill path` prints the installed skill directory when the skill is shipped with this copy.

## Commands

Use `node bin/music2.js <command>`; add `--json` to get one machine-readable object.

| Command | Purpose |
| --- | --- |
| `help [command]`, `version`, `schema` | Inspect usage, version, or Song v1 JSON Schema. |
| `recipes [id]`, `new --genre id` | Inspect a genre card or make an editable starter song; choose `--arrangement id` or `--use preset` for a structure or destination preset. |
| `validate song.json`, `events song.json`, `lint song.json` | Check schema and timing, inspect timed events, or apply genre/static rules. |
| `render song.json`, `analyze audio.wav` | Produce WAV and optional encoded copies; measure audio and write reports, an overview, and PNG views. |
| `doctor`, `critique audio.wav` | Check ffmpeg; optionally request an audio-model review. |
| `sfx --preset name [-o out.wav]` | Generate a standalone sound effect (transition or game/UI) with a reproducible JSON sidecar. |
| `skill path` | Print the packaged composition skill directory. |

Outputs without an explicit path are stored under `~/.music2` (override with `MUSIC2_HOME`): `render` writes `renders/<song>.wav`, `analyze` writes `analysis/<name>/`, and `sfx` writes `sfx/<preset>-<seed>.wav`. Keep a song's source, renders and analysis together in `~/.music2/projects/<name>/`. `music2 doctor --json` reports the active home.

See [CLI reference](docs/cli.md) for flags, outputs, errors, and environment variables.

## Song source and examples

Song v1 has a BPM, tracks with one-bar mini-notation patterns, sections that may override or mute tracks, and an arrangement that orders and repeats sections. A numeric seed controls generated choices. See the [field reference](docs/song-format.md) and [JSON Schema](schema/song.v1.json).

Start with [drill at 140 BPM](examples/drill-140.song.json), or generate a starter with `new`. The example set also includes `trap-150.song.json`, `boom-bap-90.song.json`, `lofi-75.song.json`, and `house-124.song.json` under `examples/`, plus `pop-transition`, `lofi-textures`, `cinematic-cue`, and `game-spark-loop`, which show the virtual instruments (piano, electric piano, strings, brass, choir, mallets), drum-kit characters, and transition effects.

Given the same song, seed, Node major version, and platform, music2 promises byte-identical WAV output. Keep those conditions fixed when comparing renders. Audio key estimation is advisory, especially when `KEY_UNCERTAIN` appears: the declared key and `generic/out_of_key` lint result are the reliable pitch checks. Tempo analysis reports half-time and double-time alternatives. `generic/clipping_risk` is a static onset proxy and does not account for master normalization; verify clipping on the rendered WAV.

Layering checks flag source arrangement risks in strict lint and genre-aware band-balance warnings in song-backed analysis; use the [layering guide](skills/music2/references/layering.md) to inspect and revise the rendered mix.

## DAW bridge

Song v1 can carry absolute note lists, SFZ instruments, audio clips and automation. Start with [notes and automation](examples/daw-notes-automation.song.json). The [SFZ and clip example](examples/daw-bridge/audio-sfz.song.json) is a template: `node examples/daw-bridge/make-fixtures.mjs /tmp/music2-daw-example` creates tiny deterministic WAVs and a renderable song copy. No sample audio is bundled.

Use `export midi` for editable notes, `export stems` for aligned sound, `export als` for an **experimental** Ableton Live 12 set, or `export dawproject` for notes and/or frozen audio. MIDI cannot preserve music2's instrument sound or every effect; frozen audio is not editable notes. `import midi` converts a MIDI file to Song v1 note lists; `slice` turns a WAV into a playable kit. See the [DAW choice and loss guide](skills/music2/references/daw-bridge.md), [CLI flags](docs/cli.md) and [Song fields](docs/song-format.md). A generated ALS still needs a manual Live-open check.

## Development and license

Run `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`, and `npm run audit:structure` after source changes. Contributions should follow [repository agent rules](AGENTS.md) and the existing `devlog/` plans.

music2 is MIT licensed. Its mini-notation parser is a clean-room subset implemented from public documentation and conformance work; no AGPL source is copied. Voices, drum kits and sound effects are synthesized approximations; the package includes no audio samples. User-supplied kits remain the user's licensing responsibility.
