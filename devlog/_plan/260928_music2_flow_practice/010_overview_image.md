# 010 — Flow metrics and one-page overview image

`music2 analyze` will measure the progression of loudness, onset activity, brightness, three-band waveform energy, novelty, and repeated passages, then write `overview.png` for song and WAV inputs. The image combines aligned time panels with a readable section rail and an SSM inset; `analysis.json` keeps a compact `flow` object and `analysis.md` prints the same findings. Measurement stays in `src/analyze/flow/`, drawing in `src/analyze/overview/`, and only `analyzeFile` writes artifacts. The contracts and thresholds below implement the binding F1–F9 dispositions in `004_architecture.md`, with formulas from `002_flow_metrics.md` and text-first presentation from `003_overview_layout_eval.md`.

Depends on: 030 analysis and visuals, `002_flow_metrics.md`, `003_overview_layout_eval.md`, `004_architecture.md`, `evidence/architect-proposal.md`.
Consumed by: 030 image-only evaluation, `analyze` CLI users, text-only readers of `analysis.md`, and downstream consumers of additive `AnalysisJson.flow`.

## Scope

IN: deterministic flow measurements; 1600×1400 RGB PNG for up to 20 section occurrences; additive JSON, Markdown, public types, CLI artifact path, colocation tests, and existing loudness/tempo preservation. OUT: source separation, note transcription, automatic meter claims for WAV, stochastic color or annotation selection, new dependencies, browser rendering, and an asserted VLM success rate before 030 evaluates it.

All intervals are half-open in sample space, `[round(startSeconds*rate), round(endSeconds*rate))`, clamped to PCM length. Song analysis ends at `timeline.durationSeconds`, excluding render tail; WAV-only ends at PCM duration. Numeric JSON is rounded only by the existing `roundedJson` edge, never inside DSP; silence becomes `null` LUFS/centroid, never `NaN`, `Infinity`, or `-Infinity`. Fixed traversal order and tie breaks preserve byte identity under one Node major and platform.

## File map

The `Op` column describes implementation work planned by this unit, not edits made by this document. Every new `*.tool.ts` has a colocated test row with a concrete oracle.

