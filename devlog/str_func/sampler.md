# Sampler — Structure & Functions

Sampler owns WAV-backed SFZ playback, clip source rendering, deterministic rate and time conversion, onset detection and slice materialization. The contract is specified in `devlog/_plan/260928_music2_daw_bridge/040_sampler.md`.

## File Tree

```text
src/sampler/
├── index.ts                # public feature boundary
├── sfz.schema.ts           # SFZ regions, events, warnings and loaded types
├── sfz-parse.tool.ts       # confined SFZ text and include parser
├── sfz-region.tool.ts      # deterministic region selection
├── sfz-render.tool.ts      # WAV loading, sample playback and envelopes
├── resample.tool.ts        # ratio-addressed sinc/Hermite/linear resampling
├── fft.tool.ts             # fixed radix-2 FFT and Hann window
├── stretch.tool.ts         # WSOLA and phase-vocoder time stretch
├── onsets.tool.ts          # spectral-flux onset detection
├── slice.tool.ts           # contiguous slices and fade-out
├── clips.tool.ts           # confined WAV cache, absolute clip rendering and crop
└── *.test.ts               # adjacent numerical and boundary oracles
```

## Module Responsibility

SFZ parsing captures region controls in source order and resolves includes under the main SFZ root. Its renderer caches decoded WAVs for one invocation and produces stereo PCM. The clip loader confines each song-relative WAV and caps total decoded stereo PCM at 512 MiB. `renderClips` converts tick placement with `ticksToSeconds`, renders the clip from its absolute onset, applies pitch, fades and gain, then copies only the requested output window. `none` and `varispeed` use rate-addressed resampling; `tempo` and `fit` stretch before pitch. Long tonal regions select phase vocoder; other regions use WSOLA. Slice helpers preserve source sample boundaries and add a 10 ms cosine fade-out by default.

## Key Function Signatures

| Export | Signature | Role |
|---|---|---|
| `parseSfz` | `(path: string, root: string): Promise<SfzInstrument>` | Parse confined SFZ and diagnostics. |
| `loadSfz`, `renderSfz` | `(songPath, ref, sampleRate): Promise<LoadedSfz>`; `(events, loaded, sampleRate, frames): StereoBuffer` | Decode and play SFZ. |
| `resample` | `(src: StereoBuffer, ratio: number, opts?: ResampleOptions): StereoBuffer` | Sample-rate and pitch conversion. |
| `timeStretch` | `(src: StereoBuffer, alpha: number, opts?: StretchOptions): StereoBuffer` | Duration conversion while preserving pitch. |
| `detectOnsets` | `(audio: StereoBuffer, opts?: OnsetOptions): number[]` | Sample-index onset candidates. |
| `sliceTransients`, `sliceRegions` | `(audio, opts?): AudioSlice[]`; `(audio, count, opts?): AudioSlice[]` | Transient and equal-region slices. |
| `loadClipSources` | `(songPath: string, clips: readonly ResolvedClip[]): Promise<ReadonlyMap<string, StereoBuffer>>` | Decode/cache song-confined WAVs. |
| `renderClips` | `(track: ResolvedAudioTrack, sources: ReadonlyMap<string, StereoBuffer>, window: {sampleRate; bpm; startFrame; frames}): StereoBuffer` | Render a lane into an absolute crop window. |

## Dependencies

Sampler imports public/shared time, errors and path confinement, Song resolved clip types, and audio-io WAV/stereo types. Sibling sampler tools import each other directly. It does not import `render`, `analyze`, `project`, `export`, `midi`, or CLI. Cache state belongs to a single loader call; no clock or ambient random state enters audio logic.

## Dependents

Render's sample-instrument and audio-track adapters consume SFZ and clip outputs. `music2 slice` consumes the public slice, resample and WAV functions and creates a kit and Song v1. Exporters may consume source references through Song or ProjectIR without importing sampler internals.

## Sync Checklist

- [ ] Keep `index.ts` exports and the signatures above aligned.
- [ ] Recheck source confinement, 512 MiB decode limit and invocation-local cache when loaders change.
- [ ] Recheck clip duration, source offset, fade endpoints and full-versus-crop equality when Song fields change.
- [ ] Preserve 120/150 BPM, pitch, onset, sample-boundary and byte-determinism oracles.
- [ ] Keep sampler free of render/analyze/project/export/midi/CLI imports and nondeterministic APIs.
