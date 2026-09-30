# 020 — wp3: `track.layers[]`

## Outcome

One track drives several sounds: `{"id":"bass","kind":"notes","instrument":"bass","pattern":"...","layers":[{"id":"sub","instrument":"lead","transpose":-12,"gain":-4,"params":{"wave":2}},{"id":"growl","instrument":"supersaw","transpose":12,"gain":-10,"fx":[{"type":"drive","amount":3}]}]}`. Drums: `{"id":"kick","kind":"drums","instrument":"user:dsx-kit","pattern":"bd*4","layers":[{"id":"sub","instrument":"drums","only":["bd"],"params":{"kit":1},"gain":-6}]}`. Songs without `layers` render byte-identically.

## Contract

`Layer = { id: string /* ^[a-z0-9][a-z0-9_-]{0,31}$, unique in track */, instrument: string, transpose?: integer -36..36 (notes only), gain?: number -60..12 (default 0, relative to the track), pan?: -1..1 (default 0), velocity?: 0..2 (default 1, multiplies event velocity, clamped to 1), params?: Record<string, number>, fx?: Insert[] (max 6), only?: string[] (drums only, 1..16 atom names) }`; `track.layers` max 8; empty array is allowed and equals no layers.

Semantics: the track's own `instrument` is the main sound. Each layer renders the same selected events (same timing, gate, event seeds) with its own voice or sampled instrument, its own release tail limit, pitch `midi + layer.transpose` (reject events leaving 0..127 with `E_SCHEMA` at validation when static, drop and warn otherwise), velocity scaling and `only` filtering. The layer's inserts run on the layer, then layer gain and pan (same pan law as `mixStereo`), then all sources sum into one stereo buffer that enters the unchanged track path: track inserts, plugins, fader gain/pan or gain automation, duck, sends, one stem. Track parameter automation applies to the main voice only.

## Diff-level contract

NEW `src/song/song-layers.schema.ts`: `Layer`, `ResolvedLayer`, JSON schema fragment `LAYER_JSON_SCHEMA`, `validateLayers(track, path)` (kind checks, id uniqueness, transpose/only rules, per-layer voice params via registry, FX validation reuse), `resolveLayers`.
MOD `src/song/song.schema.ts`: `layers?` on Track and ResolvedTrack; schema property; call `validateLayers`; keep file ≤ 400 lines by moving code out if needed.
MOD `src/song/index.ts`: exports.
NEW `src/render/layers.tool.ts` (+ test): `hasLayers(track)`, `loadLayerInstruments(songPath, track, rate, budget)`, `renderLayeredSource(ctx, main, layers, options): StereoBuffer`, `layerEvents(events, layer, voice)` with per-voice release limits (reuse the helper behind `selectEvents`), and the `layerTaps` callback defined in B5.
MOD `src/render/select.tool.ts`: expose the release-limit helper per voice.
MOD `src/render/mixer.tool.ts`: load layer instruments beside `kits`; in automation, tape pre-roll and static paths, when `hasLayers(track)` use `renderLayeredSource` as the stereo source (static path joins the SFZ stereo branch); pre-roll detection includes layer `tapestop`; `RenderOptions.layerTaps?` passes through. No change when layers are absent.
MOD `src/render/render.tool.ts` drum vocabulary validation: validate filtered atoms against each layer instrument.
MOD `src/render/fx.tool.ts` / `validateResolvedFx`: include layer inserts.
MOD `src/project/build.tool.ts`, `src/midi/from-project.tool.ts`, ALS/DAWproject planners: export the main instrument; add warning `layers flattened on <track>: <n> layer(s) omitted from editable notes`; frozen audio exports keep the summed sound.
MOD `src/recipes/lint.tool.ts`, `src/cli/commands/lint.ts`: `info` severity (sorted after warnings, counted as `infos`, never fails `--strict`). Lint roles keep using the main instrument; layers do not create extra role tracks.
MOD `schema/song.v1.json` via `bun run schema:json`; `docs/song-format.md`; `devlog/str_func/{song,render,recipes,export}.md`.

## Tests

Byte identity: existing golden digest untouched; a no-layers song and the same song with `"layers": []` render identical PCM; same-platform comparison over static mono, static SFZ, automation and tape-stop paths. Layer render: a layer at gain -inf-ish (−60) vs none differs by < −54 dB; two identical layers sum +6 dB; transpose shifts pitch (measure with library pitch helper or FFT peak); `only` filters atoms; release of a long-release layer is not cut by a short main voice; seeded repeatability; crop/pre-roll equivalence with a layer tapestop; one stem per track. Validation: bad id, duplicate id, drum transpose, notes-only field on drums, unknown atom in `only`, params rejected for sampled layers, max counts. Lint: info does not fail strict. Export: MIDI warns and keeps main notes.


## Audit fold (A round 1)

- **B4 example values.** The outcome example uses valid values: sub layer `{"id":"sub","instrument":"lead","transpose":-12,"gain":-4,"params":{"wave":2}}`, growl `{"id":"growl","instrument":"supersaw","transpose":12,"gain":-10,"fx":[{"type":"drive","amount":3},{"type":"filter","mode":"highpass","cutoffHz":300}]}`. Every published example is validated by a test.
- **B5 taps.** `RenderOptions.layerTaps?: (tap: { trackId: string; source: "main" | "layer"; layerId?: string; audio: StereoBuffer }) => void`. Taps fire after each source's layer inserts, layer gain and pan, before track inserts; the buffer is in the render window's frame origin (pre-roll paths crop to the window before tapping). Layer id `main` is reserved and rejected. Reported ids are `<track>` (post-fader stem), `<track>.main` and `<track>.<layer>`.
- **B7 oracles.** Before touching the mixer, B records immutable baselines on the unchanged code: SHA-256 of rendered PCM and stems for four fixture songs (static SFZ via a generated sine SFZ, automation lanes, tape-stop with `--bars` crop, static mono synth with inserts), stored in `src/render/layers-baseline.test.ts` and gated to darwin + pinned Bun like the existing golden. The +6 dB summing test reads pre-master stems (`stems:true`) so peak normalisation cannot hide amplitude errors.
