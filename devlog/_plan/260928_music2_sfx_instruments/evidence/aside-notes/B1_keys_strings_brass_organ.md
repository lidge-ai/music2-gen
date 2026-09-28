# B1: clean-room virtual-instrument notes for music2-gen

Scope: implementation guidance derived from public descriptions, not copied code or samples. `V` means the accompanying source page was fetched and directly supports the fact. `I` means a design inference/range proposed for this offline renderer. `U` means a useful requested detail was not verified on a fetched public page and should not be presented as measured fact. All numbers are starting points, not a claim about any particular instrument.

## 1. Acoustic piano

### Method

- **V** Use a bank of damped sinusoids per struck string, with partial frequencies `f_n = n f0 sqrt(1 + B n^2)`. Stiff piano strings require dispersion in a waveguide model; a higher-level additive approximation can express the same audible sharpward movement of higher partials. [1][3][11]
- **V** A physical-model route has four major pieces: hammer, string, bridge, and soundboard/enclosure/listening response. Commuted synthesis is a useful hybrid: keep the string physical, represent the hammer as a signal, and use an impulse response for body/resonator behavior. It works because nearly linear, time-invariant string/body elements can be exchanged, allowing excitation to be convolved with the body response. [1][2]
- **I** For this JSON-to-WAV renderer, make additive synthesis the default: it is deterministic and inexpensive. Offer a later optional digital-waveguide backend, not a copied implementation. Its conceptual pieces are a bidirectional delay line, per-round-trip damping, a dispersion all-pass stage, and a hammer excitation.

### Parameters with ranges/defaults

- **V** `inharmonicityB`: use `0.00005..0.0007` as a documented lower-half piano-compass starting interval; a published five-piano study gives this interval and illustrates values around `0.00010` and `0.00016` at A2. Fletcher's expression is explicitly cited there. [11] **I** Default curve: mid register `0.00010..0.00040`; do not impose a monotonic whole-keyboard curve. Raise B toward short treble strings and permit raised B in thick bass strings, because both diameter/length scaling and construction matter. [3][10]
- **V** One public secondary source reports a much broader piano span, `0.0002` bass to `0.4` treble, so B must be per-key/per-piano rather than hard-coded as one universal number. [10] **I** Treat values above `0.005` as exceptional presets requiring listening checks, rather than normal defaults.
- **I** `partials`: 12..48, default 24. Stop when `f_n` exceeds 0.45 times sample rate. Set harmonic amplitude initially near `1/n^0.8..1/n^1.4`, then shape by key and velocity.
- **I** `partialDecaySec`: use a frequency-dependent base of 0.2..12 s. Make upper partial time constants 0.25..0.8 of low-partial time constants. Default mid-key: partial 1 about 4 s, partial 8 about 1.2 s. This is a perceptual renderer control, not a measured universal piano constant.
- **V** Piano tones are described in the literature as having double decay: initial sound followed by aftersound. [12] **I** Model each partial as two exponentials, `A*(m*exp(-t/tauPrompt)+(1-m)*exp(-t/tauAfter))`, with `m=0.35..0.75`, `tauPrompt=0.03..1.5 s`, and `tauAfter=0.4..12 s`; default `m=0.55`. This approximates coupled strings/polarizations without claiming to reproduce their mechanics.
- **I** `unisonCount`: bass 1, middle 2..3, upper 3. `unisonDetuneCents`: 0..2.5 cents per string, default ±0.7 cents for a three-string middle/treble unison. Randomize deterministically from note/voice seed.
- **V** Inharmonicity causes piano octaves to be tuned wider than 2:1, with the exact stretch varying by piano and register. [3] **I** `stretchCents`: 0 around A4, then interpolate to -5..-25 cents in lowest register and +5..+35 cents in highest register; default ±12 cents at ends. This is deliberately modest and should be overrideable by a per-key table.
- **I** `hammerNoise`: 1..25 ms band-passed noise/thump, default 6 ms; mix -45..-18 dB relative to peak and brighten it with velocity. Add a 40..160 Hz damped thump at -36..-20 dB only for lower keys. Do not make the attack a static click.
- **I** `pan`: mono low bass; linearly spread each unison/string `10..55%` L/R by key position, default low keys -0.35 and high keys +0.35 with ±0.05 unison offsets.

### Pitfalls