| Path | Op | Exact content |
| --- | --- | --- |
| `src/audio-io/kweight.tool.ts` | NEW | `export function kWeightedPower(pcm: StereoBuffer, visit?: (frame: number, power: number) => void): Float64Array`. Move the coefficient formulas and two biquad filter stages from `loudness.tool.ts:5-54` unchanged. Scan left then right per sample, visit summed channel power, and return 100 ms block sums (`blockSize=round(0.1*sampleRate)`, final partial block retained); no full-length power array. The visitor lets the meter build its original per-sample prefix and flow accumulate exact interval sums in scan order. |
| `src/audio-io/kweight.test.ts` | NEW | 44.1/48 kHz mono and stereo 997 Hz at amplitude 0.1: 100 ms block length is 4410/4800; two identical channels give 2× power; visited sum equals block sum within `1e-9` relative. Silence yields zero blocks; invalid/nonfinite PCM gives `E_INPUT`. |
| `src/audio-io/loudness.tool.ts` | MODIFY | At `:5-54`, import the shared scan and remove duplicate K filter implementation. At `:135-170`, use `kWeightedPower(pcm, visit)` to fill the existing prefix at the same frame indexes and update sample peak; preserve `blockPowers` (:61-69), gated summation (:71-98), true peak (:100-133), and output shape. Do not replace the prefix-difference arithmetic with rounded block sums: `loudness.test.ts` existing outputs must stay identical. |
| `src/audio-io/index.ts` | MODIFY | At `:5`, export `kWeightedPower` beside `measureLoudness`; keep existing exports and order. |
| `src/analyze/flow/flow.schema.ts` | NEW | Own all `Flow*` interfaces below. `FlowAnalysis` is JSON-safe; `FlowRenderData` owns 1200 waveform columns, full `Float32Array(N*N)` SSM, 10 Hz curves and novelty samples. No typed array reaches `analysis.json`. |
| `src/analyze/flow/intervals.tool.ts` | NEW | `export function flowIntervals(durationSeconds: number, beatMap?: BeatMap, timeline?: Timeline): FlowIntervalGrid`. Song: `timeline.bars` exact bar intervals via `secondsPerBar`; WAV: consecutive `beatMap.beatsSeconds` intervals only if `source==='audio'`, confidence ≥0.6 and at least four usable, strictly increasing beats; otherwise consecutive 0.5 s frames with a short final frame. Axis names are `bars`, `beats`, `0.5 s`; uncovered margins of a beat grid are shown as unmeasured, never relabeled as bars. |
| `src/analyze/flow/intervals.test.ts` | NEW | 16-bar 140 BPM timeline yields 16 intervals and end `16*4*60/140`; WAV beats `[0,.5,1,1.5]` at confidence .6 choose beats; confidence .59, three beats, duplicate beats, or null map choose `[0,.5),[.5,1),[1,1.2)` for a 1.2 s clip. A 0.3 s clip gives one frame. |
| `src/analyze/flow/loudness-curve.tool.ts` | NEW | `export function flowLoudness(pcm: StereoBuffer, grid: FlowIntervalGrid, timeline?: Timeline): FlowLoudnessData`. Run shared K scan once; aggregate exact interval and placement sample sums. Convert positive mean power with `-0.691+10*log10(power)`; null for zero. 100 ms blocks form trailing ungated 4-block momentary and 30-block short-term windows at 10 Hz, null until complete. Use absolute sample positions for exact section means and `next−previous` LU; JSON short-term points only at complete integer-second timestamps (1 Hz), render data keeps both 10 Hz curves. Section mean is ungated and distinct from `SectionMetrics.integratedLufs`; emit one `sectionMeans` row per timeline placement in placement order (`id` = `${section}#${occurrence}`, one-based `startBar`, seconds, `meanLufs`), empty for WAV-only input. wp3 `SECTION_LOUDNESS_FLAT` reads these rows, never adjacent deltas. |
| `src/analyze/flow/loudness-curve.test.ts` | NEW | Settled mono 997 Hz sine at amplitudes .1/.2 reads about −23.01/−16.99 LUFS, adjacent delta +6.02±.1 LU. 0.3 s has no 400 ms value; 2.9 s has no 3 s value; 3.0 s first short-term sample. All-zero PCM gives nulls; a two-level 3 s window averages powers, not dB values. A verse(.1)/build(.2)/hook(.4) timeline gives three `sectionMeans` rows in placement order with hook minus verse about +12.04 LU; WAV input gives `[]`. |
| `src/analyze/flow/bands3.tool.ts` | NEW | `export function threeBandWaveform(pcm: StereoBuffer, width?: number): FlowWaveformColumn[]`, default `width=1200`. Per-channel second-order Butterworth `LP200`, `HP200` then `LP2000(HP200)` and `HP2000(HP200)` with `Q=1/√2`, `ω=2πf/Fs`, `α=sinω/(2Q)` and normalized RBJ coefficients from 002 §2. Column `floor(n*W/N)` stores per-band peak and RMS; stereo peak=max channels, RMS from mean channel power. Map RMS dBFS −60..0 to color contribution. Bands overlap at crossovers; label `MUSIC2 RGB — APPROXIMATE BANDS`, never claim energy partition. |
| `src/analyze/flow/bands3.test.ts` | NEW | Separate 100/1000/8000 Hz half-scale sines at 44.1 and 48 kHz make red/green/blue dominant after startup; interior peak≈0.5, RMS≈0.3536 with tolerance .03. Silence has zero peak/RMS; stereo one-channel signal has peak .5 and RMS≈.25. |
| `src/analyze/flow/features.tool.ts` | NEW | `export function intervalFeatures(pcm: StereoBuffer, grid: FlowIntervalGrid, onset: Float64Array, intervalLufs: readonly (number|null)[]): FlowFeature[]`. Reuse `realSpectrum`/`hann` (`fft.tool.ts:85-108`) with 4096 FFT/1024 hop, frame center assignment. Chroma uses 100–5000 Hz nearest equal-tempered class as in `key.tool.ts:59-99`; six energies use `BAND_EDGES_HZ` from `analysis.schema.ts:8`, `10log10(max(power,1e-8))` clamped −80..0 and scaled 0..1. L2-normalize chroma and six-band groups, weight .5/.3; onset rate clamped at 8/s and mapped 0..1, interval LUFS clamped −60..0 and mapped 0..1, each weighted .1; L2-normalize the 20-vector. Peak picking on shared 10 ms flux uses `max(.15, local median+3*MAD)` in ±0.5 s, then strongest in 50 ms, earlier time on ties. Centroid is magnitude-weighted mean over 20 Hz..Nyquist, null for no energetic frame. |
| `src/analyze/flow/features.test.ts` | NEW | Four isolated clicks inside a 2 s interval produce count 4/rate 2/s (±20 ms); click on boundary counts only in next interval. Sustained 1/8 kHz tones have near-zero onsets and centroids near tone within one FFT bin plus leakage. Silence gives 20 zeros, onset 0, centroid null, and a silent flag. |
| `src/analyze/flow/similarity.tool.ts` | NEW | `export function flowSimilarity(features: readonly FlowFeature[], grid: FlowIntervalGrid, timeline?: Timeline): FlowSimilarityData`. Fill full `Float32Array(N*N)` with nonnegative cosine `dot(v_i,v_j)`, zero when either silent; keep silent flags. Foote checkerboard around boundary `b`: `u,v∈[-L,L-1]`, `g(u)=exp(-(u+.5)^2/(2*(L/2)^2))`, same-side positive/cross-side negative, normalize by Σ|K| and clamp novelty at zero. `L=min(4,max(1,floor(N/6)))` bars, 8 for 0.5 s frames, equivalent time span for beats; require full kernel. Strict local maxima over `max(.08, median+2*MAD)`, separated by `L`, higher score then earlier boundary wins. Declared boundary hit is ±1 bar; WAV peaks have `declaredHit:null`. Repeat scan at lag ≥8 bars, ≥8 contiguous matches with each `S≥.85`, mean ≥.90 and nonoverlap; keep longest then highest mean, merge overlaps; WAV reports seconds without bar claims. |
| `src/analyze/flow/similarity.test.ts` | NEW | Eight distinct unit vectors at bars 5–12 copied to 21–28 yield eight `S=1` and `BARS 5-12 REPEAT 21-28; SIM 1.00`; silent vector yields no match. `A×8,B×8,A×8` has peaks at boundaries 8/16 and declared hits; 24 equal vectors have no interior peak; offset ±1 bar is hit and ±2 is miss. |
| `src/analyze/flow/annotate.tool.ts` | NEW | `export function flowAnnotations(flow: Pick<FlowAnalysis,"axisKind"|"sectionDeltas"|"noveltyPeaks"|"repeats">, warnings: readonly AnalysisWarning[], sections: readonly SectionMetrics[], timeline?: Timeline): { verdicts: [string,string,string]; annotations: string[] }`. Shared formatter used by JSON, Markdown, and PNG. Verdict slots: priority warning `CLIPPING`, `LUFS_OFF_TARGET`, then current warning order (`analyze.tool.ts:96-114`), else `NO FLAGS`; largest absolute adjacent section delta, then earlier boundary, as `SECTION GAP +6.0 LU INTO HOOK#0 AT B05`, else `SECTION GAP N/A`; first hook by placement order as `FIRST HOOK HOOK#0 AT B05`, else `NO HOOK DECLARED`. Boundary lines `BOUNDARY B09 MATCHED/MISSED`; repeat line `BARS 5-12 REPEAT 21-28; SIM 0.93`; WAV substitutes seconds. |
| `src/analyze/flow/annotate.test.ts` | NEW | Simultaneous clipping and LUFS warning selects clipping; +6 and −6 LU tie selects earlier boundary; no sections/hook gives both fallbacks; peaks at B09 hit/miss format exactly; WAV uses `0:08` and has no `HOOK` or `BARS` claim. |
| `src/analyze/flow/flow.tool.ts` | NEW | `export function analyzeFlow(pcm: StereoBuffer, ctx: FlowContext): FlowRenderData`. Orchestrate grid, shared onset envelopes, loudness, three-band scan, interval spectra, SSM/novelty/repeats, then annotations. Accept existing beat map, warnings, sections, bands and optional song timeline; avoid a second tempo FFT and a second full-length K power array. No file I/O or CLI import. |
| `src/analyze/flow/flow.test.ts` | NEW | Same 16-bar drill input twice gives deep-equal `FlowAnalysis` and identical typed arrays; WAV silence uses `0.5 s` axis/null LUFS; short song excludes its render tail from intervals. Check no `Float32Array`/`Float64Array` appears in JSON traversal. |
| `src/analyze/flow/flow.bench.test.ts` | NEW | Opt-in `MUSIC2_BENCH=1`: generate exactly 180 s, 48 kHz stereo fixed-seed PCM, warm once, then run existing analysis stages alone and those same stages plus flow/overview in separate same-host Node child processes so each reports its own peak RSS. Assert added wall time ≤15 s and added peak RSS ≤100 MB; log baseline/new/delta, Node/platform and host. Without env, skip explicitly. |
| `src/analyze/overview/canvas.tool.ts` | NEW | `export function createCanvas(width: number, height: number, background: Rgb): RgbCanvas`; `export function fillRect(canvas: RgbCanvas, x:number,y:number,w:number,h:number,color:Rgb):void`; `export function line(canvas:RgbCanvas,x0:number,y0:number,x1:number,y1:number,color:Rgb):void`; `export function polyline(canvas:RgbCanvas,points:readonly (readonly [number,number])[],color:Rgb):void`; `export function text(canvas:RgbCanvas,x:number,y:number,label:string,color:Rgb,scale?:number):void`. Integer/clipped RGB8 coordinates; fill every byte before drawing; encode only via `encodeRgbPng` (`png.tool.ts:24-43`). |
| `src/analyze/overview/canvas.test.ts` | NEW | 2×2 canvas background initializes all 12 RGB bytes; clipped rectangle/line cannot write outside; two identical draws encode byte-identical PNGs. |
| `src/analyze/overview/panels.tool.ts` | NEW | Export `drawHeader`, `drawVerdicts`, `drawSections`, `drawLoudness`, `drawDensity`, `drawWaveform`, `drawNovelty`, `drawBrightness`, `drawBandsAndSsm`, `drawLegends`, each `(canvas: RgbCanvas, input: OverviewInput): void`. Use the exact panel coordinates and legend rules below. SSM display is ≤256×256 rectangular-cell averages from full matrix, 0 dark navy to 1 pale yellow, with 1 px section lines on both axes and labeled axes; detection never uses downsampled pixels. |
| `src/analyze/overview/panels.test.ts` | NEW | Three-occurrence fixture marks B01/B05/B13/B17 at aligned x; hook has orange outline and printed role; a 257×257 numeric SSM yields a 256×256 inset while repeat detection remains on 257 cells. Null LUFS and WAV table print `N/A`/`NO DECLARED SECTIONS`. |
| `src/analyze/overview/overview.tool.ts` | NEW | `export function renderOverview(analysis: AnalysisJson, flow: FlowRenderData, song?: ResolvedSong, timeline?: Timeline): Buffer`. Width 1600, height `1400+44*max(0, sectionOccurrences-20)`; initialize RGB, render panels in fixed order, move bottom legend down by overflow amount, and encode RGB8 PNG. No I/O. |
| `src/analyze/overview/overview.test.ts` | NEW | 20 occurrences gives IHDR 1600×1400, 21 gives 1600×1444; duplicate renders equal bytes. Decode pixels to check background, panel boundaries, SSM diagonal, text glyph fallback and orange hook border; 1024-long-side raster inspection gate is recorded by 030. |
| `src/analyze/font.tool.ts` | MODIFY | `:1-26` adds `(` `)` `|` `%` `+` `=` `>` `<` `,` glyphs and a 5×7 hollow-box fallback for every other character. Current glyphs are A–Z, 0–9, `# - _ . / :` and space; preserve those bitmaps. `:28-45` adds `scale=1` final argument to `drawText`, integer ≥1, with scaled/clipped pixels; export `measureText(label:string,scale=1):number` (`6*scale*length-scale`), and `wrapText(label:string,maxWidth:number,scale=1):string[]` using measured whitespace breaks then character breaks. Core labels use scale 3 (21 px), with no silent missing glyph. |
| `src/analyze/font.test.ts` | MODIFY | At `:13-20`, replace blank-unknown assertion with visible hollow-box assertion; retain lowercase and clipping checks. Add exact 3× scale pixels, punctuation glyph nonblank, `measureText('B05',3)=51`, and 376 px wrapping with every emitted line ≤376 px. |
| `src/analyze/tempo.tool.ts` | MODIFY | At `:16,37-79`, export `onsetEnvelopes(pcm: StereoBuffer): OnsetEnvelopes` from current private `envelopes`, including normalized onset/hats/low 10 ms arrays and `frameRate:100`; at `:213-216`, `estimateTempo` calls it unchanged. Export `estimateTempoFromEnvelopes(pcm:StereoBuffer,envelopes:OnsetEnvelopes,meterNumerator?:number):TempoEstimate` for `analyzeAudio` to reuse the single FFT result; keep `estimateTempo(pcm,meterNumerator=4):TempoEstimate` externally identical. |
| `src/analyze/tempo.test.ts` | MODIFY | Existing synthetic tempo vectors must remain byte-exact; add equality between `estimateTempo(pcm)` and shared-envelope path at 44.1/48 kHz, and onset frame rate/count for silence. |
| `src/analyze/analysis.schema.ts` | MODIFY | At `:45-56`, insert required `flow: FlowAnalysis` immediately after `bands`, retaining `version:1`, all old meanings, and old fields' relative order. At `:58-65`, insert required `overviewPng: Buffer` and `overviewPng: string` immediately after `spectrogramPng`; import `FlowAnalysis` type from `flow/flow.schema.ts`. |
| `src/analyze/analyze.tool.ts` | MODIFY | At `:96-114`, narrow `warnings` input to the fields it reads so it accepts the pre-flow facts. At `:116-154`, obtain one onset envelope, tempo, existing meters/beat map and warnings; call `analyzeFlow`; construct `AnalysisJson` in declaration order with `flow` directly after `bands`; then `renderOverview`. No placeholder flow or late property append. At `:181-191`, add `overview.png` collision check; at `:220-232`, add path and buffer after spectrogram in artifacts/files; reuse `:234-246` temporary-file/rename/cleanup. Keep old estimates and optional piano roll/beat map logic. |
| `src/analyze/report.tool.ts` | MODIFY | At `:23-37`, insert `## Flow` after warnings and before sections: axis source, interval rows (start/end, ungated LUFS, onsets/count/rate, centroid), 1 Hz short-term curve summary, section deltas, novelty peaks with hit/miss, repeats, then each `flow.annotations` string verbatim. Images list adds `overview.png` after spectrogram. WAV prints `No song timeline supplied` as before. |
| `src/analyze/index.ts` | MODIFY | At `:1-12`, export `analyzeFlow`/`renderOverview` only if intended public, and re-export `FlowAnalysis` plus its serializable row types; keep existing exports. Internal render buffers stay unexported at package boundary. |
| `src/index.ts` | MODIFY | At `:18-19`, add `FlowAnalysis` to the package-root type re-exports from `./analyze/index.ts`; preserve existing runtime exports and their order. |
| `src/cli/commands/analyze.ts` | MODIFY | At `:25-28`, insert `result.overviewPng` immediately after spectrogram in the artifact array; `{ok:true,data}` still contains one JSON object and all old keys unchanged. |
| `src/analyze/analyze.test.ts` | MODIFY | At `:66-109`, WAV now has four files and song six, with overview PNG IHDR 1600×1400 for drill; assert `flow` key placement after `bands`, JSON 1 Hz short-term cadence, exact `## Flow` annotations, and identical overview bytes after second `analyzeFile`. Preserve input/collision cases. |
| `src/cli/commands/analyze.test.ts` | MODIFY | Assert printed artifact list and JSON artifact array place `overview.png` after spectrogram and still emit one object; WAV and song paths both exist. |
| `tests/e2e/examples.test.ts` | MODIFY | At `:67-73`, allow `assertPng(path,dir,expectedWidth?,expectedHeight?)` to check IHDR values. At `:101-121`, assert `overviewPng` exists, basename `overview.png`, and IHDR 1600×1400 for the drill. In the drill branch call `analyze` a second time on the same WAV/song to a fresh output directory and compare the two `overview.png` buffers byte-for-byte, not merely the WAV renders. Then analyze the same WAV twice without `--song` into two fresh directories, compare those `overview.png` buffers byte-for-byte, and assert the WAV-only `flow.axisKind` is `beats` or `0.5 s` with empty `sectionMeans`. Other examples assert overview exists and valid PNG dimensions. |
| `devlog/str_func/analyze.md` | MODIFY | Update file tree, flow/overview responsibility, new signatures and JSON/artifact contracts, 1 Hz vs 10 Hz distinction, deterministic overflow layout, tests, and dependency/sync rows (`:8-35`, `:37-76`, `:80-124`, `:148-198`). |
| `devlog/str_func/audio-io.md` | MODIFY | Add `kweight.tool.ts`/test tree rows, shared scan signature and 100 ms block semantics, exact-prefix preservation for `measureLoudness`, and flow dependent (`:9-16`, `:35-50`, `:94-106`, `:157-178`). |

