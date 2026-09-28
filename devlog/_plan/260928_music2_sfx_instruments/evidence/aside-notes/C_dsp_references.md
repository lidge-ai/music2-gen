# C. DSP references (parent-session notes, 2026-09-28)

Labels: V = read on the fetched page/PDF this session; I = inferred; U = not confirmed.

## Karplus & Strong 1983, "Digital Synthesis of Plucked-String and Drum Timbres", CMJ 7(2)
URL: https://users.soe.ucsc.edu/~karplus/papers/digitar.pdf (author-hosted PDF, fetched + pdftotext)
- V: basic algorithm averages two successive samples in a recirculating wavetable of length p; initial table random (+A/-A); gives slow decay (text lines ~133-139).
- V: drum variant = probabilistic recurrence with "blend factor" b: b=1 reduces to plucked string; b=1/2 is drum-like; intermediate values give in-between timbres. Large p (200+) = noisy snare-like drum; small p (~20) different timbre; initial table may be constant since drum algorithm creates its own randomness.
- V: "decay stretch factor S" slows decay (high harmonics decay very rapidly in basic algorithm); stretched drum recurrence combines b and S.
- V: a variant reduces decay times and sounds "softer, more like a nylon string than a steel one" (line ~306-310).
- Take: the base loop, blend-factor drum mode (cheap snare/tom noise drums), stretch factor for decay control.

## Jaffe & Smith 1983, "Extensions of the Karplus-Strong Plucked-String Algorithm", CMJ 7(2)
Bibliographic: https://www.semanticscholar.org/paper/Extensions-of-the-Karplus-Strong-Plucked-String-Jaffe-Smith/995470417936f34e4a6f350a8b16eedbdc1b7d28 (U: paper body not fetched)
Summary used instead: https://ccrma.stanford.edu/~jos/pasp/Extended_Karplus_Strong_Algorithm.html (V)
- V: EKS adds: pick-direction lowpass Hp(z)=(1-p)/(1-p z^-1) (p=0 one direction, 0<p<1 opposite); pick-position comb H_beta(z)=1 - z^-floor(beta N + 1/2), beta in (0,1); string-damping filter Hd (one/two poles/zeros typical, |Hd|<=1 for stability); string-stiffness allpass Hs (several poles/zeros); first-order tuning allpass H_eta with eta in [-1/11, 2/3] for tuning delays 0.2-1.2 samples; dynamic-level lowpass HL=(1-RL)/(1-RL z^-1) with RL=e^(-pi L T), L = desired bandwidth in Hz.
- V: N = pitch period (2x string length) in samples.
- V: better to offset the fractional tuning delay to [eps, 1+eps) to avoid near-zero allpass delay.
- Take: exact filter list for a guitar/koto/harp voice; pick position as comb; velocity->dynamic-level LP.

## JOS PASP, KS page
URL: https://ccrma.stanford.edu/~jos/pasp/Karplus_Strong_Algorithm.html (V)
- V: KS = ideal string with simplest frequency-dependent loss filter; pluck = random initial displacement+velocity (white noise) — very energetic, so in practice noise is lowpass filtered; the LP cutoff acts as dynamic-level control because strings are brighter when louder.

