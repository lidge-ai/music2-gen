# Render — Structure & Functions

Turn a resolved song and its timeline into deterministic stereo PCM and optional dry stems.

## File Tree

```text
src/render/
├── index.ts                    # public renderSong, VOICES, and type exports
├── render.schema.ts            # render, voice, kit, and CLI result types
├── render.tool.ts              # validation and render entry point
├── render.test.ts              # end-to-end PCM and render validation
├── mixer.tool.ts               # event selection, mixing, effects, mastering
├── mixer.test.ts               # ranges, stems, levels, determinism
├── fx.tool.ts                  # wet effects and duck envelope
├── fx.test.ts                  # effect and envelope vectors
├── kit.tool.ts                 # kit manifest loading and sample playback
├── kit.test.ts                 # kit confinement, decoding, playback
└── voices/
    ├── registry.tool.ts        # voice map, resolution, parameter validation
    ├── registry.test.ts        # instrument and parameter contract
    ├── drums.tool.ts           # eight synthetic drum names, four variants each
    ├── eight-o-eight.tool.ts   # monophonic 808 voice
    ├── bass.tool.ts            # monophonic filtered bass
    ├── bell.tool.ts            # decaying FM bell
    ├── keys.tool.ts            # gated FM keys
    ├── pluck.tool.ts           # seeded plucked-string voice
    ├── pad.tool.ts             # detuned filtered pad
    ├── lead.tool.ts            # vibrato lead
    ├── osc.tool.ts             # PolyBLEP oscillators and per-note TPT lowpass
    ├── supersaw.tool.ts        # seeded unison saw voice
    └── *.test.ts               # one test file per voice
```

## Module Responsibility

FX additions: `fx/index.ts` dispatches in-place stereo insert processors and checks output finiteness after each stage. `fx/fx-validate.tool.ts` checks direct render inputs. `mixer.tool.ts` retains the mono legacy path when a track has no inserts; an inserted track uses a reused stereo scratch buffer before pan, gain, ducking, stems, and sends. Configured buses replace only their corresponding legacy wet return. Master inserts run after wet summing and loop folding, before `masterAudio`.

`src/render` accepts a validated `ResolvedSong` and the song file path.
`renderSong` validates instruments, voice parameters, drum sample names,
MIDI ranges, and the mastering capability before building the timeline.
`mixTracks` selects events for a zero-based half-open bar range, allocates
stereo buffers including the song tail, renders each voice or kit, applies
track gain and pan, sends, ducking, wet effects, and selected mastering.

Each built-in voice renders a track-length mono `Float32Array`. The mixer
converts it to stereo and optionally retains a dry, post-gain/pan/duck stem.
Stems exclude wet sends and master processing. Kits load relative to the song
path; their decoded samples and cache live for one render invocation.

This feature returns PCM and measurements. File output, WAV bit depth,
ffmpeg encoding, optional two-pass loudnorm processing, and CLI envelopes belong to
`src/cli` with `src/audio-io` and `src/probe`.

## Key Function Signatures

These signatures are exported by implementation files. `src/render/index.ts`
re-exports only `renderSong`, `VOICES`, `RenderOptions`, `RenderResult`,
`RenderStem`, and `KitManifest`.

| Exported signature | Source | Purpose |
|---|---|---|
| `export async function renderSong(song: ResolvedSong, songPath: string, options: RenderOptions = {}): Promise<RenderResult>` | `render.tool.ts` | Validate and render a resolved song. |
| `export async function mixTracks(song: ResolvedSong, timeline: Timeline, songPath: string, options: RenderOptions = {}): Promise<RenderResult>` | `mixer.tool.ts` | Select events and create mastered PCM and stems. |
| `export function applyReverb(send: StereoBuffer): StereoBuffer` | `fx.tool.ts` | Return wet-only stereo reverb. |
| `export function applyDelay(send: StereoBuffer, bpm: number): StereoBuffer` | `fx.tool.ts` | Return dotted-eighth cross-channel delay. |
| `export function duckEnvelope(frames: number, onsets: readonly number[], sampleRate: number, amount: number, releaseMs = 180): Float32Array` | `fx.tool.ts` | Build a per-frame gain envelope. |
| `export async function loadKit(songPath: string, instrument: string, sampleRate: number): Promise<LoadedKit>` | `kit.tool.ts` | Read and decode a confined sample kit. |
| `export function renderKit(ctx: VoiceContext, kit: LoadedKit): Float32Array` | `kit.tool.ts` | Sum selected kit samples into mono PCM. |
| `export const VOICES: Readonly<Record<string, VoiceSpec>>` | `voices/registry.tool.ts` | Built-in voice map. |
| `export function resolveVoice(track: ResolvedTrack, index: number): VoiceSpec \| null` | `voices/registry.tool.ts` | Resolve built-in instrument; return null for kit. |
| `export function mergeParams(spec: VoiceSpec, params: Readonly<Record<string, number>>): Record<string, number>` | `voices/registry.tool.ts` | Fill omitted parameters with defaults. |
| `export function validateVoiceParams(song: ResolvedSong): void` | `voices/registry.tool.ts` | Reject unknown, mismatched, or invalid voices and parameters. |
| `export const DRUM_NAMES: readonly string[]` | `voices/drums.tool.ts` | Valid synthetic drum sample names. |

