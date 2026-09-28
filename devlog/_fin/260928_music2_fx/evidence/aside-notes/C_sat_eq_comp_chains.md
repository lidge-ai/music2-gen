# music2-gen mixing research notes: saturation, EQ, compression, chains

Public-web research, checked 2026-09-28. Labels: **V** page explicitly states it; **I** renderer default/inference; **U** unverified. Numerical defaults are starting points, not genre laws. Expose them as JSON parameters with bypass and output trim.

## 5 Saturation

- Saturation historically comes from overloading analog components and combines non-linear compression with harmonic enhancement. [V] https://www.izotope.com/community/blog/what-is-audio-saturation
- iZotope defines even harmonics as 2x/4x/etc. and odd harmonics as 3x/5x/etc. the fundamental; its Warm mode adds odd harmonics and Tube adds even harmonics. [V] https://www.izotope.com/community/blog/what-is-audio-saturation
- Tube/asymmetrical clipping is described as warmer/more musical; diode clipping is more abrupt and edgy with strong odd harmonics; FET/solid-state can be more forward than tubes. [V] https://www.uaudio.com/blogs/ua/a-guide-to-distortion-for-home-recordists
- Tape compresses peaks, adds harmonics and rolls off high end, and is commonly used to glue a mix. [V] https://www.uaudio.com/blogs/ua/a-guide-to-distortion-for-home-recordists
- Hard clipping abruptly flattens peaks and is bright/aggressive; soft clipping rounds peaks and generates harmonics more gently. [V] https://www.uaudio.com/blogs/ua/a-guide-to-distortion-for-home-recordists
- A hard clipper can catch transient peaks without limiter pumping; UA describes tube/transformer color, tape glue, hard clipping, then brickwall limiting as complementary stages. [V] https://www.uaudio.com/blogs/ua/a-guide-to-distortion-for-home-recordists
- Oversampling reduces aliasing from fast/heavy limiting. FabFilter recommends 4x or possibly 8x for normal use, while 16x/32x suit offline render but cost more CPU. [V] https://www.fabfilter.com/help/pro-l/using/oversampling
- The BTS “Fake Love” breakdown reports 2–3 dB kick clipping, drum-bus saturation, and multistage harmonic generation on a low sine bass so it could be heard on small speakers. [V] https://www.soundonsound.com/techniques/inside-track-bts-fake-love

### Suggested defaults for music2

- Provide tanh (tube-like soft/asymmetric option), arctan (soft), cubic soft-clip, and thresholded hard-clip curves. Curve names are a controllable character model, not a claim of physical emulation. [I] https://www.uaudio.com/blogs/ua/a-guide-to-distortion-for-home-recordists
- Default drive 0 dB; gentle color is +1 to +4 dB drive and 10–35% wet; aggressive 808/lead is +4 to +10 dB and 15–50% wet. Always provide output trim for unity gain. [I] https://www.izotope.com/community/blog/what-is-audio-saturation
- Use soft/tube color on lead, bass and 808 for small-speaker audibility; tape 5–20% wet on drum/music/master buses; hard clip only before a limiter, usually 1–3 dB peak shaving. [I] https://www.soundonsound.com/techniques/inside-track-bts-fake-love
- Default nonlinear processing to 4x oversampling; permit 2x preview and 8x offline final/master. [I] https://www.fabfilter.com/help/pro-l/using/oversampling

## 6 EQ

