# R4: Sampler DSP, time-stretch, slicing, plugin bridge (music2)

Prepared 2026-09-28 for music2 (MIT, zero-dependency TypeScript, offline + deterministic).
Tag legend: **V** = verified on a fetched page (URL given inline or by [S#] key into Sources). **I** = my inference, or a number I measured myself with a local clean-room script (marked "I-measured"; the script is described in section 0 and is not part of any cited source).

No GPL/AGPL/LGPL source code was read. For pedalboard, DawDreamer, Rubber Band and libsamplerate I used only README and API docs. I did read code from the TSM Toolbox (`wsolaTSM.m`, `pvTSM.m`, `hpTSM.m`, `hpSep.m`, `win.m`), which is MIT-licensed per its site and file headers [S9][S10]. I also read the Niemitalo interpolator paper, whose license line says "Distribute, host and use this paper freely" [S7].

---

## 0. How the "I-measured" numbers were produced

- **I:** I wrote throwaway numpy scripts locally, outside the repo, following only the equations in the cited papers. They cover linear, 4-point Hermite, and Kaiser-windowed-sinc resamplers, plus WSOLA, a phase vocoder with identity phase locking, and short-frame OLA. I used them to check that the proposed test oracles actually tell good output from bad. Setup: Fs = 44100 Hz. Spur level = the largest FFT bin more than 150 Hz from the expected tone, under a Kaiser(β=20) analysis window, in dB relative to the tone peak. Treat these numbers as calibration for thresholds, not as literature values.

---

## 1. Resampling / pitch-shifting audio samples

### 1.1 Core facts (JOS, Digital Audio Resampling Home Page)

- **V** Bandlimited interpolation evaluates `x(t) = Σ_n x(nTs)·h_s(t − nTs)` with `h_s` = sinc. To resample, you evaluate that sum at the new sample instants [S1: Theory_Ideal_Bandlimited_Interpolation].
- **V** When the new rate is *lower* than the original, "the lowpass cutoff must be placed below half the new lower sampling rate", and the filter is scaled to keep unity passband gain [S1].
  - *Sampler meaning (I):* **pitching UP by reading the source faster is a downsampling of the source.** The kernel cutoff must scale by `1/ratio`, otherwise content above the new Nyquist folds back as aliasing.
- **V** Truncating sinc at the 5th zero crossing on each side gives "only slightly more than 20 dB" of stopband rejection. Tapering to the same length with a Kaiser window gives a stopband that "starts out close to −80 dB" [S1: Theory_Practice].
- **V** JOS's design example uses **Nz = 13 zero-crossings per wing** "for high audio quality at 20% oversampling", so the effective FIR is 27 zero crossings long. The CCRMA filter table stores **512 samples per zero-crossing**, described as "somewhat over designed". Values between table points are linearly interpolated [S1: Implementation].
- **V** When the conversion factor is below 1 (i.e. downsampling), "the step-size through the filter table is reduced … this lowers the filter cutoff to avoid aliasing". Cost is roughly proportional to the *higher* of the two rates [S1: Implementation].
- **V** For a fixed stopband spec, "lowpass filters need approximately twice as many multiply-adds per sample for each halving of the transition band width" [S1: Implementation].
  - Worked example from the same page: with a 20 kHz cutoff, 44 kHz sampling leaves a ~2 kHz transition band and 48 kHz leaves ~4 kHz, so a 10% higher rate halves the filter work.
- **V** Table-size rule: with `nc`-bit coefficients, store about `2^(nc/2)` entries per zero-crossing and use about `nc/2` bits of interpolation between entries [S1: Choice_Table_Size, Conclusions].
- **V** Kaiser formulas (JOS "Under the Hood of kaiserord") [S2]:
  - `β = 0.1102(A − 8.7)` for A > 50 dB, and `β = 0.5842(A−21)^0.4 + 0.07886(A−21)` for 21 < A < 50.
  - Filter order `M = (A − 8)/(2.285·Δω)`, with Δω in rad/sample.
  - "Typical values in audio work are A = 60 to 90."
- **V** Kaiser window: `w(n) = I0(β·sqrt(1 − (n/(M/2))²)) / I0(β)`, with `I0(x) = Σ_k [ (x/2)^k / k! ]²` [S3].
- **V** Linear interpolation is `ŷ(n+η) = (1−η)·y(n) + η·y(n+1)`, with η ∈ [0,1) [S4].

### 1.2 Polynomial interpolators (Niemitalo 2001, "deip.pdf")

- **V** 4-point, 3rd-order Hermite (x-form). With samples `y[-1], y[0], y[1], y[2]` and fraction `x ∈ [0,1)` [S7]:
  ```
  c0 = y[0]
  c1 = 0.5*(y[1] - y[-1])
  c2 = y[-1] - 2.5*y[0] + 2*y[1] - 0.5*y[2]
  c3 = 0.5*(y[2] - y[-1]) + 1.5*(y[0] - y[1])
  out = ((c3*x + c2)*x + c1)*x + c0
  ```
- **V** "Modified SNR" (the paper's pinked, pre-emphasized measure) at 2x / 4x / 8x / 16x / 32x oversampled input [S7]:

  | Interpolator | 2x | 4x | 8x | 16x | 32x |
  |---|---|---|---|---|---|
  | Linear | 19.1 dB | 33.8 dB | 47.0 dB | 59.7 dB | 72.0 dB |
  | Hermite 4-point 3rd-order | 23.5 dB | 44.2 dB | 64.0 dB | 83.1 dB | 101.8 dB |
  | Hermite 6-point 3rd-order | 30.5 dB | 60.2 dB | 89.1 dB | 116.3 dB | 142.3 dB |

- **V** The paper targets *oversampled* audio. Polynomial interpolators have no cutoff that scales with the ratio, so they cannot prevent aliasing when pitching up material that already reaches the Nyquist frequency [S7] (the anti-alias half of this is I).

### 1.3 Measured comparison, to calibrate test thresholds (I-measured)

Sinc kernel used below ("sinc16"): Kaiser-windowed sinc, Nz = 16 zero-crossings per wing, A = 90 dB (β = 8.96), rolloff 0.9. The cutoff is `fc = 0.45·min(1, 1/ratio)` cycles per input sample. At ratio ≤ 1 that is ≈ 36 taps per output sample.

**Worst spur relative to the tone (dB):**

| Input tone, shift | Linear | Hermite4 | sinc16 | sinc Nz=8, A=80 | sinc Nz=32, A=100 |
|---|---|---|---|---|---|
| 1 kHz, +7.3 st | −65.1 | −91.5 | −119.6 | | |
| 5 kHz, +7.3 st | −36.1 | −47.5 | −117.3 | −104.6 | −131.8 |
| 10 kHz, +3.3 st | −21.1 | −26.3 | −107.9 | | |
| 10 kHz, −7.3 st | −21.4 | −26.6 | −103.1 | −87.0 | −123.3 |
| 15 kHz, +5.3 st (output 20.4 kHz) | −11.9 | −14.2 | −116.4 | −95.2 | −129.8 |
| 15 kHz, +12 st (output 30 kHz, above Nyquist) | alias at −0.4 dB of full scale | alias at −0.4 dB | −113 dB (removed) | | |

- Integer ratios (+12 st with power-of-two steps) come out exact for every method, which is why they are useless as test cases. **Use non-integer ratios such as +7.3 st.**

**Passband gain (dB) at ratio 2^(0.1/12):**

| Frequency | Linear | Hermite4 | sinc16 | sinc Nz=32 |
|---|---|---|---|---|
| 5 kHz | −0.369 | −0.027 | 0.000 | |
| 10 kHz | −1.495 | −0.381 | 0.000 | |
| 14 kHz | −2.982 | −1.295 | 0.000 | |
| 18 kHz | −5.053 | −3.105 | −0.601 | −0.006 |

**Recommendation (I):**
- Default the sampler to Kaiser-windowed sinc with **Nz = 16, A = 90 dB, rolloff = 0.90**.
- Offer **Nz = 32, A = 100 dB** as a `hq` mode, and **Hermite4** as a `fast` / preview mode.
- Linear should only be a "lo-fi" character option.
- Precompute the kernel as a table of `L = 512` phases per zero-crossing (JOS) with linear interpolation between phases, or evaluate it directly in `Float64Array`. Output must be bit-identical run to run: no `Math.random`, fixed summation order.

---

## 2. Time-scale modification (TSM)

### 2.1 Framework and conventions (Driedger & Müller 2016 review, CC-BY)

- **V** Frames are "usually in the range of 50 to 100 milliseconds". The stretch factor is **α = Hs/Ha**: α > 1 lengthens, α < 1 shortens. Common choices are Hs = N/2 or N/4, with `Ha = Hs/α` [S8 §2].
- **V** Hann window `w(r) = 0.5(1 − cos(2π(r+N/2)/(N−1)))` satisfies `Σ_n w(r − nN/2) = 1`. Synthesis frames are normalized by the sum of the overlapping windows: `y_m = w·x_m / Σ w(r − nHs)` [S8 §3.1].
- **V** TSM Toolbox window: `win(len,β) = sin(π·(0:len−1)/len)^β`. β = 2 gives a periodic Hann, β = 1 a sine window [S10 win.m].
- **V** In the toolbox, output length for a constant factor s is **`ceil(s·L)`**. The anchor points are `[1 1; L ceil(s·L)]` [S10 wsolaTSM.m / pvTSM.m].

### 2.2 Stretch-factor conventions (important: they are inverted between libraries)

| System | Parameter | Meaning |
|---|---|---|
| TSM review / toolbox | α (s) | output length / input length (α = 2 → twice as long). **V** [S8][S10] |
| pedalboard `time_stretch` | `stretch_factor` | **2.0 doubles the speed and halves the length**, i.e. = 1/α. **V** [S12] |
| DawDreamer PlaybackWarp | `time_ratio` | "> 1 slow down, < 1 speed up", i.e. = α. **V** [S15] |
| FL Studio Sampler | MUL knob | "stretch the sample to twice its original length" (time multiplier ≈ α). **V** [S19] |
| Fruity Slicer | TS slider | ±400%, time stretch while keeping pitch. **V** [S18] |

- **I:** music2 should store **α (output/input duration)** internally, and name it `timeScale` to avoid ambiguity.

### 2.3 Methods, defaults and where each fits

#### OLA

- **V** OLA is unsuited to harmonic content, because of phase-jump artifacts. It "delivers high quality results for purely percussive signals", and should use a "very small frame length N (roughly 10 milliseconds)" to reduce transient doubling [S8 §3.3].
- **V** Toolbox OLA as used inside HP-TSM: `synHop = 128`, `win = Hann 256`, `tolerance = 0` [S10 hpTSM.m, demoTSMtoolbox.m].

#### WSOLA (Verhelst & Roelands 1993)

- **V** Allows analysis-frame shifts of up to ±Δmax. It picks the shift that maximizes cross-correlation with the "natural progression" of the previous frame [S8 §4].
- **V** Rule of thumb: "frame length N corresponding to 50 ms and a tolerance parameter of 25 ms". The tolerance must be at least half a period, and the lowest audible frequency is assumed to be ~20 Hz [S8 §4.3].
- **V** Known artifacts:
  - Transient doubling and stuttering when stretching.
  - Transient skipping when compressing (α < 1).
  - Phase jumps on polyphonic material [S8 §4.2].
- **V** Toolbox defaults: `synHop = 512`, `win = Hann 1024` (`win(1024,2)`), `tolerance = 512` samples [S10 wsolaTSM.m].
- **V** Toolbox algorithm, in outline:
  1. Synthesis positions are `1 : synHop : outLen + N/2`.
  2. Analysis positions are `round(interp1(anchorOut, anchorIn, synPos, 'linear', 'extrap'))`.
  3. After each overlap-add, compute the cross-correlation of the next region `[ana(i+1) − tol, ana(i+1) + N − 1 + tol]` against `xC(currAnaRange + synHop)`.
  4. Set `del = tol − argmax + 1`.
  5. At the end, divide by the accumulated window sum, clamped with `ow < 1e−3 → 1` [S10].
- **V** Transient preservation (Grofit & Lavner 2008, as summarized in the review): near detected transients, set the analysis hop equal to the synthesis hop so the transient is copied unmodified. The global factor is compensated between transients [S8 §4.3].

#### Phase vocoder (PV-TSM) with identity phase locking (Laroche & Dolson 1999)

- **V** Phase propagation: `φ_mod(m+1,k) = φ_mod(m,k) + F_IF(m,k)·Hs/Fs`. Instantaneous frequency comes from the heterodyned phase increment wrapped to [−π, π]. Initialization: `φ_mod(0,k) = φ(0,k)` [S8 §5.4].
- **V** "N typically corresponds to roughly 100 ms". Identity phase locking updates only peak bins and locks every other bin to the nearest peak, which reduces phasiness and transient smearing [S8 §5.6].
- **V** Toolbox defaults [S10 pvTSM.m]:
  - `synHop = 512`, `win = sin window 2048` (`win(2048,1)`).
  - `zeroPad = 0`, `restoreEnergy = 0`, `fftShift = 0`.
  - `phaseLocking = 0` (off by default).
- **V** Toolbox peak rule: a bin is a peak if it is **strictly greater than its 4 nearest neighbours (±1, ±2)**. The region of influence runs from `ceil((p_{n−1} + p_n)/2)` to the next region start − 1, and the first region starts at bin 1 [S10 pvTSM.m].

#### HP-TSM (Driedger, Müller, Ewert 2014): recommended for mixed material

- **V** Method: separate harmonic and percussive parts with median filtering (Fitzgerald). Stretch the harmonic part with PV + identity phase locking and the percussive part with short-frame OLA, then sum [S8 §6].
- **V** Median-filter HPSS [S8 §6.2]:
  - `Ỹh = median over time (±ℓh frames)`, `Ỹp = median over frequency (±ℓp bins)`.
  - Binary masks: `Mh = 1 iff Ỹh > Ỹp`, `Mp = 1 iff Ỹp ≥ Ỹh`.
- **V** Toolbox defaults [S10 hpTSM.m, hpSep.m]:
  - HPS: `anaHop = 256`, `win = Hann 1024`, `filLenHarm = 10`, `filLenPerc = 10`, `maskingMode = 'binary'`.
  - Harmonic path (PV): `synHop = 512`, `Hann 2048`, `phaseLocking = 1`.
  - Percussive path (OLA): `synHop = 128`, `Hann 256`, `tolerance = 0`.
- **V** Toolbox license: the site says MIT (v2.03, updated 2021). The 2014 DAFx paper says it was originally published under GNU-GPL, so cite the MIT v2.03 site as the authority [S9][S11].

### 2.4 Scaling defaults to 44.1/48 kHz (I)

The toolbox defaults are given in samples. The review's millisecond guidance (WSOLA 50 ms / 25 ms, PV ~100 ms, percussive OLA ~10 ms) matches those sample counts at ~22.05 kHz: 1024 samples ≈ 46 ms, 2048 ≈ 93 ms, 256 ≈ 11.6 ms. So at 44.1/48 kHz, double them:

| Method | N (samples @44.1/48k) | Hs | Tolerance | Window | Use for |
|---|---|---|---|---|---|
| OLA-perc | 512 (11.6 / 10.7 ms) | 256 | 0 | Hann | Drums only, or the HP-TSM percussive path |
| WSOLA | 2048 (46 / 43 ms) | 1024 | 1024 (23 ms) | Hann | Monophonic / speech; cheap default for "tones" |
| PV + phase lock | 4096 (93 / 85 ms) | 1024 (N/4) | n/a | Hann | Tonal, polyphonic pads |
| HP-TSM | HPS 2048 / hop 512, medians 17 frames × 17 bins; PV 4096/1024; OLA 512/256 | | | | Full mixes; the "complex" default |

- **I:** The median lengths above (17 × 17) are a guess scaled from the toolbox's 10 × 10 at a doubled rate. They should be tuned with the oracles in 2.5.

**Drums vs tonal (V from [S8], mapping to DAW modes is I):**
- Drums: OLA with ~10 ms frames, or transient-preserving slice stretching.
- Tonal: PV with phase locking.
- Monophonic: WSOLA.
- Mixed: HP-TSM.

### 2.5 Objective metrics and test oracles

- **V** Roberts & Paliwal (2020) OMOQ uses PEAQ features plus nine TSM-specific features in a network, reaching RMSE 0.487 and Pearson 0.865 against MOS. Their finding: IPL-PV (identity phase-locking PV) is best overall for music, and Elastique best for solo instruments/voice [S13]. This is too heavy for music2's tests, so use the analytic oracles below.
- **V** Parabolic peak interpolation for frequency estimates [S5]:
  - `p = 0.5(α − γ)/(α − 2β + γ)` (α, β, γ = log magnitudes of the three bins around the peak).
  - `f = (k* + p)·Fs/N`.

**I-measured validation.** Implementations (Fs 44.1 kHz): WSOLA N=1024, Hs=512, tol=512; PV with lock at N=2048, Hs=512; OLA N=256, Hs=128.
- Output length = `ceil(α·L)` exactly, for α ∈ {0.5, 0.75, 1.25, 1.5, 2.0}.
- Pitch of a 220 Hz tone with 5 harmonics: |error| ≤ 0.09 cents (WSOLA) and ≤ 0.01 cents (PV) across that α range.
- RMS level change: 0.00 dB at α = 0.5 and 2.0 (steady tone).
- Identity (α = 1): PV SNR 258 dB (essentially perfect reconstruction). WSOLA SNR 32.8 dB (not transparent).
- Onsets: 8 noise bursts, 250 ms apart, 5 ms decay. Worst absolute timing error by α:

  | α | OLA (256/128) | WSOLA | PV + lock |
  |---|---|---|---|
  | 0.5 | 0.68 ms, all onsets found | 131 ms, 2 onsets lost | 128 ms, 2 onsets lost |
  | 0.75 | 1.74 ms | 178 ms, 1 lost | 2.9 ms |
  | 1.5 | 1.73 ms | 9.0 ms | 4.3 ms |
  | 2.0 | 2.49 ms | 5.0 ms | 8.3 ms |

  This reproduces the review's "transient skipping when compressing" (V qualitatively [S8 §4.2]).

---

## 3. Onset detection and slicing

### 3.1 Detection functions

- **V** Bello et al. 2005 tutorial [S14]:
  - HFC (Masri) weights each bin "linearly … in proportion to its frequency" (`W_k = |k|`). It "produces sharp peaks during attack transients and is notably successful when faced with percussive onsets".
  - On their database, optimal points were: HFC 90% true positives at 7% false positives (95% TP at 10% FP); spectral difference 83.0% / 4.1%; phase deviation 81.8% / 5.6%.
  - HFC does better on "highly percussive sounds and complex mixtures (with drums)". Phase deviation does better on pitched sounds.
  - A match is correct if within **50 ms**.
- **I:** HFC(n) = Σ_k |k|·|X(n,k)|² (squared magnitude, following the tutorial's energy form).
- **V** Dixon 2006 "Onset Detection Revisited" [S16]:
  - STFT: Hamming window, **N = 2048 (46 ms @ 44.1 kHz)**, **hop h = 441 (10 ms, 78.5% overlap)**, frame rate 100 Hz.
  - Spectral flux: `SF(n) = Σ_k H(|X(n,k)| − |X(n−1,k)|)`, with `H(x) = (x+|x|)/2`. Empirical tests favoured the **L1 norm** and **linear magnitude**, not log.
  - Complex domain: target `X_T(n,k) = |X(n−1,k)|·e^{j(ψ(n−1,k) + ψ'(n−1,k))}`, where ψ' is the phase difference wrapped to (−π, π]. Then `CD(n) = Σ_k |X(n,k) − X_T(n,k)|`.
  - Rectified CD (RCD): count a bin only if `|X(n,k)| ≥ |X(n−1,k)|`.
  - Results on 106,054 piano onsets: SF F = 0.964 (mean absolute timing error 8.8 ms); CD F = 0.966 (12.8 ms); RCD F = 0.955 (9.3 ms).
  - On non-pitched percussion (NP set): SF F = 0.967, CD 0.936, RCD 0.963.
  - "Spectral flux has the advantage of being the simplest and fastest algorithm."

### 3.2 Peak picking

- **V** Dixon [S16]:
  1. Normalize f(n) to mean 0 and standard deviation 1.
  2. Accept n if all three hold:
     - (a) `f(n) ≥ f(k)` for all `|k − n| ≤ w`;
     - (b) `f(n) ≥ mean(f[n − m·w .. n + w]) + δ`;
     - (c) `f(n) ≥ g_α(n−1)`, where `g_α(n) = max(f(n), α·g_α(n−1) + (1−α)·f(n))`.
  3. Constants: **w = 3, m = 3**. δ and α were tuned per dataset, and the gain from g_α was "marginal".
- **V** Bello [S14]:
  1. Normalize by subtracting the mean and dividing by the max absolute deviation.
  2. Low-pass filter.
  3. Subtract a **moving-median** adaptive threshold. The median window is "around 100 ms", and the median scale factor "is set to 1", while the fixed offset δ is sensitive.
  4. Every local maximum above zero is an onset.
- **I:** Threshold form: `thr(n) = δ + λ·median(|d(n−M..n+M)|)`, with M ≈ 100 ms and λ = 1.

### 3.3 DAW slicer behaviour (vendor manuals)

**Ableton Simpler, Slicing mode [S21]:**
- **V** Slice By options:
  - **Transient**: controlled by Sensitivity; "higher numbers result in more slices, up to a maximum of **64 slices**".
  - **Beat**: Division chooser.
  - **Region**: N evenly spaced slices.
  - **Manual**.
- **V** Playback modes: Mono / Poly / Thru. Fades are measured per slice, except in Thru mode.

**Ableton "Slice to New MIDI Track" [S20]:**
- **V** Divides by beat resolution, transients, or Warp Markers. It refuses to proceed if the result would exceed **128 slices**, because a Rack holds at most 128 chains.
- **V** It creates a MIDI clip with **one note per slice in a chromatic ascending "staircase"**, plus a Drum Rack with one Simpler per chain. "Preserve warped timing" is an option.
- **V** Convert commands use the clip's transient markers.
- Not verified: the starting MIDI note of the staircase.

**Ableton audio quantize [S17 §9.2.7]:**
- **V** "Aligns the audio by moving the nearest transient to the closest grid line". The Amount control shifts Warp Markers "by a percentage of the chosen quantization value".

**FL Fruity Slicer [S18]:**
- **V** Slicing options:
  - Use sample built-in slicing (embedded slice markers win over auto-detection).
  - Dull / Medium / Sharp auto-slicing (rough / normal / fine thresholds).
  - Even beat slices "1/6, 1/4, 1/3 beat… Beat".
  - No slicing.
  - Zero-cross check, which snaps markers to the nearest zero crossing.
- **V** Controls: PS ±12 semitones; TS ±400%; DeClick; ATT/DEC fades; "Play to End".
- **V** Dump to piano roll modes include Normal / Reverse / Random / Quantize / Swing / Stutter.

**FL Slicex [S22][S23]:**
- **V** Dull / Medium / Sharp auto-slicing is "based on peak detection" ("Dull" gives fewer slices, "Sharp" more).
- **V** Also offers Small / Medium / Large grid slicing, Detect beats, Detect pitch regions, and "Zero-cross check all regions".
- **V** Embedded slice or region data is used instead of beat detection.

**FL Sampler declicking [S19]:**
- **V** Default is "Out only": a **10 ms cosine S-shaped fade-out**. Other options: Transient; Generic 20 ms in and out; Smooth 100 ms; Crossfade 200 ms.

---

## 4. Warping semantics (for mapping music2 clips)

### Ableton Live 12 [S17]

- **V** With Warp off, the clip plays at its original tempo.
- **V** Warp Markers lock a sample position to a timeline position. Adding a marker when "there are no Warp Markers after [it]" changes the clip tempo.
- **V** Default Warp Mode is **Beats**. Newly imported loops are assumed to be 1, 2, 4, 8 or 16 bars, with markers at start and end. Auto-warp puts a marker "on the first beat for each bar".
- **V** Modes and their controls:

  | Mode | Controls / behaviour |
  |---|---|
  | Beats | Preserve = Transients or a grid division. Transient Loop Mode = Off / Forward / Back-and-Forth. Transient Envelope 0–100 (100 = no fade). |
  | Tones | Grain Size |
  | Texture | Grain Size, Fluctuation |
  | Re-Pitch | Speed change changes pitch; "double the speed, the pitch goes up by an octave"; transpose disabled |
  | Complex / Complex Pro | Pro adds Formants % and Envelope (default **128**) |

- **V** DawDreamer represents Ableton warp markers as an array of **(seconds, beats)** pairs. With `warp_on = True`, `time_ratio` is ignored. `start_marker`, `end_marker`, `loop_start` and `loop_end` are in beats [S15].
- **V** AbletonParsing (MIT): `WarpMarker.seconds` is a position in the audio; `.beats` is "typically quarter note relative to 1.1.1". Live 12 `.asd` files use a different binary format that the library does not support [S24].
- **V (third-party note):** In `.als` XML, `WarpMarkers > WarpMarker[SecTime, BeatTime]` and `IsWarped[Value]`. Clip bounds `CurrentStart` / `CurrentEnd` are in beats [S25]. See R3 for the authoritative ALS/DAWproject treatment.

### FL Studio [S19]

- **V** TIME knob options: `(none)` (the default for Playlist audio), Autodetect, Project tempo (locks to tempo), Beat/Bar #.
- **V** Stretch modes:
  - **Realtime:** Resample (tape-like), Stretch, Stretch pro (adds formant shift).
  - **Elastique (offline, "don't work with Tempo changes"):** e3 Generic, e3 Mono.
  - **Special:** **Slice stretch** (loops at tempo ≤ project; slices stretched with e3), **Slice map** (loops at tempo ≥ project; slices *moved unstretched*), Auto.
  - **Legacy:** e2 modes.

### Mapping from a music2 clip warp mode (I)

| music2 mode | Ableton | FL Studio | music2 algorithm |
|---|---|---|---|
| `off` | Warp off | TIME = (none) | Raw sample at its native rate (resampled only if the SR differs) |
| `repitch` | Re-Pitch | Resample + Project tempo | Variable-ratio sinc resampling |
| `beats` | Beats (Preserve = Transients) | Slice stretch / Slice map | Slice at onsets; place each slice at its warped time; do not stretch inside the slice; declick 10 ms out |
| `tones` | Tones | e3 Mono / Stretch | WSOLA |
| `texture` | Texture | e3 Generic | PV + phase lock |
| `complex` | Complex (Pro) | e3 Generic | HP-TSM |

### Time map (I)

- Markers are sorted `(srcSec_i, beat_i)`, strictly increasing in both. The map is **piecewise linear**. Beyond the first and last marker, extrapolate with the slope of the nearest segment.
- Output time comes from the song tempo map applied to the beat. The local stretch is `α = d(outSec)/d(srcSec)`.
- The TSM toolbox's anchor-point interface (`s` as an n×2 matrix of input/output sample positions) is exactly this map expressed in samples [S10]. The review §7.1 describes the same idea: analysis instants are `a_m = τ⁻¹(s_m)` for synthesis instants `s_m = m·Hs/Fs` [S8].

---

## 5. Plugin hosting from Python

### 5.1 Spotify pedalboard (docs + README only)

**Loading plugins:**
- **V** Signature: `load_plugin(path_to_plugin_file, parameter_values={}, plugin_name=None, initialization_timeout=10.0)` [S12].
  - Formats: **VST3 on macOS, Windows and Linux; Audio Units on macOS only**.
  - Raises `ImportError` if the plugin cannot be loaded, and `RuntimeError` for a multi-plugin bundle without `plugin_name`.
  - `initialization_timeout` was added in v0.7.6.
- **V** VST3 plugin files are *not* cross-platform [S12].
- **V** Some VST3 plugins "may throw errors, hang, generate incorrect output, or outright crash if called from background threads". Background-thread support arrived in v0.8.8 [S12].

**Instruments and MIDI:**
- **V** **Instrument plugin support was introduced in v0.7.4** (`is_instrument` / `is_effect` too) [S12].
- **V** Call signature: `plugin(midi_messages, duration, sample_rate, num_channels=2, buffer_size=8192, reset=True)` returns a float32 array of `duration` seconds [S12]. Rules:
  - Timestamps are seconds from buffer start.
  - Messages later than `duration` are ignored.
  - Accepted message forms: mido-like objects, `(bytes, t)` tuples, or `(List[int], t)` tuples. **mido is not required.**
  - 64-bit input is converted to 32-bit.

**Parameters, state and latency:**
- **V** `plugin.parameters` is a dict keyed by normalized Python-identifier names. Values are guessed ranges and units. `raw_value` is always in [0, 1] and passed straight to the plugin [S12].
- **V** VST3 state [S12]:
  - `preset_data` holds bytes in `.vstpreset` format; invalid data "may cause the plugin to crash, taking the entire Python process down".
  - Also available: `load_preset(path)`, `raw_state`, `show_editor`, `reported_latency_samples`.
  - Latency is "automatically compensate[d]".
  - `manufacturer_name`, `identifier`, `version`, `category` were introduced in v0.9.4.

**Other features:**
- **V** `time_stretch` uses Rubber Band. Its defaults: `high_quality`, `transient_mode="crisp"`, `transient_detector="compound"`, `preserve_formants=True`. Changes faster than every 1,024 samples have no effect [S12].
- **V** Non-aliasing `Resample` qualities (`WindowedSinc8` … `WindowedSinc256`) were added in v0.9.15 [S12].

**Package, platforms and license:**
- **V** PyPI shows latest **0.9.25** (uploaded 2026-09-09), `requires_python >= 3.10`, a single runtime dependency `numpy`, and classifier "GPLv3". Version 0.7.4 was uploaded 2023-06-15 [S26].
- **V** README: licensed **GPLv3**. It statically bundles JUCE (GPLv3/commercial), the VST3 SDK (GPLv3), Rubber Band (GPLv2+/commercial), FFTW (GPLv2+), LAME (LGPL upgraded to GPLv3) and libgsm (ISC) [S27].
- **V** Wheels [S27]:
  - Linux: `manylinux` / `musllinux` for x86_64 (**AVX required**) and aarch64; "most Linux VSTs require glibc > 2.27".
  - macOS: Intel and Apple Silicon.
  - Windows: amd64.
- **V** Built-in `Gain`, `Reverb`, `Compressor`, etc. exist, which allows a self-test with no third-party plugin [S27].

### 5.2 DawDreamer (alternative)

- **V** License: **GPLv3**. You must also obey the licenses of JUCE, nanobind, libsamplerate, Rubber Band, the Steinberg VST2/3 SDKs and FAUST. Python 3.11–3.14; macOS 11+ (arm64/x86_64), Windows x86_64, Linux x86_64/aarch64 [S28]. PyPI shows 0.9.0 [S29].
- **V** Capabilities [S28][S30]:
  - Processor graphs; VST2/VST3/AU hosting (`.dll`, `.vst3`, `.vst`, `.component`, `.so`).
  - Parameters **always normalized to [0, 1]**.
  - State save/load, `.fxp` and `.vstpreset` loading.
  - Audio-rate and PPQN automation.
  - MIDI in seconds or beats, plus MIDI file export.
  - `get_latency_samples()`.
  - FAUST; Rubber Band PlaybackWarp with Ableton `.asd` warp markers.
- **V** Known issue: DawDreamer must be imported before JAX and other LLVM libraries [S28].
- **I:** Choose pedalboard for a minimal "render MIDI through plugin X, apply effect chain Y" bridge. Choose DawDreamer only if you need graph routing, PPQN automation or sidechain.

### 5.3 GPL implications for an MIT tool (I, not legal advice)

- **V** GNU GPL FAQ [S31]:
  - "Pipes, sockets and command-line arguments are communication mechanisms normally used between two separate programs … But if the semantics of the communication are intimate enough, exchanging complex internal data structures, that too could be a basis to consider the two parts as combined."
  - Modules "linked together in a shared address space" are "almost surely" one program.
  - Mere aggregation of separate programs on the same media is allowed.
- **I:** To keep music2 clean:
  1. **Never** vendor, bundle or `npm`-depend on pedalboard, DawDreamer or their wheels.
  2. Invoke Python as a **separate process** that the *user* installs.
  3. Exchange only **plain JSON commands and standard WAV/MIDI files**, never serialized internal objects.
  4. The bridge script (`music2-plugin-bridge.py`) imports pedalboard, so ship it as an optional, separately licensed file. It could be MIT, which is GPL-compatible, or GPL-3.0-or-later for maximum clarity. Never import it from music2 core.
  5. Document that anyone who distributes an environment containing pedalboard together with the bridge must meet GPLv3 for that part.

---

## 6. Recommended subprocess contract (JSON + WAV)

### 6.1 Discovery / availability (I)

1. Candidate interpreters, in order: `$MUSIC2_PYTHON`, then `python3`, then `python`; on Windows also `py -3`. Spawn with `shell: false`, a 20 s timeout, and `stdin` closed.
2. Probe command:
   `python3 -c "import json,sys,importlib.metadata as m; import pedalboard; print(json.dumps({'ok':True,'pedalboard':m.version('pedalboard'),'python':sys.version.split()[0],'platform':sys.platform}))"`
3. Treat pedalboard as available iff the exit code is 0, stdout parses as JSON, `ok === true`, and the version is **≥ 0.7.4** (instrument support; recommend ≥ 0.9.4 for plugin metadata).
4. Otherwise report `unavailable` with the stderr's last 2 KB. **Never** auto-install.
5. Cache the probe result per interpreter path and mtime.
6. **Plugin crash isolation:** run **one plugin-load/scan per process**, with a hard kill after `initialization_timeout + 30 s`. Pedalboard docs warn that bad state can take the whole Python process down (V [S12]).

### 6.2 Request (stdin, UTF-8 JSON, one object)

```json
{
  "protocol": "music2-plugin-bridge/1",
  "op": "render",
  "sampleRate": 48000,
  "channels": 2,
  "bufferSize": 512,
  "durationSec": 12.5,
  "tailSec": 2.0,
  "input": { "kind": "midi", "events": [[0.0, [144, 60, 100]], [1.0, [128, 60, 0]]] },
  "chain": [
    { "path": "/Library/Audio/Plug-Ins/VST3/Synth.vst3", "pluginName": null,
      "params": { "cutoff": 0.42 }, "rawParams": { "7": 0.1234 },
      "presetFile": null, "presetDataB64": null, "initTimeoutSec": 10 }
  ],
  "output": { "wavPath": "/tmp/music2/render_ab12.wav", "format": "f32" },
  "seed": 0
}
```

- For effect-only chains, `input.kind = "wav"` with `"wavPath"`.
- Event tuples are `[timeSec, [status, data1, data2]]`. They map 1:1 to pedalboard's documented `(List[int], timestamp_in_seconds)` form (V [S12]).
- WAV writing in the bridge (I): write the float32 file with Python stdlib `struct` using the section 6.4 layout. Stdlib `wave` has no float support, and relying on `pedalboard.io.AudioFile`'s default bit depth would leave the format implicit.
- Other ops:
  - `"probe"`: environment probe.
  - `"scan"`: returns `name`, `is_instrument`, `is_effect`, the parameters list with `{name, raw_value, units}`, `reported_latency_samples`, and `manufacturer_name`.
  - `"selftest"`: see 6.4.

### 6.3 Response (stdout, one JSON object; logs go to stderr only)

```json
{ "protocol": "music2-plugin-bridge/1", "ok": true, "wavPath": "...", "frames": 696000,
  "sampleRate": 48000, "channels": 2, "peak": 0.83, "rms": 0.12,
  "latencySamples": [0], "pedalboard": "0.9.25", "warnings": [] }
```

- Exit codes (I): 0 = ok; 2 = bad request; 3 = plugin load failed; 4 = render failed; 5 = pedalboard missing.
- On error: `{ ok: false, error: { code, message } }`.

### 6.4 WAV byte layout both sides must use (V from [S32])

- Encoding: **32-bit IEEE float, little-endian, interleaved.** Non-PCM formats need the extended fmt chunk plus a `fact` chunk.

| Offset | Size | Value |
|---|---|---|
| 0 | 4 | `RIFF` |
| 4 | 4 | `50 + dataBytes` (+1 if odd) |
| 8 | 4 | `WAVE` |
| 12 | 4 | `fmt ` |
| 16 | 4 | 18 |
| 20 | 2 | `0x0003` (IEEE float) |
| 22 | 2 | channels |
| 24 | 4 | sampleRate |
| 28 | 4 | sampleRate·channels·4 |
| 32 | 2 | channels·4 |
| 34 | 2 | 32 |
| 36 | 2 | cbSize = 0 |
| 38 | 4 | `fact` |
| 42 | 4 | 4 |
| 46 | 4 | frames (samples per channel) |
| 50 | 4 | `data` |
| 54 | 4 | dataBytes = frames·channels·4 |
| 58 | … | samples |

- **V** "Some programs (naively) assume … the preamble is exactly 44 bytes … This is not a safe assumption" [S32].
  - **I:** music2's reader must walk chunks. It must accept `fmt` sizes 16, 18 and 40, format tag `0x0001`, `0x0003` or `0xFFFE` (sub-format taken from the first 2 bytes of the GUID), and skip unknown chunks, including the pad byte on odd sizes.

**Bridge oracles (I):**
- **selftest:** a 1 kHz sine at −6 dBFS peak, 1.0 s at 48 kHz, through pedalboard's built-in `Gain(gain_db=−6)`.
  - Output frames = 48000 exactly.
  - Output peak = 0.5·10^(−6/20) = 0.2506 ± 0.001.
  - Correlation with the input > 0.9999.
- **Render length:** `frames == round((durationSec + tailSec)·sampleRate)`.
- **Silent-MIDI render of an instrument:** peak < 1e−6 is expected but not guaranteed. Treat it as a warning, not a failure.
- **Determinism:** hash the float bytes. Two identical requests to built-in plugins must hash-match. Third-party plugins may not be deterministic, so record `nondeterministic: true` when two renders differ.

---

## 7. Implementation contract suggestions (pure TypeScript, zero dependencies)

All DSP runs in `Float64Array` with fixed loop order, with float32 only at file I/O. No `Math.random`: any randomness uses a seeded PRNG (e.g. mulberry32) from `song.seed`. The FFT is an in-house radix-2 implementation; every N below is a power of 2.

### A. `resample(src, ratio, opts)`: sampler pitch / SR conversion

**Parameters:**
- `ratio` = input samples advanced per output sample, computed as `2^(semitones/12 + cents/1200) · srcRate/outRate`.
- `mode: 'sinc' | 'hermite' | 'linear'`, default `'sinc'`.

**Sinc defaults:**
- `Nz = 16` zero-crossings per wing, `A = 90 dB` → `β = 0.1102·(A−8.7) = 8.96`, `rolloff = 0.90`.
- Cutoff `fc = 0.5·rolloff·min(1, 1/ratio)` cycles per input sample.
- Half-width `Nz/(2fc)` input samples.
- Kernel `2fc·sinc(2fc·t)·kaiser(t)`.
- Table of `L = 512` phases per zero crossing, linearly interpolated.
- `hq`: `Nz = 32, A = 100`.

**Position accumulator:** time is `n0 + k·ratio` in float64. Use a separate integer+fraction accumulator (or compute it as `start + k*ratio`, never by repeated addition) to avoid drift.

**Edges:** zero outside the sample. The loop start/end crossfade is the sampler's job, not the resampler's.

**Oracles (I-measured thresholds):**
1. Identity: `ratio === 1` must take a **bypass path** (plain copy), so the output equals the input exactly. The sinc path with `rolloff = 0.9` is *not* an identity at integer positions: its kernel is `2fc = 0.9` at t = 0 and non-zero at other integers, i.e. it is a 0.45·Fs lowpass. Linear and Hermite are exact at integer positions. Max abs diff ≤ 1e−12 for bypass, linear and hermite.
2. Length: `outLen = floor((srcLen − 1)/ratio) + 1`.
3. Pitch: a 1 kHz sine shifted +7.3 st → the parabolic-interpolated peak lands at `1000·2^(7.3/12)` Hz within **±0.5 cents** (FFT N = 16384, Kaiser β = 20 analysis window, zero-pad ×8).
4. Spur / alias levels: see the table below.
5. Passband: at ratio 2^(0.1/12), gain at 10 kHz must be 0 ± 0.01 dB (sinc) and ≥ −0.5 dB (hermite).
6. Determinism: identical SHA-256 of output bytes across two runs and across Node versions.

| Test | sinc (default) | hermite | linear |
|---|---|---|---|
| 5 kHz sine, +7.3 st, worst spur | ≤ −100 dB | ≤ −45 dB | ≤ −33 dB |
| 15 kHz sine, +12 st, any energy (target 30 kHz is above Nyquist) | ≤ −90 dBFS | not tested | not tested |

### B. `timeStretch(x, alphaOrAnchors, method, opts)`

**Inputs:** `alpha` = output/input duration, or `anchors: Array<[inSample, outSample]>` strictly increasing (the warp map).

**Defaults for Fs ≥ 44.1 kHz** (scale N by `nextPow2(Fs/44100)`; see 2.4):

| Method | N | Hs | Other | Window |
|---|---|---|---|---|
| `ola` | 512 | 256 | tol 0 | Hann `sin²(π·n/N)` |
| `wsola` | 2048 | 1024 | tol 1024 | Hann |
| `pv` | 4096 | 1024 | identity phase locking on; a peak is > its 4 neighbours (±1, ±2) | Hann |
| `hp` | HPSS: N 2048, hop 512, binary masks; median 17 frames (time) × 17 bins (freq) | | harmonic → `pv`; percussive → `ola` | |

**Analysis positions:** `ana[i] = round(interpLinearExtrap(anchorsOut → anchorsIn, i·Hs))`. Output length = `anchorsOut.last` (constant α: `ceil(α·L)`). Normalize by the accumulated window (OLA/WSOLA: Σw; PV: Σw²), clamping denominators below 1e−3 to 1.

**Oracles (I-measured):**
1. Length: `out.length === ceil(alpha·L)` exactly; with anchors, `=== anchors.last[1]`.
2. Pitch: a 220 Hz tone with 5 harmonics (1/h amplitudes), 2 s, α ∈ {0.5, 0.75, 1.25, 1.5, 2.0}: f0 error ≤ **1 cent** (measured ≤ 0.09).
3. Level: steady-tone RMS of the middle 50% within **±0.5 dB** of the input (measured 0.00).
4. Identity: `pv` at α = 1 → SNR ≥ **100 dB** against the input, excluding 4096-sample edges (measured 258). `wsola` at α = 1 → SNR ≥ 25 dB (measured 32.8; not transparent).
5. Onsets: 8 decaying noise bursts, 250 ms apart. Detect with the section C detector and match each expected onset `α·t_k` to the nearest detection:

   | Method | α range | Requirement |
   |---|---|---|
   | `ola` | 0.5–2.0 | all 8 found, max error ≤ **5 ms** |
   | `hp` | 0.5–2.0 | all 8 found, max error ≤ **10 ms** |
   | `pv` | ≥ 0.75 | max error ≤ **10 ms** |
   | `wsola` | 1.5–2.0 | ≤ 15 ms (compression is expected to fail; keep it as a documented known-failure test) |

6. Anchors: an anchor map with two segments (α = 0.8 then 1.25) must put a click placed at a marker within **±Hs/2 samples** of that marker's output position.

### C. `detectOnsets(x, opts)` and `slice(x, opts)`

**STFT:** Hann N = 2048, hop 441 @ 44.1 kHz. In general `hop = round(Fs/100)`, so the frame rate is 100 Hz.

**ODF options:**
- `'sf'` (default): `Σ_k max(0, |X(n,k)| − |X(n−1,k)|)`, linear magnitude, L1.
- `'hfc'`: `Σ_k k·|X(n,k)|²`.
- `'rcd'`: `Σ_k |X − X_T|` over bins where `|X(n,k)| ≥ |X(n−1,k)|`, with `X_T = |X(n−1)|·e^{j(2ψ(n−1) − ψ(n−2))}`.

**Peak picking (Dixon):**
- Normalize the ODF to mean 0, sd 1.
- Constants `w = 3`, `m = 3`, `δ = 0.1` (I: default; this is the "sensitivity" knob), `α = 0.9` (I).
- Sensitivity mapping, as Simpler-like 0–100 (I): `δ = 1.0 − 0.009·sensitivity`.

**Refinement:**
- Localize each onset to a sample: search back up to 1 hop for the envelope minimum before the peak.
- Optional `snapZeroCross: true`: move to the nearest sign change within ±1 ms (FL "zero-cross check").

**Constraints (I):**
- `minSliceMs = 50` (drop the later of any two onsets closer than this).
- `maxSlices = 64` for transient mode (Simpler) and 128 for slice-to-MIDI (Ableton Rack limit).
- Grid modes: `beat` (division d beats), `region` (N equal slices), `manual`.
- `quantize(amount 0..1)`: each onset moves `amount·(nearestGrid − onset)` (Ableton semantics).
- Slice output: `{startSample, endSample, note}` with notes ascending chromatically from `baseNote` (default 36, I: unverified vs Ableton) for DAW export. Declick fade-out 10 ms cosine S-curve by default (FL default), fade-in 0.

**Oracles:**
1. Click train of 16 impulses (1-sample, amplitude 0.9) at 120 BPM 16ths over white noise at −40 dBFS: detect 16/16, no extras, each within **±5 ms** (Dixon reports 8.8 ms mean on real piano; synthetic data should be tighter).
2. Detection counts as correct within **±50 ms** (Bello/Dixon criterion); F-measure = 1.0 on the synthetic test.
3. Steady sine (no onsets) after the first 100 ms: 0 detections beyond the first.
4. Two onsets 30 ms apart with `minSliceMs = 50` → exactly one slice.
5. `region` mode with N = 8 on a 2.0 s file: boundaries at `k·L/8` exactly (integer floor).
6. Slices concatenated with no fades reproduce the input byte-exactly.

### D. Clip warp model (DAW interop)

```ts
type WarpMode = 'off'|'repitch'|'beats'|'tones'|'texture'|'complex';
interface AudioClipWarp {
  warp: boolean;               // Ableton Warp switch / FL TIME != (none)
  mode: WarpMode;              // mapping table in §4
  markers: {srcSec: number; beat: number}[]; // >= 2, strictly increasing in both
  // Ableton: WarpMarker SecTime/BeatTime; DawDreamer warp_markers [sec, beat]
  startBeat: number; endBeat: number; loop?: {startBeat: number; endBeat: number};
  transpose?: {semitones: number; cents: number};
  beatsOpts?: {preserve: 'transients'|number /*grid beats*/; loop: 'off'|'forward'|'pingpong'; envelope: number /*0..100, 100 = no fade*/};
}
```

**Oracles:**
- Two markers `(0 s, 0 beat)` and `(2 s, 4 beats)` at song tempo 120 BPM → identity (α = 1). The source sample at 1.0 s lands at output 1.0 s ± 0 samples in `repitch` and within ±Hs/2 in TSM modes.
- The same markers at 150 BPM → output duration = 4 beats·60/150 = 1.6 s, i.e. `round(1.6·Fs)` samples ±1.
- `repitch` at 150 BPM → pitch up by `12·log2(150/120)` = +3.863 st (measured within ±1 cent).
- `beats` mode at 150 BPM → each slice starts within ±1 sample of its warped position, and each slice's internal duration is unchanged (FL "Slice map" semantics).

### E. Plugin bridge

- Contract as in section 6: JSON over stdin/stdout, float32 WAV with a 58-byte header, and a chunk-walking reader.
- The probe gates the feature. The self-test oracle is Gain −6 dB → peak 0.2506 ± 0.001, frames exact.
- music2 core never imports, bundles or downloads GPL code.

---

## Blockers / gaps

- MDPI article pages returned HTTP 403. I used the authors' e-print of the same CC-BY review hosted on audiolabs-erlangen.de [S8]. Page numbers follow that e-print.
- The Université de Montréal copy of Bello 2005 was blocked by an anti-bot page. I used the University of Rochester course-hosted PDF [S14]. The PDF-to-text conversion garbled the symbol names in eqs. 19–21, so the exact algebraic form of the median threshold is tagged I; the parameter values (≈100 ms window, scale 1) are V.
- Not verified:
  - The starting MIDI note of Ableton "Slice to New MIDI Track".
  - The exact δ/α values Dixon used (they were tuned per dataset).
  - The internal algorithms of Ableton and FL warp modes (proprietary; only manual behaviour was verified).
- The GPL analysis is an engineering reading of the FSF FAQ, not legal advice.
- The Verhelst & Roelands 1993 and Laroche & Dolson 1999 originals were not fetched (IEEE paywall). Their content is cited via the Driedger & Müller review, which summarizes both [S8].

## Sources

- [S1] JOS, Digital Audio Resampling Home Page: https://ccrma.stanford.edu/~jos/resample/ ; https://ccrma.stanford.edu/~jos/resample/Theory_Ideal_Bandlimited_Interpolation.html ; https://ccrma.stanford.edu/~jos/resample/Theory_Practice.html ; https://ccrma.stanford.edu/~jos/resample/Implementation.html ; https://ccrma.stanford.edu/~jos/resample/Choice_Table_Size.html ; https://ccrma.stanford.edu/~jos/resample/Conclusions.html ; https://ccrma.stanford.edu/~jos/resample/Free_Resampling_Software.html
- [S2] JOS, Under the Hood of kaiserord: https://ccrma.stanford.edu/~jos/sasp/Hood_kaiserord.html
- [S3] JOS, Kaiser Window: https://ccrma.stanford.edu/~jos/sasp/Kaiser_Window.html ; https://ccrma.stanford.edu/~jos/sasp/Kaiser_Window_Beta_Parameter.html
- [S4] JOS, Linear Interpolation: https://ccrma.stanford.edu/~jos/pasp/Linear_Interpolation.html
- [S5] JOS, Quadratic Interpolation of Spectral Peaks: https://ccrma.stanford.edu/~jos/sasp/Quadratic_Interpolation_Spectral_Peaks.html
- [S6] JOS, Lagrange Interpolation (context): https://ccrma.stanford.edu/~jos/pasp/Lagrange_Interpolation.html
- [S7] O. Niemitalo, Polynomial Interpolators for High-Quality Resampling of Oversampled Audio (2001): https://yehar.com/blog/wp-content/uploads/2009/08/deip.pdf ; landing page https://yehar.com/blog/?p=197
- [S8] J. Driedger & M. Müller, A Review of Time-Scale Modification of Music Signals, Appl. Sci. 2016, 6, 57 (CC-BY). E-print: https://audiolabs-erlangen.de/content/05_fau/professor/00_mueller/06_projects/90_siamus/2016_DriedgerMueller_TSMOverview_AppliedSciences_ePrint.pdf ; publisher page (403 when fetched): https://www.mdpi.com/2076-3417/6/2/57 ; DOI https://doi.org/10.3390/app6020057
- [S9] TSM Toolbox site (MIT, v2.03): https://www.audiolabs-erlangen.de/resources/MIR/TSMtoolbox/
- [S10] TSM Toolbox MIT source files: https://www.audiolabs-erlangen.de/content/resources/MIR/TSMtoolbox/wsolaTSM.m ; .../pvTSM.m ; .../hpTSM.m ; .../hpSep.m ; .../win.m ; .../demoTSMtoolbox.m (same base path)
- [S11] Driedger & Müller, TSM Toolbox, DAFx-14: https://www.audiolabs-erlangen.de/content/resources/MIR/TSMtoolbox/2014_DriedgerMueller_TSM-Toolbox_DAFX.pdf
- [S12] pedalboard API reference: https://spotify.github.io/pedalboard/reference/pedalboard.html ; I/O: https://spotify.github.io/pedalboard/reference/pedalboard.io.html
- [S13] T. Roberts & K. Paliwal, An Objective Measure of Quality for Time-Scale Modification of Audio (2020): https://arxiv.org/abs/2006.06153
- [S14] J.P. Bello et al., A Tutorial on Onset Detection in Music Signals, IEEE TSAP 13(5), 2005: https://hajim.rochester.edu/ece/sites/zduan/teaching/ece472/reading/Bello_2005.pdf ; https://ieeexplore.ieee.org/document/1495485
- [S15] DawDreamer Playback Warp Processor: https://dbraun.github.io/DawDreamer/user_guide/playback_warp.html
- [S16] S. Dixon, Onset Detection Revisited, DAFx-06: https://www.dafx.de/paper-archive/2006/papers/p_133.pdf
- [S17] Ableton Live 12 Manual, Audio Clips, Tempo, and Warping: https://www.ableton.com/en/manual/audio-clips-tempo-and-warping/
- [S18] FL Studio Manual, Fruity Slicer: https://www.image-line.com/fl-studio-learning/fl-studio-online-manual/html/plugins/Fruity%20Slicer.htm
- [S19] FL Studio Manual, Sampler Channel Settings: https://www.image-line.com/fl-studio-learning/fl-studio-online-manual/html/chansettings_sampler.htm ; Time Stretch tool: https://www.image-line.com/fl-studio-learning/fl-studio-online-manual/html/plugins/editortool_stretch.htm
- [S20] Ableton Live 12 Manual, Converting Audio to MIDI: https://www.ableton.com/en/manual/converting-audio-to-midi/
- [S21] Ableton Live 12 Manual, Live Instrument Reference (Simpler slicing §31.11.1.3): https://www.ableton.com/en/manual/live-instrument-reference/
- [S22] FL Studio Manual, Slicex: https://www.image-line.com/fl-studio-learning/fl-studio-online-manual/html/plugins/Slicex.htm
- [S23] FL Studio Manual, Slicex Wave Editor: https://www.image-line.com/fl-studio-learning/fl-studio-online-manual/html/plugins/Slicex%20Editor.htm
- [S24] AbletonParsing README (MIT): https://github.com/DBraun/AbletonParsing
- [S25] Third-party ALS format notes: https://github.com/madisonrickert/ableton-tools/blob/main/engine/references/als-format.md
- [S26] PyPI JSON, pedalboard: https://pypi.org/pypi/pedalboard/json
- [S27] pedalboard README: https://github.com/spotify/pedalboard
- [S28] DawDreamer README: https://github.com/DBraun/DawDreamer
- [S29] PyPI JSON, dawdreamer: https://pypi.org/pypi/dawdreamer/json
- [S30] DawDreamer Plugin Processor guide: https://dbraun.github.io/DawDreamer/user_guide/plugin_processor.html
- [S31] GNU GPL FAQ (MereAggregation, plug-ins): https://www.gnu.org/licenses/gpl-faq.en.html
- [S32] P. Kabal, WAVE file format specifications (McGill): https://www.mmsp.ece.mcgill.ca/Documents/AudioFormats/WAVE/WAVE.html
- Context only (not relied on for claims): Kaiser formulas cross-check https://www.mathworks.com/help/signal/ug/kaiser-window.html ; Essentia OnsetDetection docs https://essentia.upf.edu/reference/std_OnsetDetection.html
