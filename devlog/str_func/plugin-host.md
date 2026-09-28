# Plugin host boundary

`src/plugin-host/index.ts` exposes the optional external effect bridge. Song files carry only logical effect IDs and bounded parameter values. A caller must explicitly opt in and supply an external processor to rendering; the render, export and doctor integrations belong to the parent lane. This module does not import render or CLI code.

## Public functions and types

- `loadPluginConfig(home?)` reads `${music2Home()}/plugins.json`. A missing file yields `{version:1,plugins:{}}`; an existing malformed or unreadable file raises `E_INPUT` or `E_ACCESS`. The file has a 64 KiB limit and duplicate JSON keys are rejected.
- `parseHostArgv(text)` accepts one JSON array of 1–16 strings, beginning with an absolute executable path. The process command is selected from explicit override, `MUSIC2_PLUGIN_HOST`, then per-ID config. Shell strings, PATH lookup, `-c` and `-m` are rejected.
- `createExternalProcessor(config, override?)` returns a structural `ExternalProcessor`. `process(trackId, plugins, audio, context)` runs each effect in array order in a separate subprocess. Unknown IDs or missing commands raise `E_CAPABILITY`.
- `probePluginHost(argv, timeoutMs?)` sends `op:"probe"` using the same bounded subprocess contract, capped at 20 seconds. `probeConfiguredPlugins` caches repeated argv only within its call. A pedalboard probe requires version 0.7.6 or newer; a custom host reports `audioEffect:true` and `hostVersion`.
- `PluginRequest`, `PluginResponse`, `PluginConfig`, `PluginUse` and validators in `contract.schema.ts` define the exact version 1 wire format. Every response level uses an allowlist. Parameter keys are sorted before serialization.

## Wire and audio

One UTF-8 JSON object goes to stdin; one JSON object comes from stdout. Stderr is retained only as a bounded 2 KiB diagnostic tail and is never copied into public errors. JSON request and response each cap at 64 KiB. `runPluginHost` uses argument arrays with `shell:false` and a small inherited environment; processor and probe calls supply a private working directory. Timeout and abort terminate the process group. The bridge creates a private OS temp directory per stage and removes it in `finally`.

`encodePluginWav` writes a 58-byte RIFF/IEEE float32 stereo header (`fmt ` size 18, `fact` size 4) and interleaved samples. `decodePluginWav` walks chunks, including odd padding, and requires exact rate, frames, channels, float32 format and fact count. Output must be a regular `out.wav` in that temp directory with the same inode seen before and after open; symlinks and unexpected response paths are rejected. Samples must be finite with magnitude at most 64. The decoder signals headroom above 1 through `ExternalProcessor.warnings` as `PLUGIN_HEADROOM_EXCEEDED`. A stage's output replaces only that track's pre-fader buffer; plugin audio is outside byte-determinism claims.

Errors map to `E_CAPABILITY` for missing host/library/ID, `E_INPUT` for bad config or argv, `E_ACCESS` for inaccessible user paths, `E_RENDER` for bad host/output, and `E_TIMEOUT` for watchdog expiry. No plugin binary, host command or temp path belongs in a song or public artifact.

## Optional host and verification

`scripts/music2-plugin-bridge.py` is a separately installed, MIT-header Python program. It imports pedalboard only when executed; music2 core has no pedalboard dependency or bundled wheel. Redistributors of a Python environment containing pedalboard must review its GPLv3 obligations. The script implements `probe`, `render` and a built-in Gain self-test using JSON and standard float WAV bytes.

Colocated contract, host and detection tests use `tests/fixtures/plugin-host/stub-host.mjs` for deterministic gain, probe and failure vectors. The fixture requires only Node. The user has forbidden local test execution in this lane; hosted CI owns test execution. Before integration, keep these exports, the song schema, render injection, CLI flags and doctor results in sync with `devlog/_plan/260928_music2_daw_bridge/080_plugin_bridge.md` and update the feature index in `devlog/str_func/AGENTS.md` from the parent lane.
