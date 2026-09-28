# music2-gen FX research notes: reverb, delay, stereo imaging

Research date: 2026-09-28. **V** = explicitly stated on the linked page. **I** = implementation inference/default based on linked material. **U** = snippet-only or not fetch-verified. Values are starting points, not universal rules.

## 1 Reverb

- Plate is a transducer-driven steel plate with a dense, smooth decay; UA calls it a studio standard for vocals, snare, and lead instruments. [V] https://www.uaudio.com/blogs/ua/peter-mokran-vocal-preset-uad-pure-plate
- UA characterizes EMT 140 plate as dense, shimmery, and very wide. Its A/B/C variants are respectively bright/lean, darker/body-rich, and modern/full-range. [V] https://www.uaudio.com/blogs/ua/top-5-reverb-plug-ins-and-how-to-use-them
- A chamber is a real/modeled echo space. UA recommends it on a return for multiple sources so they share one physical space. [V] https://www.uaudio.com/blogs/ua/top-5-reverb-plug-ins-and-how-to-use-them
- Small rooms and plates are UA starting points for drums/percussion; larger rooms and halls with longer pre-delay suit strings, woodwinds, and some vocals. [V] https://www.uaudio.com/blogs/ua/the-basics-of-reverb
- A small reflective room can decay as long as a hall, but its early reflections arrive sooner. Early reflections + pre-delay communicate size/listener position; density/diffusion and frequency-dependent decay shape character. [V] https://www.uaudio.com/blogs/ua/the-basics-of-reverb
- Spring reverb uses springs rather than a plate. UA describes BX 20 as fast-onset and dark/dense; it says guitar-amp springs can be rattly, with its Tank A dark/rolled-off and Tank B brighter/more forward. [V] https://www.uaudio.com/blogs/ua/top-5-reverb-plug-ins-and-how-to-use-them
- For lead vocal plate, UA/Peter Mokran calls 2.5 s a classic start. Longer decay plus less pre-delay suits a washy ballad; shorter decay plus more pre-delay is tighter. [V] https://www.uaudio.com/blogs/ua/peter-mokran-vocal-preset-uad-pure-plate
- Pure Plate's documented operating range is 0.5-5.5 s decay and 0-250 ms pre-delay; its decay control changes physical damping. [V] https://help.uaudio.com/hc/en-us/articles/4419497304340-Pure-Plate-Reverb-Manual
- UA's featured vocal preset uses 87 ms pre-delay and recommends exploring 70-180 ms for vocals; its second guide gives 20-30 ms for vocal intelligibility, short/zero for snare/guitar, and 50-80 ms for tempo-matched slapback-like effect. These are context-dependent starting points. [V] https://www.uaudio.com/blogs/ua/peter-mokran-vocal-preset-uad-pure-plate
- iZotope's examples use 50 ms pre-delay on vocal and 29 ms on drums to preserve transients. [V] https://www.izotope.com/community/blog/reverb-pre-delay
- Tempo snapping: quarter-note ms = 60000/BPM; 1/8 = x0.5, 1/16 = x0.25, 1/32 = x0.125, 1/64 = x0.0625. It is an optional musical grid, not a requirement. [I] https://anotherproducer.com/online-tools-for-musicians/delay-reverb-time-calculator
- At 120 BPM, Another Producer's table maps tight ambience to 3.91 ms pre-delay/496.09 ms decay, small room to 15.63/984.38 ms, large room to 31.25/1968.75 ms, and hall to 62.5/3937.5 ms. [V] https://anotherproducer.com/online-tools-for-musicians/delay-reverb-time-calculator
- High-frequency damping prevents harsh tails: UA says reducing treble on a 2.5-s plate can reduce its high-frequency reverb time to about 1 s. [V] https://www.uaudio.com/blogs/ua/peter-mokran-vocal-preset-uad-pure-plate
- Mokran uses plate low-cut up to 180 Hz; Pure Plate documents 90 or 180 Hz, 12 dB/oct HP options. [V] https://help.uaudio.com/hc/en-us/articles/4419497304340-Pure-Plate-Reverb-Manual
- “Abbey Road trick” renderer default: HP return around 600 Hz and LP near 10 kHz, then relax cuts if a brighter/full-range effect is wanted. The exact historical attribution was not verified in fetched authoritative material. [I] https://anotherproducer.com/online-tools-for-musicians/delay-reverb-time-calculator
- Use 100%-wet reverb on a shared aux/return and control amount via send/return level. [V] https://www.uaudio.com/blogs/ua/peter-mokran-vocal-preset-uad-pure-plate

### Suggested defaults for music2