- EQ bands consist of frequency, gain and Q/bandwidth; wide gentle boosts are preferred for enhancement, while narrow cuts suit correction. [V] https://www.izotope.com/community/blog/eq-tips-when-to-boost-when-to-cut
- UA recommends moderation: 1–2 dB may go a long way, and additive boosts can accumulate into mud. [V] https://www.uaudio.com/blogs/ua/multiband-eq-mix-fix
- iZotope lists kick trouble zones at 200–500 Hz (“tubby”), 600 Hz–1 kHz (“boxy”) and 2–4 kHz (“pointy/clicky”). [V] https://downloads.izotope.com/guides/iZotope-Mixing-Guide-Principles-Tips-Techniques.pdf
- UA suggests kick 80–120 Hz for boom/roundness, snare-wire brightness at 5–10 kHz, and reducing a boxy snare at 300–800 Hz. [V] https://www.uaudio.com/blogs/ua/multiband-eq-mix-fix
- UA suggests bass 80–120 Hz for roundness and about 1 kHz for attack, and says to differentiate kick and bass rather than boost both in the same range. [V] https://www.uaudio.com/blogs/ua/multiband-eq-mix-fix
- FabFilter says normal vocal sibilance is usually around 8–10 kHz and allows a de-esser detection range from 2–20 kHz. [V] https://www.fabfilter.com/downloads/pdf/help/ffprods-manual.pdf
- Dynamic EQ changes gain only in response to level and can make surgical, multiband-compressor-like corrections; iZotope illustrates a dynamic 3 kHz vocal cut that preserves intelligibility. [V] https://www.fabfilter.com/help/pro-q/using/dynamic-eq
- In BTS “Fake Love,” 4–6 kHz dynamic EQ pulled down loud esses, and the kick externally ducked 50–100 Hz in the mid channel of the instrumental bus. [V] https://www.soundonsound.com/techniques/inside-track-bts-fake-love

### Suggested defaults for music2

- Default corrective bells to Q 1.0–2.5 and ±3 dB; surgical resonance cuts Q 4–10 up to -6 dB. Broad tone shelves/bells: Q 0.5–1.0 and ±1–3 dB. [I] https://www.izotope.com/community/blog/eq-tips-when-to-boost-when-to-cut
- HPF/LPF starting profiles: kick HP 25 Hz; snare HP 90 Hz; hats HP 250 Hz; 808 HP 20 Hz and LPF 8–12 kHz; bass HP 30 Hz/LPF 7 kHz; keys HP 100 Hz; pluck HP 120 Hz; pad HP 150 Hz; lead HP 120–150 Hz; bell HP 180 Hz; reverb return HP 200 Hz/LPF 8–10 kHz. [I] https://www.soundonsound.com/techniques/inside-track-bts-fake-love
- Make 200–500 Hz a -1 to -3 dB mud-control candidate, 2–5 kHz a +1 to +3 dB presence candidate, and 10–12 kHz a +1 to +3 dB air-shelf candidate. [I] https://www.uaudio.com/blogs/ua/multiband-eq-mix-fix
- Dynamic EQ presets: lead de-ess 5–8 kHz, max -3 to -6 dB; kick-triggered 808/bass bell at 50–100 Hz, max -2 to -5 dB. [I] https://www.soundonsound.com/techniques/inside-track-bts-fake-love

## 7 Compression

- A too-fast mix-bus attack can squash transients; a slower attack passes more transient information. Release is often related to tempo and should return near unity before the next major transient. [V] https://www.izotope.com/community/blog/mix-bus-compression
- iZotope’s conservative mix-bus example is 1.7:1, 50 ms attack, 100 ms release and -18 dBFS threshold; it suggests 1.5:1 or 2:1 with a fairly high threshold as a general approach. [V] https://www.izotope.com/community/blog/mix-bus-compression
- Parallel compression blends a lightly compressed original with a heavily compressed duplicate, retaining crisp peaks while increasing density. [V] https://www.izotope.com/community/blog/audio-dynamics-101-compressors-limiters-expanders-and-gates
- Sidechain compression makes one track quieter as another gets loud, managing their volume relationship. [V] https://www.izotope.com/en/learn/what-is-sidechain-compression
- Excessively fast attack can kill transients; too-slow release can create pumping or unwanted sustain. [V] https://www.izotope.com/community/blog/8-common-compression-mistakes-music-producers-make
- BTS “Fake Love” used kick-triggered multiband ducking on bass and kick-triggered 50–100 Hz ducking on the instrumental bus. [V] https://www.soundonsound.com/techniques/inside-track-bts-fake-love
- Spotify normalizes to -14 LUFS under ITU 1770 and recommends -14 integrated LUFS and below -1 dBTP. If mastering louder than -14 LUFS, it says keep true peak below -2 dBTP. [V] https://support.spotify.com/kr-ko/artists/article/loudness-normalization/

