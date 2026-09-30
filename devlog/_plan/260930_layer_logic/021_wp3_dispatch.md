# 021 — wp3 stale check and dispatch split

Previous D (wp2): `music2 library` and `user:<id>` shipped in bf8e6fd..6dddb83; real Logic content verified (Lush Bright Pad corrected −24 semitones, verify 0 cents; Deep Tech AIF kit imported). Direction unchanged: layers per 020 with folds B4, B5, B7. Stale check: `mixer.tool.ts`, `select.tool.ts`, `render.schema.ts` unchanged by wp2; `song.schema.ts` gained `user:` validation only.

## Baseline oracle (B7)

Recorded on the pre-layer tree (commit 38e00bc, Bun 1.4.0, darwin arm64) with the fixtures committed in `src/render/layers-baseline.test.ts`: four songs (`sfz` via a `*sine` SFZ, `automation`, `tapestop`, `inserts`), each rendered full and with `bars {1,4}`, `stems:true`; sha256 over the Float32 left+right buffers of the mix and each stem. Digests are the JSON in the test; the test is gated to darwin + pinned Bun like the existing golden.

## Frozen interfaces

`src/song/song-layers.schema.ts`:
```ts
export interface Layer { id: string; instrument: string; transpose?: number; gain?: number; pan?: number; velocity?: number;
  params?: Record<string, number>; fx?: InsertInput[]; only?: string[] }
export interface ResolvedLayer { id: string; instrument: string; transpose: number; gain: number; pan: number; velocity: number;
  params: Record<string, number>; fx: ResolvedInsert[]; only: string[] | null }
export const MAX_LAYERS = 8; export const MAX_LAYER_INSERTS = 6;
export const LAYER_JSON_SCHEMA: Record<string, unknown>; // array schema, items additionalProperties:false
export function validateLayers(track: Track, trackIndex: number): Issue[] /* or throws via the existing issue collector */;
export function resolveLayers(track: Track): ResolvedLayer[] | undefined; // undefined when absent or empty
```
`Track.layers?: Layer[]`, `ResolvedTrack.layers?: ResolvedLayer[]` (omitted when absent or empty so resolved JSON of existing songs is unchanged). Layer id pattern `^[a-z0-9][a-z0-9_-]{0,31}$`, unique in the track, `main` reserved. `transpose` integer −36..36, notes tracks only. `only` drums tracks only, 1..16 names. `velocity` 0..2. Layer `instrument` must suit the track kind exactly as a track instrument would (built-in voice kinds, `kit:`, `sfz:`/`lib:` notes only, `user:`). Params validated against the layer voice; sampled layers reject params. `fx` validated like track inserts (tapestop allowed).

`src/render/render.schema.ts`: `RenderOptions.layerTaps?: (tap: LayerTap) => void`, `export interface LayerTap { trackId: string; source: "main" | "layer"; layerId?: string; audio: StereoBuffer }`.

`src/render/layers.tool.ts`:
```ts
export function hasLayers(track: ResolvedTrack): boolean;
export function layerTrack(track: ResolvedTrack, layer: ResolvedLayer): ResolvedTrack; // {...track, instrument, params, fx: layer.fx, transpose: track.transpose + layer.transpose, layers: undefined, automation: undefined, plugins: undefined, duck: null}
export async function loadLayerInstruments(songPath: string, track: ResolvedTrack, rate: number, budget: DecodeBudget): Promise<(LoadedSampleInstrument | null)[]>;
export function layerEvents(events: VoiceEvent[], track: ResolvedTrack, layer: ResolvedLayer, frames: number): VoiceEvent[]; // midi + layer.transpose (drop out-of-range), velocity*layer.velocity clamped to 1, only filter, stopFrame recomputed from the layer voice release like selectEvents
export function renderLayeredSource(input: { ctx: VoiceContext; mainKit: LoadedSampleInstrument | null; mainParams: Record<string, number> | null; layerKits: (LoadedSampleInstrument | null)[]; startSeconds: number; secondsPerBar: number; bpm: number; cropOffset?: number; taps?: (tap: LayerTap) => void; windowFrames?: number }): StereoBuffer;
```
Main source renders exactly as today (mono voices duplicated to both channels, SFZ stereo). Each layer: render with `layerTrack` context and `layerEvents`, stereo, apply layer inserts, then layer gain (dB) and pan with the `mixStereo` pan law (`PAN_SCALE` cos/sin); sum. Taps receive main and each layer after this stage, cropped to the window when `cropOffset` is set.

