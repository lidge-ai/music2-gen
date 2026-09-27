# 002 — Flow metrics for the overview image (algorithms and parameters)

Source: read-only research subagent (gpt-6-sol, 2026-09-28). Formulas and constants cite EBU Tech 3341, ITU-R BS.1770-5, Foote 2000 and the FMP notebooks; parameter choices are music2 design decisions marked as such. Main dispositions are in 004.

---

## 1. Loudness flow

**Formula and parameters.** Reuse the K-weighting coefficients and channel-power sum in [loudness.tool.ts](../../../src/audio-io/loudness.tool.ts). Accumulate filtered power in 100 ms blocks: 4 blocks for momentary loudness and 30 for short-term loudness. At 44.1/48 kHz, a block is exactly 4,410/4,800 samples. For each complete, trailing window, output `−0.691 + 10 log10(mean power)` at 10 Hz. These curves are **ungated**; use `null` for zero power or before a full window exists. EBU Tech 3341 specifies sliding rectangular 400 ms and 3 s windows and at least 10 Hz short-term updates. [EBU Tech 3341](https://tech.ebu.ch/publications/tech3341), [ITU-R BS.1770-5](https://www.itu.int/rec/R-REC-BS.1770-5-202311-I).

For a placement, compute the mean filtered power over its exact sample interval, convert once to LUFS, then report `next − previous` in LU. This is an **ungated section mean**; retain the existing gated `integratedLufs` as a separately named measurement. Exclude render tail from declared sections. A mean of LUFS values would be mathematically wrong.

**Pitfall and test vector.** A mono 997 Hz sine at amplitude 0.1, after filter settling, reads approximately −23.01 LUFS; amplitude 0.2 reads −16.99 LUFS. Two such sections should differ by +6.02 LU. A transition within a 3 s window changes its *power* average gradually; silence produces `null`, never JSON `-Infinity`. The reference 997 Hz calibration is specified by [BS.1770-5](https://www.itu.int/rec/R-REC-BS.1770-5-202311-I).

## 2. Three-band waveform

**Formula and parameters.** Choose music2’s own crossovers at 200 and 2,000 Hz. For each stereo channel, split with second-order Butterworth low/high-pass biquads: `low = LP200(x)`, `remainder = HP200(x)`, `mid = LP2000(remainder)`, `high = HP2000(remainder)`. For cutoff `f`, use `ω=2πf/Fs`, `α=sin(ω)/(2Q)`, `Q=1/√2`; standard low-pass numerator is `[(1−cosω)/2, 1−cosω, (1−cosω)/2]`, high-pass is `[(1+cosω)/2, −(1+cosω), (1+cosω)/2]`, and denominator is `[1+α, −2cosω, 1−α]`. Normalize by its first coefficient. These are *music2 design choices*, not vendor crossover specifications.

Map sample `n` to column `floor(n·W/N)` with `W=1200`. Per band and column, store `peak=max(abs(sample))` and `rms=sqrt(sum(sample²)/count)`; for stereo, take the larger channel peak and average channel powers before RMS. Draw a symmetric peak envelope, with a darker RMS envelope. Give each column a hue from its three band RMS values, using a shared fixed dB range such as −60 to 0 dBFS. Legend: **red <200 Hz, green 200–2,000 Hz, blue >2,000 Hz**. Serato explicitly documents that mapping. [Serato waveform guide](https://support.serato.com/hc/en-us/articles/224969307-Main-Waveform-Display).

**Vendor evidence and limit.** Rekordbox documents distinct `BLUE`, `RGB`, and `3Band` modes, but its manual does not specify an exact band-to-color table or crossover frequencies. Traktor offers `Ultraviolet`, `Infrared`, `X-Ray`, and `Spectrum` color modes, so it has no single fixed RGB mapping to reproduce. Label the proposed palette “music2 RGB,” not an exact Rekordbox or Traktor emulation. [rekordbox manual](https://cdn.rekordbox.com/files/20250925103803/rekordbox7.2.3_manual_EN.pdf), [Traktor preferences](https://docs.native-instruments.com/ni-tech-manuals/traktor-pro-manual/en/preferences).

**Pitfall and test vector.** Biquad bands overlap near a crossover and have startup transients; do not claim their RMS powers sum exactly to full-band power. Separate 100, 1,000, and 8,000 Hz sine intervals should yield respectively red-, green-, and blue-dominant columns at both sample rates. A half-scale sine has an interior peak near 0.5 and RMS near `0.5/√2`.

## 3. Bar features, self-similarity, and repeats

**Formula and parameters.** Use `Timeline.secondsPerBar` and `placements.startBar` for exact song intervals. For WAV-only audio, use consecutive beat intervals only when the existing `BeatMap` is reliable; otherwise use fixed, half-open 0.5 s frames. Mark the axis as “beats” or “0.5 s,” never “bars” when its meter is inferred. Exclude a song’s render tail from bar features.

For each interval, form 20 values:

- 12 chroma bins from its spectra, restricted to 100–5,000 Hz as in [key.tool.ts](../../../src/analyze/key.tool.ts); sum magnitudes by nearest equal-tempered pitch class, then L2-normalize.
- Six band energies using the existing `[20,60,250,500,2000,8000,20000]` Hz edges. Compute `10log10(max(power,10⁻⁸))`, clamp to `[−80,0]`, map to `[0,1]`, then L2-normalize the six-value group.
- Onsets per second, clamped and scaled by 8; section K-weighted mean LUFS mapped from `[−60,0]` to `[0,1]`.

Multiply the chroma group by 0.5, the band group by 0.3, and the two scalars by 0.1 each; L2-normalize the complete vector. Set `S(i,j)=dot(vᵢ,vⱼ)` in a `Float32Array(N*N)`; if either interval is silent, set similarity to zero and flag it separately. This nonnegative feature design keeps similarity in `[0,1]`. These weights and thresholds need corpus tuning, but the specification is deterministic.

Render the **numeric matrix** at up to 256×256 pixels: each pixel averages its corresponding rectangular cell range, then maps 0→dark navy and 1→pale yellow. Keep numeric resolution for detection. Draw 1-pixel section-boundary lines on both axes, section labels outside the matrix, and bar/time ticks. A repeating passage appears as an off-diagonal bright stripe parallel to the main diagonal, as described in the [FMP structure notebook](https://www.audiolabs-erlangen.de/resources/MIR/FMP/C4/C4S4_StructureFeature.html).

To report repeats, scan lags `d≥8` bars for maximal runs of `S(i,i+d)≥0.85`; require at least 8 bars, mean similarity ≥0.90, and nonoverlapping intervals. Merge overlapping reports, retaining the longest run, then highest mean. Report 1-based inclusive ranges, for example, “bars 5–12 repeat bars 21–28; mean similarity 0.93.” A high cosine score alone does not prove the same notes or arrangement.

**Test vector.** Feed the matrix stage eight distinct unit vectors at bars 5–12 and exact copies at 21–28, with orthogonal vectors elsewhere. The matching stripe must contain eight values of 1 and produce that repeat report; a silent interval must produce no repeat.

## 4. Novelty and declared boundaries

**Formula and parameters.** Apply a Foote checkerboard around each *boundary* `b`, between intervals `b−1` and `b`. Use offsets `u,v∈[−L,L−1]`; let `g(u)=exp(−(u+0.5)²/(2(L/2)²))`. Set `K(u,v)=g(u)g(v)` when both offsets are on the same side, and its negative otherwise; normalize by `Σ|K|`. Then `novelty(b)=max(0, Σ K(u,v)S(b+u,b+v))`. Choose `L=min(4,max(1,floor(N/6)))` bars, or `L=min(8,max(1,floor(N/6)))` for 0.5 s WAV frames; use the equivalent span for beat frames. Evaluate only where the full kernel fits to prevent false edge peaks. This even-sized, boundary-centered form is an implementable adaptation of Foote’s method. [Foote 2000](https://doi.org/10.1109/ICME.2000.869637), [FMP novelty notebook](https://www.audiolabs-erlangen.de/resources/MIR/FMP/C4/C4S4_NoveltySegmentation.html).

Pick strict local maxima above `max(0.08, median(novelty)+2·MAD)`, with a minimum separation of `L` frames; retain the higher peak on conflicts. A declared placement boundary is a hit when a picked peak lies within ±1 bar. On WAV-only data, report seconds and avoid a declared-boundary score.

**Pitfall and test vector.** A 24-bar feature sequence `A×8, B×8, A×8`, where A and B are orthogonal unit vectors, should peak at boundaries 8 and 16 and match declarations there. Constant features should produce no interior peak. Kernel size trades small changes against stable phrase boundaries; the [FMP notebook](https://www.audiolabs-erlangen.de/resources/MIR/FMP/C4/C4S4_NoveltySegmentation.html) documents this dependence.

## 5. Onset density and brightness

**Formula and parameters.** Reuse the 10 ms spectral-flux envelope from [tempo.tool.ts](../../../src/analyze/tempo.tool.ts). Pick peaks exceeding `max(0.15, local median + 3·MAD)` in a ±0.5 s neighborhood, then retain the strongest within each 50 ms refractory span. Count peaks in each half-open bar/frame; report both count and `count/durationSeconds`. For onset tests, allow roughly ±20 ms timing error because the FFT window spreads an impulse. Reusing the existing normalized envelope requires exposing it or factoring its calculation into a shared function; calling `estimateTempo` alone does not return it.

For spectral centroid, use Hann-windowed 4,096-point FFT frames with 1,024-sample hop. For each nonsilent frame, `centroid=Σ(fₖ·|Xₖ|)/Σ|Xₖ|`, using bins from 20 Hz to Nyquist. Average centroids for frames whose **centers** lie in the interval, weighted by frame magnitude sum; return `null` when no such frame has energy. Brightness is frequency balance, not loudness.

**Test vectors.** Four isolated clicks centered well inside a 2 s bar should yield count 4 and density 2/s; a click exactly on the next bar boundary belongs only to the next bar. Sustained 1 kHz and 8 kHz sines should have near-zero onset density and centroids near 1,000 and 8,000 Hz respectively, within about one FFT bin plus window leakage. Silence gives zero onsets and a `null` centroid.

All five metrics fit typed arrays and the existing FFT, PNG, font, and timeline facilities. The read-only research found no need for a runtime dependency.