- **V** Higher partials become progressively sharp in piano tones, and real tuning/stretch differs among pianos and registers. [3] Do not use one B, one static EQ curve, or pure equal-tempered partials for all keys.
- **V** A string and body response are only approximately linear/time-invariant, so commuted synthesis is a useful approximation rather than exact physics. [2]
- **I** Avoid adding every component at the same phase: randomize unison phases but retain deterministic renders. Clamp total attack level, because three unisons plus hammer noise can clip.
- **U** Published, general-purpose numeric prompt/aftersound time constants and a reliable universal hammer-noise duration were not established in the fetched pages. Keep the above as tunable design controls.

## 2. Electric piano

### Method

- **V** A public DX7 programming discussion describes three modulator-carrier pairs: a `1:1` pair for the body and a `14:1` pair for the bell-like attack; the modulator envelope controls time-varying modulation intensity. [13]
- **I** Implement `epiano_fm` as 2..4 parallel FM pairs. A simple operator is `sin(2π f_c t + I(t) sin(2π f_m t))`. Use a 1:1 body pair, optionally a lightly detuned duplicate, plus a fast-decaying 14:1 attack pair. Keep the attack carrier at the played pitch, with the modulator ratio at 14:1; do not confuse this with setting the entire note 14× high.
- **I** `epiano_wurli` can be a distinct optional voice: a reed-like, less bell-heavy branch using 1:1 or 2:1 FM plus a saturating/soft-clipped sine or triangle body, short noise, and tremolo. This is a sonic approximation, not a claim that it models a real Wurlitzer reed mechanically.

### Parameters with ranges/defaults

- **V** `bodyRatio`: 1:1; `bellRatio`: 14:1 are directly supported as a DX7-style recipe. [13]
- **I** `bodyIndex`: 0.3..4.0, default 1.2. `bellIndex`: 1..12, default 6.0. Map velocity 1..127 to a 0.35..1.0 multiplier, especially on bell index. High index produces a brighter, more complex attack.
- **I** `indexDecaySec`: body 0.15..2.5 s, default 0.7 s; bell 0.015..0.35 s, default 0.08 s. Couple amplitude and index decay, but let index decay faster than amplitude.
- **I** amplitude: attack 1..15 ms, decay 0.2..3.0 s, sustain 0..0.7, release 0.08..2.5 s; defaults 4 ms, 1.1 s, 0.25, 0.7 s.
- **I** `pairDetuneCents`: ±0..5 cents, default ±1.2 cents. `keyNoise`: 1..12 ms at -50..-26 dB, default 4 ms.
- **I** Wurli defaults: body index 0.4..2.2 (1.0), mild drive 0..18 dB (5 dB), attack 2..12 ms (5 ms), release 80..900 ms (350 ms).
- **I** tremolo/autopan: sine or equal-power pan, rate 3..8 Hz (default 5.5 Hz), depth 0..0.8 (default 0.25); use a slightly offset L/R phase only if stereo is desired.

### Pitfalls

- **V** The supplied public recipe supports a 1:1 body and 14:1 bell pair, but not universal operator levels, envelopes, or a Rhodes/Wurlitzer identity. [13]
- **I** A constant large FM index reads as a metallic bell, not an electric piano. Make velocity raise the initial index and let it decay. Avoid using copyrighted factory patch data, samples, or source code.
- **U** No fetched public technical source gave authoritative Rhodes/Wurlitzer tremolo ranges or a complete Wurlitzer reed physical parameterization.

## 3. Strings ensemble

### Method

- **V** Bowed strings can be regarded as near-harmonic in steady bowing because nonlinear stick-slip motion mode-locks partials to integer ratios; that is unlike struck piano strings. [3]
- **I** Generate 3..9 detuned sawtooths per note, low-pass them, and add a modest broad spectral/formant tilt. Use per-voice phase offsets and a stereo distribution. This is an ensemble-synth voice, not a substitute for a bow/string physical model.
- **I** Create ensemble movement with three independent delay/pitch paths. A Solina-like approximation can use three phases 120 degrees apart and two slow components per path, around 0.4..0.9 Hz and 4..7 Hz. This rate choice is an inference to achieve a slow drift plus a quicker shimmer, not verified as original Solina circuitry values in the fetched sources.

### Parameters with ranges/defaults