The nine voice declarations are `drumsVoice`, `eightOhEightVoice`,
`bassVoice`, `bellVoice`, `keysVoice`, `pluckVoice`, `padVoice`, and
`leadVoice`, plus `supersawVoice`, each typed `VoiceSpec` and exported from its own `.tool.ts`.
Lead, bass, and pad keep their original sample order when no new parameter is
explicit in `track.params`; `unison` or filter envelope controls select the
PolyBLEP/unison/TPT filter path, as does `detuneCents` for lead and bass.
Each new oscillator uses the event seed addressed by song seed, track ID, and
event index; bass retains continuous phase and filter state across mono notes.
`VoiceSpec.render(ctx: VoiceContext, params: Readonly<Record<string, number>>): Float32Array`
is the voice contract; individual render methods are object members.

### Public data types

| Type | Source | Shape and use |
|---|---|---|
| `RenderOptions` | `render.schema.ts` | Optional `bars`, `stems`, `mastering: "peak" \| "loudnorm" \| "lufs"`. |
| `RenderResult` | `render.schema.ts` | `audio`, `stems`, `bars`, `durationSeconds`, peak fields, `ceilingDb`, `events`, and nullable whole-song `loop` sample points. |
| `RenderStem` | `render.schema.ts` | `trackId` and stereo `audio`. |
| `VoiceEvent` | `render.schema.ts` | MIDI/sample, velocity, frame timing, event index, seed. |
| `VoiceContext` | `render.schema.ts` | Sample rate, frame count, resolved track, selected events. |
| `ParamSpec` | `render.schema.ts` | Default, min, max, optional integer constraint. |
| `VoiceSpec` | `render.schema.ts` | ID, track kind, mono default, parameter specs, render method. |
| `KitManifest` | `render.schema.ts` | Version 1, named sample arrays, optional gain dB/root MIDI. |
| `LoadedKit` | `render.schema.ts` | Manifest, decoded mono variants, sample rate. |
| `RenderData` | `render.schema.ts` | CLI output paths and render measurements, with optional `loopStartSample`/`loopEndSample`; imported directly by CLI. |

The schema also names `DrumsParams`, `EightOhEightParams`, `BassParams`,
`BellParams`, `KeysParams`, `PluckParams`, `PadParams`, and `LeadParams`.
These interfaces describe each voice's parameter names; the registry's
`ParamSpec` values enforce defaults and bounds at runtime.

### Voice parameter table

All ranges are inclusive. A value marked `int` must be an integer.
The table records `default [min,max]` from the voice declarations.

| Voice | Kind; mono default | Parameters: default [min,max] |
|---|---|---|
| `drums` | drums; false | `tone` 0.5 [0,1]; `decayMs` 180 [20,1000]; `noise` 0.5 [0,1] |
| `808` | notes; true | `drive` 2.2 [1,8]; `decayMs` 1100 [100,5000]; `attackMs` 3 [0,50] |
| `bass` | notes; true | `wave` 0 [0,1] int; `cutoffHz` 600 [40,8000]; `resonance` 0.15 [0,0.9]; `releaseMs` 80 [5,1000] |
| `bell` | notes; false | `ratio` 3.5 [1,12]; `index` 2.2 [0,10]; `decayMs` 450 [50,5000] |
| `keys` | notes; false | `ratio` 2 [1,8]; `index` 1.4 [0,8]; `attackMs` 8 [0,200]; `releaseMs` 220 [20,2000] |
| `pluck` | notes; false | `damping` 0.992 [0.8,0.9999]; `decayMs` 900 [50,5000]; `brightness` 0.7 [0,1] |
| `pad` | notes; false | `detuneCents` 11 [0,50]; `cutoffHz` 1800 [80,12000]; `attackMs` 400 [10,5000]; `releaseMs` 700 [20,5000] |
| `lead` | notes; false | `wave` 1 [0,1] int; `vibratoHz` 5 [0,12]; `vibratoCents` 12 [0,100]; `releaseMs` 120 [5,2000] |

For `drums`, allowed sample names are `bd`, `sd`, `cp`, `hh`, `oh`,
`rim`, `perc`, and `tom`; each has four stable numbered presets.
`bass` and `808` require `mono: true`, including when a song explicitly
overrides the voice's mono default.

### Render and mixing behavior

- When mastering is omitted, `master.targetLufs` selects in-process `lufs`;
  otherwise the default is `peak`. The CLI explicitly selects `loudnorm`
  only for `--loudnorm`.
- It validates every timeline event's drum name and MIDI value before
  audio allocation and mixing.
- `mixTracks` requires `0 <= start < end <= timeline.bars`; an invalid
  requested range raises `E_INPUT`.
