# Analyze — Structure & Functions

Song-backed analysis uses `flow.sectionMeans` occurrence LUFS for
`SECTION_LOUDNESS_FLAT`: loudest hook minus quietest verse must reach 1 LU
for trap/drill/boom bap; house/techno use hook-or-groove minus breakdown
with a 3 LU minimum. `loopSeam(pcm)` compares first/last 50 ms for endpoint
jump (>0.1 FS), RMS step (>3 dB), and low/mid/high spectral steps (>6 dB)
with a -60 dBFS floor. A loop warning contains all metrics in `details`.
Both checks require a supplied song. Existing warnings precede these new
warnings, and flow annotations are refreshed before JSON, Markdown, or PNG.
Song-backed loop WAV alignment expects body frames, excluding `tailSeconds`.

Measure audio, estimate musical features, and write deterministic analysis reports and images.

## File Tree

```text
src/analyze/
├── index.ts              # public analysis, estimator, renderer, and type exports
├── analysis.schema.ts    # analysis JSON, beat map, metric, and artifact contracts
├── analyze.tool.ts       # PCM analysis and WAV/song artifact workflow
├── analyze.test.ts       # analysis values, warnings, files, and input validation
├── balance-warnings.tool.ts # genre-aware whole-file six-band balance prompts
├── balance-warnings.test.ts # A1–A4 boundary and silence vectors
├── loop-seam.tool.ts     # pure 50 ms endpoint, RMS, and three-band seam metrics
├── loop-seam.test.ts     # activation, exact boundaries, and silent windows
├── fft.tool.ts           # cached Hann windows and radix-2 spectral transform
├── fft.test.ts           # transform and spectrum vectors
├── tempo.tool.ts         # onset envelopes, BPM candidates, and beat phase
├── tempo.test.ts         # synthetic tempo and half/double-time cases
├── key.tool.ts           # chroma and major/minor profile scoring
├── key.test.ts           # tonal, harmonic, and uncertain-key cases
├── bands.tool.ts         # six spectral energy shares
├── bands.test.ts         # band distribution and invalid input
├── beats.tool.ts         # song-exact or audio-estimated beat map
├── beats.test.ts         # grid, sections, and fallback cases
├── spectrogram.tool.ts   # log-frequency heatmap and optional bar grid
├── spectrogram.test.ts   # PNG dimensions, pixels, and labels
├── pianoroll.tool.ts     # song note bars and drum-onset lanes
├── pianoroll.test.ts     # note, track, and section display
├── report.tool.ts        # human Markdown analysis report
├── report.test.ts        # report sections and fallback text
├── flow/                 # interval loudness, onsets, RGB bands, similarity, annotations
│   ├── flow.schema.ts    # JSON-safe flow rows and internal render data
│   ├── flow.tool.ts      # pure flow orchestration; matching colocated tests
│   ├── intervals.tool.ts # declared bar / reliable beat / 0.5 s axis
│   ├── loudness-curve.tool.ts # ungated interval and section means, 10 Hz curves
│   ├── bands3.tool.ts    # 200/2000 Hz three-band waveform columns
│   ├── features.tool.ts  # onset, chroma, band, and centroid interval features
│   ├── similarity.tool.ts # mean-centered SSM, novelty, repeat ranges
│   └── annotate.tool.ts  # shared verdict and annotation wording
├── overview/             # RGB canvas, panels, and overview PNG renderer
├── png.tool.ts           # dependency-free RGB8 PNG encoder
├── png.test.ts           # PNG chunks, CRC, and dimensions
├── colormap.ts           # fixed 256-entry inferno RGB lookup table
├── colormap.test.ts      # palette endpoints and shape
├── font.tool.ts          # five-by-seven bitmap label drawing
└── font.test.ts          # glyph drawing and clipping
```

## Module Responsibility

