# B2: Clean-room virtual-instrument research notes

Scope: public descriptions only. These are synthesis recipes, not implementations or copied code. **V** = directly verified on a fetched public page; **I** = engineering default inferred from the cited acoustics/synthesis descriptions; **U** = useful lead not used as a production fact. Frequencies are Hz and times seconds unless noted.

## 1. Mallets: modal synthesis

### Shared engine
**Method (I, informed by [1], [2], [3], [4])**: on a hit, excite a small bank of independently decaying sinusoids. Each mode is `f0 × ratio`; use a very short raised-cosine/noise strike, then add a separate filtered attack transient. This matches the fact that struck bars have inharmonic transverse modes and that makers alter their ratios by undercutting the bar.

**Parameters (I)**
- `strikePosition` 0.15-0.85 of bar length, default 0.42. Scale each mode by a position-dependent sinusoidal weight; do not excite a mode exactly at its node.
- `hardness` 0-1, default 0.45. Raise the transient cutoff from 1.5 to 10 kHz and increase upper-mode level from roughly -24 to -3 dB as it rises. This is a perceptual control, not a documented material calibration.
- `velocity` 0-1: amplitude approximately quadratic or 1.5-power; let hard hits additionally raise `hardness` by 0-0.25.
- Modal decay should be independently controllable. Do not force all partials to decay at the same rate.

**Pitfalls (I)**: do not use harmonic additive partials, a long white-noise burst, or a fixed modal amplitude pattern at every register. At high pitches, limit modes below Nyquist and anti-alias the transient.

### Marimba
**Method (V: [1], [2], [3], [4])**: modal bar plus a fundamental-weighted resonator/body layer. A marimba bar is undercut so its first overtone is near the fourth harmonic; CCRMA gives about 1, 4.0, 9.2. A measured example gives 1, 3.92, 9.24, 16.27, 24.22, 33.54, 42.97 [1 V].

**Parameters (I)**: ratios `[1, 3.92-4.00, 9.20-10.0, 16.0-16.5, 24-25]`; relative mode levels `[0, -7 to -14, -13 to -24, -22 to -36, -30 to -45] dB`; main decay 0.35-2.0, default 0.9; upper mode decay 0.12-1.0. Use a 2-12 ms impact transient and modest resonator/body gain around f0.

**Pitfalls (V/I: [3], [4])**: tubes reinforce the fundamental, not every partial [3 V]. Making high modes too loud turns it into xylophone or synthetic bell.

### Vibraphone
**Method (V: [2], [4])**: use deeply undercut metal-bar modes near marimba/vibe ratios 1:4:about 9.2-10, long decays, a fundamental resonator, and amplitude tremolo. The real rotating discs periodically occlude resonators, producing primarily tremolo with slight vibrato [2 V].

**Parameters (I)**: mode ratios `[1, 4.00, 9.2-10.0, 16-17]`; decay 2-12 (default 6 with pedal), damped decay 0.25-1.5; tremolo rate 1-10 Hz (default 5.5), depth 0-0.65 (default 0.32), sine-like shape; pedal controls the long versus damped envelope. Add 0-3 cents slow pitch modulation only if desired.

**Pitfalls (V/I: [2], [4])**: label the motor effect `tremolo` in the API, because the discs modulate resonator amplitude [2 V]. Do not bake tremolo into each note phase: use a shared motor LFO so chords breathe together.

### Xylophone
**Method (V: [1], [3], [4])**: shallow-undercut modal wood bar. The first overtone is tuned to about a 3:1 ratio; a measured xylophone set is 1, 3.00, 6.16, 10.29, 14.01, 19.66, 24.02 [1 V]. It is bright partly because of thick, stiff bars and a reinforced first overtone [3 V].

**Parameters (I)**: ratios `[1, 3.00, 6.16, 10.29, 14.0]`; main decay 0.15-1.1, default 0.42; hard transient 1-8 ms; upper-mode levels 4-10 dB stronger than marimba for the same velocity.

