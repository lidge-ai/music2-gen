# A1. Clean-room transition-SFX notes for music2-gen

**Scope.** This is a method catalogue, not sample/code copying. `V` means a directly fetched page supports the statement; `I` means an implementation recommendation inferred from verified synthesis/mixing principles; `U` is included only where the requested detail was not confirmed. Numbers marked `I` are practical defaults for an offline renderer, not claims about a source.

## 1. Noise riser (`riser_noise`)

- **What / placement.** A sustained broadband rise that adds tension in the last 1–8 bars before a drop; EDMProd distinguishes it from a pitched riser because the perceived pitch need not rise. [V: S1]
- **Frequency ranges.** Generate white noise, high-pass from 80–300 Hz to 1–3 kHz across the cue; optionally open a low-pass from 800–2,000 Hz to 12–18 kHz. These endpoints are renderer defaults, not source measurements. [I, S3/S12]
- **Curves.** Use an exponential/log-frequency cutoff path and a convex gain ramp (for example gain `t^1.7`), then a 5–30 ms stop or mute at the drop. Filter cutoff is a normal modulation target and LP/HP sweeps alter brightness/airiness. [V: S3, S12; I]
- **Stereo.** Start near mono, widen the upper band from 0 to 60–100% with decorrelated noise, light auto-pan (0.1–1 Hz), or 5–10-cent L/R detune; do not widen low frequencies. [V: S4; I]
- **Synthesis recipe.** Seeded white noise -> optional resonant band-pass (Q 0.7–3) or HP + LP -> gain/filter automation -> short stereo reverb. Noise is broadband and is a valid basic synth source. [V: S12]

## 2. Pitched riser (`riser_pitched`)

- **What / placement.** A long note rising usually one or two octaves; saw or square is a common EDM form. Layering sustained and rhythmic risers is recommended. [V: S1]
- **Frequency ranges.** Fundamental 110–440 Hz to 440–1,760 Hz, typically +12 to +24 semitones; bright harmonic content can be filtered from 1–3 kHz toward 10–16 kHz. [I, S12]
- **Curves.** Interpolate pitch exponentially in Hz, equivalently linearly in semitones/octaves, for even musical motion; gain can be convex and detune 0–7 cents can increase toward the end. The source support is that envelopes can drive oscillator pitch and long bends of several semitones. [V: S11; I]
- **Stereo.** Two to seven detuned saws, L/R detune ±3–10 cents, or alternating pan; keep a centered dry component for mono compatibility. Slight oscillator detune creates chorus-like richness. [V: S12; I]
- **Synthesis recipe.** 2–7 saw oscillators -> detune/pitch envelope -> LP cutoff envelope -> optional distortion/reverb. Ableton specifically recommends pitch/filter automation and increasing LFO speed/intensity toward a riser climax. [V: S8]

## 3. Downlifter / fall (`downlifter`)

- **What / placement.** A falling noise or pitched tail used just after a hit/drop, or to remove energy at an exit. Risers and falls are recognized transition categories. [V: S14]
- **Frequency ranges.** Noise: LP 14–18 kHz down to 300–2,000 Hz; pitched: 1–2 octaves down, for example 880 -> 110–220 Hz. [I]
- **Curves.** Exponential downward pitch/cutoff and exponential amplitude decay sound more natural than a straight-Hz path because octave spacing is multiplicative. [I]
- **Stereo.** Wide high-frequency tail, but high-pass the side channel below 120–180 Hz. [I, S4]
- **Synthesis recipe.** Reverse the `riser_noise` envelopes, or use descending saw/noise with 0.3–3 s release and reverb tail. [I]

## 4. Impact / boom (`impact`)

- **What / placement.** A punctuation hit on the downbeat: trailer impacts emphasize shocks, climaxes and transitions; risers commonly resolve into an impact. [V: S5]
- **Frequency ranges.** Layer: sub sine 35–80 Hz, kick/body 60–200 Hz, taiko/tom or distorted mid 150–1,000 Hz, metallic/noise attack 2–10 kHz. NI explicitly describes kick low end, taiko midrange, metallic high attack, and a sub-bass swoop. [V: S5; I]
- **Curves.** Attack 0–10 ms; sub pitch falls 1–2 octaves in 80–400 ms; body/noise decay 150 ms–2 s; optional reverb 0.7–4 s. [I]
- **Stereo.** Mono below about 120 Hz; stereo/reverb only in the mid/high layers. Keeping low end centered is established mixing advice. [V: S4; I]
- **Synthesis recipe.** Sine/triangle sub with pitch-down envelope + filtered noise transient + tuned drum-like pulse; saturate parallel layers and add a filtered reverb tail. [I, S5/S12]

