# music2-gen clean-room DSP reference notes

Scope: public-web research only, 2026-09-28. This is an algorithm/reference map, not source code. Do not copy implementation code, GPL code, diagrams, tables, or prose beyond what is necessary to independently implement the documented DSP ideas. Fact labels: **V** = directly stated in the cited public source; **I** = engineering inference/recommendation derived from it; **U** = citation/snippet-level or not independently fetched.

## 1. Dattorro plate reverb, *Effect Design Part 1* (1997)

### Source URLs
- CCRMA author mirror PDF: https://ccrma.stanford.edu/~dattorro/EffectDesignPart1.pdf
- Dattorro’s CCRMA index: https://ccrma.stanford.edu/~dattorro/music.html

### License/availability
- **V:** The full paper is publicly downloadable from its author’s CCRMA page. The fetched paper identifies JAES 45(9), September 1997. No reuse license for code was found in the fetched material; treat it as a technical reference, not code to copy.

### Structure & parameters
- **V:** The paper’s simplified plate-class topology is: input pre-delay, a bandwidth low-pass, four input-diffusion allpasses, then a two-branch cross-coupled tank. Each branch contains a first decay-diffusion allpass, delays, damping low-pass, a second decay-diffusion allpass, and further delays; stereo is made by a signed multi-tap wet-output sum. Two tank delay taps are slowly modulated.
- **V:** Default paper values are sample rate **29,761 Hz**, modulation excursion **16 samples**, decay **0.50**, decay diffusion 1 **0.70**, decay diffusion 2 **0.50**, input diffusion 1 **0.750**, input diffusion 2 **0.625**, bandwidth **0.9995**, damping **0.0005**. The paper says diffusion 2 is constrained as decay + 0.15, with floor 0.25 and ceiling 0.50.
- **V:** The paper says modulation around 1 Hz, about 8 samples peak at about 29.8 kHz, increases effective modal density. Its figure/table establishes delay lengths including input diffuser lengths **142, 107, 379, 277** and tank lengths **672, 908, 4453, 4217, 1800, 2656, 3720, 3163** samples at the paper rate; retain the original tap/sign layout from the paper as a separately reviewed specification.

### Implementation notes for music2
- **I:** Build named primitives first: circular delay, fractional read head, first-order low-pass, allpass, and signed tap mixer. Scale all paper delay/tap/excursion sample counts by `fs / 29761`; round static delay storage upward, but retain fractional modulation.
- **I:** Expose pre-delay, decay, bandwidth, damping, input diffusion, decay diffusion, modulation rate/depth, and wet/dry. Smooth user parameters before they hit recursive coefficients. Implement a clean-room topology from this prose and the paper’s block diagram, never port a third-party implementation.

## 2. Jot/Chaigne feedback delay networks (FDN)

### Source URLs
- Jot & Chaigne bibliographic record: https://www.semanticscholar.org/paper/Digital-Delay-Networks-for-Designing-Artificial-Jot-Chaigne/cee51b28f161f7619f12fd05cd3b1f2938f496c0
- Julius O. Smith, FDN chapter: https://ccrma.stanford.edu/~jos/pasp/Feedback_Delay_Networks_FDN.html
- Open later FDN treatment with decay relation: https://ccrma.stanford.edu/~orchi/Documents/JAES21_GFDN.pdf

### License/availability
- **V:** The Jot/Chaigne 1991 AES Convention 90 work is identified publicly, but the search record reports no paper link; availability of an authorized free full text is **U**. Smith’s explanatory CCRMA page is publicly readable; its copyright notice applies. Das and Abel’s later JAES PDF is openly hosted by CCRMA.

