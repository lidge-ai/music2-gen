# 030 — wp4 Analysis and visuals for text+image-only models

wp4 measures rendered PCM independently of song metadata and writes an agent-readable `analysis.json`, `analysis.md`, `beats.json`, and visual evidence. A WAV-only invocation produces a spectrogram and audio-derived beat grid; a song adds an exact piano roll, section data, and an authoritative song beat grid. DSP estimates remain visible beside declared values so a text or image model can reason about the music without hearing it.

Depends on: 003 D1/D6/D8/D9/D11, 005 DSP choices, 010 types/CLI, 020 `renderSong` and audio-io PCM/WAV APIs. Consumed by: 040 recipe lint/critic reports, 050 examples/docs/dogfood/CI; vid2-gen beat-map import requires the explicit adapter noted below.

## Scope

IN: deterministic measurements, six-band balance, beat/key candidates, two RGB PNG visualizations, five output files for a song or three/four for WAV-only depending on whether BPM is measurable, CLI command and public exports. OUT: pitch transcription from WAV, changing the song schema, ffmpeg, browser rendering, ML models, network calls, AGPL or copied upstream code. Use built-in `node:zlib`, `node:fs`, `node:path` only; runtime dependency count remains zero. No `Math.random` or `Date` in audio or image paths; if future analysis sampling needs randomness, use `src/shared/prng.tool.ts` with a stable seed. All complete PCM reads use finite bounded buffers; reject malformed/empty PCM with `E_INPUT` before FFT.

## Contract and resolution notes

- Reuse `StereoBuffer`/PCM type, WAV reader, `renderSong`, `Song`/`ResolvedSong`, `Timeline`, `Track`, `Section`, `TimedEvent`, `Music2Error`, `EXIT`, `buildTimeline`, and the CLI success/error envelope from 010/020. Before implementation, reconcile the exact names/signatures created in 020; this document fixes analysis behavior and its external shapes, not a duplicate PCM type. PCM is planar finite `Float32Array` channels with `sampleRate`; mono/stereo are accepted, more than two channels are `E_INPUT` until a channel layout exists. Analysis never applies mastering gain.
- `meter.denominator` is 4 in song v1. For an audio-only beat map use 4/4 as a provisional assumption, with confidence reduced and warning `METER_ASSUMED`. `beats.json` begins at audio frame zero (`offsetFrames: 0`), and section end excludes the next section.
- **vid2-gen compatibility (main decision, 2026-09-28):** the vid2-gen reader at `vid2-gen/src/timeline/resolve.ts:64-65` reads `{bpm: number, offsetFrames?: number, meter?: number}` and uses `meter` as beats per bar (`:29`). music2 therefore writes `meter` as a **number** (the time-signature numerator, beats per bar) and carries the full signature in an extra `timeSignature: {numerator, denominator: 4}` field that vid2 ignores. No vid2-gen change is needed; beats.test.ts asserts `typeof map.meter === "number"` and a fixture parsed with the same three-field projection yields bar 2 beat 1 at 60/bpm·meter seconds.
- Reference observations: 002 establishes why text/image artifacts are first-class; 004/006 establish drill hats and section roles; `/tmp/music2-poc/render.mjs` has the known 140 BPM C-minor 8-bar drill loop. PoC code is evidence only, not a source to copy. 005 gives reference formulas/vectors and source links; use those as numeric oracle, not vid2 source text.

## File map

