# 005 — DSP and image algorithms for music2 analyze

Source: read-only research subagent (gpt-6-sol, handle 01a0e37e-3c63-7923-a15a-ecc776e96b01, 2026-09-28). BS.1770 / EBU constants are normative;
analysis parameters are music2 choices. Main dispositions for 040: implement integrated LUFS, LRA (flagged
provisional under 60 s), true peak by 4× windowed-sinc interpolation labelled `truePeakEstimate` at 44.1 kHz,
spectral-flux + Ellis-weighted autocorrelation tempo with explicit half/double alternatives, fixed-tempo phase
search for beats, Krumhansl–Kessler key with Temperley as secondary, six band shares, radix-2 FFT, inferno LUT
(CC0, 256 entries generated at build time from the published anchor table and committed as a TS constant),
PNG RGB8 with filter 0. When a song file is supplied, `beats.json` comes from the song (authoritative) and the
DSP estimate is reported next to it.

---

I read `/tmp/music2-poc/render.mjs`. Its 44.1 kHz stereo WAV and known 140 BPM arrangement make useful reference vectors. The recommendations below require only TypeScript and Node built-ins. **The suggested analysis settings are implementation choices; BS.1770 and EBU constants are normative.**

### Loudness and true peak

**Formula and constants.** Apply the K-weighting shelf and RLB high-pass separately to each channel, then calculate each 400 ms block’s mean-square power \(z_{i,j}\). Block loudness is \(L_j=-0.691+10\log_{10}(\sum_i G_i z_{i,j})\). For stereo, \(G_L=G_R=1\); **sum channel powers without dividing by two**. Use 75% overlap: at 44,100 Hz, blocks are **17,640 samples**, advancing **4,410 samples**. Discard incomplete final blocks. First retain blocks above −70 LUFS; compute their *linear-power* mean; set a second gate 10 LU below that loudness; then recompute the linear-power mean of blocks passing **both** gates. Return null or −Infinity for all-silent input, explicitly documented. [ITU-R BS.1770-5, Annex 1, Tables 1–2 and equations 2–7](https://www.itu.int/dms_pubrec/itu-r/rec/bs/R-REC-BS.1770-5-202311-I!!PDF-E.pdf).

At **48 kHz only**, the standard’s normalized biquads \((b_0,b_1,b_2;a_1,a_2)\) are shelf `(1.53512485958697, −2.69169618940638, 1.19839281085285; −1.69065929318241, 0.73248077421585)` and high-pass `(1, −2, 1; −1.99004745483398, 0.99007225036621)`. Do not reuse those coefficients at 44.1 kHz. For a sample-rate-derived implementation, use \(k=\tan(\pi f_c/f_s)\). Shelf: \(f_c=1681.97445095553\), \(Q=0.707175236955419\), \(V_h=10^{3.99984385397/20}\), \(V_b=V_h^{0.499666774155}\), \(a_0=1+k/Q+k^2\); numerators are \((V_h+V_bk/Q+k^2,\;2(k^2-V_h),\;V_h-V_bk/Q+k^2)/a_0\), denominators \((1,\;2(k^2-1)/a_0,\;(1-k/Q+k^2)/a_0)\). High-pass: \(f_c=38.13547087614\), \(Q=0.500327037325395\), the same denominator formula, and numerator **`(1,−2,1)`** as in the reference implementation. Preserve independent filter state per channel. [Sample-rate derivation and code](https://docs.rs/bs1770/latest/src/bs1770/lib.rs.html#65).

**True peak.** Measure \(\max|x_{\mathrm{interpolated}}|\) per channel and report \(20\log_{10}\) of the maximum as dBTP. BS.1770-5 Annex 2 supplies a 48-tap, four-phase FIR example for 4× interpolation at 48 kHz. A floating-point implementation needs no preliminary 12.04 dB attenuation. At **44.1 kHz, 4× reaches 176.4 kHz**, below Annex 2’s stated *at least 192 kHz* guidance: label it an estimate, or use 8× with a suitable low-pass interpolator and validate against the EBU true-peak vectors. Linear interpolation misses intersample peaks. [ITU Annex 2](https://www.itu.int/dms_pubrec/itu-r/rec/bs/R-REC-BS.1770-5-202311-I!!PDF-E.pdf), [EBU Tech 3341 §2.6](https://tech.ebu.ch/docs/tech/tech3341.pdf).

**Vectors.** The EBU’s 20-second, in-phase **stereo** 1 kHz sine at **−23 dBFS peak per channel** must read **−23.0 ±0.1 LUFS**; at −20 dBFS it should read about −20 LUFS. The corresponding **mono** −20 dBFS peak sine reads about **−23.01 LUFS**, since removing the second equal-power channel subtracts \(10\log_{10}2\). Use EBU Tech 3341’s published loudness and true-peak signals for compliance tests. [EBU Tech 3341 §2.9, Table 1](https://tech.ebu.ch/docs/tech/tech3341.pdf).

### Loudness range (LRA)

**Formula.** Measure ungated loudness over sliding **3 s** windows at **≥10 measurements/s**. Keep values ≥−70 LUFS. Convert those values back to linear power, average, convert to LUFS, and retain values ≥that result −20 LU. LRA is the **95th minus 10th percentile** of the retained loudness values, in LU. The EBU reference uses sorted-array positions `round((n−1)*p/100)` with zero-based indexing. Do not reuse the integrated-loudness −10 LU gate. At 44.1 kHz choose 132,300-sample windows and 4,410-sample advances; report LRA as provisional for clips under 60 s. [EBU Tech 3342 §3 and reference algorithm](https://tech.ebu.ch/files/live/sites/tech/files/shared/tech/tech3342.pdf), [EBU Tech 3341 §2.4](https://tech.ebu.ch/docs/tech/tech3341.pdf).

**Vector.** Twenty seconds of stereo 1 kHz sine at −20 dBFS peak followed by twenty seconds at −30 dBFS should produce **10 ±1 LU**. [EBU Tech 3342, Table 1](https://tech.ebu.ch/files/live/sites/tech/files/shared/tech/tech3342.pdf).

### Tempo, beats, and downbeats

**Formula and suggested parameters.** From mono audio, use a Hann-window STFT and positive spectral flux, \(O_t=\operatorname{mean}_k\max(0,S_{k,t}-S_{k,t-1})\), preferably on log magnitudes or perceptual bands; locally detrend and normalize it. A practical 44.1 kHz choice is **2048-point FFT, 441-sample hop** (100 onset frames/s). For each candidate lag \(\tau\), calculate \(R(\tau)=\sum_t O_tO_{t-\tau}\) and \(BPM=60f_{\rm onset}/\tau\). Ellis weights this with a log-time Gaussian, \(W(\tau)=\exp[-\tfrac12(\log_2(\tau/\tau_0)/\sigma)^2]\), using \(\tau_0=0.5\) s (120 BPM) and \(\sigma=1.4\) octaves. Search, for example, 50–220 BPM, retaining strong **½× and 2× alternatives** instead of declaring one tempo certain. [Ellis, *Beat Tracking by Dynamic Programming*, §§3.1–3.2](https://www.ee.columbia.edu/~dpwe/pubs/Ellis07-beattrack.pdf); [spectral-flux definition](https://librosa.org/doc/0.11.0/generated/librosa.onset.onset_strength.html).

For beat times, a simple fixed-tempo phase search maximizes \(\sum_n O(\phi+nT)\). For drift, Ellis’s dynamic program uses \(C(t)=O(t)+\max_u[C(u)-\alpha\log^2((t-u)/T)]\), searching predecessors from \(T/2\) to \(2T\) back and backtracking the chosen times. For 4/4 downbeats, score the four beat-index phases using low-frequency kick/transient energy and harmonic-change evidence; emit the best phase **with confidence**, since audio accents do not prove bar position. Where `music2` has the source song JSON, its declared BPM, bar origin, and event times should be the authoritative `beats.json`; DSP estimates can check the rendered WAV. [Ellis §2](https://www.ee.columbia.edu/~dpwe/pubs/Ellis07-beattrack.pdf); [beat/downbeat accent approach](https://perso.telecom-paristech.fr/grichard/Publications/2014-durand-icassp.pdf).

**Vector and pitfall.** Render 140 BPM quarter-note clicks with a strong kick on beat 1 and snare on beat 3. Expect quarter-note spacing **0.428571 s** and a four-beat bar of **1.714286 s**. The snare’s **0.857143 s** recurrence can make **70 BPM** score strongly: expose both candidates and prefer the JSON tempo when available.

### Key and chroma

**Formula and constants.** For each tonal FFT bin \(f_k\), map \(m=69+12\log_2(f_k/440)\), round to a semitone, and accumulate magnitude or power into pitch class `((m % 12)+12)%12`; normalize per frame, then pool across time. For 808 fundamentals, **8192-point Hann frames** give about **5.38 Hz/bin** at 44.1 kHz; a shorter FFT can miss or misassign low notes. Suppress broadband percussion and avoid giving harmonics the same authority as fundamentals. A CQT-style log-frequency bank or harmonic-aware weighting can improve this later. [Chroma explanation](https://librosa.org/doc/main/auto_tutorials/01-intro/04-harmony.html).

Krumhansl–Kessler profiles, ordered C through B:

- Major: `[6.35,2.23,3.48,2.33,4.38,4.09,2.52,5.19,2.39,3.66,2.29,2.88]`
- Minor: `[6.33,2.68,3.52,5.38,2.60,3.53,2.54,4.75,3.98,2.69,3.34,3.17]`

Rotate each profile through 12 tonics and use Pearson correlation with the chroma vector; return the top candidates and their score gap. Temperley’s alternative major/minor profiles are `[5,2,3.5,2,4.5,4,2,4.5,2,3.5,1.5,4]` and `[5,2,3.5,4.5,2,4,2,4.5,3.5,2,1.5,4]`. His segmented presence/absence approach reduces repeated-note bias; treat it as an alternative estimate, especially for short loops. [Profile values and correlation implementation](https://music21.org/music21docs/_modules/music21/analysis/discrete.html); [Temperley, §2 and Figure 1](https://davidtemperley.com/wp-content/uploads/2015/11/temperley-maai.pdf).

**Vector.** A sustained C–E♭–G arrangement should favor C minor; a pure C sine has **insufficient evidence** for a confident key. The proof-of-concept’s C-minor arrangement is a useful mixed-instrument test, though its G and B notes may complicate the ranking.

### Band balance, FFT, and spectrogram

**Band energy.** Treat boundaries as a **mixing convention, not a standard**: sub 20–60 Hz, low 60–250, low-mid 250–500, mid 500–2000, presence 2000–8000, air 8000–20,000. Sum one-sided STFT **power** in each band and report each band’s share of total 20–20,000 Hz energy, plus dB ratio to a documented reference; do not compare raw sums without accounting for bandwidth when interpreting spectral density. At 44.1 kHz cap the top band at Nyquist. [Mixing-band reference](https://www.teachmeaudio.com/mixing/techniques/audio-spectrum). A 50 Hz sine should concentrate in sub; a 10 kHz sine in air. Expect leakage near boundaries.

**Fast FFT.** For power-of-two \(N\), bit-reverse the input indices, then perform iterative butterfly stages of lengths 2, 4, …, \(N\): \(u=X[j]\), \(v=e^{-2\pi i r/\ell}X[j+\ell/2]\), write \(u+v,u-v\). Complexity is \(O(N\log N)\). Precompute stage twiddles and reuse typed-array buffers. Test impulse → all bins equal, and a bin-centred sine → peaks at \(k\) and \(N-k\). [Radix-2 implementation discussion](https://www.cs.drexel.edu/~johnsojr/2009-10/winter/cs650/lectures/fft.html).

**Spectrogram image.** Choose **4096-point periodic Hann**, **1024-sample hop** (≈23.2 ms), mono \(L+R\) divided by two, and \(D_{k,t}=20\log_{10}(\max(\epsilon,|X_{k,t}|/(\sum w/2)))\). Map output row \(y\) to \(f(y)=f_{\min}(f_{\max}/f_{\min})^{1-y/(H-1)}\), e.g. 30–20,000 Hz, interpolate between FFT bins, clip display to **−80…0 dBFS**, and index a 256-color **Inferno or Magma** LUT. State the reference level in the PNG legend. A 1 kHz sine should form a horizontal line at 1 kHz; an impulse a narrow vertical stripe. The color tables are **CC0** from their authors. [STFT framing](https://librosa.org/doc/1.0.0/auto_tutorials/01-intro/02-frequency.html); [original colormap project and license](https://bids.github.io/colormap/).

### PNG and piano roll

Write signature `89 50 4E 47 0D 0A 1A 0A`; then `IHDR`, `IDAT`, `IEND`. Each chunk is big-endian length, four ASCII type bytes, data, then CRC-32 over **type + data** (not length). Use 8-bit RGB `IHDR` (color type 2, compression/filter/interlace methods 0). Prefix **every scanline with byte 0** for the “None” filter, compress the concatenated scanlines with `node:zlib` `deflateSync`, and put that zlib stream in `IDAT`. PNG CRC uses reflected polynomial `0xEDB88320`, initial `0xffffffff`, final XOR `0xffffffff`. [W3C PNG specification §§5, 9–11](https://www.w3.org/TR/png-3/).

For the piano roll, rasterize **the song JSON’s note events**, with x from event start/end seconds and y from MIDI pitch; use separate lanes for unpitched drums. This preserves exact notes even when audio pitch tracking is ambiguous. A one-note C4 event from 0–1 s should occupy exactly that horizontal interval and MIDI row 60. A 1×1 known-color PNG that decodes and passes CRC verification is the encoder’s minimal vector.

No repository files were changed.