### Structure & parameters
- **V:** Smith describes an FDN as vector feedback comb filtering: a diagonal matrix of delay lines followed by per-line gains and an orthogonal feedback/mixing matrix. The general form has N line lengths `M_i`, gains `g_i`, matrix entries `q_ij`, and input/output vectors.
- **V:** The later CCRMA paper states an FDN has parallel delay lines, associated decay filters, and an N-by-N feedback matrix; it describes a unitary matrix as energy-conserving and gives the per-line decay response `g_i = 0.001^(tau_i / T60)` where `tau_i` is seconds. **I:** In samples `d`, `tau_i=d/fs`, equivalently `g_i = 10^(-3*d/(T60*fs))`.
- **I:** Use mutually prime or otherwise deliberately incommensurate lengths to reduce coincident repeats; this is a common design heuristic, but not directly verified in the fetched primary Jot paper. A normalized Hadamard matrix is a convenient orthogonal mixer for power-of-two N; a Householder reflector is another orthogonal, low-cost choice.
- **I:** A tone-correction filter is a per-line low-pass/shelf or frequency-dependent decay filter selected so high frequencies meet a shorter target T60 than lows.

### Implementation notes for music2
- **I:** Start with N=8 or 16, delays chosen in milliseconds then rounded to distinct/near-coprime sample lengths, normalized Hadamard mixing, and frequency-dependent damping. Compute the line loss from target T60 rather than exposing raw feedback only. Validate impulse response decay and no growth at maximum settings.

## 3. Freeverb

### Source URLs
- Julius O. Smith’s Freeverb page: https://ccrma.stanford.edu/~jos/pasp/Freeverb.html
- Public tuning reference (do not copy code): https://github.com/thestk/stk/blob/master/src/FreeVerb.cpp

### License/availability
- **V:** Smith calls Freeverb a public-domain C++ program by “Jezar at Dreampoint.” Smith also warns that distributions can have different `tuning.h` defaults. The cited STK file is only a public corroborating tuning reference; do not copy it.

### Structure & parameters
- **V:** Per channel, Freeverb uses **8 parallel** filtered feedback combs followed by **4 series** Schroeder allpasses. The right channel is formed by adding a default stereo spread of **23 samples** to all 12 delay lengths.
- **V:** Public tuning references list 44.1-kHz comb lengths **1116, 1188, 1277, 1356, 1422, 1491, 1557, 1617** samples and allpass lengths **556, 441, 341, 225** samples.
- **U:** Common original `tuning.h` constants reported in public implementations are fixed input gain **0.015**, room-size scaling **0.28** plus offset **0.70**, damping default **0.4**, and allpass feedback **0.5**. Verify against an original Jezar archive before presenting these as product-compatible defaults.

### Implementation notes for music2
- **I:** Treat this as a compact, recognizable Schroeder/Moorer baseline, with delay values scaled from 44.1 kHz. Use separate comb damping state per comb. Avoid claiming exact Freeverb compatibility unless original constants and wet/dry routing are independently validated.

## 4. RBJ Audio EQ Cookbook

### Source URLs
- W3C Working Group Note: https://www.w3.org/TR/audio-eq-cookbook/

### License/availability
- **V:** W3C says the note is adapted from Robert Bristow-Johnson’s cookbook with permission for Web Audio API use. It is a public formula reference; the page does not itself grant a general software license for copied code.

### Structure & parameters
- **V:** The cookbook gives normalized biquad coefficient formulae for LPF, HPF, two BPF variants, notch, allpass, peaking EQ, low shelf, and high shelf. It defines user inputs `Fs`, `f0`, `Q`/BW/S, and `dBgain` for peaking/shelves; `w0 = 2*pi*f0/Fs`; and gain factor `A = 10^(dBgain/40)` for peaking/shelf equations.
- **V:** `alpha` is defined from Q, bandwidth in octaves, or shelf slope S depending on filter type. The page states the formulas are digitized analog prototypes using bilinear transform with frequency-warping compensation, and it supplies the Q/BW and Q/S relations.
- **V:** The page gives Direct Form I recurrence after normalizing `a0`: current/previous input weighted by b coefficients minus previous outputs weighted by a coefficients.

### Implementation notes for music2
- **I:** Use the W3C equations as a prose/math specification, generate coefficient tests from them, and implement either DF-I or transposed DF-II with explicit per-channel state. DF-I is easiest to audit; transposed DF-II uses fewer state variables but needs robust floating-point behavior. Smooth coefficients or interpolate stable parameter trajectories during automation to avoid zipper noise; reset/guard states when changing filter type or invalid Q/frequency.