### Suggested defaults for music2

- Kick: 4:1, attack 15–30 ms, release 50–100 ms, 2–4 dB GR. Snare: 4:1, 10–25 ms, 60–120 ms, 2–5 dB GR. Drum bus: 2:1, 20–30 ms, 100–300 ms/auto, 1–3 dB GR, 3–6 dB knee. [I] https://www.izotope.com/community/blog/mix-bus-compression
- Bass/808: 3–4:1, 15–35 ms, 80–160 ms, 3–6 dB GR. Lead: serial 2–3:1 stages, 5–20 ms/50–120 ms, 3–6 dB total GR. Pads/keys: 1.5–2:1, 20–50 ms, 150–300 ms, 1–3 dB GR. [I] https://www.izotope.com/community/blog/using-compression-to-help-vocals-sit-in-a-mix
- SSL G-bus-style preset: 2:1–4:1, 10–30 ms attack, auto or 100–300 ms release, soft knee and 1–3 dB GR. This is an implementation convention, not a universal SSL setting. [I] https://www.izotope.com/community/blog/mix-bus-compression
- New York parallel: duplicate drum bus at 8–12:1, 1–10 ms attack, 50–100 ms release, 10–20 dB GR, blend 20–50%. [I] https://www.izotope.com/community/blog/audio-dynamics-101-compressors-limiters-expanders-and-gates
- EDM/K-pop sidechain: kick-to-bass/music 4–10:1, 0–5 ms attack, release tied to eighth/quarter note (120 BPM: 250/500 ms), 3–10 dB GR; provide explicit volume-shaper envelope too. [I] https://www.izotope.com/en/learn/what-is-sidechain-compression
- Master: optional EQ -> gentle bus compressor -> 1–2 dB soft clip -> true-peak limiter at -1 dBTP for streaming. `streaming=-14 LUFS`; `loud pop/club=-8 to -6 LUFS` is an aesthetic option, not Spotify guidance. [I] https://support.spotify.com/kr-ko/artists/article/loudness-normalization/

## 10 Typical chains

**Evidence note:** The concrete chains below are renderer presets and therefore **I**, unless marked otherwise. BTS verifies the broad K-pop pattern of low-end cleanup, kick clipping/saturation, bass harmonic generation, sidechain carving, lead dynamic EQ/de-essing/saturation, and hall/plate/delay sends. [V] https://www.soundonsound.com/techniques/inside-track-bts-fake-love