## New TypeScript contracts

> **Implementation amendments (wp2 B, main, after visual inspection of rendered drill/trap/house overviews).**
> 1. Rail rows are 50 px (`RAIL_ROW`) instead of 44 px: two 21 px lines at 44 px touched with no gap. The height rule becomes `1400 + 50*max(0, occurrences-20)` (21 occurrences give 1600×1450).
> 2. The self-similarity matrix compares **mean-centered** interval features: each nonsilent 20-value vector minus the song mean, renormalized; score `(1+cos)/2`, silent pairs 0, two vectors equal to the mean 1, one of them 0.5. Uncentered cosine left every cell near 0.85–1.0 because a looped chord and the overall band balance are constant, so trap reported no novelty peaks and a false "bars 1–12 repeat 13–24". Centered, trap and house recover every declared boundary. Repeat and novelty thresholds are unchanged and now apply to the centered score.
> 3. The SSM inset stretches display values from the lowest nonsilent off-diagonal cell (capped at 0.9) to 1 and prints `DARK = x.xx  PALE = 1.00`; detection never uses the stretch.
> 4. The novelty plot scales to its own maximum (at least 0.1) and prints `MAX x.xx`. Section block labels that do not fit at 3× drop to 2× before truncating. `FlowContext` gains optional `metered` PCM so flow loudness reuses the meter's resampled input for sample rates outside 8–192 kHz.
> 5. The 16-bar drill example yields no novelty peak: its 2-bar snare cycle makes bar-level features alternate, and the kernel radius is 2 bars. This is recorded as a measurement limit; the image-only gate reads declared sections from the section band and rail.

