# music2-gen research notes: modulation, synth design, lo-fi

Research scope: public web only. Labels: **V** = directly stated on fetched page; **I** = implementation inference/recommendation; **U** = not used below (no snippet-only claims presented as facts).

## 3 Modulation

- Chorus is a modulated delayed copy mixed with dry signal; iZotope distinguishes it from flanging by its longer delay, typically **15–35 ms**. [V] https://www.izotope.com/en/learn/understanding-chorus-flangers-and-phasers-in-audio-production.html
- Nectar Pro’s chorus rate range is **0.01–4 Hz**; increasing rate makes the pitch movement more wobbly. [V] https://www.izotope.com/en/learn/understanding-chorus-flangers-and-phasers-in-audio-production.html
- Flanging uses a modulated delay of **0.1–10 ms**; its feedback controls how much processed signal is fed back into the effect. [V] https://www.izotope.com/en/learn/understanding-chorus-flangers-and-phasers-in-audio-production.html
- A phaser produces its effect with all-pass filters rather than delay lines. [V] https://www.izotope.com/en/learn/understanding-chorus-flangers-and-phasers-in-audio-production.html
- A documented host implementation provides flanger **1–20 ms** and chorus **20–80 ms** delay ranges; it gives phaser tempo-sync rate, feedback, and stereo-width controls. [V] https://www.soundonsound.com/techniques/using-your-plugin-delay-effects
- One SOS flanger setup uses **0.62 ms** delay, **3.08 ms** depth, and **0.45 Hz** rate; the same article finds **0–0.4 Hz** rate effective in another flanging use. [V] https://www.soundonsound.com/techniques/flanger-management
- Tremolo is regular amplitude/volume modulation. A phaser implementation cited by Zoom offers **4-stage or 8-stage** modes; its flanger exposes depth, rate, resonance, pre-delay, and mix. [V] https://zoomcorp.com/media/documents/E_MS-70CDR_FX-list_v2.pdf
- Pitch LFO makes vibrato; LFO routed to amplifier level makes tremolo-type effects. [V] https://www.soundonsound.com/techniques/synth-school-part-2
- The original Juno-60 has a dedicated stereo chorus, while its ordinary LFO has rate and delay controls. [V] https://www.soundonsound.com/reviews/roland-juno-60
- The Juno-60 service/manual evidence summarized by KVR reports Chorus I at **0.4 Hz triangle**, II at **0.6 Hz triangle**, and I+II at a shallower **8 Hz** filtered-triangle/sine-like modulation. Treat these reconstruction figures as secondary-source evidence, not an official Roland specification. [V] https://www.kvraudio.com/forum/viewtopic.php?t=489346
- Roland/Boss states the CE-2W recreates CE-1 stereo chorus and vibrato, has Rate and Depth controls, and uses an analog BBD delay line; it also includes CE-2-style standard mode. [V] https://www.boss.info/global/products/ce-2w/
- The historical account identifies the Boss CE-1 Chorus Ensemble (1976) as the first chorus pedal and notes the Eventide Instant Flanger has feedback and oscillator-rate controls. [V] https://www.attackmagazine.com/features/long-read/from-pedals-to-plugins-a-history-of-modulation-effects/

### Suggested defaults for music2

- **Chorus for pads / Rhodes-style keys / supersaw:** 2–4 modulated voices, base delay **15–25 ms**, depth **1.5–5 ms**, rate **0.15–0.8 Hz**, wet **20–45%**; alternate L/R LFO phase 180 degrees. [I] https://www.izotope.com/en/learn/understanding-chorus-flangers-and-phasers-in-audio-production.html
- **Juno-ish mode:** I = 0.4 Hz triangle and roughly 3–5 ms excursion; II = 0.6 Hz triangle and roughly 4–6 ms; I+II = blend the two slow modes rather than literally adopting the uncertain 8-Hz reconstruction. [I] https://www.kvraudio.com/forum/viewtopic.php?t=489346
- **Flanger for guitars, transition leads, FX:** base delay **0.3–3 ms**, depth **0.3–4 ms**, rate **0.05–0.5 Hz**, feedback **10–45%**, wet **15–40%**. Keep feedback below self-oscillation. [I] https://www.izotope.com/en/learn/understanding-chorus-flangers-and-phasers-in-audio-production.html
- **Phaser for keys, pads, guitar-like plucks:** 4 stages as default, 8 for stronger sweep; rate **0.08–0.6 Hz**, feedback **0–35%**, wet **15–35%**. Tempo-sync rate choices: 1/2, 1, 2, or 4 bars for slow movement; 1/4–1/8 for rhythmic movement. [I] https://zoomcorp.com/media/documents/E_MS-70CDR_FX-list_v2.pdf
- **Tremolo/autopan:** sine or triangle LFO, depth **15–50%** for accompaniment and **50–100%** for an obvious chop; tempo-sync 1/2, 1/4, 1/8, and dotted/triplet variants. Autopan should use equal-power L/R gain rather than simple linear panning. [I] https://www.soundonsound.com/techniques/synth-school-part-2
- **Vibrato for leads:** sine LFO **5–7 Hz**, depth **±5–20 cents**, delayed fade-in **100–400 ms**; use 100% wet only when a dedicated vibrato effect is desired. [I] https://www.soundonsound.com/techniques/using-your-plugin-delay-effects