**Pitfalls (I)**: avoid vibraphone-like sustained metal ringing; use short decays and brighter attack.

### Glockenspiel
**Method (V: [5])**: free-free rectangular metal bar bank. CCRMA reports free-bar ratios 1.00:2.76:5.40:8.90 and notes that, for glockenspiel, all but the lowest transverse mode die quickly [5 V].

**Parameters (I)**: ratios `[1, 2.76, 5.40, 8.90]`; fundamental decay 1.5-10, default 4.0; upper decays 0.08-1.5; bright 0.5-5 ms transient; optional small f0 resonator. Make upper modes vivid at onset but relatively short.

**Pitfalls (I)**: sustaining every mode makes a generic bell. The clear long fundamental ring needs to remain audible after the metallic onset fades.

### Kalimba / mbira
**Method (V: [6], [7])**: model each tine as a clamped-supported-free beam, not a generic free bar. Published analysis finds the overtone ratios depend on where the bridge subdivides the tine [6 V]. A measurement summary reports a strong fundamental plus one dominant inharmonic overtone around 5.3-5.9× [7 V].

**Parameters (I)**: ratios `[1, 5.3-5.9, 8-14 optional]`, default second ratio 5.6; decay 0.35-3.0, default 1.2; pluck transient 2-15 ms; body resonance 150-900 Hz at low mix; add low-level sympathetic tine resonances only for currently held notes.

**Pitfalls (V/I: [6])**: do not hard-code a universal 5.9 or 6.3 ratio. Bridge position changes the ratios [6 V], so expose `overtoneRatio` per tine or register.

### Optional sitar and koto
**Sitar method (V/I: [8])**: start with a plucked waveguide/KS string, then add stiffness dispersion and a post-string nonlinear, curved-bridge contact stage. A physical-model paper identifies bridge-as-obstacle nonlinearity and dispersion as central to the sound [8 V]. Add 1-4 quiet sympathetic strings or resonant combs tuned to scale tones (I).

**Koto method (I)**: KS or modal-pluck string with a short body filter, `pluckPosition` 0.05-0.45, and a post-hit pitch bend of 0-200 cents over 30-400 ms for pressed-string gestures. Keep it optional until a public koto-acoustics source is collected.

## 2. Guitar: Karplus-Strong and extended KS

**Method (V: [9], [10])**: put a short excitation in a delay line, feed it through a loop loss filter, and feed it back. The original uses a two-sample averaging filter; the delay/loop phase determines pitch [9 V]. The required total phase delay is approximately `fs/f0`; fractional delay/interpolation is needed when that is non-integer [10 V]. Jaffe and Smith's 1983 extended KS paper is named in [10 V] as the canonical extension reference.

**Parameters (I, grounded in [9], [10])**
- `delaySamples`: `fs/f0`, with an allpass or interpolating fractional-delay section for final tuning.
- `loopLowpass`: one-pole or averaging amount 0.15-0.85, default 0.45. More smoothing loses treble faster.
- `loopGain`: 0.970-0.9995, default 0.992. Calibrate by target T60, not one global value.
- `pickPosition` beta: 0.05-0.48, default 0.18. Filter the excitation with a comb/notch pattern based on position; avoid exactly 0.5, which removes many odd harmonics.
- `stiffness`: allpass/dispersion amount 0-0.35, default steel 0.10, nylon 0.025. Keep subtle.
- `body`: 2-5 fixed resonant peaks or a short synthetic body IR, low wet mix 0.08-0.30.
- `strumSpacing`: 10-50 ms between strings, default 22 ms. Downstroke schedules low-to-high; upstroke reverses it (I).

**Nylon vs steel (I)**
- `guitar_nylon`: soften initial excitation, use lower high-frequency cutoff around 2-6 kHz, loop lowpass 0.45-0.75, dispersion 0-0.08, decays 0.8-5.0.
- `guitar_steel`: brighter 4-12 kHz excitation, loop lowpass 0.15-0.55, dispersion 0.04-0.20, decays 1.0-10.0. A light pick should raise attack brightness more than a finger.