### K-pop / pop dance
- Drums: bus EQ HP 25 Hz, -2 dB at 300 Hz -> tape sat +2 dB/15% -> glue comp 2:1, 30 ms, auto, 2 dB GR -> soft clip 1 dB; room send 8%. [I] https://www.soundonsound.com/techniques/inside-track-bts-fake-love
- Kick: HP 25, -2 dB 250 Hz, +2 dB 85 Hz -> 4:1/20 ms/80 ms/3 dB GR -> clip 2 dB -> trigger 808/music duck. [I] https://www.soundonsound.com/techniques/inside-track-bts-fake-love
- Snare: HP 90, -2 dB 500 Hz, +2 dB 7 kHz -> 4:1/15 ms/90 ms/3 dB -> transient lift; plate 12%. [I] https://www.uaudio.com/blogs/ua/multiband-eq-mix-fix
- Hats: HP 250 -> dynamic -3 dB at 7–9 kHz -> +1 dB shelf 11 kHz; short room 5%. [I] https://www.fabfilter.com/downloads/pdf/help/ffprods-manual.pdf
- 808: HP 20 -> kick duck 50–80 Hz (-4 dB) -> tube sat +5 dB/30% -> 4:1/25 ms/120 ms/4 dB. [I] https://www.soundonsound.com/techniques/inside-track-bts-fake-love
- Bass: HP 30 -> +1 dB 1 kHz -> warm sat +3 dB/20% -> 3:1/30 ms/120 ms/3 dB -> kick duck. [I] https://www.uaudio.com/blogs/ua/multiband-eq-mix-fix
- Keys: HP 110, -2 dB 300 Hz -> 2:1/30 ms/200 ms/2 dB -> chorus 10%; plate 10%. [I] https://www.soundonsound.com/techniques/inside-track-bts-fake-love
- Pluck: HP 140 -> +2 dB 3 kHz -> 3:1/15 ms/100 ms/3 dB -> dotted-1/8 delay 12%. [I] https://www.soundonsound.com/techniques/inside-track-bts-fake-love
- Pad: HP 180, LP 12 kHz -> 1.5:1/40 ms/250 ms/1 dB -> chorus 20%; hall 18%; kick duck 3 dB. [I] https://www.izotope.com/en/learn/what-is-sidechain-compression
- Lead: HP 150 -> de-ess 5–8 kHz -> 3:1/10 ms/80 ms/4 dB -> tube +2 dB/15% -> chorus 10%; plate 12% + dotted-1/8 delay 10%. [I] https://www.soundonsound.com/techniques/inside-track-bts-fake-love
- Bell: HP 200 -> -2 dB 3–5 kHz if sharp -> 2:1/20 ms/150 ms/2 dB; hall 20%, delay 10%. [I] https://www.izotope.com/community/blog/when-to-use-dynamic-eq-in-a-mix
- Master: HP 20 -> broad EQ ±1 dB -> 2:1/30 ms/auto/1–2 dB GR -> clip 1 dB -> limiter -1 dBTP; -10 to -8 LUFS dense-pop option or -14 streaming. [I] https://support.spotify.com/kr-ko/artists/article/loudness-normalization/

### Trap / drill
- Drums/kick/snare/hats: use the pop-dance order but hard-clip kick 2–3 dB, use drier snare plate 5–8%, and de-ess hats before any air shelf. [I] https://www.soundonsound.com/techniques/inside-track-bts-fake-love
- 808: HP 20 -> kick-keyed -4 dB at 50–80 Hz -> tanh/soft clip +6–10 dB, 25–45% -> 4:1/20 ms/100 ms/4–6 dB -> limiter. [I] https://www.soundonsound.com/techniques/inside-track-bts-fake-love
- Bass: HP 30 -> +1–2 dB 1 kHz -> saturation +3 dB -> 4:1/25 ms/120 ms/4 dB. [I] https://www.uaudio.com/blogs/ua/multiband-eq-mix-fix
- Keys/pluck/pad: HP 150/180/200 -> 250–400 Hz mud cut -> light saturation -> wide chorus/reverb, kick duck 3–5 dB. [I] https://www.izotope.com/en/learn/what-is-sidechain-compression
- Lead/bell: lead HP 150 -> 3:1 comp -> grit saturation -> de-ess -> quarter/slap delay; bell HP 200 -> high-cut 10 kHz -> hall 15%. [I] https://www.soundonsound.com/techniques/inside-track-bts-fake-love
- Master: gentle EQ -> 2:1 glue/1 dB GR -> hard/soft clip 1–2 dB -> limiter -1 dBTP. [I] https://www.uaudio.com/blogs/ua/a-guide-to-distortion-for-home-recordists

### House / techno
- Drums/kick: EQ cleanup -> transient-friendly 2–4:1, 20–30 ms comp -> clip 1 dB; use kick as the sidechain key. [I] https://www.izotope.com/community/blog/mix-bus-compression
- 808/bass: HP 25/30 -> saturation +2–4 dB -> 3:1 comp -> quarter-note kick volume-shaper, 4–8 dB dip. [I] https://www.izotope.com/en/learn/what-is-sidechain-compression
- Snare/hats/bell: HP 100/250/200 -> dynamic high control -> short room/plate. [I] https://www.fabfilter.com/downloads/pdf/help/ffprods-manual.pdf
- Keys/pluck/pad/lead: HP 120/150/180/150 -> mud cut -> optional chorus/phaser -> tempo delay/reverb -> kick pump 3–6 dB. [I] https://www.izotope.com/en/learn/what-is-sidechain-compression
- Master: bus EQ -> 2:1, 10–30 ms, auto -> clip 1 dB -> -1 dBTP limiter; -8 to -6 LUFS only as aesthetic option. [I] https://support.spotify.com/kr-ko/artists/article/loudness-normalization/