## 4 Synth sound design

- Roland explicitly describes the JP-8000 Super Saw as **seven detuned saws**. [V] https://www.roland.com/uk/products/jp-8000/
- Adam Szabo’s thesis measured JP-8000/JP-8080 Super Saw samples at **44.1 kHz, 32-bit stereo** and concludes that it combines seven saw waveforms, amplitude changes tied to its mix control, and a pitch-tracked high-pass characteristic. [V] https://www.adamszabo.com/internet/adam_szabo_how_to_emulate_the_super_saw.pdf
- Szabo’s thesis specifically says its detune curve is narrow around the midpoint, a characteristic of the JP-8000; do not substitute a simple linear detune law if emulation is the goal. [V] https://www.adamszabo.com/internet/adam_szabo_how_to_emulate_the_super_saw.pdf
- Attack’s Sylenth supersaw walkthrough sets per-oscillator stacking to **8 voices** and detune just below halfway, and identifies voice stacking, detune, and panning as key facilities. [V] https://www.attackmagazine.com/technique/synth-secrets/sylenth-supersaw
- ADSR is attack, decay, sustain, release; attack/decay/release are times and sustain is a level. [V] https://www.soundonsound.com/techniques/synth-school-part-2
- A plucked acoustic sound starts bright and decays toward the fundamental; SOS recommends zero filter-envelope attack so the filter opens immediately for that harmonic decay. [V] https://www.soundonsound.com/techniques/synth-school-part-2
- Filters remove harmonics in subtractive synthesis; filter-envelope amount determines the magnitude of cutoff movement, while resonance boosts frequencies around the cutoff. [V] https://www.soundonsound.com/techniques/synth-school-part-2
- In FM synthesis, operator frequency ratios and output levels are core controls. Yamaha’s example obtains a metallic bell tone using operator ratios **1.00** and **4.77**, with the modulating operator’s envelope changing the metallic overtone content. [V] https://yamahasynth.com/learn/synth-programming/mannys-modulation-manifesto-intro-to-fm-synthesis
- A synthesized 808 can start from a sine wave; a **-12 or -24 semitone** downward pitch envelope over **20–60 ms** supplies initial thump. The cited guide gives amp attack **0–5 ms**, short decay **50–200 ms**, and long decay/release **500 ms–2 s+** use cases. [V] https://www.nailthemix.com/what-is-an-808
- Clean sine 808s contain little harmonic information; the cited guide says saturation/distortion adds upper harmonics that aid audibility on small speakers. [V] https://www.nailthemix.com/what-is-an-808
- Aliasing occurs when waveforms demand harmonics above Nyquist and those components wrap into the audible spectrum. A PolyBLEP rounds discontinuities using band-limited steps; mipmapped/band-limited wavetable sets are another practical route. [V] https://christianfloisand.wordpress.com/2014/09/03/custom-pure-data-external-polyblep-sawtooth-oscillator/ ; https://forum.juce.com/t/wavetable-synthesis-producing-artifacts-at-high-frequencies-how-to-fix-this-aliasing/34824

### Suggested defaults for music2