## 5. Sub drop / 808 fall (`sub_drop`)

- **What / placement.** The low component of an impact, normally starting exactly on the drop/downbeat; use sparingly where the arrangement leaves room. [I]
- **Frequency ranges.** 65–110 Hz start -> 25–45 Hz end; render at a sample rate that preserves the intended low end and avoid hard clipping. [I]
- **Curves.** Sine amplitude: 1–10 ms attack, 250–1,200 ms decay. Pitch: an exponential descent of 12–36 semitones in 100–800 ms; sine is appropriate because it contains only the fundamental. [V: S12; I]
- **Stereo.** Mono. [V: S4]
- **Synthesis recipe.** Sine oscillator -> pitch envelope -> amplitude envelope -> optional soft saturation/harmonic layer so small speakers reveal the event. [I]

## 6. Whoosh / sweep (`whoosh`)

- **What / placement.** A short directional noise gesture for fills, entrances, exits, or pre-hit movement; white-noise whooshes can fill a kick-free transition gap. [V: S7]
- **Frequency ranges.** HP 200–800 Hz, band-pass center sweep 500 Hz -> 6–12 kHz (up) or reverse (down); 100–1,500 ms duration. [I]
- **Curves.** Fast exponential filter trajectory with 10–80 ms fades; a resonant BPF gives a narrower, more directional sound. Filters can be swept manually/modulated; BPF removes above and below its set frequency. [V: S3/S12]
- **Stereo.** Pan 20–90% across the duration, use two independently seeded noise channels, and high-pass sides. [I]
- **Synthesis recipe.** Noise -> BPF/HP -> amplitude and pan envelopes -> tiny early-reflection reverb. [I]

## 7. Reverse cymbal (`reverse_cymbal`)

- **What / placement.** Reverse a crash to make an up-riser; use it as a lead-in to a hook, key change, snare hit, or loop seam. End its waveform exactly at the target downbeat so the impact has a clean transient. Reversing a crash is directly demonstrated; the exact downbeat alignment is implementation practice. [V: S6/S13; I]
- **Frequency ranges.** Mostly 2–16 kHz; high-pass 150–500 Hz if it conflicts with bass/kick. [I]
- **Curves.** Reversing a decaying cymbal naturally yields an accelerating/convex-sounding growth; add 0–2 s reverb before reversal for a longer bloom. [I]
- **Stereo.** Preserve cymbal width; M/S high-pass side below 150–300 Hz. [I]
- **Synthesis recipe.** Offline alternative: multiple inharmonic high sine/metallic partials plus filtered noise, amplitude ramp upward and a hard end; optionally reverse an internally synthesized decay buffer. [I]

## 8. Snare/noise build (`snare_build`)

- **What / placement.** A momentum-building roll over the last 1–8 bars, commonly joined by risers; source examples place a snare roll at the final macro-tension layer and use the last 4–5 bars for filtering. [V: S1/S7]
- **Frequency ranges.** Snare body 150–300 Hz, snap/noise 1–8 kHz; progressively HP 100–300 Hz -> 500–1,500 Hz if clearing room for the drop. [I]
- **Curves.** Quantized rhythmic acceleration: 1/4 -> 1/8 -> 1/16 -> 1/32, optionally ending in 1/64 for one beat; ramp velocity/gain +3–12 dB but cap with a limiter. MusicRadar cautions that continuous 16ths are over-familiar. [V: S2; I]
- **Stereo.** Keep the main snare near center; send alternating hits/noise/reverb to stereo for size. [I]
- **Synthesis recipe.** Each hit = short filtered-noise burst + 180–250 Hz damped sine/body, 5–20 ms attack and 60–180 ms decay; increase rate, HP cutoff, reverb send and optional pitch 0–5 semitones. [I]

## 9. Tape stop (`tape_stop`)

- **What / placement.** Emulates magnetic tape slowing; a popular way to introduce a drop or break, including at the end of four bars. [V: S9/S10]
- **Frequency ranges.** Full-band source, but low-pass progressively toward 200–1,000 Hz near zero speed for a darker inertia effect. [I]
- **Curves.** Playback rate ramps 1.0 -> 0 over 150–1,500 ms, using a concave deceleration curve (for example `(1-t)^2`); pitch falls with rate. Attack reports controllable short/fast vs long/drawn-out stops and adjustable curve. [V: S9; I]
- **Stereo.** Usually maintain original image; optional parallel lanes panned left/right are documented for stereo motion. [V: S9]
- **Synthesis recipe.** Since music2-gen renders its own audio, apply time-varying resampling/read-rate to an internally rendered segment, simultaneously low-pass and fade to silence. Do not change global tempo. [I]