**Pitfalls (V/I: [9], [10])**: delay length alone is not exact tuning because filter phase matters [9 V]. Do not change integer delay without compensating fractional delay, and use stateful strings so retriggers can interact naturally rather than always resetting to silence.

## 3. Flute, whistle, ocarina

**Method (V/I: [11], [12])**: physical flutes are sustained by a jet across the embouchure coupling to air-column resonances [11 V]. For a lightweight renderer, use a sine or rounded triangle core, a gently shaped harmonic layer, band-passed breath noise, and an attack chiff. Whistles can have a more harmonic core; ocarina should be close to a sine with little harmonic content (I).

**Parameters (I)**
- `breath`: 0-1, default 0.28; bandpass noise centered near `1-3 × f0`, Q 0.7-3.0, plus a 1-6 kHz component at low mix for airy attacks.
- `chiff`: 2-80 ms, default flute 18, whistle 8, ocarina 4; a short noise burst whose cutoff falls from 4-10 kHz.
- `vibratoRate`: 4-6 Hz, default 5.1; `vibratoDepth`: 3-25 cents, default 10; start after 80-350 ms.
- `tone`: flute sine:triangle 70:30 to 95:5; whistle triangle/sine 30:70 to 65:35; ocarina sine 85-100%.
- ADSR: attack 15-120 ms, release 40-250 ms, sustain controlled by note length/breath.

**Pitfalls (V/I: [11], [12])**: use noise as an excitation/air layer, not as a constant loud hiss. Static vibrato from sample zero sounds synthetic; ramp it in.

## 4. Choir / vocal formants

**Method (V: [13], [14], [15])**: use a rich saw/pulse or glottal-like source through *parallel* resonant bandpass filters whose centers are fixed in Hz, then mix their gains. A vocal tract has resonances/formants, and three formants can make a usable vowel identity [14 V]. Csound provides voice-specific formant frequency, amplitude, and bandwidth tables [13 V].

**Parameters (I)**: 3-5 parallel bands; source pulse width 35-60%; `ensembleVoices` 3-12, default 6; detune ±3-18 cents; start jitter 0-25 ms; vibrato 4.5-6.2 Hz, 3-18 cents; formant interpolation 30-250 ms. For pad use slow 0.2-2.5 s attack/release and lightly lowpass the source at 5-12 kHz.

### Formant table: Csound values, first three formants
All entries are **V from [13]**. Format is `F1/F2/F3 Hz; BW1/BW2/BW3 Hz`. `a` is /a/, `e` /e/, `i` /i/, `o` /o/, `u` /u/ as named by the Csound table. These are practical singing-voice presets, not universal Peterson-Barney population averages.

| Voice | a | e | i | o | u |
|---|---|---|---|---|---|
| Alto | 800/1150/2800; 80/90/120 | 400/1600/2700; 60/80/120 | 350/1700/2700; 50/100/120 | 450/800/2830; 70/80/100 | 325/700/2530; 50/60/170 |
| Bass | 600/1040/2250; 60/70/110 | 400/1620/2400; 40/80/100 | 250/1750/2600; 60/90/100 | 400/750/2400; 40/80/100 | 350/600/2400; 40/80/100 |
| Soprano | 800/1150/2900; 80/90/120 | 350/2000/2800; 60/100/120 | 270/2140/2950; 60/90/100 | 450/800/2830; 40/80/100 | 325/700/2700; 50/60/170 |
| Tenor | 650/1080/2650; 80/90/120 | 400/1700/2600; 70/80/100 | 290/1870/2800; 40/90/100 | 400/800/2600; 70/80/100 | 350/600/2700; 40/60/100 |

**Population-data note (V: [16])**: Hillenbrand et al. recorded 45 men, 48 women, and 46 children and measured F1-F4, explicitly extending Peterson and Barney [16 V]. Use such datasets later for spoken-vowel variation; do not claim a single set of numbers covers all speakers.