- **Replace naïve saw/square:** implement polyBLEP saw and square first, then optional wavetable mipmaps for richer tables. Oversample nonlinear/filter/distortion stages 2–4x if affordable. This addresses high-note aliasing before adding more voices. [I] https://christianfloisand.wordpress.com/2014/09/03/custom-pure-data-external-polyblep-sawtooth-oscillator/
- **Supersaw pad/lead:** 7 voices (JP-style) or 5/7/9 selectable; symmetric cents offsets such as `[0, ±5, ±11, ±19]` for a restrained 7-voice patch, widening to `[0, ±9, ±18, ±30]` for EDM. Pan outer voices progressively, but mono-sum below about 150 Hz. Use a non-linear Szabo-style detune/mix curve if pursuing JP character. [I] https://www.roland.com/uk/products/jp-8000/ ; https://www.adamszabo.com/internet/adam_szabo_how_to_emulate_the_super_saw.pdf
- **Pluck:** band-limited saw or saw+square, amp A **0–5 ms**, D **100–400 ms**, S **0–15%**, R **30–150 ms**; LP cutoff base **0.8–3 kHz**, env peak **4–10 kHz**, filter A **0–5 ms**, D **80–350 ms**, resonance **5–25%**. [I] https://www.soundonsound.com/techniques/synth-school-part-2
- **Pad:** 2–7 detuned saws, amp A **300–2,000 ms**, D **0.5–3 s**, S **60–100%**, R **0.8–4 s**; 12/24-dB LP cutoff **2–6 kHz**, modest resonance, slow cutoff LFO **0.05–0.3 Hz**; add chorus. [I] https://www.soundonsound.com/techniques/synth-school-part-2
- **Bass:** 1–2 oscillators plus optional sine sub; amp A **0–10 ms**, D **80–350 ms**, S **50–100%**, R **40–150 ms**; LP cutoff **150 Hz–2 kHz** and positive filter-env amount for a punch. [I] https://www.soundonsound.com/techniques/synth-school-part-2
- **Bell/EP:** carrier sine with inharmonic FM modulator around **4.77:1** for metallic bell, with modulator decay shorter than carrier; use stereo chorus for EP-like width. [I] https://yamahasynth.com/learn/synth-programming/mannys-modulation-manifesto-intro-to-fm-synthesis
- **808:** sine base, pitch drop **-12 semitones/35 ms** as default (range -12 to -24 / 20–60 ms), amp A **0–3 ms**, D **200–900 ms** for notes or up to 2 s for drops, mono output, optional glide **40–120 ms**, and parallel soft saturation with a post-LP around **150–300 Hz**. [I] https://www.nailthemix.com/what-is-an-808

## 9 Lo-fi

- The SP-1200 specification is **12-bit linear, 26.04 kHz**, with analog dynamic filtering; Rossum says the original-family pitch shifting includes audible aliasing and imaging artifacts. [V] https://www.rossum-electro.com/products/sp-1200
- The MPC60 manual states **40 kHz** sampling for an **18 kHz** drum-sound response, using 16-bit A/D and D/A conversion with samples compressed to a proprietary nonlinear **12-bit** format. [V] https://www.manualslib.com/manual/207378/Akai-Mpc-60.html
- Native Instruments identifies vinyl crackle, warm saturation, and wonky pitch drift as lo-fi tools; its description of iZotope Vinyl includes crackle, hiss, dust, warp depth, and pitch drift. [V] https://blog.native-instruments.com/best-lo-fi-plugins/
- iZotope Vinyl explicitly simulates dust, scratches, warp, and mechanical noise, and exposes age, scratches, electrical-noise, and lo-fi coloration concepts. [V] https://www.izotope.com/en/products/vinyl.html
- ChowTape has a wow/flutter section. Its manual describes flutter as timing irregularity from tape-machine mechanics; its depth control sets flutter depth and rate sets flutter speed, which can synchronize to tape speed or song tempo. [V] https://chowdsp.com/manuals/ChowTapeManual.pdf
- RC-20’s Wobble is pitch inconsistency associated with unstable analog playback; its Wow–Flutter slider blends slow wow with faster flutter. [V] https://www.sweetwater.com/sweetcare/articles/rc-20-retro-color-plug-in-quickstart-guide/
- XLN describes RC-20’s Wobble as pitch inconsistencies associated with unstable analog playback such as vinyl players and tape machines. [V] https://www.xlnaudio.com/products/addictive_fx/effect/rc-20_retro_color
- A measurement reference says listeners find flutter most objectionable at **4 Hz** and notes professional tape machines can reach about **0.02% weighted** flutter, considered inaudible. [V] https://en.wikipedia.org/wiki/Wow_and_flutter_measurement

### Suggested defaults for music2