- **I** `voices`: 3..9, default 5; `detuneCents`: ±3..±18 cents, default ±8 cents across the stack.
- **I** filter: 12 dB/oct low-pass cutoff 1.2..8 kHz, default 3.5 kHz; velocity opens it by 0..2.5 kHz. Add a weak broad boost centered 700 Hz..2 kHz, 0..5 dB, default 2 dB.
- **I** bowed amplitude attack: 100..500 ms, default 220 ms; release 100..900 ms, default 350 ms. Use a small 10..50 ms stagger across ensemble members.
- **V** A violin-vibrato study reports a mean rate of 5.9 Hz and mean excursion ±15.2 cents, modeled well by one sinusoid; partial amplitude envelopes also have vibrato-rate-related components. [14]
- **I** `vibratoRateHz`: 4.5..6.5, default 5.8; `vibratoDepthCents`: ±8..±30, default ±15; onset delay 100..900 ms, default 350 ms; ramp 80..500 ms. Include 0..20% amplitude modulation at the same rate.
- **I** chorus delay: 4..25 ms, default 12 ms; pitch depth ±3..±14 cents, default ±7; mix 0.15..0.75, default 0.45. Slow LFO 0.4..0.9 Hz (0.6); fast LFO 4..7 Hz (6.0).

### Pitfalls

- **V** Removing amplitude modulation from a studied violin-vibrato model had a marked perceptual effect, whereas removing frequency modulation had little effect in that evaluation. [14] Do not implement vibrato as pitch-only by default.
- **I** Full-depth vibrato from note-on sounds synthetic. Delay and ramp it. Excess detune plus deep chorus creates seasick pitch rather than section width; cap both jointly.
- **U** The fetched source set did not verify the exact original Solina BBD/LFO topology or the requested 0.6/6 Hz figures as historical circuit constants.

## 4. Brass section

### Method

- **V** A practical brass-synthesis account identifies the evolving loudness, tonal contour, pitch contour, formants, and noise as separate contributors, and describes initial transients that can be gentle, rapid, or plosive depending on tonguing/blowing. [5]
- **I** Use 2..5 saw/pulse oscillators with ±2..±12-cent section detune, a 12 or 24 dB/oct low-pass filter, optional broad formant peaks, noise at the start, and amplitude/filter envelopes. More velocity raises both level and filter cutoff.

### Parameters with ranges/defaults

- **I** amplitude attack: 15..180 ms, default 55 ms; decay 80..600 ms, default 220 ms; sustain 0.55..1.0, default 0.85; release 50..500 ms, default 140 ms.
- **I** `cutoffHz`: 600..7000 Hz, default 2.2 kHz at medium velocity; velocity envelope adds 0.5..5 kHz, default 2.0 kHz. `filterAttack`: 10..120 ms, default 35 ms; filter decay 80..600 ms, default 240 ms.
- **I** `lipScoopCents`: -100..+30 cents over 20..80 ms, default -25 cents over 45 ms. Make it velocity/style dependent and apply to all section players with a small timing spread.
- **I** attack noise: 3..35 ms, -45..-20 dB, default 12 ms/-32 dB; filter it broadly 1..6 kHz. Optional mild saturation 0..9 dB, default 2 dB.
- **I** formant-ish peaks: 700..1200 Hz and 1.5..3.5 kHz, each 0..6 dB, default 2 dB. Keep them optional to prevent every brass preset sounding like trumpet.

### Pitfalls

- **V** A static waveform alone ignores the temporal changes that distinguish brass notes. [5]
- **I** Avoid hard-coding the pitch scoop. It is an expressive preset control, not a universal measured trumpet law. For a section, stagger attack 0..35 ms and pitch offsets ±2..±8 cents to prevent a mono-synth chord.
- **U** Risset/Morrill paper-specific numeric cutoff, attack, or scoop figures were not verified on a fetched public page. The stated brass numeric ranges are renderer design proposals.

## 5. Organ drawbar

### Method

- **V** Hammond drawbars mix relatively pure sine-wave tone-generator outputs. The common nine are 16', 5 1/3', 8', 4', 2 2/3', 2', 1 3/5', 1 1/3', and 1'. [6][7]
- **V** Their relative harmonic multipliers are 0.5, 1.5, 1, 2, 3, 4, 5, 6, and 8, respectively. [6]
- **I** Per held key, sum nine near-sines using those multipliers, multiplied by each drawbar gain. Use a stable oscillator phase per tonewheel/key lane. Add optional tiny frequency drift/noise, but keep it extremely small so the basic tone remains organ-like.