## 5. Zavalishin/TPT state-variable filter

### Source URLs
- Zavalishin, *The Art of VA Filter Design* PDF: https://www.native-instruments.com/fileadmin/ni_media/downloads/pdf/VAFilterDesign_1.1.1.pdf

### License/availability
- **V:** The PDF grants permission to freely copy the complete, unmodified revision in software or hard-copy form, and says it is informational; it is not an MIT code license.

### Structure & parameters
- **V:** The book covers virtual-analog filter design, state-variable filters, time discretization, state-space form, and nonlinearities for music DSP.
- **I:** The common trapezoidal-integrator/state-variable form uses `g = tan(pi*fc/fs)` and resonance parameter `k = 1/Q` (some conventions name it `2R`). Its state update yields low-pass, band-pass, and high-pass outputs concurrently. Confirm the exact sign/order convention against the selected derivation before coding, because TPT/SVF variants differ.
- **I:** TPT is a good candidate for cutoff envelopes because prewarping with tan preserves the intended cutoff mapping and the implicit/trapezoidal formulation remains well behaved under coefficient changes when parameters are clamped.

### Implementation notes for music2
- **I:** Clamp `fc` below Nyquist with headroom and Q positive; recalculate `g` per smoothed cutoff or control block. Offer LP/BP/HP mixing rather than three separate filters. Add regression tests for DC, impulse, sweep, high-Q, and rapidly changing cutoff.

## 6. Band-limited oscillators: polyBLEP, BLIT, minBLEP

### Source URLs
- Välimäki et al., 2010 paper record: https://www.researchgate.net/publication/221780582_Perceptually_informed_synthesis_of_bandlimited_classical_waveforms_using_integrated_polynomial_interpolation
- 2007 survey record: https://www.academia.edu/97506982/Antialiasing_Oscillators_in_Subtractive_Synthesis
- Public discussion identifying BLIT/minBLEP families: https://music-dsp.music.columbia.narkive.com/eY4551p6/anti-aliasing-for-oscillators

### License/availability
- **U:** Search results expose the cited papers but authorized open full-text status was not independently verified. Use DOI/publisher or author-hosted PDFs before relying on them as archival sources. The public discussion is not a primary technical authority.

### Structure & parameters
- **U:** Search snippets identify polyBLEP as using integrated polynomial interpolation for a correction function.
- **I:** For a naive saw/square, locate each phase discontinuity; add a short polynomial residual that replaces the discontinuity’s local, two-sample-scale error rather than filtering the whole oscillator. The residual width is set by phase increment `dt = frequency/fs`; apply it at wrap (saw) and both edges (square), including hard-sync discontinuities.
- **U:** BLIT is attributed in public discussion to Stilson & Smith; minBLEP to Brandt (2001). Their standard framing is impulse-train/bandlimited-step correction, respectively, but fetch the primary papers before documenting exact kernels, tables, or licensing.

### Implementation notes for music2
- **I:** A clean-room polyBLEP is the lowest-dependency first choice for saw, pulse, and hard sync. Test spectra at several fundamentals near Nyquist, at high modulation, and against phase wrap edge cases. Do not import GPL oscillator code or copy lookup tables.

## 7. Compressor: Giannoulis, Massberg, Reiss (2012)

### Source URLs
- Public full-text mirror linked from ResearchGate: https://www.researchgate.net/publication/277772168_Digital_Dynamic_Range_Compressor_Design-A_Tutorial_and_Analysis
- Bibliographic record: https://www.semanticscholar.org/paper/Digital-Dynamic-Range-Compressor-Design%E2%80%94A-Tutorial-Giannoulis-Massberg/f1b20a5681e6ef7080e5b5fbce81911c6873543c

### License/availability
- **V:** The paper is JAES 60(6), 2012, pp. 399–408, and a public full-text link is exposed by ResearchGate. **U:** This is a mirror/access path, not evidence of a reuse license; use the paper for study and avoid copying diagrams/text/code.