## 10. Vinyl/record stop (`vinyl_stop`)

- **What / placement.** A turntable-style whole-track pitch-and-speed drop, typically immediately before a break/drop. [V: S2/S10]
- **Frequency ranges.** Full-band -> low-pass 300–1,500 Hz; add optional surface-noise 2–10 kHz. [I]
- **Curves.** 250–2,000 ms rate/pitch fall, typically 2–3 octaves of pitch bend in a sampler implementation. [V: S2; I]
- **Stereo.** Keep stable, then narrow to mono during the final 10–30% if desired. [I]
- **Synthesis recipe.** Same variable-rate renderer as tape stop, with optional low-level crackle/noise and slightly irregular speed wobble. [I]

## 11. Laser zap (`laser_zap`)

- **What /placement.** Very short sci-fi punctuation before/after fills, stingers, trap edits, or trailer action; oscillator pitch envelopes have an explicit application in sci-fi sweeps. [V: S11]
- **Frequency ranges.** 1–8 kHz start -> 100–800 Hz end (down-zap), or reverse for up-zap; 40–400 ms. [I]
- **Curves.** Exponential pitch sweep, 1–4 octaves; amplitude attack 0–5 ms, 50–300 ms release. [I]
- **Stereo.** Pan or alternate L/R for repeated zaps; leave a mono core. [I]
- **Synthesis recipe.** Sine/triangle or synced saw -> pitch envelope -> optional ring-mod/FM-like sideband layer -> short delay. Oscillator sync produces aggressive changing harmonics. [V: S12; I]

## 12. Vocal-like chop (`vocal_chop`)

- **What / placement.** A short vowel/word-like rhythmic hook used on the last beat before a drop or as a call-and-response fill; a house-transition example puts a vocal snippet on the final beat before the drop. [V: S7]
- **Frequency ranges.** Synthetic formant targets: F1 about 250–850 Hz and F2 about 850–2,500 Hz are useful engineering targets, but not verified in the fetched sources. [U]
- **Curves.** 40–250 ms chopped envelopes; pitch ±0–12 semitones; formant/interpolated resonator movement for vowel motion. Pitch/formant shifts and stretched/looped vocals are verified production methods. [V: S13; I]
- **Stereo.** Center the intelligible main chop; pan delayed/reverbed repeats 15–70% L/R. [I]
- **Synthesis recipe.** Clean-room non-speech approach: noise plus voiced saw/pulse excitation -> two or three moving band-pass resonators (vowel-like) -> gate/stutter -> pitch, delay, reverb. Alternatively make a vocal-like riser from looped vowel/noisy-sibilant-style synthesis, as the source distinguishes vowel versus sibilant source character. [V: S13; I]

## Placement practice

1. **Build window.** Start a major riser/snare build in the last 1–8 bars. One documented house pattern removes kick for the last four bars of a 16-bar section, filters over the last four/five bars, then raises HP in the last bar; the final bar can lose all percussion. [V: S7]
2. **Layer by role, not loudness.** Use one long tension layer (noise/pitched riser), one rhythmic layer (snare build), and a short transition cue (reverse cymbal/whoosh/vocal chop). EDMProd describes sustained, rhythmic and white-noise riser forms and supports layering. [V: S1]
3. **Resolve sharply.** End rising material at or just before the downbeat; place impact/sub drop precisely on it. This is an `I` timing rule consistent with sources describing riser-to-impact pairing. [V: S5/S8; I]
4. **Make room.** Mute or automate instruments and effect returns at the downbeat, otherwise releases/reverbs reduce impact; use LP then HP strategies or series filters to shape energy. [V: S2]
5. **Protect the low end.** Keep impact/sub drop mono and reserve stereo excitement for noise, cymbals, reverb and upper layers. [V: S4]
6. **Curves.** Store automation as normalized `t in [0,1]`. For pitch/cutoff spanning musical octaves, use `f(t)=f0*(f1/f0)^curve(t)` rather than linear Hz; this is an engineering choice, while the sources verify octave-based VCO convention, pitch/filter envelopes, and sweep modulation. [V: S11/S12; I]

## Sources