- **Bit/sample degradation:** provide bit depth **8–12 bit** (default **12 bit**) and sample-rate **8–26.04 kHz** (default **16 kHz**); presets: `SP1200 = 12 bit / 26.04 kHz`, `MPC60 = nonlinear-ish 12-bit quantizer / 40 kHz`. Put rate reduction before saturation; offer a wet mix to retain transients. [I] https://www.rossum-electro.com/products/sp-1200 ; https://www.manualslib.com/manual/207378/Akai-Mpc-60.html
- **Vinyl noise:** independent hiss/crackle/dust layers, default noise around **-42 dBFS**, useful range **-55 to -28 dBFS**; sparse crackle rather than constant white noise. [I] https://www.izotope.com/en/products/vinyl.html
- **Wow/flutter:** wow **0.5–2 Hz**, flutter **6–20 Hz**; default pitch depths respectively **±5 cents** and **±1.5 cents**, with randomized LFO phase/drift so loops do not sound periodic. These are deliberately audible creative ranges, not a claim about calibrated tape-machine specification. [I] https://chowdsp.com/manuals/ChowTapeManual.pdf
- **Tone/saturation:** 12-dB/oct LP cutoff **3–8 kHz** (default **6 kHz**), optional high-pass **30–80 Hz**, soft tape saturation before final output with 1–4 dB level-dependent thickening, and subtle stereo narrowing. [I] https://blog.native-instruments.com/best-lo-fi-plugins/
- Offer named reference-oriented presets only as broad sonic targets, not emulations: `Vinyl` (noise + sparse crackle + slow warp), `RC-20-style Wobble` (pitch drift), `Chow-style Tape` (saturation + flutter), `SP1200`, and `MPC60`. [I] https://www.izotope.com/en/products/vinyl.html ; https://www.xlnaudio.com/products/addictive_fx/effect/rc-20_retro_color ; https://chowdsp.com/manuals/ChowTapeManual.pdf

## Sources

- https://www.izotope.com/en/learn/understanding-chorus-flangers-and-phasers-in-audio-production.html — Understanding Chorus, Flangers, and Phasers in Audio Production
- https://www.soundonsound.com/techniques/using-your-plugin-delay-effects — Using Your Plug-in Delay Effects
- https://www.soundonsound.com/techniques/flanger-management — Flanger Management
- https://zoomcorp.com/media/documents/E_MS-70CDR_FX-list_v2.pdf — Effect Types and Parameters (MS-70CDR)
- https://www.soundonsound.com/techniques/synth-school-part-2 — Synth School: Part 2
- https://www.soundonsound.com/reviews/roland-juno-60 — Roland Juno-60
- https://www.kvraudio.com/forum/viewtopic.php?t=489346 — Juno 60 chorus DSP discussion
- https://www.boss.info/global/products/ce-2w/ — BOSS CE-2W
- https://www.attackmagazine.com/features/long-read/from-pedals-to-plugins-a-history-of-modulation-effects/ — From Pedals To Plugins: A History Of Modulation Effects
- https://www.roland.com/uk/products/jp-8000/ — Roland JP-8000
- https://www.adamszabo.com/internet/adam_szabo_how_to_emulate_the_super_saw.pdf — How to Emulate the Super Saw
- https://www.attackmagazine.com/technique/synth-secrets/sylenth-supersaw — Sylenth Supersaw
- https://yamahasynth.com/learn/synth-programming/mannys-modulation-manifesto-intro-to-fm-synthesis — Intro to FM Synthesis
- https://www.nailthemix.com/what-is-an-808 — What Is an 808?
- https://christianfloisand.wordpress.com/2014/09/03/custom-pure-data-external-polyblep-sawtooth-oscillator/ — Custom Pure Data External: PolyBLEP Sawtooth Oscillator
- https://forum.juce.com/t/wavetable-synthesis-producing-artifacts-at-high-frequencies-how-to-fix-this-aliasing/34824 — Wavetable Synthesis: aliasing discussion
- https://www.rossum-electro.com/products/sp-1200 — SP-1200
- https://www.manualslib.com/manual/207378/Akai-Mpc-60.html — AKAI MPC60 Operator’s Manual
- https://blog.native-instruments.com/best-lo-fi-plugins/ — The Best Lo-Fi Plugins for Making Beats
- https://www.izotope.com/en/products/vinyl.html — Vinyl
- https://chowdsp.com/manuals/ChowTapeManual.pdf — ChowTape User Manual
- https://www.sweetwater.com/sweetcare/articles/rc-20-retro-color-plug-in-quickstart-guide/ — RC-20 Retro Color Quickstart Guide
- https://www.xlnaudio.com/products/addictive_fx/effect/rc-20_retro_color — RC-20 Retro Color
- https://en.wikipedia.org/wiki/Wow_and_flutter_measurement — Wow and flutter measurement