**Pitfalls (V/I: [14], [15])**: series-connected BPFs do not create independent formant peaks the way parallel bands do [15 V]. Avoid hard vowel jumps; F2 movement is especially important in speech-like transitions [15 V].

## 5. Drums

### Kit 808
**Verified basis (V: [17], [18], [19], [20])**: the TR-808 uses analog synthesis rather than samples [20 V]. Werner, Abel and Smith identify bridged-T networks in the bass drum and other 808 voices [17 V]. The 808 hat/cymbal bank uses six nominal Schmitt-trigger oscillators at 800, 540, 522.7, 369.6, 304.4, and 205.3 Hz; the 800 and 540 sources are trim-tunable [18 V].

**Recipes (I, grounded in [17]-[19])**
- Kick: bridged-T-like decaying pseudo-sine/resonator, final pitch 45-60 (default 53), decay 0.12-1.8, small downward pitch drift 0-8 semitones over 15-100 ms, click 0-0.35 with 1-8 ms duration. The exact 45-60 default is a design range, not claimed as a hardware calibration.
- Snare: two decaying resonant components around 180 and 330 plus noise. The two near-180/330 components are observed snare modes in SOS's acoustic analysis [19 V]. Set tonal decay 0.08-0.35, noise 0.07-0.30, noise HPF 800-2500 Hz.
- Hats/cymbal: sum six bandlimited pulse/square-like oscillators at the verified nominal frequencies, then highpass 3-8 kHz and bandpass/tone-shape. Closed hat 25-120 ms, open 0.25-2.0, cymbal 0.7-5.0. Use separate envelopes but one oscillator bank.
- Toms/congas: 1-3 decaying resonators, pitch 70-260, decay 0.15-1.2, downward pitch envelope 0-7 semitones.

**Pitfalls (V/I: [17], [18])**: do not substitute six sine oscillators for the pulse-like oscillator bank. Preserve non-identical frequencies and filters; otherwise hats become a simple chord.

### Kit 909
**Verified basis (V: [21], [22], [23])**: TR-909 succeeded TR-808 and uses samples for some sounds [21 V]. Roland's official spec lists controls: kick level/tune/decay/attack; snare level/tune/tone/snappy; tom tune/decay; closed/open hat level/tune [23 V]. SOS describes the kick as a saw oscillator shaped near sine, with pitch envelope, plus filtered noise and a short pulse/click path [22 V].

**Recipes (I)**
- Kick: saw-to-near-sine tonal path; start frequency 120-500 and fall to 45-65 over 20-90 ms; amplitude decay 0.18-1.5; click 1-12 ms; lowpassed noise 0-0.20. Do not assert a single hardware start frequency.
- Snare: two triangle-ish/near-sine resonators around 160-230 and 280-420, 80-250 ms; add bandpassed noise 0.08-0.45; `snappy` controls noise and highpass amount; `tone` moves noise filter.
- Hats/cymbals: use a short 6-bit-like sampled/noise asset if the product permits designed-in assets; otherwise mimic with bit-reduced filtered noise and short metallic layers. Label the latter an approximation.

**Pitfalls (V/I: [21]-[23])**: model controls separately rather than one opaque `909ness` knob. The official interface itself distinguishes tune, decay, attack, tone and snappy [23 V].

### Kit acoustic
**Method (V/I: [5], [19])**: circular membranes have modal behavior rather than a harmonic oscillator series [5 V], and a snare has two coupled heads, shell coupling, and wires/cables across its lower head [19 V].