Declare these once in `flow.schema.ts`; use imports rather than copies in feature modules. Existing `StereoBuffer`, `Timeline`, `BeatMap`, `AnalysisWarning`, `SectionMetrics`, and `BandValue` retain their current owners.

```ts
export type FlowAxisKind = "bars" | "beats" | "0.5 s";
export interface FlowInterval {
  index: number; // zero based
  startSeconds: number; endSeconds: number; // half open
  barNumber: number | null; beatNumber: number | null; // one based when applicable
  lufs: number | null; onsetCount: number; onsetsPerSecond: number;
  centroidHz: number | null;
}
export interface FlowIntervalGrid {
  axisKind: FlowAxisKind; durationSeconds: number;
  intervals: Pick<FlowInterval, "index" | "startSeconds" | "endSeconds" | "barNumber" | "beatNumber">[];
}
export interface FlowCurvePoint { timeSeconds: number; lufs: number | null }
export interface FlowSectionDelta {
  fromId: string; toId: string; atSeconds: number;
  atBar: number | null; deltaLu: number | null;
}
export interface FlowSectionMean {
  id: string; // occurrence id, e.g. "hook#0", placement order
  role: string | null; startBar: number; bars: number; // startBar is one based
  startSeconds: number; endSeconds: number;
  meanLufs: number | null; // ungated mean power over the whole occurrence
}
export interface FlowNoveltyPeak {
  atSeconds: number; atBar: number | null; score: number;
  declaredHit: boolean | null;
}
export interface FlowRepeat {
  firstStartSeconds: number; firstEndSeconds: number;
  secondStartSeconds: number; secondEndSeconds: number;
  firstStartBar: number | null; firstEndBar: number | null;
  secondStartBar: number | null; secondEndBar: number | null;
  meanSimilarity: number;
}
export interface FlowAnalysis {
  axisKind: FlowAxisKind; intervals: FlowInterval[];
  shortTermLufs1Hz: FlowCurvePoint[];
  sectionMeans: FlowSectionMean[]; // empty for WAV-only input
  sectionDeltas: FlowSectionDelta[]; noveltyPeaks: FlowNoveltyPeak[];
  repeats: FlowRepeat[]; verdicts: [string, string, string]; annotations: string[];
}
export interface FlowWaveformColumn {
  lowPeak: number; lowRms: number; midPeak: number; midRms: number;
  highPeak: number; highRms: number;
}
export interface FlowFeature {
  vector: Float32Array; // exactly 20 elements
  silent: boolean; onsetCount: number; onsetsPerSecond: number;
  centroidHz: number | null;
}
export interface FlowLoudnessData {
  intervalLufs: (number | null)[]; sectionMeans: FlowSectionMean[]; sectionDeltas: FlowSectionDelta[];
  momentary10Hz: FlowCurvePoint[]; shortTerm10Hz: FlowCurvePoint[];
  shortTermLufs1Hz: FlowCurvePoint[];
}
export interface FlowSimilarityData {
  matrix: Float32Array; size: number; novelty: Float32Array;
  peaks: FlowNoveltyPeak[]; repeats: FlowRepeat[];
}
export interface FlowContext {
  beatMap: BeatMap | null; onset: OnsetEnvelopes;
  warnings: readonly AnalysisWarning[]; sections: readonly SectionMetrics[];
  bands: readonly BandValue[]; song?: ResolvedSong; timeline?: Timeline;
}
export interface FlowRenderData {
  analysis: FlowAnalysis; waveform: FlowWaveformColumn[];
  loudness: FlowLoudnessData; similarity: FlowSimilarityData;
}
export interface RgbCanvas {
  width: number; height: number; rgb: Uint8Array;
}
export type Rgb = readonly [number, number, number];
export interface OverviewInput {
  analysis: AnalysisJson; flow: FlowRenderData;
  song?: ResolvedSong; timeline?: Timeline;
}
export interface OnsetEnvelopes {
  onset: Float64Array; hats: Float64Array; low: Float64Array; frameRate: 100;
}
```