## JOS PASP (book) — https://ccrma.stanford.edu/~jos/pasp/ (V, index page)
- Take: digital waveguides (strings, tubes), commuted synthesis, piano chapter (https://ccrma.stanford.edu/~jos/pasp/Piano.html, V): hammer-string interaction modeled as one or a few discrete impulses filtered in a collision-velocity-dependent way; louder = taller, thinner pulses (brighter). Soundboard+enclosure impulse response can be commuted into an excitation table. Sustain pedal "string reverberation" can be simulated by summing all-strings ringing into the excitation.
- Commuted piano paper: Smith & Van Duyne, ICMC 1995, https://ccrma.stanford.edu/~jos/pdf/svd95.pdf (V abstract: multiple coupled strings, nonlinear hammer, soundboard/enclosure; simplifications via LTI commutativity).

## JOS SASP — https://ccrma.stanford.edu/~jos/sasp/ (V index page)
- Take: STFT/sinusoidal modeling, additive synthesis, spectral envelopes, noise modeling (for analysing/validating output spectra and for additive piano/organ voices). (I: specific chapters not read this session.)

## Chowning 1973, "The Synthesis of Complex Audio Spectra by Means of Frequency Modulation", JAES 21(7) 526-534
URL: https://ccrma.stanford.edu/sites/default/files/user/jc/fm_synthesis_paper.pdf (V, digital version 2007)
- V: sidebands at c +/- n m; amplitudes follow Bessel functions Jn(I); bandwidth grows with index I; energy "stolen" from carrier.
- V: negative-frequency sidebands reflect around 0 Hz with phase inversion; c:m = 1:1 gives harmonic spectra (example c=m=100 Hz, I=4); irrational ratios (e.g. 1:sqrt2) give inharmonic spectra -> bells/drums.
- V: paper closes with brass, woodwind and percussive simulations; key insight is index envelope controls spectral evolution over time.
- Take: 2-op FM for EP tines, bells, brass (index tracks amp envelope), mallets, laser zaps.

## Werner, Abel, Smith 2014, "A Physically-Informed, Circuit-Bendable, Digital Model of the Roland TR-808 Bass Drum Circuit", DAFx-14
URL: https://dafx14.fau.de/papers/dafx14_kurt_james_werner_a_physically_informed,_ci.pdf (V, fetched)
- V: 1 ms trigger pulse excites a bridged-T resonator (bandpass); modeled centre ~49.5 Hz, Roland's tuning chart 56 Hz.
- V: two different frequency effects are often conflated: (1) during attack an envelope (settles ~5 ms after trigger) lowers effective resistance, raising centre frequency by more than an octave and raising Q for ~6 ms — too short to hear as pitch, but makes attack "punchier/crisper"; (2) "pitch sigh" = subtle downward pitch drift from leakage through R161.
- V: decay control spans a wide range (paper sweeps k in [0.001, 1.0]); output = passive LP (tone) -> level divider -> HP.
- Take: 808 kick = resonant sine-like ringing at ~50-56 Hz, very short (~6 ms) 2x+ frequency attack transient, then small slow downward "sigh", long adjustable decay. Big "808 glide" in trap is a production practice, not the circuit.

## Werner, Abel, Smith 2014, "The TR-808 Cymbal: a Physically-Informed, Circuit-Bendable, Digital Model", ICMC/SMC 2014
URL: http://icmc14-smc14.net/images/proceedings/OS24-B10-TheTR-808Cymbal.pdf (V, fetched); CCRMA listing https://ccrma.stanford.edu/papers/tr-808-cymbal-physically-informed-circuit-bendable-digital-model
- V: six Schmitt-trigger rectangular oscillators (one HD14584 hex chip) shared by cymbal and hi-hats. Nominal frequencies 205.3, 369.6, 304.4, 522.7 Hz, #5 range 359.4-1149.9 (factory-tuned 800 Hz), #6 range 254.3-627.2 (factory-tuned 540 Hz). Duty cycle ~47.98%.
- V: summed signal feeds two band-pass filters, centres ~3440 Hz and ~7100 Hz, that accentuate upper overtones; later VCA/HP stages; a resonance near ~10500 Hz noted in a later stage.
- Take: metallic hat/cymbal = 6 detuned squares -> two bandpasses (3.4k, 7.1k) -> HP -> short (closed) or long (open/cymbal) exponential envelopes.

## Sound On Sound "Synth Secrets" (Gordon Reid, 1999-2004), 63 parts
Index: https://www.soundonsound.com/series/synth-secrets-sound-sound (V)
- Relevant parts (V titles/dates on index): Synthesizing Drums: The Bass Drum (Jan 2002); Practical Bass Drum Synthesis (Feb 2002, incl. TR-808/909 bass drums); Snare Drum (Mar/Apr 2002); Analysing Metallic Percussion (May 2002); Synthesizing Realistic Cymbals (Jun 2002); Practical Cymbal Synthesis (Jul 2002: TR-808 cymbal "six square-wave oscillators tuned enharmonically"); Bells (Aug 2002); Cowbells & Claves (Sep 2002); Pianos (Oct 2002) + JX10 piano parts 1-3; String machines (Feb 2003); bowed strings (Mar-Jul 2003); pan pipes; flutes (Aug 2003); brass and organ parts.
- Take: subtractive recipes and envelope shapes for drums, strings, brass, organ, flute.

## Modal synthesis
- Adrien 1991, "The Missing Link: Modal Synthesis", in Representations of Musical Signals (MIT Press) pp. 269-298: https://dl.acm.org/doi/10.5555/131150.131158 (V bibliographic only).
- Morrison & Adrien 1993, "MOSAIC: A Framework for Modal Synthesis", CMJ 17(1):45-56 (V as a citation on https://dl.acm.org/doi/10.1162/comj.2006.30.3.22).
- Take: modal = bank of exponentially-decaying sinusoids / 2-pole resonators, each with (freq ratio, amplitude, T60); strike position and mallet hardness set per-mode amplitudes. (I)

## Peterson & Barney 1952, "Control Methods Used in a Study of the Vowels", JASA 24(2):175-184
- Publisher: https://pubs.aip.org/asa/jasa/article/24/2/175/722376/Control-Methods-Used-in-a-Study-of-the-Vowels (V bibliographic)
- PDF mirror: https://pure.mpg.de/rest/items/item_2375480_4/component/file_2375479/content (V: 76 speakers, ten /hVd/ words, F1/F2 measurements)
- Take: F1/F2/F3 averages for men/women/children (numbers: see B2 notes).