### Structure & parameters
- **V:** The abstract says it compares RMS and peak approaches, feedforward and feedback designs, linear and log-domain detection, and analyzes why designs sound different.
- **I:** A standard log-domain gain computer uses input level `L` (dB), threshold `T`, ratio `R`, and knee width `W`: below `T-W/2` request 0 dB reduction; above `T+W/2` use the hard-ratio line; in between, use the quadratic transition joining those two slopes. Add make-up gain after reduction.
- **I:** For a one-pole envelope coefficient, use `alpha = exp(-1/(tau*fs))`; select attack vs release based on whether the detector must move toward more vs less attenuation. Peak detector means rectified absolute sample/peak; RMS means a smoothed power measure before conversion to dB. Detector placement before gain is feedforward; after gain is feedback.
- **U:** “Decoupled”/branching peak detector topology is reported by the paper’s public figure index, but its exact circuit/equations were not independently extracted in this pass.

### Implementation notes for music2
- **I:** Implement separate detector, gain computer, and gain smoother units. Define dB floor to avoid log(0), look-ahead only if explicitly designed (it adds latency), and make channel-link behavior explicit. Test threshold, ratio, knee continuity, attack/release timing, and feedforward/feedback differences.

## 8. Chorus/flanger by fractional delay

### Source URLs
- Dattorro, *Effect Design Part 2* PDF: https://ccrma.stanford.edu/~dattorro/EffectDesignPart2.pdf
- Smith’s PASP entry point: https://ccrma.stanford.edu/~jos/pasp/

### License/availability
- **V:** The full Part 2 PDF is publicly hosted by the author at CCRMA; no software-code reuse permission was identified.

### Structure & parameters
- **V:** Dattorro says fractional delay allows a delay expressed as integer plus fractional samples, avoiding discontinuities when sweeping/modulating delay; it is used for chorus, flange, and vibrato. Linear interpolation filters the delayed signal; allpass interpolation can avoid that artifact in relevant cases.
- **V:** For his white chorus example at 44.1 kHz: nominal delay **400 samples**, peak excursion about **350 samples**, modulation rate about **0.15 Hz**. The paper’s approximate ranges are vibrato 0–5 ms, flange 1–10 ms, chorus 5–30 ms, doubling 20–100 ms, echo 80 ms onward. It caps feedback magnitude at **0.9999999** for stability.

### Implementation notes for music2
- **I:** Use a ring buffer with a continuously moving read position. Start with linear interpolation for chorus; use first-order allpass or higher-order Lagrange only after audible/measurement tests. Flanger needs short delay plus optional feedback and dry/wet/feedforward mix; chorus needs longer base delay, slower LFO, and decorrelated stereo LFOs. Smooth delay changes and cap feedback below 1.

## 9. Oversampling and ADAA for nonlinearities

### Source URLs
- Parker, Zavalishin, Le Bivic, DAFx-16 PDF: https://dafx.de/paper-archive/2016/dafxpapers/20-DAFx-16_paper_41-PN.pdf
- Accessible explanatory page: https://ccrma.stanford.edu/~jatin/Notebooks/adaa.html

### License/availability
- **V:** The DAFx conference PDF is publicly accessible. It describes methods and points to accompanying sound/code examples, but this is not a blanket license to reuse code.

### Structure & parameters
- **V:** The paper states that a memoryless waveshaper `y[n]=f(x[n])` generates harmonics above Nyquist and hence aliasing; conventional mitigation is oversampling. It presents continuous-time approximation, nonlinear processing, and analytically applied convolution, reporting marked alias reduction especially when combined with low-order oversampling.
- **V:** The paper says the method introduces delay/filtering considerations and gives a feedback-system treatment that can eliminate equivalent trapezoidal-integrator FIR delay in a particular serial configuration.
- **I:** Conventional oversampling is: upsample by 2x/4x/etc., apply a low-pass interpolation filter, run the nonlinearity at the higher rate, low-pass anti-alias filter, then decimate. A half-band FIR is attractive at 2x because alternating coefficients are zero except the center, and polyphase decomposition avoids computing discarded outputs.
- **I:** ADAA uses an antiderivative of the nonlinearity and successive input samples to form a finite-difference-like output, reducing discontinuity-caused aliasing. Guard the near-equal-input limit numerically with the original function/derivative limit.