`FlowAnalysis`, its row types, grid, feature and render data live in `flow.schema.ts` without importing `AnalysisJson` or tempo. `FlowContext` lives in `flow.tool.ts`; `OnsetEnvelopes` lives in `tempo.tool.ts`; `RgbCanvas`/`Rgb` live in `overview/canvas.tool.ts`; `OverviewInput` lives in `overview/panels.tool.ts`. These latter interfaces are shown together above for review but must not be duplicated in source. `FlowContext` and `FlowRenderData` are internal to the feature; only `FlowAnalysis` and serializable row types cross the public boundary. This ownership avoids even a type-only `analysis.schema.ts` ↔ `flow.schema.ts` cycle.

## Computation and serialization invariants

1. `analyzeAudio` validates PCM once at its current ingress (`analyze.tool.ts:23-35`). The new tools may enforce domain preconditions such as a positive interval duration; they do not add a second shape parser around trusted PCM.
2. Keep `measureLoudness`'s existing sample-ordered prefix sums. The shared K scanner must produce the same filtered `number` for each frame and call the visitor before adding that frame to its 100 ms block accumulator.
3. Do not reset K filters at section boundaries. Section and interval means use the continuous filtered stream, so adjacent measurements share exactly the same filter history.
4. For a boundary at time `t`, compute sample index with `round(t*sampleRate)` once and use that index for both neighboring intervals. No sample can contribute to both intervals.
5. The final partial 100 ms block may support an exact interval sum through its visitor, but cannot count as one of four or 30 *complete* blocks in a trailing loudness window.
6. Momentary and short-term windows advance in integer block steps. At 44.1/48 kHz those steps are exactly 4410/4800 samples, and first complete outputs occur at 0.4/3.0 s.
7. The 10 Hz curves are internal because plotting benefits from them. Only complete whole-second short-term samples at `t=3,4,5,…` enter `shortTermLufs1Hz`; short files serialize an empty array.
8. A section delta is null if either ungated section mean is null. A finite negative value means the next section is quieter; display a leading sign for both positive and negative gaps.
9. The current `SectionMetrics.integratedLufs` remains gated by the existing 400 ms meter (`analyze.tool.ts:70-85`). The image rail uses it for the loudest-section label; never substitute the ungated gap measurement.
10. The onset envelope from `tempo.tool.ts:37-79` is computed once on its established 44.1 kHz resampling grid. Flow peak picking consumes that normalized 100 Hz array; tempo ranking and return values keep their prior numerical order.
11. Centroid and interval chroma may share one 4096/1024 spectral traversal, but the existing whole-song key and six-band estimators keep their established FFT sizes and outputs (`key.tool.ts:6-10`, `bands.tool.ts:6-8`).
12. Assign an FFT frame to the interval containing its center. A frame centered exactly on a boundary belongs to the following interval. Silence contributes neither centroid numerator nor denominator.
13. Chroma bin assignment uses nearest equal-tempered pitch class; `100–5000 Hz` restricts this interval feature only. Its 12 values and the six band energies occupy fixed positions 0–11 and 12–17; onset and LUFS are 18 and 19.
14. Normalize each feature group only when its norm is positive, then normalize the complete vector once. A wholly silent interval stays 20 zeros with `silent=true`; dot products involving it are zero, including the diagonal.
15. SSM computation uses the full interval count. A 180 s fallback WAV has about 360 frames and 129,600 matrix cells; 256 px is a display cap, never a detection cap.
16. Checkerboard novelty is evaluated only where all `2L` intervals exist. Stable sort order is peak score descending then earlier boundary; serialize accepted peaks in time order.
17. Repeat ranges are one-based inclusive bars only on a declared song grid. For WAV, use half-open second ranges; if a beat axis is used, its intervals do not become alleged song bars.
18. Build the JSON object with `bands`, then `flow`, then the preexisting `sections`/`tracks` fields. `roundedJson` (`analyze.tool.ts:157-159`) remains the sole decimal rounding point for data files.
19. Keep the raw flow arrays out of the serializable contract: a JSON stringify of `analysis.flow` must contain no typed-array object keys, 1200-column waveform, or N×N matrix.
20. Format all verdicts and annotations once, after warnings and section deltas are known; the image and `analysis.md` consume those exact strings rather than reconstructing phrases.
21. Colors are literal fixed RGB tuples; no dynamic palette, locale-dependent number formatting, unordered object iteration, timestamp, random seed, or font substitution enters the PNG path.
22. `drawText` iterates Unicode code points as its current `Array.from` does (`font.tool.ts:30`). `measureText` and wrapping count the same code points, including one hollow box for each unsupported code point.
23. Rendering initializes the full `1600*height*3` RGB buffer to the background color before drawing. Every line is clipped before indexing; the PNG encoder still owns compression, chunk order and CRC.
24. Output collision detection runs before rendering and includes `overview.png`. Its final path is written by the current same-directory temporary-file/rename loop; no temporary path appears in JSON, Markdown, or CLI output.
25. Run the performance benchmark on the same host, Node binary and input for both children. Subtract the baseline's wall time and peak RSS from the new path; record negative deltas rather than silently clamping them to zero.
26. For each three-band cutoff `f`, use low-pass numerator `[(1-cosω)/2,1-cosω,(1-cosω)/2]`, high-pass numerator `[(1+cosω)/2,-(1+cosω),(1+cosω)/2]`, and common denominator `[1+α,-2cosω,1-α]`; divide every coefficient by `1+α`.
27. For WAV similarity, interpret lag ≥8 and run length ≥8 in the chosen *intervals* rather than bars, and print their seconds. For beat-frame novelty choose `L=clamp(round(4/medianBeatSeconds),1,min(8,max(1,floor(N/6))))`, while fixed 0.5 s frames retain the 8-frame maximum.
28. SSM display pixel `(x,y)` averages cells in `[floor(x*N/256),ceil((x+1)*N/256)) × [floor(y*N/256),ceil((y+1)*N/256))`, clamped to N. This permits repeated source cells when N<256 without reading an empty range.