**Recipes (I)**
- Kick: 3-8 inharmonic membrane/shell modes, fundamental 45-80, pitch fall 0-5 semitones over 20-80 ms, beater click 1-12 ms, decay 0.15-1.2.
- Snare: 5-10 short membrane modes plus 1-80 ms filtered wire noise; two prominent tonal regions near 180/330 can be starting points, not required fixed frequencies.
- Tom: 3-7 membrane modes, fundamental 80-260, pitch drop 0-4 semitones/30-150 ms, decay 0.15-1.8.
- Hat/cymbal: layered filtered noise plus 12-40 sparse inharmonic modes; asymmetric rapid onset and 0.08-5 s decay.

**Pitfalls (I)**: neat integer harmonic stacks sound like tuned percussion, not membranes. Randomize hit-dependent mode levels and decay slightly.

### Kit lo-fi
**Method (I)**: synthesize any of the above, then apply drive/saturation, sample-rate reduction, optional bit-depth reduction, and lowpass.

**Parameters (I)**: saturation drive 0-18 dB; bit depth 4-12 (default 8); sample-rate reduction 4-22 kHz (default 11); lowpass 8-12 kHz (default 10); optional 50/60 Hz hum at -50 to -35 dB. Put anti-alias filtering before rate reduction.

**Pitfalls (I)**: apply degradation after the voice envelopes and mix, but keep a safety limiter. Excessive bitcrush on every channel removes transient separation.

## 6. Proposed voice table

| voice id | method | parameters | ranges | defaults | references |
|---|---|---|---|---|---|
| marimba | modal bar + f0 resonator | ratios, decay, hardness | 1/3.92-4/9.2-10; 0.35-2 s | 1/3.92/9.24; 0.9 s | [1]-[4] |
| vibraphone | modal metal bar + shared tremolo | pedal, tremolo, decay | 1-10 Hz; 2-12 s | 5.5 Hz, 32%, 6 s | [2], [4] |
| glockenspiel | free-bar modes | modal levels, decay | 1/2.76/5.40/8.90; 1.5-10 s | 4 s | [5] |
| kalimba | bridge-dependent tine modes | overtone ratio, pluck, body | 5.3-5.9×; 0.35-3 s | 5.6×, 1.2 s | [6], [7] |
| xylophone | shallow-undercut modal bar | ratios, bright attack, decay | 1/3/6.16; 0.15-1.1 s | 0.42 s | [1], [3], [4] |
| guitar_nylon | KS + body filter | beta, loop LP/gain, dispersion | beta .05-.48; decay .8-5 s | beta .18, disp .025 | [9], [10] |
| guitar_steel | extended KS + dispersion | beta, LP/gain, dispersion | beta .05-.48; decay 1-10 s | beta .18, disp .10 | [9], [10] |
| flute | sine/triangle + breath | breath, chiff, vibrato | vib 4-6 Hz; 3-25 cents | 5.1 Hz, 10 cents | [11], [12] |
| whistle | bright sine/triangle + chiff | tone, breath, vibrato | chiff 2-30 ms | 8 ms | [11], [12] |
| ocarina | near-sine air tone | sine %, breath, attack | sine 85-100% | 95% | [11], [12] |
| choir_aah | source + parallel formants | formants, ensemble, vibrato | 3-12 voices; ±3-18 cents | soprano/alto a, 6 voices | [13]-[16] |
| choir_ooh | source + parallel formants | formants, ensemble, vibrato | 3-12 voices; ±3-18 cents | tenor/alto u, 6 voices | [13]-[16] |
| sitar | KS + nonlinear bridge | dispersion, bridge, sympathy | 0-.35; 1-4 strings | disp .12, 2 strings | [8]-[10] |
| koto | KS/modal pluck + bend | pluck position, bend | .05-.45; 0-200 cents | .20; 60 cents | I only |
| kit_909 | analog-style layered drum synth | pitch env, click, snappy | kick 45-65 end Hz | 55 Hz | [21]-[23] |
| kit_808 | bridged-T/resonator + six-pulse hats | decay, pitch drift, filter | kick 45-60 end Hz | 53 Hz | [17]-[20] |
| kit_acoustic | membrane modes + noise | modes, pitch drop, wire noise | kick 45-80; tom 80-260 | 6 modes/voice | [5], [19] |
| kit_lofi | post-process kit voice | drive, bits, SR, LPF | 4-12 bit; 4-22 kHz; LPF 8-12k | 8 bit, 11 kHz, 10k LPF | I only |