| Path | Op | Exact content |
|---|---|---|
| `src/analyze/analysis.schema.ts` | NEW | Export all interfaces below; constants `ANALYSIS_VERSION = 1`, `BEATS_VERSION = 1`, `BAND_EDGES_HZ = [20,60,250,500,2000,8000,20000] as const`. No parallel JSON schema needed in v1. |
| `src/analyze/fft.tool.ts` | NEW | `hann(size: number): Float64Array` periodic `0.5-0.5*cos(2*pi*n/size)`; `fft(real: Float64Array, imag?: Float64Array): ComplexSpectrum` iterative radix-2 complex transform on copied arrays, forward negative exponent, unscaled; `realSpectrum(samples: Float32Array, offset: number, size: number, window?: Float64Array): Float64Array` returns `size/2+1` magnitudes with zero-padded final frame. Validate power-of-two `2..32768`, nonnegative offset, finite samples. Bit reversal, staged butterflies and cached twiddles; no O(N^2) DFT. |
| `src/analyze/fft.test.ts` | NEW | `fft([1,0,0,0])` yields real `[1,1,1,1]`, imag zeros; 8-point unit sine peaks only at bins 1/7 (magnitude 4, tolerance 1e-12); `hann(4)` is `[0,.5,1,.5]`; invalid size 3 and NaN input fail `E_INPUT`; 4-point zero-padded tail gives all bins magnitude 1. |
| `src/audio-io/loudness.tool.ts` | NEW | (owner moved to audio-io after architect reflection so render's `master.targetLufs` and analyze share it without a render/analyze cycle; loudness uses only `left` when `sourceChannels === 1`) | `measureLoudness(pcm: StereoBuffer): LoudnessMetrics`; design K-weighting biquads from `sampleRate`, independent two-filter state per channel. `k=tan(pi*fc/fs)` shelf `fc=1681.97445095553,Q=.707175236955419,Vh=10^(3.99984385397/20),Vb=Vh^.499666774155`; shelf numerator `(Vh+Vb*k/Q+k²,2*(k²-Vh),Vh-Vb*k/Q+k²)/a0`, denominator `(1,2*(k²-1)/a0,(1-k/Q+k²)/a0)`, `a0=1+k/Q+k²`. RLB high-pass `fc=38.13547087614,Q=.500327037325395`, numerator `(1,-2,1)` and corresponding denominator; verify against 48 kHz reference coefficients, derive afresh at 44.1 kHz. 400 ms windows/100 ms hop, discard incomplete; `-0.691+10log10(sum channel mean-square)`, no stereo division. Absolute gate -70 LUFS, relative gate 10 LU below linear-power mean of first-pass blocks, recompute gated mean. Silence returns `integratedLufs:null`; short clip below 400 ms returns null. LRA: 3 s windows at 100 ms, -70 absolute then -20 relative to linear-power mean, sorted 10th/95th percentiles at `round((n-1)*p/100)`; `lraLu:null` if no window and `lraProvisional = duration<60`. True peak: 4x per-channel, 48-tap windowed-sinc polyphase reconstruction normalized for unity at integer phases; include sample peaks, report dBTP estimate and `truePeakOversample:4`. |
| `src/audio-io/loudness.test.ts` | NEW | 20 s stereo 1 kHz sine at -23 dBFS peak: -23.0 ±0.1 LUFS at 44.1k and 48k; 20 s mono -20 dBFS peak: -23.01 ±0.1 LUFS; 20 s stereo -20 then 20 s -30 yields LRA 10 ±1 LU and provisional true; all zeros returns null loudness/peak; a crafted intersample signal has true-peak estimate above sample peak; <400 ms has null integrated loudness. |
| `src/analyze/tempo.tool.ts` | NEW | `estimateTempo(pcm: StereoBuffer, meterNumerator = 4): TempoEstimate`; downmix channels arithmetically, deterministic linear resample to 44,100 if needed. STFT 2048 Hann/hop 441, positive spectral flux of `log1p(100*normalizedMagnitude)`, summed over 40..10000 Hz and divided by bin count; subtract 1 s running mean, floor at zero, divide by robust 95th percentile (zero-safe). Weighted normalized autocorrelation for integer lags matching 50..220 BPM: `R(lag)=sum O[t]O[t-lag]/sqrt(sum O[t]^2 sum O[t-lag]^2)` times Ellis `exp(-.5*(log2((lag/100)/.5)/1.4)^2)`. Retain local maxima plus interpolated lag peak; generate each peak's half/double aliases within 50..220. Select 70..180 prior unless no candidate exists; when 70/140 ambiguity remains, prefer the candidate whose beat/half-beat/quarter-beat onset grid explains more independent hat subdivisions, with beat-aligned events weighted 1 and subdivision events .35; score using ±2 onset frames around nearest grid point, subtract `.15` per predicted grid point without onset, normalize by total onset energy, and require ≥0.03 improvement to override weighted autocorrelation. Otherwise apply the guarded octave rule: if the best candidate B < 90, the candidate nearest 2B has weighted score ≥ 0.85 × score(B), **and** the texture is finer than B's eighth notes, choose 2B. Texture test, phase-aligned to the best B beat phase, using onset-strength local maxima ≥ 0.3 matched within ±2 frames: `occ16` = fraction of grid points spaced 60/B/4 s holding a maximum; `off32` = share of total peak strength lying on odd 32nd-of-B positions (spacing 60/B/8 s, excluding positions already on the sixteenth grid). Promote only when `occ16 > 0.6` or `off32 ≥ 0.10`. Straight eighth hats at 75 BPM give occ16 = 0.5 and off32 ≈ 0, so 75 stays; drill-140 with eighth hats and rolls gives occ16 ≈ 1; a UK 3+3+2 hat bar (140-sixteenth steps 0,3,6,8,11,14) gives occ16 = 0.5 but off32 ≈ 0.33, so both drill shapes promote (measured on the PoC drill render: 70 → 0.497, 140 → 0.461, ratio 0.93, evidence/tempo-probe.md); then prefer stronger weighted score, then higher BPM on tie. This rule must select 140 in drill test and retain 70 as alternative. Phase search over one beat at 10 ms resolution maximizes flux on quarter-note grid; sub-frame parabolic refinement; emit times `phase+n*60/bpm` in `[0,duration)`. Low-band 20..180 Hz onset energy scores each meter-index phase for downbeats; confidence combines normalized top-vs-runner autocorrelation gap and phase concentration, clamped 0..1. Audio BPM never reads `Song.bpm`. |
| `src/analyze/tempo.test.ts` | NEW | 16-bar synthetic 140 BPM kick on beat 1, snare beat 3, hats eighths and brief 16th rolls: estimate 138..142, 70 candidate present, beat spacing 0.428571 ±.02 s, downbeat spacing 1.714286 ±.04 s; 16-bar `examples/drill-140.song.json` rendered by 020 returns 138..142 with song metadata withheld; synthetic 75 BPM backbeat (kick 1/3, snare 2/4 of a 75 BPM bar) with loud straight eighth hats (same peak level as the snare, so the 150 BPM alias is strong) returns 73..77 and lists 150 as an alternative; synthetic 140 BPM UK 3+3+2 hat bar (steps 0,3,6,8,11,14) with snare on step 9 returns 138..142; synthetic 70 BPM groove with continuous sixteenth hats reports 140 with 70 as the first alternative (documented ambiguity, asserted so the behaviour is explicit); 90 BPM four-on-floor returns 88..92; silence gives bpm null/confidence 0/empty beats; 48k input follows same thresholds. |
| `src/analyze/key.tool.ts` | NEW | `estimateKey(pcm: StereoBuffer): KeyEstimate`; 8192 Hann STFT/hop 2048, analyze 40..5000 Hz. For each local spectral peak, assign nearest MIDI pitch `69+12log2(f/440)`, fold into C..B chroma, suppress broadband bins by peak-to-neighbor ratio ≥1.5, weight magnitude/sqrt(f) and downweight 2nd/3rd harmonics when a fundamental is present; L1-normalize each nonempty frame and average. Pearson-correlate all 24 rotations of KK major/minor profiles and Temperley major/minor profiles locked below. `candidates` top 3 by KK score, include Temperley score for same key; stable key-name tie break. `confidence` = clamp((top-second KK score)/.2,0,1) × tonal-frame fraction; fewer than 3 occupied pitch classes yields key null/confidence 0 but candidates retained for diagnosis. |
| `src/analyze/key.test.ts` | NEW | Synthetic sustained C4/Eb4/G4 triad plus octave doubles chooses `C minor` first with positive score gap; a single C sine returns null and confidence 0; silent PCM returns empty candidates; same triad at 48k selects C minor. |
| `src/analyze/bands.tool.ts` | NEW | `measureBands(pcm: StereoBuffer): BandMetrics`; 8192 Hann/hop 2048 one-sided squared magnitudes; six half-open bands `[20,60),[60,250),[250,500),[500,2000),[2000,8000),[8000,min(20000,Nyquist)]`, final upper endpoint inclusive. Sum energy by FFT-bin center over all frames. `share = bandPower/totalPower` (0 on silence), `dbRelative = 10log10(bandPower/totalPower)` or null when zero. Sum shares ≈1 when analyzable; report no bandwidth-normalized claim. |
| `src/analyze/bands.test.ts` | NEW | 50 Hz sine at 44.1k places >.8 share in sub; 10 kHz sine places >.9 in air; silence gives all shares 0/dB null; 48k upper bound remains 20 kHz. |
| `src/analyze/png.tool.ts` | NEW | `encodeRgbPng(width:number,height:number,rgb:Uint8Array): Buffer`; require positive integer dimensions ≤4096 and `rgb.length===3*w*h` (E_INPUT). Signature, IHDR RGB8 type 2, filter byte 0 before each row, `deflateSync` into IDAT, IEND; big-endian lengths; CRC32 reflected polynomial `0xEDB88320`, init/final XOR `0xffffffff`, precomputed 256-entry table over chunk type+data. Encoder has no decoder branch. |
| `src/analyze/png.test.ts` | NEW | Test-local `decodeRgbPngForTest(bytes: Uint8Array): {width:number;height:number;rgb:Uint8Array}` validates signature, chunk lengths/CRC, RGB8/filter-0 and inflates; no runtime export. Encode 1x1 `[17,34,51]`, decode exact bytes/dimensions; mutate one IDAT byte and assert CRC failure; inspect PNG signature/IHDR type 2/IDAT/IEND; invalid RGB length E_INPUT; decoder rejects unsupported filter. |
| `src/analyze/colormap.ts` | NEW | `export const INFERNO_RGB: readonly number[]` with exactly 256 × 3 precomputed integer RGB channels from published Inferno lookup (committed literal, no runtime generation/interpolation); anchors index 0 = `[0,0,4]`, index 255 = `[252,255,164]`. Comment: "Inferno colormap, Nathaniel J. Smith and Stefan van der Walt; CC0/public domain; source https://bids.github.io/colormap/". Validate endpoints and length in `spectrogram.test.ts`. |
| `src/analyze/font.tool.ts` | NEW | `drawText(rgb:Uint8Array,width:number,height:number,x:number,y:number,label:string,color:readonly [number,number,number]): void`; fixed built-in 5x7 bitmap glyphs for ASCII uppercase letters, digits, `#`, `-`, `_`, `.`, `/`, `:`, space; each glyph advances 6 px; clip pixel writes. Convert labels to uppercase; unsupported glyph draws blank. Shared directly by both image tools, never exported through feature barrel. |
| `src/analyze/font.test.ts` | NEW | `drawText` of `C4` changes expected glyph pixels in a 12x7 canvas; unknown glyph leaves its cell blank; negative x and right-edge x clip without out-of-bounds writes; lowercase `c4` equals uppercase. |
| `src/analyze/spectrogram.tool.ts` | NEW | `renderSpectrogram(pcm: StereoBuffer, timeline?: Timeline): Buffer`; 4096 Hann/hop 1024, mono average, `20log10(max(1e-8,abs(X)/(sum(window)/2)))`, clamp -80..0 dB. Width `min(2400, max(1,ceil((frames-4096)/1024)+1))` data columns; average **linear power** of source frames assigned to each column before converting to dB. Data height 512, rows map log-frequency 20 kHz at top to 30 Hz at bottom (cap Nyquist), interpolate FFT-bin power. Inferno index round((dB+80)*255/80). Add fixed 48 px left axis with `30,100,1k,10k,20k` Hz labels and 24 px bottom legend `-80..0 dBFS` via `font.tool.ts`; draw bar grid lines when `timeline` exists, no lines otherwise. Canvas width=data width+48, height=512+24. All ticks/lines clip to image. |
| `src/analyze/spectrogram.test.ts` | NEW | 1 kHz sine produces brightest row within ±2 rows of 1 kHz and line across middle columns; impulse is a narrow vertical bright stripe; 10 s input width follows frame count, >2400 frames clamps to width 2448 including axis; timeline adds visibly different bar pixels; all PNGs decode with valid CRC; colormap has 768 bytes and fixed first/last RGB anchors. |
| `src/analyze/pianoroll.tool.ts` | NEW | `renderPianoRoll(song: ResolvedSong, timeline: Timeline): Buffer`; canvas has fixed 80 px left label margin, 24 px top section label, 24 px bottom bar scale, 10 px per MIDI row across occupied note range padded by 2 semitones and clamped 0..127; drum tracks are separate 18 px lanes at bottom, one per track in song order. Width `min(2400,max(640,ceil(timeline.durationSeconds*80)))+80`; time maps linearly to x, clip all rectangles. Notes draw `[time,time+duration)` in stable color by track id (`fnv1a32` hue, no PRNG draw); C4 row is MIDI 60. Drum events are 3 px onset marks in their own lanes, labels from track id. Draw bar lines from `secondsPerBar`, section boundaries from placements, role/id labels in the top strip; use `font.tool.ts` for pitch, drum, role, bar and axis labels. For timeline without note events show drum lanes and an explicit `NO NOTES` label. |
| `src/analyze/pianoroll.test.ts` | NEW | Single C4 event at 0..1 s colors exactly the MIDI-60 row over its mapped time interval; two drum tracks have distinct bottom lanes and labels; section boundary x matches `startBar*secondsPerBar`, role label pixels nonblank; drum-only case has `NO NOTES`; PNG decoder round trip/CRC passes. |
| `src/analyze/beats.tool.ts` | NEW | `makeBeatMap(tempo: TempoEstimate, durationSeconds:number, song?: ResolvedSong, timeline?: Timeline): BeatMap | null`; with song, `source:"song"`, exact BPM/meter, beats at quarter-note times from 0 through `< musical duration` (exclude render tail), downbeats each bar, sections from placements (IDs `section#occurrence` using 010 `Placement.occurrence`, counted across all arrangement entries, so a section reused in separate entries stays unique; end = musical end, never the tail), confidence 1. Without song, `source:"audio"`, BPM/beat/downbeat times from tempo, provisional 4/4, sections `[]`, confidence `tempo.confidence * .7` to reflect unknown meter; if no estimated BPM, return null, beats.json is **not written**, and orchestrator emits warning `NO_BEATS`. Serialize 2-space JSON plus newline; enforce sorted finite arrays and offsetFrames 0. |
| `src/analyze/beats.test.ts` | NEW | 140 BPM 4/4 two bars has beat starts 0,.428571,...,3.0 and downbeats 0,1.714286; song beats ignore a contrary 70 BPM estimate; repeated section IDs unique and ordered; WAV-only uses estimated 140 and empty sections; silence suppresses beat map and emits `NO_BEATS` via orchestrator. |
| `src/analyze/analyze.tool.ts` | NEW | `analyzeAudio(pcm: StereoBuffer, opts?: {song?: ResolvedSong;timeline?: Timeline;targetLufs?:number}): AnalysisResult`; calculate peak/sample clipping, RMS, loudness, tempo, key, bands, warnings, section metrics, track density, beat map, PNGs, text report. `analyzeFile(inputPath:string, opts?: {songPath?:string;outDir?:string}): Promise<AnalysisArtifacts>` loads WAV via 020 audio-io or song via `loadSong` + `buildTimeline` + in-memory `renderSong`, then optional companion `--song`; writes atomically (temp in output dir then rename) `analysis.json`, `analysis.md`, `spectrogram.png`, conditional `pianoroll.png` and `beats.json`. `analysis.json` numeric values round to 6 decimals only at serialization; internal metrics retain precision. File paths are resolved against cwd, output dir defaults to `<input basename>.analysis` beside input. Explicit song path must validate; WAV plus `--song` requires equal sample rate and a frame count within ±1 of the expected rendered length `ceil((timeline.durationSeconds + song.tailSeconds) * sampleRate)` (a cropped `--bars` render is rejected with a fix telling the user to analyze the full render), else E_INPUT; section metrics and beats stop at the musical end, the tail is reported separately as `AnalysisJson.tailSeconds` (song-backed input; null for WAV-only). Song input plus `--song` is E_INPUT ambiguity. CLI result lists emitted absolute paths. |
| `src/analyze/analyze.test.ts` | NEW | WAV-only 1 kHz sine emits JSON/MD/spectrogram, no piano roll, no beats when onsetless; song example emits all five artifacts, declaredBpm 140 and independent estimatedBpm 138..142, section table and densities; peak >1 yields `CLIPPING`, >3 LU target delta yields `LUFS_OFF_TARGET`, sub share >.55 yields `LOW_END_DOMINANCE`, air share <.001 with sufficient energy yields `EMPTY_HIGH_BAND`; malformed PCM E_INPUT; same input emits byte-identical files twice. |
| `src/analyze/index.ts` | NEW | Export public `analyzeAudio`, `analyzeFile`, `estimateTempo`, `estimateKey`, `measureLoudness`, `measureBands`, `renderSpectrogram`, `renderPianoRoll`, `makeBeatMap`, `encodeRgbPng`, and types `ComplexSpectrum`, `LoudnessMetrics`, `TempoCandidate`, `TempoEstimate`, `KeyCandidate`, `KeyEstimate`, `BandValue`, `BandMetrics`, `BeatSection`, `BeatMap`, `SectionMetrics`, `TrackDensity`, `AnalysisWarning`, `AnalysisJson`, `AnalysisResult`, `AnalysisArtifacts`; omit test decoder/font/colormap. Internal modules import concrete `.tool.ts` files, not this barrel. |
| `src/cli/commands/analyze.ts` | NEW | `export const analyze: CommandSpec` using the 010 registry type; `run(ctx: {args:string[];values:Record<string,unknown>;json:boolean;cwd:string;stderr:NodeJS.WritableStream}): Promise<CommandResult>` parses positional WAV/song and `--song`, `--out`, `--json`, calls `analyzeFile`, returns `AnalysisArtifacts` as output `data`; no DSP logic. |
| `src/cli/registry.ts` | MODIFY | Add one `register()` entry for `analyze` pointing to `src/cli/commands/analyze.ts`, usage `music2 analyze <audio.wav|song.json> [--song song.json] [--out dir] [--json]`. |
| `src/cli/commands/help.ts` | MODIFY | Add `analyze` usage/description row and flags to command help; preserve existing order and envelope. |
| `src/cli/main.test.ts` | MODIFY | Add CLI in-process cases: song input `--json` yields one success envelope; WAV plus mismatched song E_INPUT exit 2; unknown analyze flag E_INPUT exit 2; missing WAV E_NOT_FOUND exit 2; `--out` paths point to emitted files. |
| `src/index.ts` | MODIFY | Add named exports of analysis public functions/types from `src/analyze/index.ts`; retain existing exports. |
| `src/audio-io/index.ts` | MODIFY | Add `measureLoudness`, `LoudnessMetrics` exports. |
| `src/render/render.schema.ts` + `src/render/render.tool.ts` + `src/cli/commands/render.ts` | MODIFY | Widen `RenderOptions.mastering` to `"peak" | "loudnorm" | "lufs"`; default becomes `"lufs"` when `targetLufs` is set and `--loudnorm` is absent, `"peak"` otherwise; the wp3 E_CAPABILITY branch is deleted. |
| `src/render/mixer.tool.ts` | MODIFY | When mastering is `"lufs"`: measure the pre-limiter mix with `measureLoudness`, apply static gain `targetLufs - integratedLufs` dB, then run the existing soft clip + limiter; remove wp3's E_CAPABILITY branch for `targetLufs` without `--loudnorm`. Test in mixer.test.ts: drill example with `targetLufs:-14` renders between -16 and -13 LUFS integrated. |
| (fixture) | none | Tempo and CLI acceptance use 020's `examples/drill-140.song.json` (16 bars, 140 BPM); no new drill fixture in this phase. |
| `devlog/str_func/analyze.md` | NEW | File Tree covering all analysis files, responsibilities, exact public signatures from map, dependency direction, dependents, sync checklist for metrics/PNG/CLI/beat-map contracts. |
| `devlog/str_func/cli.md` | MODIFY | Add `analyze` command signature/flags/artifacts/error row and analyze dependency; preserve other command documentation. |
| `devlog/str_func/AGENTS.md` | MODIFY | Add feature index row `analyze | analyze.md | active` when wp4 implementation lands. |

## Implementation checkpoints

These choices close gaps that otherwise change results across implementations:

Key-profile constants in `key.tool.ts` are literal C-through-B arrays, rotated
by tonic index before Pearson correlation (source and interpretation: 005):

```ts
const KK_MAJOR = [6.35,2.23,3.48,2.33,4.38,4.09,2.52,5.19,2.39,3.66,2.29,2.88] as const;
const KK_MINOR = [6.33,2.68,3.52,5.38,2.60,3.53,2.54,4.75,3.98,2.69,3.34,3.17] as const;
const TEMPERLEY_MAJOR = [5,2,3.5,2,4.5,4,2,4.5,2,3.5,1.5,4] as const;
const TEMPERLEY_MINOR = [5,2,3.5,4.5,2,4,2,4.5,3.5,2,1.5,4] as const;
```

1. Audio validation belongs at `analyzeAudio` before any detector. Require sample rate
   finite and positive, equal nonzero channel lengths, and every sample finite.
   Permit sample rates above 4 kHz; cap every spectral band at Nyquist.
   The CLI WAV reader owns RIFF decoding errors, surfaced as `E_INPUT`.
2. Compute one downmix for spectral work: `mono = sourceChannels === 1 ? left : (left[n]+right[n])/2` (a mono file is never doubled; test: mono and stereo-duplicated versions of the same sine give equal spectra within 1e-6).
   Keep original channels for peak, RMS, LUFS, and true peak. In particular,
   stereo loudness sums two independently K-weighted powers.
3. Reuse the one FFT primitive for all STFTs. The window is periodic, and the
   normalization for images uses `sum(window)/2` only for non-DC bins.
   Do not use image normalization when accumulating band power or chroma.
4. For a final partial STFT frame, zero-pad to N; a file shorter than N still
   produces one frame. The complete 400 ms and 3 s loudness blocks do **not**
   zero-pad. Silence and near silence therefore have separate, testable paths.
5. Implement K-weighting as two transposed-direct-form-II biquads per channel.
   At 48 kHz compare all five coefficients of each stage with 005's reference;
   at 44.1 kHz compare the LUFS vectors, not copied 48 kHz coefficients.
6. The true-peak filter evaluates 4 phases per input sample, with 24 taps before
   and 24 after the center and zero extension at edges. Normalize phase weights
   so a constant 0.5 PCM signal estimates 0.5 within 1e-4.
   Call the field an **estimate** because 4x at 44.1 kHz is 176.4 kHz.
7. The onset envelope uses the same sample index origin as PCM time zero.
   The first spectral-flux frame has zero flux. Guard all zero-power divisions;
   a silent or steady tone must not acquire a tempo from numeric noise.
8. Keep autocorrelation score and octave-grid score in separate local values.
   Normalize each to [0,1] before comparison. Candidate output is ordered by
   selection score descending, then BPM ascending, with BPM rounded to 0.01.
   Retain the half/double alias even if its autocorrelation peak is weak.
9. Hat evidence is flux above 4 kHz with onset peaks above 20% of that band's
   maximum. An onset placed on a candidate's eighth-note slot contributes
   more than one requiring a 16th slot; a quarter-beat slot contributes least.
   The 140-versus-70 synthetic fixture has enough hats to activate this rule.
10. Phase search evaluates every onset-frame phase within one candidate beat;
    use flux interpolation at beat sample times and choose earliest phase on tie.
    First emitted audio beat may be after zero. Do not force a beat at zero.
11. Downbeat search uses a separately computed low-band flux, summed on beat
    indices modulo meter numerator. If all phases tie, use phase zero and set
    confidence to zero; song source always starts with a bar at zero.
12. Chroma excludes DC and frequencies above 5 kHz or Nyquist. Pearson
    correlation with a zero-variance vector returns zero; do not emit NaN.
    Use equal-tempered nearest-semitone pitch classes, not note spellings.
13. Band powers are computed from unnormalized Hann-window magnitudes. Since
    shares divide by total in-range power, the common FFT scale cancels.
    No silent band's dB value may serialize as `-Infinity`.
14. PNG text/axes are drawn **after** spectrogram colors; bar and section lines
    are drawn after event rectangles so they remain visible. The 5x7 font's
    small alphabet is committed as literal bitmap rows, no platform fonts.
15. On piano-roll x mapping, use the image's data width divided by
    `timeline.durationSeconds`; `time+duration` is exclusive. Clamp a short
    nonzero event to one visible pixel, and sort event drawing by trackIndex
    then event order for deterministic overlaps.
16. Track density divides each track's event count by `timeline.bars` and by
    `timeline.durationSeconds` (exclude render tail). Section RMS/LUFS slice
    the original PCM, while section boundaries come only from placements.
17. `analysis.md` prints `n/a` for null metrics, `provisional` beside LRA for
    clips under 60 s, and a `source: song` or `source: audio` statement beside
    beat confidence. It gives the top three keys with KK/Temperley scores.
18. The output writer creates only the files named by `AnalysisArtifacts`.
    Use same-directory temporary names based on process id plus a local counter,
    then rename; never put a temporary path in JSON/Markdown. If writing fails,
    remove only this invocation's temporary files and surface `E_ACCESS`.
19. JSON object key order follows `AnalysisJson` declaration order, arrays follow
    song track/placement order or stable score order, and all printed numbers
    use decimal rounding at the output edge. This makes repeated files identical.
20. Keep `examples/drill-140.song.json` short enough that `npm test` can render it;
    generated WAV files stay in test temporary directories. Its hats must include
    eighth-note spacing plus at least one finer roll to disambiguate 70/140.

## New TypeScript types

```ts
export interface ComplexSpectrum { real: Float64Array; imag: Float64Array }
export interface LoudnessMetrics {
  integratedLufs: number | null; lraLu: number | null; lraProvisional: boolean;
  samplePeakDbfs: number | null; truePeakEstimateDbtp: number | null;
  truePeakOversample: 4;
}
export interface TempoCandidate { bpm: number; score: number; relation: "primary" | "half" | "double" }
export interface TempoEstimate {
  bpm: number | null; confidence: number; candidates: TempoCandidate[];
  beatsSeconds: number[]; downbeatsSeconds: number[];
}
export interface KeyCandidate { key: string; kkScore: number; temperleyScore: number }
export interface KeyEstimate {
  key: string | null; confidence: number; candidates: KeyCandidate[];
  chroma: number[]; // C,C#,D,...,B; 12 nonnegative values, sum 1 when tonal
}
export interface BandValue {
  name: "sub" | "low" | "lowMid" | "mid" | "presence" | "air";
  fromHz: number; toHz: number; share: number; dbRelative: number | null;
}
export interface BandMetrics { bands: BandValue[] }
export interface BeatSection {
  id: string; role: Section["role"] | null; startSeconds: number; endSeconds: number;
}
export interface BeatMap {
  version: 1; bpm: number; meter: number; timeSignature: { numerator: number; denominator: 4 };
  offsetFrames: 0; source: "song" | "audio"; confidence: number;
  beatsSeconds: number[]; downbeatsSeconds: number[]; sections: BeatSection[];
}
export interface SectionMetrics {
  id: string; role: Section["role"] | null; startSeconds: number; endSeconds: number;
  rmsDbfs: number | null; integratedLufs: number | null;
}
export interface TrackDensity {
  id: string; kind: Track["kind"]; eventCount: number;
  eventsPerBar: number; eventsPerSecond: number;
}
export interface AnalysisWarning {
  code: "CLIPPING" | "LUFS_OFF_TARGET" | "LOW_END_DOMINANCE" |
    "EMPTY_HIGH_BAND" | "NO_BEATS" | "METER_ASSUMED" | "KEY_UNCERTAIN";
  observed: number | null; threshold: number | null; message: string;
}
export interface AnalysisJson {
  version: 1; source: "wav" | "song"; sampleRate: number; channels: number;
  durationSeconds: number; tailSeconds: number | null; samplePeakDbfs: number | null; samplePeakLinear: number;
  clippedSamples: number; rmsDbfs: number | null; integratedLufs: number | null;
  lraLu: number | null; lraProvisional: boolean;
  truePeakEstimateDbtp: number | null; truePeakOversample: 4;
  declaredBpm: number | null; estimatedBpm: number | null;
  tempoConfidence: number; tempoCandidates: TempoCandidate[];
  declaredKey: string | null; estimatedKey: string | null;
  keyConfidence: number; keyCandidates: KeyCandidate[]; chroma: number[];
  bands: BandValue[]; sections: SectionMetrics[]; tracks: TrackDensity[];
  targetLufs: number | null; warnings: AnalysisWarning[];
}
export interface AnalysisResult {
  analysis: AnalysisJson; reportMarkdown: string; spectrogramPng: Buffer;
  pianoRollPng?: Buffer; beatMap?: BeatMap;
}
export interface AnalysisArtifacts {
  analysisJson: string; analysisMd: string; spectrogramPng: string;
  pianoRollPng: string | null; beatsJson: string | null;
  summary: { declaredBpm: number | null; estimatedBpm: number | null;
    integratedLufs: number | null; warnings: AnalysisWarning[] };
}
```

## Derived reporting rules

`analysis.json` is the single numeric source; `analysis.md` is a short deterministic rendering of it. Order: title/source/duration, one-line declared vs estimated BPM and confidence with alternatives, key and its top three scores, integrated LUFS/LRA provisional marker/true-peak estimate/sample peak, six-band table (share percent and dB relative), warnings with observed/threshold, section table (id, role, start/end, RMS dBFS, LUFS), track table (kind, event count, events/bar, events/s), then image file names and one-line interpretation caveat. A WAV-only report prints `No song timeline supplied` in lieu of section and track tables; it does not claim transcription. Per-section metrics slice PCM on `[round(start*sr),round(end*sr))` excluding render tail; sections under 400 ms have LUFS null. Whole-file RMS uses mean square over all channels and samples; dBFS null when zero. `clippedSamples` counts individual samples `abs(x)>=1` across channels. Warnings: clipping if count>0; LUFS off target if target exists and absolute difference>3 LU; low-end dominance if sub+low share>.55; empty high band if total power>0 and air share<.001; key uncertain if confidence<.2. Target defaults to song.master.targetLufs if set, otherwise null, so WAV-only does not invent a mastering target. Warning ordering is the enum order above. JSON floats are finite or null, no NaN/Infinity.

## CLI command

| Command/flag | Default and behavior | Success `data` / errors |
|---|---|---|
| `music2 analyze <audio.wav|song.json>` | Required input. `.wav` uses 020 PCM reader; `.json` validates song, builds timeline, renders in memory via 020 `renderSong`; no intermediate WAV. | Existing envelope `{ok:true,data:AnalysisArtifacts,meta:{music2:<version>}}`; non-JSON prints report and output paths. |
| `--song song.json` | WAV input only; enables piano roll, exact sections and song beat map; compare PCM alignment. | E_INPUT (2) for missing/invalid combination or mismatch; E_SCHEMA (2) for bad song. |
| `--out dir` | `<input basename>.analysis` beside input; create directory recursively, atomic replacement of task-owned output files. | E_ACCESS (4) for unwritable destination; artifacts contain absolute paths. |
| `--json` or `MUSIC2_JSON=1` | Existing CLI single-object envelope; stdout contains one JSON object, diagnostics on stderr. | Errors preserve existing `{ok:false,error,meta}` shape. |
| Input/analysis errors | No fallback to invented values. | E_NOT_FOUND/E_INPUT/E_SCHEMA/E_RENDER map to exits 2/2/2/5; E_INTERNAL exit 1 only for an unexpected fault. Silence is valid: null loudness/BPM, no beats file, `NO_BEATS`. |

## Acceptance

| Check | Command | What it observes |
|---|---|---|
| Type contract | `npm run typecheck` | All public interfaces, `.ts` imports, strict nulls and CLI adapter compile. |
| Style | `npm run lint` | No unhandled promises or unused numeric helpers. |
| Numeric and PNG vectors | `npm test` | All colocated cases above; stereo/mono LUFS, LRA, FFT, key, bands, 140 BPM and 70 alternative, PNG CRC, C4 row. |
| Build/CLI | `npm run build` | Dist build rewrites extensions and bin can load `analyze`. |
| Song artifacts | `node bin/music2.js analyze examples/drill-140.song.json --json` | One success envelope; five files; declared 140 and estimated 138..142; `beats.json.source` song; `beats.json.meter === 4`. |
| WAV artifacts | `npm test` | `src/cli/main.test.ts` renders drill fixture to a temporary WAV, invokes the WAV-only command, checks 140±2 audio beat map and `METER_ASSUMED`, and confirms no piano roll. |
| Missing input | `node bin/music2.js analyze no-such.wav --json` | One error envelope, E_NOT_FOUND, exit 2. |

## Activation scenarios

- `fft.test.ts`: invalid non-power-of-two and NaN vectors trigger E_INPUT; impulse, sine and zero-padding prove transform branches.
- `loudness.test.ts`: stereo and mono vectors prove channel sum; 44.1k/48k vectors prove coefficient derivation; silence and <400 ms prove null path; two-level vector proves the -20 LU LRA gate and provisional flag; intersample vector proves 4x estimate exceeds sample peak.
- `tempo.test.ts`: half-time snare plus hats/rolls activates 70/140 octave choice and 70 alternative; drum accents activate low-band downbeat phase; silence activates zero-confidence/no-beat path; 48k vector activates resampling.
- `key.test.ts`: triad activates KK and Temperley ranking; single sine activates insufficient-evidence guard; silence gives no candidates.
- `bands.test.ts`: 50 Hz and 10 kHz hit sub/air; zeros activate null dB; 48k checks Nyquist cap.
- `png.test.ts`: 1x1 RGB round trip proves scanline/filter/zlib layout; mutated IDAT activates CRC rejection; invalid length/filter activate E_INPUT/decoder guard.
- `spectrogram.test.ts`: sine and impulse prove horizontal/vertical mapping; long PCM activates 2400-column cap and averaging; supplied timeline toggles bar-grid branch; colormap anchors guard LUT drift.
- `pianoroll.test.ts`: C4 rectangle proves pitch/time mapping, drum lanes/labels and section role trigger font paths, drum-only activates `NO NOTES`.
- `beats.test.ts`: song overrides contrary estimate and excludes tail; audio uses estimate and 4/4; silence omits beats file; duplicate section repeats get unique IDs.
- `analyze.test.ts` plus `src/cli/main.test.ts`: peak ≥1, >3 LU target gap, sub+low >.55, air <.001, uncertain key, malformed/missing input, WAV/song alignment mismatch, unwritable output and unknown flag each activate the named warning/error; second same-input run proves byte identity. `analysis.md` asserts each warning and section/track row is legible to a text-only agent.