## Workers (sol, disjoint write scopes)

| Worker | Writes |
|---|---|
| Y1 schema | `src/song/song-layers.schema.ts`+test, `src/song/song.schema.ts`, `src/song/index.ts`, `src/song/*.test.ts` for layers, `schema/song.v1.json` (regenerate with `bun run schema:json`), `src/render/render.tool.ts` (drum vocabulary for layers), `src/render/fx.tool.ts` or wherever `validateResolvedFx` lives (layer inserts), `src/render/voices/registry.tool.ts` (layer param validation hook if needed) |
| Y2 render | `src/render/layers.tool.ts`+test, `src/render/select.tool.ts` (export per-voice release helper; behaviour identical), `src/render/mixer.tool.ts`, `src/render/render.schema.ts`, `src/render/layers-baseline.test.ts`, `src/render/mixer.test.ts` (only if needed) |
| Y3 lint/export/docs | `src/recipes/lint.tool.ts`, `src/cli/commands/lint.ts`+tests (info severity), `src/project/build.tool.ts` (warning only; ProjectIR keeps main instrument), `src/midi/from-project.tool.ts`, `src/export/**` (layers-flattened warnings), `src/cli/commands/export.ts` if warnings are assembled there, their tests, `docs/song-format.md`, `devlog/str_func/{song,render,recipes,export,midi,project}.md` |

## Reflection fixes (architect: ALIGNED with fixes)

1. **Validation signature.** `export function checkLayers(value: unknown, path: string, kind: "drums" | "notes", issues: { path: string; message: string }[]): void` in `song-layers.schema.ts`; `song.schema.ts` calls it inside its existing collector and maps the pushed issues into its private `Issue` list. `InsertInput`/`ResolvedInsert` are type-only imports from `src/render/fx/fx.schema.ts`; runtime insert validation reuses the same checker track `fx` uses today, so enum and boolean parameters are covered and no new runtime cycle appears.
2. **FX owner.** Y1 owns `src/render/fx/fx-validate.tool.ts`: `validateResolvedFx`, `validateFxFields` and `checkFxOrder` traverse layer inserts (max 6 per layer, same relational rules, also on direct resolved-song calls).
3. **Release helper.** `select.tool.ts` exports `limitStops(events: VoiceEvent[], track: ResolvedTrack, trackIndex: number, frames: number, sampleRate: number): void`, which first resets every `stopFrame` to `frames`, then applies the existing mono rule (layers inherit the parent's `mono`) or the voice release rule for `track`. `selectEvents` calls it (identical results). `layerEvents(events, track, layer, trackIndex, frames, sampleRate)` clones, strips `event.params`, filters (`only`, pitch range), scales velocity, then calls `limitStops` with `layerTrack(track, layer)`.
4. **Params.** `layerTrack(...).params` holds only the layer's explicit params (enhanced-synth selection reads raw `ctx.track.params`); the renderer passes `mergeParams(voice, layer.params)` to `voice.render`. `mainParams` is the merged param set the main voice renders with today.
5. **Transpose policy.** One policy: pitches leaving 0..127 after layer transpose are dropped at render and reported once per layer in `RenderResult.warnings` as `LAYER_NOTES_DROPPED:<track>.<layer>:<count>`. No static rejection (020's static clause is superseded).
6. **Owners.** Y2 also owns `src/render/index.ts` (export `LayerTap`), tests for `limitStops` and taps. Taps fire only for layered tracks; balance uses stems for unlayered tracks. Taps fire before loop-tail folding; `balance` rejects loop songs with E_INPUT. Y1 owns voice/FX validation tests. Y3 extends `tests/e2e/library-flow.test.ts` with a layered `user:` song.
7. **Baselines.** The coordinator commits `src/render/layers-baseline.test.ts` with the recorded digests before dispatch. Export warnings: `buildProject` appends `LAYERS_FLATTENED:<trackId>:<count>` to ProjectIR warnings; ALS/DAWproject already surface ProjectIR warnings and the MIDI projection copies it into its own list.