- Normal frame count is `ceil((selected bars * secondsPerBar + tailSeconds) *
  sampleRate)`; an unsafe or overlarge RIFF allocation raises `E_RENDER`.
- For `song.loop`, the whole song is one body: after wet FX, tail frames wrap
  modulo the body length into its start before mastering. Master PCM and dry
  stems end at `ceil(timeline.durationSeconds * sampleRate)` frames. `RenderResult.loop`
  is `{startSample:0,endSample:bodyFrames}`; non-loop renders return `null`.
  CLI JSON adds `loopStartSample` and `loopEndSample` for loop songs. `--bars`
  on a loop is `E_INPUT`.
- Event indices count all events per track before bar filtering. Seeds use
  `fnv1a32(song.seed, track.id, eventIndex)` for stable addressed noise.
- Monophonic events stop at the next onset. Other note voices use bounded
  release tails, clipped to the allocated frame count.
- Kits use `kit:<path>` relative to the song directory. Manifest and
  samples are checked against the kit directory, including symlink targets.
- Kit samples are read as WAV, folded to mono, resampled when needed,
  and cached by canonical path and output sample rate per load.
- Track gain uses dB conversion; pan uses equal-power trigonometric gains.
  Ducking applies at the dry track before sends and stem capture.
- Reverb and delay are wet-only sends. Reverb uses comb and all-pass stages;
  delay alternates channels at a dotted-eighth interval with feedback.
- `lufs` measures pre-master PCM with `measureLoudness`, adds the difference
  from `master.targetLufs` to master gain, and uses a milder soft-saturation
  normalization without peak scaling. Silence or a null target adds no LUFS gain.
- Other modes apply gain, soft saturation, and peak scaling. All modes then
  use lookahead limiting, clipping, and an eight-times interpolated true-peak check.
- Silence reports `-Infinity` for PCM peak fields. The CLI turns these
  values into JSON `null` when constructing `RenderData`.

### Validation and errors

| Code | Source condition | CLI exit |
|---|---|---|
| `E_SCHEMA` | Invalid voice, kind, mono setting, parameter, MIDI/drum name, or kit manifest/sample decode. | 2 |
| `E_INPUT` | Invalid requested bar range. | 2 |
| `E_ACCESS` | Kit path, manifest, or sample cannot be accessed or escapes the kit root. | 4 |
| `E_RENDER` | Invalid signal, effect input, frame count, or master peak ceiling. | 5 |

## Dependencies

| Dependency | Import path | Current use |
|---|---|---|
| Song boundary | `../song/index.ts` / `../../song/index.ts` | Resolved types and timeline builder. |
| Audio I/O | `../audio-io/index.ts` | Stereo allocation/peaks, LUFS measurement, and kit WAV read/resampling. |
| Shared | `../shared/index.ts` / `../../shared/index.ts` | Typed errors and addressed PRNG/hash. |
| Node filesystem/path | `node:fs/promises`, `node:path` | Kit manifest/sample access and confinement. |
| Render schema | `./render.schema.ts` / `../render.schema.ts` | Options, results, voice and kit contracts. |
| Voice registry | `./voices/registry.tool.ts` | Resolution and parameter validation. |
| Mixer, effects, kit | `./mixer.tool.ts`, `./fx.tool.ts`, `./kit.tool.ts` | Render pipeline. |

There are no runtime package dependencies. Tests use the Node test runner.

## Dependents

| Module | Import path | Current use |
|---|---|---|
| `src/cli/commands/render.ts` | `../../render/index.ts`, `../../render/render.schema.ts` | Render PCM, consume CLI `RenderData` type. |
| `src/index.ts` | `./render/index.ts` | Re-export public render entry, voice map, and types. |
| `src/render/render.test.ts` | `./render.tool.ts` | Validate end-to-end render behavior. |
| `src/render/mixer.test.ts` | `./mixer.tool.ts` | Exercise mixing and mastering. |
| `src/render/kit.test.ts` | `./kit.tool.ts` | Exercise kit loading and playback. |
| `src/render/fx.test.ts` | `./fx.tool.ts` | Exercise effects. |
| `src/render/voices/*.test.ts` | Adjacent voice `.tool.ts` files | Exercise each voice and registry. |

## Sync Checklist

- [ ] Update this document when render exports, PCM semantics, voices, or
  parameter bounds change.
- [ ] Keep `src/render/index.ts` and `src/index.ts` public exports aligned.
- [ ] Keep voice registry IDs, track kinds, defaults, and validation aligned
  with song resolution and tests.
- [ ] Update `devlog/str_func/cli.md` when `RenderData` or render options change.
- [ ] Update kit tests when manifest or path-confinement behavior changes.
- [ ] Recheck mixer vectors, dry stems, and true-peak ceiling after DSP changes.
- [ ] Recheck `lufs` target behavior and `devlog/str_func/audio-io.md` when loudness measurement changes.
- [ ] Update `devlog/str_func/AGENTS.md` index when adding or moving this document.