### Parameters with ranges/defaults

- **V** drawbar values are 0..8; a Hammond-focused source says each pull step is roughly +3 dB, with 0 silent. [6] **I** represent `drawbars` as nine integers 0..8 and calculate gain with a tunable 3 dB/step law, normalized after summing. Default registration: `[8,0,0,0,8,0,0,0,0]` for a simple 8'+2 2/3' color is not appropriate because index mapping must be explicit; safer default `[0,0,8,0,0,0,0,0,0]` for pure 8'.
- **V** Hammond documentation describes percussion as a decaying 4' (second harmonic) or 2 2/3' (third harmonic) addition; Fast shortens decay and Soft reduces volume. [7]
- **I** `percussion`: harmonic `2|3`, default 2; decay mode `fast|slow`, default fast; decay 80..350 ms fast (160 ms), 350..1500 ms slow (800 ms); normal/soft attenuation 0..-9 dB (soft -5 dB). These times are implementation ranges, not verified vintage values.
- **I** key click: 0.5..8 ms shaped noise/transient, -55..-25 dB, default 2.5 ms/-40 dB. Keep click independent of note velocity or only mildly velocity-scaled.
- **V** A Hammond manual says the tonewheel engine has 96 continuously oscillating tonewheels; its vibrato changes pitch, and Chorus combines that with original sound. [7] **I** `scannerRateHz`: 6.10..7.25, default 6.83, matching a current Hammond documented rate-option range. [8] Use C1/C2/C3 as progressively wider dry+modulated mixes and V1/V2/V3 as progressively deeper pitch-only mixes; exact vintage scanner depths are U.
- **V** Leslie uses a rotating treble horn and bass drum; published measured figures include chorale around 40..50 rpm (about 0.7..0.8 Hz) and tremolo roughly 340..400 rpm (about 5.7..6.8 Hz), with horn generally faster than bass. [4][9]
- **I** `leslieHornHz`: chorale 0.7..0.85 (0.8), tremolo 5.7..6.8 (6.3). `leslieDrumHz`: chorale 0.55..0.75 (0.67), tremolo 5.3..5.9 (5.7). Simulate both amplitude and Doppler/pan change; cross over horn/drum around 700..1000 Hz.
- **V** Current Hammond documentation offers horn rise/fall 0.2..5.0 s and bass rise/fall 0.5..12.5 s. [8] **I** defaults: horn rise 1.2 s/fall 1.0 s; drum rise 4.5 s/fall 3.8 s.
- **I** foldback: offer `foldbackMode: off|vintageApprox`, default vintageApprox. At keyboard extremes, remap unavailable high/low harmonic generators into the available tonewheel range rather than producing unlimited mathematical harmonics. Exact model-specific breakpoint tables are U.

### Pitfalls

- **V** Leslie is not just tremolo: rotation creates a moving horn/drum presentation and the source describes both frequency and amplitude consequences. [4][8]
- **I** Do not label a plain sine additive organ as Hammond merely because it has drawbars. Key click, percussion behavior, scanner/chorus, foldback choice, and rotary speaker are separate optional layers.
- **U** Exact vintage C1/C2/C3/V1/V2/V3 depth tables, exact original percussion capacitor decay times, and exact foldback maps were not confirmed in fetched pages.

## Proposed voice table