`src/analyze` accepts finite in-memory `StereoBuffer` PCM or reads a WAV or
song file through `analyzeFile`. Audio-only estimates derive tempo, key,
spectral balance, amplitude, and loudness from PCM. A supplied song contributes
declared BPM/key, exact timeline sections and beats, track density, bar grid,
and piano-roll data. Song labels do not feed the audio estimators.

The feature owns versioned `analysis.json` and optional `beats.json` data,
human `analysis.md`, `spectrogram.png`, `overview.png`, and optional `pianoroll.png`. The
analysis tool coordinates audio I/O, rendering, estimators, report generation,
and output writes. It does not parse CLI flags or encode MP3/Ogg.

## Key Function Signatures

These signatures come from current implementation declarations. `index.ts`
re-exports the public analysis functions and JSON types. Flow measurement,
tempo-envelope reuse, overview drawing, FFT helpers, report formatting, font
drawing, and colormap are internal to this feature.

| Exported signature | Source | Purpose |
|---|---|---|
| `export function analyzeAudio(pcm: StereoBuffer, opts: { song?: ResolvedSong; timeline?: Timeline; targetLufs?: number; source?: "wav" \| "song" } = {}): AnalysisResult` | `analyze.tool.ts` | Analyze finite PCM and build in-memory report and images. |
| `export function balanceWarnings(bands: readonly BandValue[], genre?: string \| null): AnalysisWarning[]` | `balance-warnings.tool.ts` | Internal A1–A4 whole-file power guides in fixed order. |
| `export async function analyzeFile(inputPath: string, opts: { songPath?: string; outDir?: string } = {}): Promise<AnalysisArtifacts>` | `analyze.tool.ts` | Read or render input and write named artifacts. |
| `export function estimateTempo(pcm: StereoBuffer, meterNumerator = 4): TempoEstimate` | `tempo.tool.ts` | Estimate BPM candidates, beat times, and confidence. |
| `export function onsetEnvelopes(pcm: StereoBuffer): OnsetEnvelopes` | `tempo.tool.ts` | Reusable normalized 100 Hz onset, hats, and low envelopes. |
| `export function estimateTempoFromEnvelopes(pcm: StereoBuffer, envelopes: OnsetEnvelopes, meterNumerator = 4): TempoEstimate` | `tempo.tool.ts` | Reuse one spectral-flux pass without changing tempo ranking. |
| `export function analyzeFlow(pcm: StereoBuffer, ctx: FlowContext): FlowRenderData` | `flow/flow.tool.ts` | Measure time flow with no file I/O. |
| `export function loopSeam(pcm: StereoBuffer): LoopSeamResult` | `loop-seam.tool.ts` | Measure whole-song loop boundary discontinuity without I/O. |
| `export function renderOverview(analysis: AnalysisJson, flow: FlowRenderData, song?: ResolvedSong, timeline?: Timeline): Buffer` | `overview/overview.tool.ts` | Encode the aligned RGB overview. |
| `export function estimateKey(pcm: StereoBuffer): KeyEstimate` | `key.tool.ts` | Estimate chroma and major/minor key candidates. |
| `export function measureBands(pcm: StereoBuffer): BandMetrics` | `bands.tool.ts` | Split spectral power into six named bands. |
| `export function makeBeatMap(tempo: TempoEstimate, durationSeconds: number, song?: ResolvedSong, timeline?: Timeline): BeatMap \| null` | `beats.tool.ts` | Prefer song grid, else use audio beats. |
| `export function renderSpectrogram(pcm: StereoBuffer, timeline?: Timeline): Buffer` | `spectrogram.tool.ts` | Encode a log-frequency PNG heatmap. |
| `export function renderPianoRoll(song: ResolvedSong, timeline: Timeline): Buffer` | `pianoroll.tool.ts` | Encode exact note and drum lanes. |
| `export function encodeRgbPng(width: number, height: number, rgb: Uint8Array): Buffer` | `png.tool.ts` | Encode RGB8 pixels as PNG. |
| `export function hann(size: number): Float64Array` | `fft.tool.ts` | Return a cached periodic Hann window. |
| `export function fftInPlace(re: Float64Array, im: Float64Array): void` | `fft.tool.ts` | Apply forward complex radix-2 FFT. |
| `export function fft(real: Float64Array, imag?: Float64Array): ComplexSpectrum` | `fft.tool.ts` | Copy inputs before transforming. |
| `export function realSpectrum(samples: Float32Array, offset: number, size: number, window?: Float64Array, scratch?: { re: Float64Array; im: Float64Array; out: Float64Array }): Float64Array` | `fft.tool.ts` | Window, zero-pad, and return half-spectrum magnitudes. |
| `export function drawText(rgb: Uint8Array, width: number, height: number, x: number, y: number, label: string, color: readonly [number, number, number]): void` | `font.tool.ts` | Draw clipped bitmap labels. |
| `export function renderAnalysisReport(a: AnalysisJson, beatMap?: BeatMap): string` | `report.tool.ts` | Format a human-readable Markdown report. |
| `export const INFERNO_RGB: readonly number[]` | `colormap.ts` | Fixed heatmap palette. |