## Sources

1. **V**. Euphonic / University of Cambridge, “Marimbas and xylophones.” https://euphonics.org/3-3-marimbas-and-xylophones/
2. **V**. Wikipedia, “Vibraphone.” https://en.wikipedia.org/wiki/Vibraphone
3. **V**. HyperPhysics, “Xylophone and Marimba.” http://hyperphysics.phy-astr.gsu.edu/hbase/Music/xylo.html
4. **V**. CCRMA, “Percussion Instruments.” https://ccrma.stanford.edu/CCRMA/Courses/150/percussion.html
5. **V**. CCRMA, “Percussion Instruments,” free-bar and glockenspiel modal ratios. https://ccrma.stanford.edu/CCRMA/Courses/150/percussion.html
6. **V**. JASA/PubMed record, “The tones of the kalimba (African thumb piano).” https://pubmed.ncbi.nlm.nih.gov/22280717
7. **V**. Canadian Acoustics, “Characterizing the sound of an African thumb piano (kalimba).” https://jcaa.caa-aca.ca/index.php/jcaa/article/download/1805/1552/1942
8. **V**. Siddiq, “A Physical Model of the Nonlinear Sitar String.” https://acoustics.ippt.pan.pl/index.php/aa/article/view/129
9. **V**. Smith, *Physical Audio Signal Processing*, “The Karplus-Strong Algorithm.” https://ccrma.stanford.edu/~jos/pasp/Karplus_Strong_Algorithm.html
10. **V**. Wikipedia, “Karplus-Strong string synthesis,” including bibliographic links to Karplus-Strong (1983) and Jaffe-Smith (1983). https://en.wikipedia.org/wiki/Karplus%E2%80%93Strong_string_synthesis
11. **V**. UNSW Music Acoustics, “Flute acoustics.” https://www.phys.unsw.edu.au/jw/fluteacoustics.html
12. **V**. Sound On Sound, “Synthesizing Wind Instruments.” https://www.soundonsound.com/techniques/synthesizing-wind-instruments
13. **V**. Csound Manual, “Formant Values.” https://csound.com/manual/misc/formants/
14. **V**. Wikipedia, “Formant.” https://en.wikipedia.org/wiki/Formant
15. **V**. Sound On Sound, “Formant Synthesis.” https://www.soundonsound.com/techniques/formant-synthesis
16. **V**. Hillenbrand et al. (1995), PubMed record, “Acoustic characteristics of American English vowels.” https://pubmed.ncbi.nlm.nih.gov/7759650/
17. **V**. Werner, Abel, Smith (2014), “A Physically-Informed, Circuit-Bendable, Digital Model of the Roland TR-808 Bass Drum Circuit.” https://dafx14.fau.de/papers/dafx14_kurt_james_werner_a_physically_informed,_ci.pdf
18. **V**. Baratatronix, “Roland TR-808 Cymbal & Hi-Hat Synthesis.” https://www.baratatronix.com/blog/cascadia-808-cymbal-hi-hat-synthesis
19. **V**. Sound On Sound, “Synthesizing Drums: The Snare Drum.” https://www.soundonsound.com/techniques/synthesizing-drums-snare-drum
20. **V**. Wikipedia, “Roland TR-808.” https://en.wikipedia.org/wiki/TR-808
21. **V**. Wikipedia, “Roland TR-909.” https://en.wikipedia.org/wiki/Roland_TR-909
22. **V**. Sound On Sound, “Practical Bass Drum Synthesis.” https://www.soundonsound.com/techniques/practical-bass-drum-synthesis
23. **V**. Roland Support, “TR-909: Technical Specifications.” https://support.roland.com/hc/en-us/articles/201921899-TR-909-Technical-Specifications