The existing `analysis.json` fields remain in their current relative order and retain their meanings. The new `flow` field is required for every successful song or WAV analysis, including silence; optional files remain optional under their current conditions.

Warnings and annotations have different roles: `warnings` retains machine-readable codes and thresholds, while the three verdicts are short display strings chosen from those records. The Markdown report repeats the display strings exactly, so a text reader sees the same finding as an image reader.

## Overview geometry and labels

Canvas width is 1600. Shared time-domain x is `136..1168` inclusive; the right rail is `1200..1576`. Map a time `t` to `136+round(1032*t/duration)` and reuse the same integer x for every time panel and section boundary. Section `startBar` is zero-based in `timeline.placements` (`timeline.tool.ts:13-15`, `:76-77`); print bar `startBar+1`, and print final boundary `timeline.bars+1`. Prefer role plus occurrence ID inside each block, such as `02 HOOK#0`; use 3 px boundaries and an orange hook outline. Never infer bars from WAV beat frames.

| Panel | y (half-open) | Content |
| --- | ---: | --- |
| Header | 0–100 | Title (wrapped when necessary), duration, meter/axis, `BPM 140 (DECLARED 140) | C MINOR | -14.1 LUFS | TP -1.3 DBTP`; null values print `N/A`. |
| Verdicts | 100–170 | Three fixed slots from `flow.verdicts`, wrapped within their own bounds; no raw warnings hidden by color. |
| Section flow and ticks | 170–310 | Proportional blocks, 1-based section number, role and `id#occurrence`, B01…B(N+1) plus matching m:ss ticks; WAV prints `AUDIO AXIS` and no declared block. |
| Loudness | 310–500 | Per-interval ungated LUFS line/points and 10 Hz short-term trace, sky blue; y ticks 0, −12, −24, −36, −48 LUFS, endpoint arrows with actual number when out of range; section x lines. |
| Arrangement density | 500–620 | Song: DRUMS, BASS/808, OTHER NOTES event-count bars with `EVENTS/BAR`; derive counts from `timeline.events` (`timeline.tool.ts:8-11`, `:76`). WAV: `ONSET DENSITY / S` only, never track claims. |
| Three-band waveform | 620–800 | Symmetric peak silhouette plus darker RMS inset from 1200 columns, red <200 Hz, green 200–2000 Hz, blue >2000 Hz, with text `MUSIC2 RGB — APPROXIMATE BANDS`. |
| Novelty | 800–900 | Novelty line, marked peak positions, declared boundary hit/miss labels only for song; WAV labels seconds. |
| Brightness | 900–1000 | Per-interval centroid Hz line, gaps for null; `BRIGHTNESS = CENTROID HZ`, not loudness. |
| Global bands and SSM | 1000–1290 | Left: `GLOBAL BAND SHARE — NOT TIME`, six bars in 2×3 grid inside x=136–824 with names and percentages from `analysis.bands`. Right: 256×256 SSM inset x=880–1136, y=1014–1270, dark navy→pale yellow, `SELF SIMILARITY`, axis ticks/section labels and boundary lines. |
| Legends | 1290–1400 | `NUMBER = SECTION TABLE`, `ORANGE OUTLINE = HOOK`, `SKY BLUE = LUFS`, `BAR HEIGHT = EVENTS/BAR`, `SSM PALE = SIMILAR`; waveform text names all bands. |