| voice id | method | parameters | ranges | defaults | references |
|---|---|---|---|---|---|
| `piano` | additive inharmonic partial bank; optional future waveguide/commuted body | B, partials, double decay, unison, stretch, hammer, pan | B 0.00005..0.0007 lower compass; 12..48 partials; unison 1..3; detune 0..2.5 cents | B key curve around 0.0001..0.0004; 24 partials; 3 upper strings ±0.7 cents | [1][2][3][10][11][12] |
| `epiano_fm` | parallel FM body/bell pairs | ratios, indices, index envelopes, velocity, tremolo | 1:1 body; 14:1 bell; body I 0.3..4; bell I 1..12 | 1:1 + 14:1; I 1.2/6; bell decay 80 ms | [13] |
| `epiano_wurli` | optional reed-ish FM + mild drive | body ratio/index, drive, noise, tremolo | ratio 1:1..2:1; I 0.4..2.2; drive 0..18 dB | 1:1, I 1, 5 dB drive | [13] (method family only); U for Wurli specifics |
| `strings_ensemble` | detuned saw stack + LPF/formant tilt + chorus/vibrato | voices, detune, cutoff, chorus LFO, vibrato | 3..9; ±3..18 cents; 0.4..0.9/4..7 Hz chorus; 4.5..6.5 Hz vibrato | 5 voices, ±8 cents, 0.6/6 Hz, 5.8 Hz ±15 cents | [3][14] |
| `brass_section` | saw/pulse stack, velocity filter envelope, noise, scoop | detune, amp/filter envelopes, cutoff, scoop, formants | 2..5; ±2..12 cents; cutoff 600..7000 Hz; scoop -100..+30 cents | 3 voices, 55 ms attack, 2.2 kHz cutoff, -25 cents/45 ms | [5] |
| `organ_drawbar` | nine sine tonewheel partials + optional click/percussion/scanner/Leslie | 9 drawbars, percussion, scanner, rotary rates/rise | 0..8; 0.7..0.8 and 5.7..6.8 Hz Leslie; horn 0.2..5 s rise; bass 0.5..12.5 s | pure 8' `[0,0,8,0,0,0,0,0,0]`; horn 0.8/6.3 Hz; drum 0.67/5.7 Hz | [4][6][7][8][9] |

## Sources

1. Julius O. Smith III, “Piano Synthesis,” CCRMA. https://ccrma.stanford.edu/~jos/pasp/Piano_Synthesis.html
2. Julius O. Smith III, “Commuted Synthesis,” CCRMA. https://ccrma.stanford.edu/~jos/pasp/Commuted_Synthesis.html
3. Wikipedia, “Inharmonicity.” https://en.wikipedia.org/wiki/Inharmonicity
4. Wikipedia, “Leslie speaker.” https://en.wikipedia.org/wiki/Leslie_speaker
5. Gordon Reid, “Synthesizing Brass Instruments,” Sound On Sound, May 2001. https://www.soundonsound.com/techniques/synthesizing-brass-instruments
6. HammondWiki, “Drawbars.” https://www.dairiki.org/HammondWiki/Drawbars
7. Hammond Organ Company, *XK-3 Owner’s Manual*. https://hammondorganco.com/wp-content/uploads/2011/03/XK-3.pdf
8. Hammond Organ Company, *Drawbar Effects*. https://hammondorganco.com/wp-content/uploads/2015/06/04-DRAWBAR-EFFECTS-corrected-2.pdf
9. HammondWiki, “Leslie Rotation Speed.” https://www.dairiki.org/HammondWiki/LeslieRotationSpeed
10. Haye Hinrichsen, “Entropy-based tuning of musical instruments,” figure/context page. https://www.researchgate.net/figure/Figura-4-Inharmonicity-coefficients-B-of-an-upright-piano-The-two-parts-of-the-data_fig4_221933427
11. Mats Ternström and A. Friberg, “Measuring inharmonicity through pitch extraction,” *STL-QPSR* 1/1994. https://www.speech.kth.se/qpsr/1994/1994_35_1_135-144.pdf
12. AIP/ASA, “Study on double decay of individual partials of piano sound.” https://pubs.aip.org/asa/jasa/article/108/5_Supplement/2592/552888/Study-on-double-decay-of-individual-partials-of
13. Nord User Forum, “DX-7/FM piano patch.” http://www.norduserforum.com/viewtopic.php?t=151
14. Mellody and Wakefield, “The time-frequency characteristics of violin vibrato: Modal distribution analysis and synthesis,” abstract page. https://www.researchgate.net/publication/12672221_The_time-frequency_characteristics_of_violin_vibrato_Modal_distribution_analysis_and_synthesis
15. Gordon Reid, “Practical Bowed-string Synthesis (continued),” Sound On Sound, June 2003. https://www.soundonsound.com/techniques/practical-bowed-string-synthesis-continued
16. Hammond Organ Company, *Drawbars & Percussion*. https://hammondorganco.com/wp-content/uploads/2015/06/03-DRAWBARS-PERCUSSION-corrected.pdf