### Lo-fi / boom bap
- Drums/kick/snare/hats: HP cleanup -> tape +2–5 dB, 20–40% -> gentle 2–3:1; optionally roll top end around 10–12 kHz. [I] https://www.uaudio.com/blogs/ua/a-guide-to-distortion-for-home-recordists
- 808/bass: HP 25/30 -> tape or tube +2–4 dB -> 2–3:1; retain dynamics instead of compulsory pumping. [I] https://www.izotope.com/community/blog/what-is-audio-saturation
- Keys/pluck/pad/lead/bell: HP 120/150/180/150/200 -> broad 200–500 Hz correction only if muddy -> tape color -> filtered plate/room sends. [I] https://www.izotope.com/community/blog/eq-tips-when-to-boost-when-to-cut
- Master: subtle tape 5–10% -> 1.5–2:1, 1 dB GR -> -1 dBTP limiter; default -14 LUFS streaming mode. [I] https://support.spotify.com/kr-ko/artists/article/loudness-normalization/

## Sources

- https://www.izotope.com/community/blog/what-is-audio-saturation — What is audio saturation? How to use it in your mix
- https://www.uaudio.com/blogs/ua/a-guide-to-distortion-for-home-recordists — A Guide to Distortion for Home Recordists
- https://www.fabfilter.com/help/pro-l/using/oversampling — FabFilter Pro-L 2 Help: Oversampling
- https://www.izotope.com/community/blog/behind-the-technology-of-izotope-ozone-10 — Behind the Technology of iZotope Ozone 10
- https://downloads.izotope.com/guides/iZotope-Mixing-Guide-Principles-Tips-Techniques.pdf — Mixing Guide: Principles, Tips, and Techniques
- https://www.izotope.com/community/blog/eq-tips-when-to-boost-when-to-cut — EQ Tips: When to Boost and When to Cut
- https://www.uaudio.com/blogs/ua/multiband-eq-mix-fix — Using Multiband EQ to Fix Common Mix Problems
- https://www.fabfilter.com/help/pro-q/using/dynamic-eq — FabFilter Pro-Q Help: Dynamic EQ
- https://www.fabfilter.com/downloads/pdf/help/ffprods-manual.pdf — FabFilter Pro-DS Help
- https://www.izotope.com/community/blog/when-to-use-dynamic-eq-in-a-mix — When to use dynamic EQ in a mix
- https://www.izotope.com/community/blog/mix-bus-compression — Mix Bus Compression 101
- https://www.izotope.com/en/learn/what-is-sidechain-compression — What is sidechain compression? And how to use it
- https://www.izotope.com/community/blog/using-compression-to-help-vocals-sit-in-a-mix — Using Compression to Help Vocals Sit in a Mix
- https://www.izotope.com/community/blog/audio-dynamics-101-compressors-limiters-expanders-and-gates — Audio Dynamics 101: compressors, limiters, expanders, and gates
- https://www.izotope.com/community/blog/8-common-compression-mistakes-music-producers-make — 8 common compression mistakes music producers make
- https://support.spotify.com/kr-ko/artists/article/loudness-normalization/ — Spotify loudness normalization
- https://www.izotope.com/en/learn/mastering-for-streaming-platforms.html — How to master for streaming platforms: normalization, LUFS, and loudness
- https://www.soundonsound.com/techniques/inside-track-bts-fake-love — Inside Track: BTS ‘Fake Love’
- https://www.soundonsound.com/techniques/inside-track-kpop-demon-hunters — Inside Track: KPop Demon Hunters
- https://www.attackmagazine.com/technique/tutorials/rethinking-compression-3-techniques-you-should-be-using/ — Rethinking Compression: 3 Techniques You Should Be Using