`src/analyze/index.ts` also re-exports `measureLoudness` from
`src/audio-io/index.ts`; its exact signature is
`export function measureLoudness(pcm: StereoBuffer): LoudnessMetrics` in
`loudness.tool.ts`.

### Public data types

| Type | Source | Shape and use |
|---|---|---|
| `ComplexSpectrum` | `analysis.schema.ts` | Real and imaginary `Float64Array` outputs. |
| `TempoCandidate`, `TempoEstimate` | `analysis.schema.ts` | BPM, score, relation (`primary`, `half`, `double`, `two_thirds`, `three_halves`), confidence, beats, downbeats. |
| `export function relateToChosen(bpm, chosenBpm, relation)` | `tempo.tool.ts` | Label unrelated peaks at 2:3 or 3:2 of the chosen tempo. |
| `export function declaredTempoMatch(candidates, declared)` | `analyze.tool.ts` | Best candidate within 1.5 BPM of the declared tempo with score ≥ 0.9 (`tempoDeclaredMatch`). |
| `export function bpmHeadline(analysis)` | `overview/panels.top.tool.ts` | Overview BPM text; prefers the declared match and names the audio relation. |
| `KeyCandidate`, `KeyEstimate` | `analysis.schema.ts` | Key scores, nullable winner, confidence, twelve-bin chroma. |
| `BandValue`, `BandMetrics` | `analysis.schema.ts` | Named frequency interval, energy share, relative dB. |
| `BeatSection`, `BeatMap` | `analysis.schema.ts` | Versioned beat/downbeat times, meter, source, sections. |
| `SectionMetrics`, `TrackDensity` | `analysis.schema.ts` | Timeline section levels and per-track event counts. |
| `AnalysisWarning`, `AnalysisJson` | `analysis.schema.ts` | Versioned measurements and typed warning records. |
| `AnalysisResult` | `analysis.schema.ts` | In-memory JSON, Markdown, PNGs, optional beat map. |
| `AnalysisArtifacts` | `analysis.schema.ts` | Written paths and a compact analysis summary. |
| `FlowAnalysis` and serializable row types | `flow/flow.schema.ts` | Bar/beat/frame metrics, section means/deltas, novelty, repeats, verdicts. |
| `LoudnessMetrics` | `audio-io/loudness.schema.ts` | Re-exported integrated LUFS, LRA, and peaks. |

`ANALYSIS_VERSION` and `BEATS_VERSION` are both 1. `BAND_EDGES_HZ` is
`[20, 60, 250, 500, 2000, 8000, 20000]`. The six band names are `sub`,
`low`, `lowMid`, `mid`, `presence`, and `air`.

### Analysis and artifact behavior

- `analyzeAudio` rejects empty, mismatched, or nonfinite PCM, a timeline
  without a song, and nonfinite explicit target LUFS as `E_INPUT`.