- **Algorithms/controls:** room = compact/early-forward; hall = wide/late-tail-forward; plate = dense/smooth; chamber = shared natural space; spring = characterful/fast-onset. Expose `decaySec`, `preDelayMs`, `earlyLate`, `damping`, `width`, `hpHz`, `lpHz`, `sendDb`. [I] https://www.uaudio.com/blogs/ua/the-basics-of-reverb
- **RT60 starts:** vocal/lead 1.6-2.8 s; snare/clap 0.5-1.3 s; pads 2.5-5.0 s; keys 1.0-2.5 s; bells 1.8-4.0 s. These per-instrument ranges are inferred defaults, not prescriptive source values. [I] https://www.uaudio.com/blogs/ua/peter-mokran-vocal-preset-uad-pure-plate
- **Genre starts:** K-pop/pop 0.8-2.2 s; trap/drill 0.4-1.5 s; house/techno 0.8-2.8 s; lo-fi 1.2-3.5 s. Favor shorter tails in dense/fast arrangements. [I] https://www.uaudio.com/blogs/ua/peter-mokran-vocal-preset-uad-pure-plate
- **Pre-delay starts:** vocal 50 ms, snare/clap 10-25 ms, pads/keys 20-50 ms, bells 25-70 ms; snap to 1/64 through 1/8 as appropriate. [I] https://www.izotope.com/community/blog/reverb-pre-delay
- **Return defaults:** HP 180-600 Hz, LP 8-10 kHz, damping 0.45, early/late 0.45 for room and 0.70 late for hall/plate, stereo width 100%; start sends at -18 dB subtle, -12 dB audible, -6 dB effect. Send tiers are implementation defaults. [I] https://help.uaudio.com/hc/en-us/articles/4419497304340-Pure-Plate-Reverb-Manual
- **Ducked return:** dry vocal/lead keys a wet-return compressor: threshold about -30 dBFS, ratio 2:1-4:1, 3-6 dB GR, 5-15 ms attack, 150-350 ms release. Unsourced implementation default for clarity between phrases. [I] https://www.uaudio.com/blogs/ua/the-basics-of-reverb

## 2 Delay

- Tempo-synced delay: quarter ms = 60000/BPM; eighth = x0.5; dotted eighth = x0.75; eighth triplet = x1/3; quarter triplet = x2/3. [I] https://anotherproducer.com/online-tools-for-musicians/delay-reverb-time-calculator
- At 120 BPM, quarter=500 ms, eighth=250 ms, dotted eighth=375 ms, and eighth triplet=166.67 ms. [V] https://anotherproducer.com/online-tools-for-musicians/delay-reverb-time-calculator
- Waves recommends vocal rhythmic repeats from sixteenths through half or whole notes, according to performance pace and tempo. [V] https://www.waves.com/delay-tips-for-mixing-vocals
- Ping-pong alternates repeats left/right; feedback controls repeat count. [V] https://www.waves.com/delay-tips-for-mixing-vocals
- Waves suggests a subtle BV delay at eighth or dotted eighth with feedback all the way down. [V] https://www.waves.com/mixing-background-vocals-hot-hacks
- Filtering repeats: reducing highs increases depth; reducing lows improves clarity. [V] https://www.waves.com/delay-tips-for-mixing-vocals
- For modern pop vocal throws, Waves suggests host-synced 1/4 or 1/8, HP about 300-500 Hz, LP 2-2.5 kHz, and feedback that mostly ends before the next phrase. [V] https://www.waves.com/tips-for-mixing-2021-pop-vocals
- A throw is automation of an aux send on a selected word/phrase, rather than a constantly loud effect. [V] https://www.waves.com/tips-for-mixing-2021-pop-vocals
- For stereo slap, Waves suggests hard-L/R returns and offseting the sides by a few ms; it demonstrates a 1/32-note offset. [V] https://www.waves.com/delay-tips-for-mixing-vocals
- Sending delay into plate makes the plate process repeats rather than the dry vocal; roll back delay bass to avoid low-end stacking. [V] https://www.uaudio.com/blogs/ua/peter-mokran-vocal-preset-uad-pure-plate

### Suggested defaults for music2

- **Time menu:** `1/16`, `1/8`, `1/8D`, `1/8T`, `1/4`, `1/4D`, `1/4T`, `1/2`, free ms. Multipliers: 0.25, 0.5, 0.75, 1/3, 1, 1.5, 2/3, 2. [I] https://anotherproducer.com/online-tools-for-musicians/delay-reverb-time-calculator
- **Genre starts:** pop vocal 1/8 or 1/4, feedback 15-30%, HP 300/LP 2500 Hz; trap/drill 1/8T or 1/4, 20-45%, dark; house/techno 1/8 or 1/8D ping-pong, 25-50%; lo-fi 80-140 ms slap or 1/8, 10-35%, HP 150-300/LP 2-6 kHz; dub 1/4 or 1/8, 55-85%, dark feedback. Genre values are implementation defaults. [I] https://www.waves.com/tips-for-mixing-2021-pop-vocals
- **Slapback:** default 100 ms, adjustable 60-140 ms, feedback 0-15%, mono or subtly offset stereo. The range is an implementation inference. [I] https://www.waves.com/delay-tips-for-mixing-vocals
- **Throw automation:** normal send off or -24 dB; phrase send -9 to -3 dB; default feedback 25%. [I] https://www.waves.com/tips-for-mixing-2021-pop-vocals
- **Feedback categories:** 0-20% one/subtle, 20-45% rhythmic, 45-70% pronounced, >70% dub/special effect; cap at 95%. [I] https://www.waves.com/delay-tips-for-mixing-vocals