The rail starts at y=170 and uses 44 px per occurrence: line one `02 HOOK#0 B05 0:07`, line two `SECTION LUFS -12.4`. For the greatest finite gated `SectionMetrics.integratedLufs` (`analysis.schema.ts:36-39`), abbreviate line two to `LUFS -12.4 LOUDEST` so it fits the same row; ties select the earliest occurrence. Do not call this value mean LUFS; the new ungated section mean is used only for gap calculations. For WAV, the rail instead lists `AXIS: BEATS` or `AXIS: 0.5 S`, onset summary, novelty peaks and repeats in seconds, with `NO DECLARED SECTIONS` and no hook statement. Wrap rail text at x=1576 rather than painting beyond it.

For 0–20 occurrences, height is exactly 1400. At 21+, height adds 44 px per extra row, retaining 44 px rows, 3× text, and all panel y coordinates; move the legend band to `1290+extra .. 1400+extra` so the longer table cannot overlap it. Record the actual width/height in IHDR and report the 1024-long-side scaled text height `21*1024/max(1600,height)`; at 25+ occurrences flag a focused readability review in 030, and if that value falls below 12 px the 1024 condition fails pending a layout revision. Never shrink row text to force a fixed image.

RGB constants: background `(15,23,34)`, primary text `(241,245,249)`, secondary text `(203,213,225)`, grid `(107,114,128)`; Okabe–Ito sky `(86,180,233)` loudness, orange `(230,159,0)` hook, yellow `(240,228,66)` drums, green `(0,158,115)` bass, magenta `(204,121,167)` other notes. The labeled music2 waveform uses vermillion `(213,94,0)` for low/red, green `(0,158,115)` for mid, blue `(0,114,178)` for high; SSM endpoints are dark navy `(20,32,54)` and pale yellow `(255,240,150)` with linear RGB interpolation. Each color meaning is duplicated by text, line/border pattern, lane, or bar height. At 1600→1024 the 3× 5×7 font remains about 13 px high. `measureText` and `wrapText` constrain title, verdict, and rail labels before rasterizing; unsupported Unicode prints a hollow box so missing glyphs remain visible.