- Whole-file peak, clipped-sample count, and RMS use the actual source channel
  count. Loudness and tempo meters resample unsupported rates into 8..192 kHz;
  the JSON retains the original sample rate and source channel count.
- `analysis.json` includes duration and optional tail, sample and true peaks,
  integrated LUFS and LRA, declared and estimated BPM/key, tempo candidates,
  chroma, bands, required flow immediately after bands, sections, tracks, target LUFS, and warnings.
- `flow.sectionMeans` is one ungated K-power mean per timeline placement; WAV-only input has none. Section gated `integratedLufs` keeps its original meaning. JSON carries complete whole-second short-term points at 1 Hz; drawing receives 10 Hz curves and the full numeric SSM separately.
- Section metrics use timeline placements and report RMS and integrated LUFS
  over each placement. Track density counts timeline events by track.
- Warnings cover clipping, LUFS more than 3 LU from target, almost-empty air,
  absent beat map, assumed audio-only meter, uncertain key, then the A1–A4
  balance prompts before song-backed flow warnings. `balanceWarnings(bands, genre)`
  uses whole-file linear-power shares: low-end dominance over 0.92 for trap,
  drill and club genres, 0.85 for boom bap/lo-fi, and 0.55 without a known
  genre; low-mid buildup over 0.25; sub without body above a 0.65 sub ratio
  when total low share exceeds 0.50; and thin highs below 0.02 except lo-fi.
  Silent bands skip all four. Overview verdicts prioritize clipping, LUFS,
  then A1–A4 while preserving serialized warning order.
- `analyzeFile` accepts `.wav` or `.json`. A song JSON input is loaded and
  rendered with `peak` or in-process `lufs` mastering as appropriate.
- `--song` metadata is valid only for WAV input. Its sample rate and full-song
  frame count must match the WAV within one frame; a bar-range render fails.
- The default output directory is `<input-stem>.analysis` beside the input.
  The tool protects the input and optional song from output-path collisions.
- It writes `analysis.json`, `analysis.md`, `spectrogram.png`, and `overview.png`; song metadata
  adds `pianoroll.png`, and a non-null beat map adds `beats.json`.
- Each artifact is first written to a temporary file in the output directory
  and renamed to its final name. Finite JSON numbers are rounded to six
  decimal places. Write failures use `E_ACCESS`.

### Audio estimation

- `fftInPlace` accepts power-of-two sizes from 2 through 32768 and uses an
  unscaled forward transform. `hann` caches periodic windows; callers must
  leave the returned window unmodified. `realSpectrum` zero-pads short frames.
- `estimateTempo` uses 2048-point spectra on 44.1 kHz audio with 441-frame
  hops. It builds onset, hat, and low-frequency envelopes, scores BPM lags in
  50..220, and evaluates phase and half/double-time relationships.
- `analyzeAudio` computes those envelopes once and passes them to both tempo ranking and flow onset counting. Flow uses exact declared bars, reliable measured beats, or 0.5 s WAV frames; song render tail is excluded.
- Tempo results include candidate relations (`primary`, `half`, `double`, and `two_thirds`/`three_halves` relative to the chosen tempo),
  beat/downbeat times, and confidence. No reliable rhythm yields null BPM,
  zero confidence, and empty timing arrays.
- `estimateKey` uses 8192-point frames with 2048-frame hops over tonal
  100..5000 Hz content. Chroma is compared against Krumhansl-Kessler and
  Temperley major/minor profiles. Sparse or uncertain content can yield a
  null key; the top three candidates remain available.
- `measureBands` uses squared, unnormalized Hann-window FFT magnitudes in
  six bands between 20 Hz and the lesser of 20 kHz and Nyquist. Shares sum
  to one when there is in-range energy; silent bands have null relative dB.