## 8 Stereo imaging

- Stereo imaging positions sounds to create perceived location; iZotope says widening decisions should be checked in mono. [V] https://www.izotope.com/community/blog/6-tips-for-widening-the-stereo-image-of-a-mix
- Haas widening uses an opposite-panned, 100%-wet, no-feedback delayed copy. iZotope gives 1-40 ms as a Haas range and 2-50 ms as a practical tuning range. [V] https://www.izotope.com/community/blog/what-is-the-haas-effect
- Haas can cause comb-filtering/phase problems. iZotope's M/S option applies Haas to Side so it cancels in mono instead of comb-filtering the mono signal. [V] https://www.izotope.com/community/blog/what-is-the-haas-effect
- Waves suggests about 25 ms as a starting offset for doubled BVs, plus small pitch changes; hard L/R panning can create width. [V] https://www.waves.com/mixing-background-vocals-hot-hacks
- Waves describes M/S EQ as separate center/edge EQ and recommends a Side low-cut below 150 Hz to preserve clean low end. [V] https://www.waves.com/vocal-production-complete-guide
- UA suggests 3-10 ms of opposite-panned reverb-return delay to separate layered guitars. [V] https://www.uaudio.com/blogs/ua/the-basics-of-reverb
- Ping-pong delay widens by alternating vocal echoes left/right. [V] https://www.waves.com/vocal-production-complete-guide

### Suggested defaults for music2

- **Low end:** set kick/sub/bass `widthPct: 0` below a 120-Hz crossover, user-adjustable 100-150 Hz. Keep lead vocal/snare mostly centered; widen pads, keys, bells, BVs, and effect returns. [I] https://www.waves.com/vocal-production-complete-guide
- **Width starts:** kick/sub/bass 0%; lead vocal 0-20%; snare/clap 10-35%; lead synth 20-55%; keys 40-80%; pads 60-100%; bells/plucks 35-75%; BVs 70-100%; FX/reverb 80-120%. `100%` = unmodified stereo; >100% = deliberate widening. These are defaults, not universal rules. [I] https://www.izotope.com/community/blog/6-tips-for-widening-the-stereo-image-of-a-mix
- **Haas:** expose 1-35 ms default range, hard-limit 50 ms, feedback 0, opposite-panned wet copy, mono warning/check. Start vocal/guitar at 12-20 ms and BVs at 25 ms. [I] https://www.izotope.com/community/blog/what-is-the-haas-effect
- **M/S:** default `sideLowCutHz: 120` (range 100-150), `sideGainDb: 0` (safe range -3 to +3), with mono-sum audition. [I] https://www.waves.com/vocal-production-complete-guide

## Sources

- [Best Plate Reverb Settings for Vocals | Universal Audio](https://www.uaudio.com/blogs/ua/peter-mokran-vocal-preset-uad-pure-plate)
- [Pure Plate Reverb Manual | Universal Audio Help Center](https://help.uaudio.com/hc/en-us/articles/4419497304340-Pure-Plate-Reverb-Manual)
- [The Basics of Reverb | Universal Audio](https://www.uaudio.com/blogs/ua/the-basics-of-reverb)
- [Best UAD Reverb Plug-Ins | Universal Audio](https://www.uaudio.com/blogs/ua/top-5-reverb-plug-ins-and-how-to-use-them)
- [Reverb pre-delay explained | iZotope](https://www.izotope.com/community/blog/reverb-pre-delay)
- [What Is the Haas Effect and How to Use It | iZotope](https://www.izotope.com/community/blog/what-is-the-haas-effect)
- [6 Tips for Widening the Stereo Image of a Mix | iZotope](https://www.izotope.com/community/blog/6-tips-for-widening-the-stereo-image-of-a-mix)
- [10 Delay Tips for Mixing Vocals | Waves](https://www.waves.com/delay-tips-for-mixing-vocals)
- [4 Tips for Mixing 2021 Pop Vocals | Waves](https://www.waves.com/tips-for-mixing-2021-pop-vocals)
- [A Complete Guide for Vocal Editing, Mixing, and Production | Waves](https://www.waves.com/vocal-production-complete-guide)
- [Mixing Background Vocals: 10 HOT HACKS | Waves](https://www.waves.com/mixing-background-vocals-hot-hacks)
- [Delay & Reverb Time Calculator | Another Producer](https://anotherproducer.com/online-tools-for-musicians/delay-reverb-time-calculator)