1. https://www.edmprod.com/tension/ — V: sustained pitch, rhythmic and white-noise risers; octave examples; riser/snare-build placement in macro tension.
2. https://www.musicradar.com/tuition/tech/9-ways-to-create-better-transitions-641798 — V: record-stop recipe with 2–3 octave pitch bend; rolls, filter strategies, mute/return automation.
3. https://www.perfectcircuit.com/signal/filter-sweeps — V: definition and behavior of LP/HP/resonant filter sweeps and envelope/LFO modulation.
4. https://flypaper.soundfly.com/produce/stereo-widening/ — V: keep low frequencies centered; width tools, 5–10-cent microshift, Haas caveat.
5. https://blog.native-instruments.com/sound-in-film/ — V: impact as punctuation; kick/taiko/metal/sub-swoop layered roles; riser-to-impact relationship.
6. https://smabellakoppenaudio.wordpress.com/2015/08/12/production-technique-2-reverse-cymbal-as-transitional-effect — V: reverse a crash to create an up-riser and use it into a hook/key change.
7. https://www.musicradar.com/tuition/tech/how-to-build-a-house-transition-585840 — V: 16-bar house build, remove kick for four bars, filtering and last-beat vocal drop.
8. https://www.ableton.com/fr/blog/learn-how-to-make-high-impact-sounds-for-movies-and-trailers/ — V: risers pitch/modulate and may be followed by hit/silence; pitch/filter/LFO automation; trailer SFX context.
9. https://www.attackmagazine.com/technique/tutorials/creative-tape-stop-effects/ — V: magnetic-tape origin, transition use, curve control, stereo parallel motion, 16/16 -> 1/16 tension acceleration.
10. https://www.musicradar.com/news/10-time-tips — V: sudden tape stop as a way to introduce drop/break.
11. https://www.soundonsound.com/techniques/sound-synthesis-part-2 — V: envelopes can control filter frequency and oscillator pitch; long several-semitone bends; one-volt-per-octave convention.
12. https://www.soundonsound.com/techniques/sound-synthesis-part-1 — V: oscillator/noise basics, waveform harmonics, ADSR, filter definitions, detuning and oscillator sync.
13. https://www.musicradar.com/tuition/tech/10-creative-ways-to-use-your-voice-641397 — V: stretched/looped vocal risers, gradual pitch rise, vowel vs sibilant source character, pitch/formant processing.
14. https://splice.com/sounds/packs/sample-magic/risers-falls/samples — V: public category evidence for EDM risers/falls only; no technical claims used.

## Proposed renderer table

| id | synthesis recipe | parameters with ranges/defaults | typical use |
|---|---|---|---|
| `riser_noise` | seeded white noise -> HP/LP/BPF -> gain/filter envelope | 2 bars; HP 150->1,500 Hz; LP 1,500->16,000 Hz; width 20->85% | last 2–8 bars pre-drop |
| `riser_pitched` | 4 detuned saws -> pitch + LP envelopes | 2 bars; +24 st; detune 3->10 cents; LP 2k->14k | melodic/EDM/trailer build |
| `downlifter` | filtered noise or descending saw | 1 bar; 16k->1k LP; -24 st; 0.8 s | immediately after hit/drop |
| `impact` | sine sub + drum body + noise/metal transient | 55 Hz sub; -18 st/180 ms; 1.2 s tail; mono <120 Hz | downbeat punctuation |
| `sub_drop` | sine -> pitch-down + amp decay | 75->32 Hz; -18 st/450 ms; 700 ms decay | impact low-end layer |
| `whoosh` | noise -> moving BPF + pan | 350->8,000 Hz; Q 1.5; 350 ms; pan -50->50 | short directional fill |
| `reverse_cymbal` | synthesized metallic/noise decay buffer reversed | 1 bar; HP 250 Hz; 0.8 s reverb before reverse | end exactly at target downbeat |
| `snare_build` | noise burst + damped sine repeated by grid | 2 bars; 1/8->1/16->1/32; gain +6 dB; HP 250->900 Hz | final build rhythm |
| `tape_stop` | variable-rate resample + LP + fade | 600 ms; rate 1->0 concave; LP 18k->600 Hz | end of phrase/break |
| `vinyl_stop` | variable-rate resample + wobble + crackle | 900 ms; 2–3 oct pitch fall; 0.3% wobble | turntable-style pre-drop |
| `laser_zap` | sine/triangle or synced saw -> exp pitch envelope | 140 ms; 5k->350 Hz; 2 oct; 0–20% delay | trap edit/stinger |
| `vocal_chop` | voiced/noise excitation -> moving formant BPFs -> gate | 120 ms; pitch ±7 st; 2–3 resonators; 15% delay | last beat hook/fill |
| `noise_hit` | short noise burst + highpass + reverb | 80 ms dry, 500 ms tail, HP 800 Hz | accent alongside impact |