- `makeBeatMap` uses exact song BPM, meter, and placement sections when a
  song is supplied. Audio-only maps assume 4/4, reduce tempo confidence,
  filter out-of-range times, and have no sections. Null tempo gives null map.

### Reports and images

- `renderAnalysisReport` lists tempo/key alternatives, LUFS, LRA, peaks,
  band balance, warnings, flow rows and exact annotation strings, optional sections/tracks, and image names.
- `renderOverview` draws 1600×1400 RGB8 for up to 20 section occurrences, adding 50 px (RAIL_ROW) per extra occurrence while retaining panel positions and moving the legend.
- `renderSpectrogram` uses 4096-point FFTs at 1024-frame hops, 512
  log-frequency rows from 30 Hz to Nyquist/20 kHz, and an -80..0 dBFS
  inferno palette. Width is capped at 2400 data columns; an optional
  timeline adds bar lines and labels.
- `renderPianoRoll` uses timed song events, pitch rows, and separate drum
  onset lanes. Monophonic notes extend to the next onset on their track;
  sections, track names, and bar markers use the song timeline.
- `encodeRgbPng` accepts dimensions from 1 to 4096 and exactly three bytes
  per pixel. It writes RGB8 PNG with filter byte zero, zlib compression,
  and checked chunk CRCs. `drawText` clips five-by-seven glyphs at edges.

## Dependencies

| Dependency | Import path | Current use |
|---|---|---|
| Audio I/O | `../audio-io/index.ts`, `../audio-io/buffer.schema.ts` | WAV input, PCM type, and loudness measurement. |
| Song | `../song/index.ts`, `../song/timeline.tool.ts` | Load songs, build timeline, derive exact beats and event density. |
| Render | `../render/index.ts` | Render song JSON input to PCM. |
| Shared | `../shared/index.ts` | Typed errors and deterministic track colors. |
| Node filesystem/path/zlib | `node:fs/promises`, `node:path`, `node:zlib` | Artifact writes, path checks, PNG compression. |
| FFT and schema | `./fft.tool.ts`, `./analysis.schema.ts` | Spectral primitives and versioned result types. |
| Image helpers | `./colormap.ts`, `./font.tool.ts`, `./png.tool.ts` | Heatmap colors, labels, and PNG encoding. |
| Shared K scanner | `../audio-io/kweight.tool.ts` | Continuous power for interval and section means. |

There are no runtime package dependencies. Tests use the Node test runner.

## Dependents

| Module | Import path | Current use |
|---|---|---|
| `src/cli/commands/analyze.ts` | `../../analyze/analyze.tool.ts` | Execute WAV/song analysis and return artifacts. |
| `src/analyze/analyze.test.ts` | `./analyze.tool.ts` | Verify JSON, visuals, warnings, and file workflow. |
| `src/analyze/*.test.ts` | Adjacent `.tool.ts` files | Verify estimators, image helpers, and reports. |
| `src/analyze/flow/*.test.ts` | Adjacent flow tools | Verify half-open grids, LUFS, band filters, features, SSM, wording and deterministic data. |
| `src/analyze/index.ts` | Local tools and schema | Public feature barrel. |

The CLI currently imports `analyzeFile` directly; check actual consumers
before changing the public barrel or artifact shape.

## Sync Checklist

- [ ] Keep `src/analyze/index.ts`, `analysis.schema.ts`, and this signature
  table aligned when public exports or versioned JSON fields change.
- [ ] Update `devlog/str_func/cli.md` when command flags or artifact paths change.
- [ ] Update `devlog/str_func/audio-io.md` when loudness semantics change.
- [ ] Update `devlog/str_func/render.md` when song-input mastering changes.
- [ ] Recheck estimator tests when FFT windows, BPM, key, or band rules change.
- [ ] Recheck PNG, palette, font, and visual tests when image layout changes.
- [ ] Recheck artifact collision, alignment, and error cases in `analyze.test.ts`.
- [ ] Keep `devlog/str_func/AGENTS.md` index aligned with this feature folder.