## Acceptance

| Check | Command | What it observes |
| --- | --- | --- |
| Contract | `npm run typecheck` | Required `flow`/`overviewPng` types compile; type-only imports and `.ts` extensions resolve. |
| Style and ownership | `npm run lint && npm run audit:structure` | No unused DSP paths, misplaced tool/test pairs, or structural regressions. |
| Existing meter/tempo preservation | `node --test src/audio-io/loudness.test.ts src/analyze/tempo.test.ts` | All original numeric expectations stay identical after shared scan/envelope extraction. |
| Flow and image vectors | `node --test src/audio-io/kweight.test.ts src/analyze/flow/*.test.ts src/analyze/overview/*.test.ts src/analyze/font.test.ts` | Sine/click/SSM vectors, null paths, font fallback, dimensions, color, overflow and PNG identity. |
| Full repository tests | `npm test` | Updated analysis, CLI, and examples e2e paths plus all existing tests pass. |
| Build | `npm run build` | Published ESM/types include additive public contract and bundled entry point loads. |
| Song e2e | `node --test tests/e2e/examples.test.ts` | Drill's overview exists, IHDR is 1600×1400, and two song-backed analyze runs produce byte-identical overview PNGs. The same drill WAV analyzed twice **without** `--song` into fresh directories also yields byte-identical `overview.png`, and its `analysis.json.flow` has `axisKind` `beats` or `0.5 s`, empty `sectionMeans` and no `HOOK`/`BARS` annotation (c-2 WAV-only half). |
| Performance | `MUSIC2_BENCH=1 node --test src/analyze/flow/flow.bench.test.ts` | 180 s/48 kHz stereo baseline vs new path on same host: ≤15 s and ≤100 MB incremental peak RSS, with host/Node recorded. |
| Human/model reading gate | 030's image-only evaluation command, defined in 030 | Same prompt/conditions compare overview and spectrogram at long sides 1600/1280/1024; record raw answers and per-field scores before any readability claim. |

## Activation scenarios

- `kweight.test.ts` exercises mono/stereo branch, both sample rates, zero energy, final partial block, and invalid input; `loudness.test.ts` confirms the refactor preserves gated meter values and exact prior expectations.
- `intervals.test.ts` selects song bars, reliable WAV beats, low-confidence WAV frames, too-few/duplicate beats, and a short final frame; the WAV path never gains a bar number.
- `loudness-curve.test.ts` activates incomplete 400 ms/3 s windows, silence/null, section interval boundaries, +6.02 LU step, and power-before-log averaging.
- `bands3.test.ts` activates each 200/2000 Hz band, both sample rates, stereo channel aggregation, and all-zero columns; no test asserts exact full-band power decomposition.
- `features.test.ts` activates onset local median/MAD, 50 ms refractory tie, exact boundary ownership, centroid weighting, and silent feature vector.
- `similarity.test.ts` activates diagonal/copy stripe, silent similarity zero, both Foote peaks, constant no-peak, declared hit/miss, repeat threshold and overlap tie rules.
- `annotate.test.ts` activates warning priority, signed maximum gap, first hook, missing section/hook fallbacks, boundary strings, and WAV seconds-only strings.
- `overview.test.ts` activates song and WAV rails, null labels, glyph fallback, SSM downsample/section lines, 20/21-occurrence height boundary, and repeated PNG byte equality.
- `analyze.test.ts`, `src/cli/commands/analyze.test.ts`, and `tests/e2e/examples.test.ts` activate JSON/Markdown/PNG wiring, atomic output, artifact ordering, single-object CLI JSON, drill size and byte identity across two analyze runs.
- `flow.bench.test.ts` activates only with `MUSIC2_BENCH=1`; 030 later activates the separate VLM readability gate without treating this plan as a measured result.