### Implementation notes for music2
- **I:** First ship a tested 2x or 4x FIR oversampling wrapper for saturation/wavefolding. Benchmark latency and CPU. Add ADAA only per nonlinearity with an independently derived antiderivative and near-zero-difference branch; never transplant an implementation.

## 10. Bonus: metering and historical reverberation

### Source URLs
- ITU-R BS.1770 public PDF (2006 edition fetched): https://www.itu.int/dms_pubrec/itu-r/rec/bs/R-REC-BS.1770-0-200607-S!!PDF-E.pdf
- Open historical/review pointer via CCRMA FDN paper: https://ccrma.stanford.edu/~orchi/Documents/JAES21_GFDN.pdf

### License/availability
- **V:** ITU hosts the fetched BS.1770 PDF publicly. It specifies programme loudness and true-peak measurement algorithms. **U:** This pass did not fetch the current revision, so do not assert current-version gates or exact 4x requirements from this 2006 edition.
- **U:** Schroeder (1962), Moorer (1979), and Välimäki et al., “Fifty Years of Artificial Reverberation” were not fetched within the budget. Locate authorized library/author copies before adding their technical claims.

### Structure & parameters
- **V:** The fetched ITU edition explains that true peak can occur between samples, requires oversampling/up-sampling for a true-peak estimate, and discusses symmetric FIR reconstruction filtering. It distinguishes sample peak from continuous-time true peak.
- **U:** LUFS K-weighting, absolute/relative gating, and a mandated **4x** true-peak path are associated with later BS.1770 revisions, but were not verified from the current official PDF here.

### Implementation notes for music2
- **I:** Keep offline/analysis metering separate from effect DSP. If implementing LUFS/true peak, fetch and cite the current official BS.1770 revision and write conformance vectors before using results for exported-audio claims.

# Deduplicated sources

1. Dattorro Part 1, CCRMA: https://ccrma.stanford.edu/~dattorro/EffectDesignPart1.pdf
2. Dattorro Part 2, CCRMA: https://ccrma.stanford.edu/~dattorro/EffectDesignPart2.pdf
3. Dattorro index: https://ccrma.stanford.edu/~dattorro/music.html
4. Smith, FDN: https://ccrma.stanford.edu/~jos/pasp/Feedback_Delay_Networks_FDN.html
5. Smith, Freeverb: https://ccrma.stanford.edu/~jos/pasp/Freeverb.html
6. Das and Abel, grouped FDN: https://ccrma.stanford.edu/~orchi/Documents/JAES21_GFDN.pdf
7. Jot/Chaigne record: https://www.semanticscholar.org/paper/Digital-Delay-Networks-for-Designing-Artificial-Jot-Chaigne/cee51b28f161f7619f12fd05cd3b1f2938f496c0
8. W3C Audio EQ Cookbook: https://www.w3.org/TR/audio-eq-cookbook/
9. Zavalishin VA Filter Design: https://www.native-instruments.com/fileadmin/ni_media/downloads/pdf/VAFilterDesign_1.1.1.pdf
10. Giannoulis/Massberg/Reiss record/mirror: https://www.researchgate.net/publication/277772168_Digital_Dynamic_Range_Compressor_Design-A_Tutorial_and_Analysis
11. Parker/Zavalishin/Le Bivic DAFx-16: https://dafx.de/paper-archive/2016/dafxpapers/20-DAFx-16_paper_41-PN.pdf
12. ITU-R BS.1770-0: https://www.itu.int/dms_pubrec/itu-r/rec/bs/R-REC-BS.1770-0-200607-S!!PDF-E.pdf
13. Freeverb public tuning corroboration: https://github.com/thestk/stk/blob/master/src/FreeVerb.cpp
