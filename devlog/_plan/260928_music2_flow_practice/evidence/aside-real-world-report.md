# music2 real-world reference report: how successful tracks and real workflows are built

Research date: 2026-09-28. Public web pages only (no sign-in, no forms). Scope: structural facts about works (BPM, key, length, bar counts, section order, drum placement on a 16-step grid, arrangement moves, instrumentation, loudness). No melodies or lyrics are reproduced.

## How to read this report

Evidence labels are used on every per-track fact:

- **V (verified)**: a cited page states it directly.
- **M (metadata)**: from a BPM/key database (Tunebat, SongBPM, GetSongBPM, Beatport). These are algorithmic estimates. They often disagree on key and report half- or double-time.
- **S (section order)**: order and relative size of labelled sections taken from the track's public Genius page. Only the order of section headers and the number of lyric lines per section were counted. No lyric text was copied. Line counts are a proxy for length, not a bar count (one rap line is usually about 1 bar, one sung hook line about 1 to 2 bars).
- **I (inferred)**: arithmetic (bars = seconds x BPM / 240 for 4/4) or a recipe-oriented reading of a verified description.
- **U (unverified)**: no reliable public source found in this pass. I left these blank instead of guessing.

Grid convention: one bar of 4/4 = 16 steps; beats fall on steps 1, 5, 9, 13; 8th-note offbeats on 3, 7, 11, 15. At 130 to 150 BPM, hip-hop genres use a half-time feel, so the backbeat lands on step 9.

The main limit: almost no commercial rap record has a public, timestamped bar map or MIDI grid. Exact per-track kick positions for drill, trap and boom bap records are **U** unless noted. Detailed step-level grids come from producer tutorials (Attack Magazine Beat Dissected, Native Instruments, Audeobox) and one full published arrangement analysis (Attack's deconstruction of Jeff Mills' "The Bells"). The recommendations treat tutorial grids as idioms and track metadata as ranges, not as copies of specific records.

---

# Part A: reference-track case studies

## A.0 Cross-genre finding: where the first hook lands

Header order was read from Genius for 12 hip-hop-family references (S). After the intro (or at the very top), the first labelled section is:

| Track | Genre | Order after intro | Rough relative size (lyric lines) |
|---|---|---|---|
| Central Cee "Doja" | UK drill | **Hook first** | hook 4, verse 20, hook 9 |
| Unknown T "Homerton B" | UK drill | Verse first | intro 10, verse 26, hook 10, verse 33, hook 10, outro 17 |
| Pop Smoke "Dior" | NY drill | **Pre-hook + hook first** | intro 8, pre 8, hook 13, verse 23, pre 8, hook 12 |
| Pop Smoke "Welcome to the Party" | NY drill | **Hook first** | hook 15, verse 13, hook 15, verse 12, hook 16 |
| Fivio Foreign "Big Drip" | NY drill | **Hook first** | intro 14, hook 12, verse 35, hook 12 |
| Future "Mask Off" | trap | **Hook first** | intro 5, hook 8, verse 13, hook 8, interlude 3, verse 13, hook 8, outro 7 |
| Rae Sremmurd "Black Beatles" | trap | **Hook first** | intro 6, hook 8, verse 14, hook 8, verse 12, hook 8, verse 12, hook 9 |
| Migos "Bad and Boujee" | trap | **Hook first** | intro 5, hook 16, verse 32, hook 16, verse 28, hook 16, verse 30, hook 17 |
| Gang Starr "Mass Appeal" | boom bap | **Hook first** | hook 4, verse 15, hook 4, verse 17, hook 4, verse 15, hook 4, outro 5 |
| Nas "N.Y. State of Mind" | boom bap | Verse first | intro 6, verse 42, hook 4, verse 36, hook 4 |
| Wu-Tang "C.R.E.A.M." | boom bap | Verse first | intro 11, verse 25, hook 6, verse 30, hook 12, outro 14 |
| Mobb Deep "Shook Ones Pt. II" | boom bap | Verse first | intro 9, verse 34, hook 12, verse 25, hook 17 |

Sources: Genius pages listed in the Sources section (S).

What this means:
- **8 of 12** open with the hook (right after a short intro). All 3 trap and all 3 NY drill tracks do. Boom bap is the opposite: 3 of 4 are verse-first, with very long verses (about 25 to 42 lines, roughly 24 to 40 bars) and short 4-line hooks.
- music2's current `trap` and `boom_bap` cards both use `intro 4 > verse 16 > hook 8 > ...`. For trap that goes against every sampled reference. For boom bap it matches the verse-first examples but undersizes the verses.
- In practice verse lengths vary a lot. Trap verses run about 12 to 32 lines. Boom bap verses in these references are 1.5 to 2.5 times the hook-to-hook spacing a textbook 16-bar verse implies.

## A.1 UK drill

Genre-level practice (from tutorials, V):
- Hats come from grime/garage: on a 1/16 grid, "two spaces, two spaces and one space repeated", then rolls, triplets or removed hits for variation ([Attack UK Drill](https://www.attackmagazine.com/technique/beat-dissected/uk-drill/)). That gives hits at steps 1, 4, 7, (9/10), ... a 3+3+2 tresillo cell.
- NI's 146 BPM two-bar tutorial: hats on 16ths 1, 4, 7 (velocity 100/87/100), repeated on beats 3 to 4, plus a quiet final-16th hat (velocity 52) that is deleted in bar 2. Snare on **beat 3 of bar 1 (step 9) and beat 4 of bar 2 (step 13)**. Kicks: bar 1 on the first and eighth 8th notes (steps 1 and 15); bar 2 on 16ths 1, 4, 7, 15 ([NI drill guide](https://blog.native-instruments.com/drill/)). The moving snare is what separates UK drill from trap: NI names "tresillo hi-hat patterns, shifting snare drum positions, and big, grime-inspired portamento bass lines" as the differences.
- 808: slides are made by overlapping notes into a mono glide voice. NI glides from G#1 up to F#3 on the last two 8ths of a 2-bar clip, which is a phrase-end flourish, not a constant move. Attack: "slidey 808 bass is as ubiquitous with drill as 909 drums with techno" ([Attack Dutchavelli/M24](https://www.attackmagazine.com/technique/beat-dissected/make-uk-drill-in-the-style-of-dutchavelli-or-m24)).
- Tempo and feel: Attack uses 144 BPM with **0% swing**; NI uses 146. Kicks stay simple ("it's all about the knock"), velocity at max.
- Musical layer: dark pad or bell run through a half-time effect and **sidechained to the kick**. Piano is sidechained to the hats. The music group gets an **auto-filter sweep at the end of every 8 bars**. The 808 turns on EQ and reverb and hard-pans a note rundown at bar 7 (a turnaround move). "Magic makers" (triangle, tom, open hat, SFX impacts, vocal one-shots) add lift. Master: drum bus, EQ, limiter, plus a volume dip to leave room for a vocalist (Attack, V).
- Keys: NI's example is C# minor with a -20 dB piano low-passed at 750 Hz, so the keys stay dark and quiet under the drums (V).

### Case studies

**1. Central Cee, "Doja" (2022).** Producers LiTek and WhyJay (V, Genius). 140 BPM, F#/Gb major (M), 1:37 (M, SongBPM). About **57 bars** total (I). Section order: hook > verse > hook (S). The hook comes first and the whole song is one verse between two hooks, a very short streaming-era form. Harmony comes from a sample of "Let Me Blow Ya Mind" (V), so roman numerals are U. Drum grid, 808 slides, drop-outs: U.

**2. Unknown T, "Homerton B" (2018).** Producer ChubzTp (V, YouTube credits). SongBPM lists **98 BPM, double-time 196** and 3:10 (M). Treat that as a detection artifact: about 147 BPM in half-time feel is likely, but it is I, not verified. Key U. Order: intro > verse > hook > verse > hook > outro (S). This one is verse-first with a long intro and outro (10 and 17 lines). Grid and 808: U.

**3. Harlem Spartans, "Kennington Where It Started" (2017).** Producer SVOnTheBeat (V, Genius). 138 BPM, Ab major, 3:57 (M, Tunebat). About **136 bars** (I). A multi-MC posse cut, so structure is verse rotation rather than hook-driven (I from credits). Everything else: U.

**What UK drill examples agree on:** tempo 138 to 146 (tutorials 144 to 146; tracks 138/140). Straight timing (0% swing). Syncopated 3+3+2 hat cell with velocity and roll variation. Snare on step 9 but allowed to **move** (step 13 in alternate bars). Sparse, max-velocity kick. Mono gliding 808 with slides at phrase ends. Dark, quiet, low-passed keys sidechained to the kick. 8-bar filter-sweep turnarounds.

**What varies:** length (57 to 136 bars, 1:37 to 3:57). Hook-first (Doja) vs verse-first (Homerton B). Detected keys are often *major* (F# major, Ab major) despite the dark sound. Sample-led harmony (Doja) vs original keys.

**Numbers for recipes:** hook within the first 4 to 8 bars in the modern short form. Turnaround or filter move every 8 bars. The snare-position change is a 2-bar cycle. Total 56 to 64 bars for a streaming single, 96 to 136 for a posse or long form.

## A.2 NY / Brooklyn drill

Genre-level: same half-time drill grid family as UK drill, which inherits from it (NI notes UK drill has influenced US styles). Brooklyn-specific tutorials were not retrievable in this pass. The per-track facts below are metadata plus section order.

**1. Pop Smoke, "Dior" (2019).** Producer 808Melo (V; Genius "Making Of" video exists). 142 BPM, G major (M), 3:36. About **128 bars** (I). Order: intro > pre-hook > hook > verse > pre-hook > hook > outro (S). The pre-hook is a real section (8 lines, about the size of the intro), a common Brooklyn drill build before the hook.

**2. Pop Smoke, "Welcome to the Party" (2019).** Producer 808Melo (V). 143 BPM, D major (M), 3:35. About **128 bars** (I). Order: hook > verse > hook > verse > hook (S). The hook is about as long as each verse (15 vs 12 to 13 lines), so hooks here are 16 bars, not 8.

**3. Fivio Foreign, "Big Drip" (2019).** Producer Axl (V, cited reporting). 140 BPM, C major, 2:48 (M). About **98 bars** (I). Production described as "mostly stuttering hi-hats" (V, Wikipedia summary). Order: intro (long, 14 lines) > hook > one long verse (35 lines) > hook (S).

**4. Kay Flock, "Is Ya Ready" (2021).** Producers prodbywar and d.a. got that dope (V, Genius/AllMusic). 144 BPM, E minor (M). Samples DaBaby's "Ball If I Want To" (V, WhoSampled). Length and structure: U.

**Agree:** tempo **140 to 144** (tight cluster). Hook-first in 3 of 3 checked, often after a pre-hook. Hats are the busiest lane (stuttering). 808 as a melodic lead instrument (808Melo credit on two tracks).

**Vary:** hook size (8 to 16 bars). Detected keys are mostly major (G, D, C) with one minor (E). Length 98 to 128 bars. One very long verse (Big Drip) vs regular alternation.

**Numbers:** hook by about bar 8 to 16. Total 96 to 128 bars. Hook is as long as or longer than a verse in two of three.

## A.3 Trap

Genre-level (V):
- Hats: triplets, rolls, pitch changes and swing are the vocabulary. A 32nd-triplet roll as a crescendo into beat 1 is a standard move ([LANDR](https://blog.landr.com/trap-hats/)).
- Metro Boomin style: "sparse, purposeful drums, heavy 808s, crisp snares and rolling hats". "Bad and Boujee" is described as dark, spacious and minimal with skittering hats, a sub-heavy 808 and a bell-like melody. "Mask Off" is a flute sample over booming 808s ([Melodics](https://melodics.com/blog/metro-boomin-producer-deep-dive)).
- Build order, from Mike WiLL Made-It's own walkthrough of "Black Beatles": clap > 808 > snare > hats > arpeggiator (held, "video game" sound) > piano. He says hats supply the bounce and character ([Genius Deconstructed](https://www.youtube.com/watch?v=8jp4I9shmrE)).

### Case studies

**1. Migos ft. Lil Uzi Vert, "Bad and Boujee" (2016).** Producers Metro Boomin, G Koop (V). 127 BPM (M, likely a detector reading; the track is conventionally felt in half-time), B major (M), 5:43 (M). Order: short intro > **16-line hook** > 32-line verse > hook > 28-line verse > hook > 30-line verse > hook (S). Hooks are long (about 16 bars) and the song cycles hook/verse four times. Drums (I from style descriptions): clap on 9, sparse kick, 8th-note hat lattice with skittering rolls. Harmony: loop-based, roman numerals U.

**2. Future, "Mask Off" (2017).** Producer Metro Boomin (V). 150 BPM, half-time 75 (M, SongBPM). Tonic D, mode disputed (M). 3:24. Samples the flute line from Tommy Butler's "Prison Song" (V, WhoSampled; Genius reports it was released before the sample was cleared). About **128 bars** (I). Order: intro > **8-line hook** > verse > hook > **interlude** > verse > hook > outro (S). The interlude is a short breakdown between cycles. The flute identity stays constant while drums and vocals cycle (I).

**3. Travis Scott ft. Drake, "SICKO MODE" (2018).** Three separately credited production parts: Part I (Rogét Chahayed, Hit-Boy), Part II (OZ, Cubeatz), Part III (Tay Keith), with Mike Dean (V, Wikipedia). 155 BPM (M). No single key (U). Approximate part lengths at 155 BPM: **~76 / ~48 / ~78 bars** (I). The signature arrangement move is the **beat switch**: separate arrangements with a reset of drums and 808, not variations of one loop.

**4. Rae Sremmurd ft. Gucci Mane, "Black Beatles" (2016).** Producer Mike WiLL Made-It (V). 146 BPM, 4:52 (M). About 178 bars (I). Order: intro > **8-line hook** > verse > hook > verse > hook > verse > hook (S). A textbook alternation with an 8-bar hook and 12 to 14-line verses, **hook first**. Build order as above (V).

**Agree:** half-time backbeat (clap/snare on 9). Hats carry the micro-rhythm (8ths with 16th, 32nd and triplet bursts at bar ends and section lifts). Loop-centric harmony (one or two chords, often a sample). The 808 is the bass and supports kick attacks. **Hook comes first in 3 of 3 checked.**

**Vary:** hook length 8 lines (Black Beatles, Mask Off) vs 16 (Bad and Boujee). 0 beat switches (most) vs 2 (SICKO MODE). Tempo readings 127 to 155 BPM. Interlude or breakdown present in some.

**Numbers:** first hook at bar 4 to 8 (after a 4 to 8-bar intro). Hook 8 or 16 bars. Verses 12 to 32 bars. 3 to 4 hook repeats. Total about 100 to 180 bars (2:40 to 5:40).

## A.4 Boom bap

Genre-level (V):
- Audeobox MPC workflow: 85 to 100 BPM. **58% MPC swing** with 1/16 timing correction, typical range **54 to 62%** (every other 16th pushed late). Kick on beat 1 and the "and" of beat 3 (steps 1 and 11). Snare on 2 and 4 (steps 5 and 13). 8th-note hats with velocity variation ([Audeobox](https://www.audeobox.com/learn/mpc-software/classic-hip-hop-workflow/)).
- Attack "90s Boom Bap": clap nudged a few ms late against the snare. **16th hats** with a cowbell on beat 1 of bar 2 and an open hat on beat 4 of bar 2 (a 2-bar pattern). **Kick and snare swing "MPC 3000 8ths 57"; hats swing separately at "MPC 3000 16th 74"** (per-lane swing). Kick EQ: small lift around 60 Hz, significant dip around 150 Hz. Sample transposed down 5 semitones, low end rolled off, and **sidechained to the kick**. A simple sine bass fills the space left by the high-passed sample. Drum bus and master limiter ([Attack](https://www.attackmagazine.com/technique/beat-dissected/90s-boom-bap-hip-hop/)).
- DJ Premier: "Mass Appeal" is a Vic Juris sample slowed from 118 to 96 BPM and pitched down 4 semitones, plus a cut-up drum loop. "N.Y. State of Mind" uses heavily swung drums and a Kool & the Gang drum excerpt slowed from about 100 to 84 BPM ([ModeAudio](https://modeaudio.com/magazine/masters-of-sampling-dj-premier)).

### Case studies

**1. Nas, "N.Y. State of Mind" (1994).** Producer DJ Premier (V). 84 BPM, 4:54 (M). About **103 bars** (I). Order: short intro > very long verse (about 42 lines) > 4-line hook > long verse > hook (S). Verse-first and verse-dominant. The hook is a short scratched refrain. Drums: heavily swung break (V). Bass: the piano/double-bass sample from Joe Chambers' "Mind Rain" is the whole harmonic bed (V, ModeAudio). No separate synth bass (I).

**2. Mobb Deep, "Shook Ones Pt. II" (1995).** Producer Havoc (V, Genius page credit line). 93 BPM (M; Tunebat 94, Bb minor). 5:26. About **126 bars** (I). Order: intro > verse > hook > verse > hook (S). Samples include Herbie Hancock "Jessica" and Quincy Jones "Kitty with the Bent Frame" (V, cited summary). Tension comes from a nearly unchanging dark loop (I).

**3. Gang Starr, "Mass Appeal" (1994).** Producer DJ Premier (V). 96 BPM, Bb minor, 3:41 (M). About **88 bars** (I). Order: **hook first** > verse > hook > verse > hook > verse > hook > outro (S). A short 4-line hook repeated 4 times, three regular verses. The sample plus cut-up drums are the whole bed except scratches (V).

**4. Wu-Tang Clan, "C.R.E.A.M." (1993/94).** Produced, arranged, mixed and programmed by RZA (V). 92 BPM, 4:12 (M). About 97 bars (I). Order: long spoken intro > verse > hook > verse > hook > outro (S). Core loop is The Charmels "As Long as I've Got You" (piano riff and drums loop continuously). RZA describes stacking 4 to 5 sounds into one (V, Wikipedia; Power 106 interview).

**Agree:** 84 to 96 BPM (mean about 91). Snare on 5 and 13. Kick on 1 plus a late-beat-3 answer (step 11 or 12). Swing 54 to 62% on drums, optionally more on hats. One sampled loop runs through the whole track. Density changes come from mutes, scratches and drum drops, not new chords.

**Vary:** verse-first (3 of 4) vs hook-first (Mass Appeal). Verse length from about 15 to 42 lines. Hooks are short (4 to 6 lines, around 4 to 8 bars) and often scratched or chanted. Intros range from 1 to 11 lines.

**Numbers:** verses 16 to 32+ bars. Hooks 4 to 8 bars. 1 to 3 layers change between sections (scratch/stab, hat amount, kick fill, sample mute). Total 88 to 126 bars.

## A.5 Lo-fi hip-hop

Genre-level (V):
- Tempo bands in tutorials: 60 to 80 ([ModeAudio](https://modeaudio.com/magazine/lofi-hip-hop-5-production-essentials)), 60 to 90 ([Loopcloud](https://www.loopcloud.com/cloud/blog/5182-Mastering-Lo-Fi-Hip-Hop-in-FL-Studio-A-Comprehensive-Guide-with-Loopcloud-Sounds)), 65 to 95 ([Lunacy](https://lunacy.audio/news/how-to-make-lofi-music/)).
- Drums: boom-bap backbone (kick around 1 and 3, snare 2 and 4) with syncopated extra kicks. One off-grid kit element is a classic Dilla-derived technique, though fully quantized beats also occur (ModeAudio).
- Texture and arrangement: detuning, vinyl crackle, tape wobble, jazz chords, simple loops. Add or remove one element in 4- or 8-bar phrases ([NI lo-fi](https://blog.native-instruments.com/lo-fi-hip-hop-beats)). Low-pass, saturation and transient softening on drums ([EDMProd](https://www.edmprod.com/lofi-hip-hop)).
- Length economics: a Spotify stream counts after **30 seconds** of play ([Spotify](https://support.spotify.com/us/artists/article/how-your-streams-are-counted)). Industry commentary notes most lo-fi playlist tracks are under 2 minutes ([Tom Dupree, Medium](https://medium.com/@tomdupreeiii/how-lo-fi-producers-are-winning-the-streaming-game-1757149dc3d1)).

### Case studies

**1. Nujabes ft. Cise Starr & Akin, "Feather" (2005).** 181 BPM listed, usable half-time **~90.5**, Bb minor, 2:52, 4/4 (M, SongBPM). About **65 bars** (I). Sample-based production per a 2003 Nujabes interview (V). Form: vocal verses with a refrain lift (I). Snare near 5/13 with loose kicks (I).

**2. J Dilla, "Time: The Donut of the Heart" (2006).** *Donuts* has 31 tracks in 43 minutes and rebuilds samples rather than just looping them (V, RBMA). 187 BPM listed, half-time ~93.5, F minor, **1:39** (M). About **39 bars** (I). A single-idea vignette with hard edits instead of risers (I).

**3. J Dilla, "Don't Cry" (2006).** Samples The Escorts "I Can't Stand (To See You Cry)" throughout (V, WhoSampled). Tunebat 173 BPM, C# major, 1:59. Hooktheory community analysis: Db major, 175 BPM, 4/4, most-used chord **ii(add11)** (M/V community). Half-time about 87, **~43 bars** (I). The source is chopped into 8th-note slices and re-sequenced (V, secondary summary).

**4. Tomppabeats, "Monday Loop".** **69 BPM, Bb major, 1:32, 3 beats per bar** (M, SongBPM, verified on the page). About **35 bars of 3/4** (I). A near-static loop. This is a real counterexample to 4/4-only lo-fi.

**Agree:** working tempo **69 to 94** (half-time readings). Loops are central. **Short: 35 to 65 bars, 1:30 to 2:50.** Changes every 4 to 8 bars by adding or removing one layer. Sample or jazz-colored harmony (7th, 9th, add11). Loose microtiming.

**Vary:** meter (3/4 in Monday Loop). Vocal form (Feather) vs instrumental vignette. Amount of off-grid drift.

**Numbers:** total 32 to 64 bars (about 1:30 to 2:30). Intro of 0 to 4 bars. One layer change per 4 to 8 bars. Density contrast is small, typically 1 layer.

## A.6 House

Genre-level (V):
- 4-on-the-floor kick, clap on 2 and 4, **120 to 130 BPM**. Offbeat hats with 16th "dancing" hats. Swing via shuffle: EDMProd's author likes the MPC-16 65 preset. A **pre-shifted clap about 20 ms early** is common. Syncopated bass, often minor pentatonic. The kick owns the sub while the bass sits above, or they are sidechained. Structure: **DJ intro 16 to 32 > breakdown 16 to 32 > drop 16 to 32 > optional drop variation > breakdown > drop > outro 16 to 32, with subtle changes every 8 bars**. The DJ intro and outro are at least 16 bars each. A radio edit removes them (about 4 min vs about 7 min) ([EDMProd](https://www.edmprod.com/how-to-make-house-music/)).
- Tech house: 125 to 128 BPM, 8-bar sections, 32-bar full intro, 8-bar breakdown and build, 32-bar drop split into 4 x 8 A/B/C/D. Differentiate with a crash on the downbeat, a riser at the end of B, and **muting kick and bass for the last 2 bars of section B** ([EDMProd tech house](https://www.edmprod.com/how-to-make-tech-house/)).

### Case studies

**1. Daft Punk, "Around the World" (1997).** 121 BPM (M; key conflicts between G major and E minor). Five instruments and very few patterns. The title phrase repeats 144 times on the album version (V, Wikipedia summarizing Gondry's analysis). About 216 bars if the ~7:10 length is right (I). Change comes by adding and removing a small fixed palette, not by writing new material.

**2. Frankie Knuckles ft. Jamie Principle, "Your Love" (1986).** E minor, 118 BPM, 6:47 (M, Tunebat). About **200 bars** (I). Signature: an arpeggiated synth line and a thick analogue bassline (V, Guardian). Drum machine (V). Made in a DJ booth rather than a studio, per Knuckles' RBMA lecture (V).

**3. FISHER, "Losing It" (2018).** **125 BPM, G key, 6:40** (V per the Top Music Arts remake analysis; BPM Supreme lists 125 G minor). About 208 bars (I). Kick is plain 4-on-the-floor from a 2-beat loop. It switches to 8th notes in the second half of the second build, then an alternating pattern with 8ths and a 16th fill at the end of each 2-bar phrase. **Snare rolls (16ths) only in builds and breakdowns, only when hats, claps, rims and rides are out, so the section never gets crowded.** Main bassline is a 4-bar loop around two neighbouring semitones, doubled by a sub in drops. **Bass is removed to build tension** before each drop. Lead is a 4-bar pattern varied mainly by FX and automation. Structure: **8 bars of filtered-kick beat as intro, then breakdown > build > drop three times, then a different final build > final drop > outro**. Rims and percussion are sidechained to the kick ([Top Music Arts](https://topmusicarts.com/blogs/news/fisher-losing-it-deconstructed-and-hot-to-make-in-ableton)).

**4. Disclosure ft. Sam Smith, "Latch" (2012).** 122 BPM, C# major (M). Reported as written in **6/8** ([Imaginando](https://www.imaginando.pt/news/how-to-make-disclosure-latch-blip-and-pad-sounds-in-drc)). Logic stock synths and drums, a drum bus with only a simple limiter, **three sub-bass layers**, and environmental texture such as street noise and vinyl crackle (V, We Rave You summary of the Disclosure stream). A pop-vocal song form, not a DJ tool (I).

**Agree:** 118 to 125 BPM in these references (tutorials 120 to 130). Kick 1/5/9/13 except in compound-meter songs. **Small fixed palette changed by mutes and filters on 8-bar boundaries within 16/32-bar sections.** Long DJ forms of about 200 to 216 bars (6:40 to 7:10). Bass and kick kept apart by register or sidechain. **Bass or kick removed before each drop.**

**Vary:** club tool (Around the World, Losing It) vs vocal song (Latch). Meter (6/8 in Latch). Tension device: FISHER-style snare rolls and a bass cut vs classic subtractive filter.

**Numbers:** intro 8 to 32 bars (FISHER 8, textbook 16 to 32). First drop at about bar 32 to 64. Something changes every 8 bars. Breakdown-to-drop density about 2 to 3 layers vs 6 to 8. Radio edit about 4 min vs extended about 6:40 to 7.

## A.7 Techno

Genre-level: one tutorial ([Track Sensei](https://tracksensei.com/blog/how-to-arrange-a-techno-track)) proposes 128 to 135 BPM, about 6 minutes (about 195 bars at 130), a 32 to 64-bar drum-only intro, 16/32-bar phrasing with **one element added or removed per 32-bar block**, and mono below 150 Hz (V as one source's recommendation).

### Case studies

**1. Jeff Mills, "The Bells" (1997), the only fully published bar-level arrangement found.** 137.52 BPM (V, Attack), A minor, 4:40 to 4:52 depending on version ([Attack deconstruction](https://www.attackmagazine.com/technique/deconstructed/jeff-mills-the-bells), [Beatport](https://www.beatport.com/track/the-bells/821823)). Bar map (V):
- bar 1: overdriven 909 kick (straight 4-on-the-floor, steps 1/5/9/13) plus the two-note A-minor motif, **from the first bar**
- bar 9: 909 open hat on the offbeats (steps 3/7/11/15), rides faded in as 8ths shortly after
- bar 17: claps (through a delay, low in the mix)
- end of 17 to 25: everything drops out except the notes
- about bar 33: bells enter as two layers. The low layer is muted in and out for 2 or 4 bars at a time
- bar 41: low bell out. Final 2 bars of that section: kick and claps out
- bar 57: rides return (pitched lower, then corrected). After 7 bars, a **1-bar break** for hats, rides, claps
- bar 65: 16th bassline fades in (about 2 minutes into the track)
- bars 81 to 89: last bell statement, never heard again
- bar 93: **4-bar break of kick plus notes only**. Claps return at 101
- bar 121: notes killed, bassline modulated alone for 16 bars, rides out for 2 bars at 129
- bar 137: **4 bars of rides only**
- then chords and kick return, and percussion toggles until the fade

Attack states: "there are no programmed drum fills or sequence changes... All energy is directed by muting and unmuting looping patterns." Two movements: melody first half, bassline second half.

**2. Plastikman, "Spastik" (1993).** 126 BPM, 9:17 (M, one digital version; about 9:22 original). About 290 bars (I). Opens with little more than a click track and develops subtly over about 8 minutes as a mostly-live mix (V, Insomniac). Attack's "Spastik-style" reconstruction (V as a tutorial, not a transcription): kick on quarters, **16th closed hats, snare as 32nd-note rolls rather than a backbeat, manual swing, 32nd snare notes delayed or moved individually**, reverse or open-hat pickup before half-bar ends, 707/808/909 sources, 2 to 3 dB drum-bus compression ([Attack](https://www.attackmagazine.com/technique/beat-dissected/spastik-style-percussive-techno/)). No bass or chords to speak of (U/I).

**3. Ben Klock, "Subzero" (2009).** 125 BPM, F# minor, 6:26 (M). About 201 bars (I). Section map U. Treat as a Berlin "deep-driving plateau" reference only.

**4. Adam Beyer & Bart Skils, "Your Mind" (2018, Drumcode DC191).** 126 BPM, B minor, 8:22, Beatport genre Techno (Peak Time / Driving) (V). Label copy: it began as a **tool**, with a "stirring vocal" and "thundering impact" (V). About 263 bars (I). Map U.

**Agree:** 4-on-the-floor. Identity from 1 or 2 layers (a motif, a bassline, a percussion roll, a vocal chop), not chord progressions. **Subtractive/additive arrangement by mutes.** DJ usability.

**Vary:** tempo 125 to 138. Length 4:40 to 9:20. Change rate: Mills changes something every 8 bars and **starts at full force from bar 1**, while modern plateaus change one element per 32 bars. Breakdowns: **1 to 4 bars** in The Bells vs 16 to 32 in peak-time tools. No breakdown longer than 4 bars exists in the one fully mapped classic.

**Numbers:** first new element by bar 9 (Detroit) or bar 33 (modern). A change every 8 (Detroit) to 32 (plateau) bars. Breakdowns 1 to 4 bars (linear) or 16 to 32 (peak-time). Density about 2 to 4 layers in breaks vs 5 to 8 at peak.

## A.8 Cross-genre gaps against music2's current cards

| Card | Current default | Real-world evidence | Gap |
|---|---|---|---|
| drill_uk | intro 4 > hook 8 > verse 16 > hook 8 > verse 16 > hook 8 > outro 4 (64 bars); snare on 9 | Hook-first short forms (Doja, 57 bars); snare moves 9 > 13 across bars; 0% swing; 8-bar filter turnarounds | Mostly matches form. Missing: moving-snare variant, 3+3+2 hat cell as default, phrase-end 808 glide, turnaround move |
| drill_ny | same as UK | Hook-first with **pre-hook**; hooks up to 16 bars; stuttering hats; 96 to 128 bars | Add pre-hook role, 16-bar hook option, longer form |
| trap | intro 4 > **verse 16** > hook 8 ... | 3 of 3 references are **hook-first**; hooks 8 or 16; interlude; beat switch | Reorder to hook-first; add interlude and beat-switch variant |
| boom_bap | intro 4 > verse 16 > hook 8 ... | Verse-first is common but verses are 24 to 40 bars; hooks 4 to 8 and often scratched; per-lane swing (57% drums, 74% hats) | Longer verses; 4-bar hook option; per-track swing amount |
| lofi_hiphop | 48 bars incl. 8-bar breakdown | 35 to 65 bars, often under 2:00; 3/4 exists; change 1 layer per 4 to 8 bars | Length roughly right; add 3/4 variant and loop-ready ending |
| house | intro 16 > groove 16 > hook 16 > breakdown 8 > groove 16 > outro 16 (88 bars, ~2:50) | 200 to 216 bar extended mixes; 32-bar intros; 3 breakdown/build/drop cycles; bass cut before drops | Card is shorter than even a radio edit (~4 min, ~120 bars). Add extended and radio variants |
| techno | intro 16 > build 16 > groove 32 > breakdown 16 > groove 32 > outro 16 (128 bars, ~3:56) | 200 to 290 bars; Detroit linear variant has a 1 to 4-bar break; plateau variant changes per 32 bars | Add linear-Detroit and plateau variants; allow 1 to 4-bar breaks; longer total |

---

# Part B: practical use cases for generated instrumentals

## B.0 Loudness reference numbers (platform docs first)

| Destination | Integrated target | True peak | Behaviour | Source |
|---|---|---|---|---|
| Spotify music | **-14 LUFS** (Normal); Loud -11, Quiet -19 | **-1 dBTP**; **-2 dBTP if the master is louder than -14** | Turns loud tracks down. Turns quiet tracks up only while keeping 1 dB TP headroom (e.g. -20 LUFS with TP -5 is lifted only to -16). Album normalization in album play. Web player does not normalize | [Spotify](https://support.spotify.com/us/artists/article/loudness-normalization) |
| YouTube | -14 LUFS reference | -1 dBTP (common guidance) | Down only: quiet uploads stay quiet | [MeterPlugs/Ian Shepherd](https://www.meterplugs.com/blog/2019/09/18/youtube-changes-loudness-reference-to-14-lufs.html), [iZotope](https://www.izotope.com/community/blog/mastering-for-streaming-platforms) |
| Apple Music | -16 LUFS (Sound Check, on by default, LUFS-based since 2022) | -1 dBTP | Never limits; turns up only as far as peaks allow | [MeterPlugs 2022](https://www.meterplugs.com/blog/2022/03/23/apple-switch-to-lufs.html), [iZotope](https://www.izotope.com/community/blog/mastering-for-streaming-platforms) |
| Amazon / Tidal / Deezer | -14 / -14 / -15 | -1 dBTP | Mostly down only | [iZotope](https://www.izotope.com/community/blog/mastering-for-streaming-platforms) |
| Apple Podcasts | **-16 LKFS +/-1 dB** | **-1 dBFS true peak** | Recommendation to avoid content-driven volume changes | [Apple Podcasts](https://podcasters.apple.com/support/893-audio-requirements) |
| AES TD1008 (streaming/podcast) | Speech -18 LUFS (dialog-gated); music track-normalized -16; album loudest track -14; interstitials -18; mixed-format stream -17 | **-1 dBTP** at codec input | Formula: -16 - 2 x (speech % / 100) | [AES TD1008 PDF](https://www.aes.org/wp-content/uploads/2024/01/20210924_TD1008_v3.13.pdf) |
| Mono podcast convention | -19 LUFS mono = -16 stereo (3 LU dual-mono offset) | -1 dBTP | Most devices don't apply the offset | [Auphonic](https://auphonic.com/blog/2020/06/09/loudness-normalization-mono-productions) |
| TikTok / Instagram Reels | **No official published target found**; third-party guides use -14 LUFS / -1 dBTP | -1 dBTP | Treat as unofficial | [Media Strategy Lab](https://mediastrategylab.com/guides/audio-ducking) (third-party) |
| Broadcast (EBU R128) | -23 LUFS | -1 to -2 dBTP | Only if a TV delivery is requested | [Media Strategy Lab](https://mediastrategylab.com/guides/audio-ducking) (third-party) |

Consequence for music2: **-14 LUFS / -1 dBTP is right for a standalone music upload but wrong for a bed that will sit under a voice.** Beds should be delivered quieter and more dynamic, so the editor turns them up only where there is no dialogue.

## B.1 YouTube / TikTok / Reels / Shorts background music

- **Durations:** Shorts up to **3 min** (uploads from 2024-10-15). Music picked from YouTube's own library for Shorts is limited to **15-second clips** ([YouTube Help](https://support.google.com/youtube/answer/15424877), [Shorts upload](https://support.google.com/youtube/answer/12779649)). Reels can be up to 20 min, but **over 3 min are not recommended to new audiences** ([Instagram Help](https://help.instagram.com/2720958398006062)). Stock-music tools standardize on **15 / 30 / 60 s** presets plus custom lengths up to 5 min and a "loopable" option ([Epidemic Sound Adapt](https://www.epidemicsound.com/tools/adapt/tutorial)).
- **Structure:** start immediately (hook in the first 1 to 2 s; a short-form feed allows no 8-bar intro). A clear ending on a downbeat, or a seamless loop.
- **Under voice-over:** a music bed about **6 LU below dialogue** during speech, rising to about 3 LU below in gaps. Duck attack **80 to 150 ms**, release **300 to 500 ms**; faster releases pump ([Media Strategy Lab](https://mediastrategylab.com/guides/audio-ducking)). CapCut guide: duck 6 to 12 dB, attack 30 to 80 ms, release 250 to 700 ms ([CapCut](https://www.capcut.com/create/audio-ducking-for-clear-dialogue-in-video)). DaVinci Resolve Ducker defaults to 2.7 dB, with 2 to 5 dB working most of the time (per Resolve 21 manual, [summary](https://davinciresolveclub.com/davinci-resolve-audio-ducking)). Premiere's Essential Sound auto-duck writes keyframes after clips are tagged Dialogue or Music ([Adobe](https://helpx.adobe.com/premiere/desktop/add-audio-effects/adjust-volume-and-levels/automatically-duck-audio.html)).
- **Avoid:** busy mids where speech consonants live (**about 1 to 4 kHz**); dense melodic leads; big transients that trigger the ducker; hooks that fight the talent ([VividSpark](https://www.vividspark.ai/blog/how-to-optimize-music-volume-for-voiceover-and-dialogue), [CapCut](https://www.capcut.com/create/audio-ducking-for-clear-dialogue-in-video)).
- **Tool support needed:** exact-length renders (15.0 / 30.0 / 60.0 s) that end on a downbeat with a real ending; a "bed" mix with the lead muted; stems (drums / bass / music / lead) so editors can cut layers themselves (Epidemic ships melody/instruments/bass/drums stems); a "mid-scoop" flag that lowers or thins voices in 1 to 4 kHz.

## B.2 Product / demo videos synced to cuts

- Editors cut on hits and phrase boundaries. Good production music "writes in plenty of good edit points... obvious hits, drum breaks and sudden silences", e.g. drum breaks every 4 or 8 bars. **Key and tempo changes are usually a bad idea** because they make edits hard ([Sound On Sound, "Library Work"](https://www.soundonsound.com/techniques/library-work)).
- Adobe Premiere's **Remix** retimes music to a target duration within about 1 s by cutting and crossfading at beat-compatible points. It keeps the beginning and end and edits the middle, and works best on instrumentals with clear beats ([Adobe Remix](https://helpx.adobe.com/premiere/desktop/add-audio-effects/apply-audio-effects/remix-in-premiere.html)). A music2 track with a clean intro, a repeating middle and a real ending is automatically Remix-friendly.
- **Tool support needed:** `beats.json` already exists. Add **cue markers** (section starts, hit points, stops) in beat-map output; an optional "hit list" input (timestamps in seconds) that snaps section boundaries or accents to video cuts and reports the BPM that best fits them; a steady tempo and key through the whole track.

## B.3 Podcast intros, outros, stingers

- Intro music: most guidance says **15 to 30 s** (musicradiocreative, rss.com, Podpage). Current practice is a cold open, then a **5 to 10 s sting**, with the longer theme saved for the outro ([Mubert blog](https://mubert.com/blog/podcast-intro-music-how-to-create-a-theme-listeners-remember)). Library producers deliver a "sting", a very short fragment (often the last few notes or the opening hook) that works as a musical logo ([SOS](https://www.soundonsound.com/techniques/library-work)).
- Commercial and library cut-downs: 60 / 30 / 20 / 10 s; **UK 30 s spots carry 0.5 s of silence at each end, so edits are 29/19/9 s**; "you can't just end on a repeat chorus and fade it out. You must have a good ending"; also supply an underscore mix without lead instruments; mono-compatible, with bass energy around 80 Hz for small speakers ([SOS](https://www.soundonsound.com/techniques/library-work)). Editors often make a 30 s edit as about 26.5 to 28.5 s of music plus a sting that rings out to 30 ([Gearspace](https://gearspace.com/board/music-for-picture/988145-edits.html)).
- Loudness: the episode is normalized to Apple **-16 LUFS +/-1, TP <= -1 dBFS**, or AES -18 speech-gated for talk formats. The intro should match the loudness of the dialogue so the host isn't a sudden drop after the music ([Apple](https://podcasters.apple.com/support/893-audio-requirements), [AES TD1008](https://www.aes.org/wp-content/uploads/2024/01/20210924_TD1008_v3.13.pdf)).
- **Tool support needed:** a "theme pack" preset that renders one idea as full (30 s), short (10 s), sting (3 to 5 s) and bed (60 s+ loopable, lead muted), each with a hard ending and reverb tail inside the length.

## B.4 Game music loops

- Engines loop a region and let the tail play over the restart. In FMOD this is a loop region plus a transition timeline so "reverb tails ring out in full" ([FMOD forum](https://qa.fmod.com/t/how-to-setup-loops-with-intro-and-reverb-tail/18193)), commonly with **two bars of overlap** for tails ([FMOD forum](https://qa.fmod.com/t/any-way-to-loop-a-music-segment-while-keeping-the-tail/15591)). Wwise segments have **entry and exit cues**; the area before the entry cue (pre-entry) and after the exit cue (post-exit) plays over transitions ([Audiokinetic](https://www.audiokinetic.com/en/library/edge?id=working_with_cues&source=Help)). Wwise users set transition grids of **2 or 4 bars** on 4-bar segments ([Audiokinetic Q&A](https://www.audiokinetic.com/qa/10882/music-exit-source-next-grid-should-include-the-exit-falls-grid)).
- For a single-file loop (OGG loop points, etc.), render with the tail and fold the tail back onto the loop start ("wrap remainder"). Watch for **harmonic clashes at the seam** (a long release on the last chord against the first note) and low-frequency buildup from overlapping toms or bass. Fix by writing the last bar to lead back into bar 1, or by high-passing the tail ([OCRemix thread](https://ocremix.org/community/topic/41570-creating-seamless-loops-for-video-games)).
- **Structure:** intro (plays once, 1 to 4 bars) > loop body (8 to 32 bars, an integer number of bars) > optional ending/stinger. Keep tempo and key constant.
- **Loudness:** games mix at runtime. Deliver a consistent level (no platform standard found in this pass; mark U), true peak <= -1 dBTP, and no limiter pumping across the seam.
- **Tool support needed:** `render --loop` that renders intro, loop body and tail separately (or a loop body with the tail wrapped onto its start); emit loop points in samples plus an entry/exit cue JSON; a **loop-seam analysis** (see Recommendations).

## B.5 Livestream background

- Twitch allows only music you own or have licensed; DMCA takedowns follow otherwise ([Twitch Music Guidelines](https://legal.twitch.com/en/legal/music)). Lofi Girl's own terms allow its tracks on streams with attribution but **forbid modification** (no remix or added lyrics) ([Lofi Girl terms](https://www.lofigirl.com/terms)). This is exactly the gap owned generative music fills.
- Needs: hours of non-fatiguing, low-contrast music, often ducked under the streamer's mic (same 6 LU gap as B.1). Tracks must chain without loudness jumps (match integrated loudness within about 1 LU) and without abrupt stops.
- **Tool support needed:** a playlist/batch render (N songs, same loudness target, seeded variation); a "low-contrast" constraint (no drops, no full stops, density change limited to 1 layer).

## B.6 Type beats for rappers

- Artists preview the first 10 to 20 s, so the intro matters. A common arrangement: **intro 4 to 8, verse 16, hook 8, verse 16, hook 8, bridge 4 to 8, hook/outro 8, about 80 bars (2:30 to 3:30)** ([BeatPass](https://blog.beatpass.ca/how-to-make-a-type-beat/)). Hooks are typically 8 bars and verses 12 to 16. Intros often have no kick or snare ([Cole Mize Studios](https://colemizestudios.com/the-quickest-method-to-determining-where-your-rap-verse-should-go/)). Rap songs total about 60 to 80 bars ([Orphiq](https://orphiq.com/resources/how-to-write-a-rap-song)).
- Part A shows that many real hits open with the hook, so a type beat should make **the first full-energy section hook-ready** and mark it.
- Delivery: a **tagged MP3** preview, untagged **WAV**, and **trackout stems** (16 to 32-bit WAV up to 48 kHz, zipped). Stems carry a higher lease tier ([BeatStars](https://blog.beatstars.com/posts/what-you-need-to-know-about-track-creation)). Tags go in about every 10 s on public previews and once in the intro for signed artists ([Gearspace](https://gearspace.com/threads/how-many-beat-tags-per-song.1211956/)). Filenames should carry BPM and key, and the mix should be mono-checked ([Output](https://output.com/blog/type-beat)).
- Loudness: previews are commonly mastered loud. For a *lease* deliverable, leave headroom (about -14 to -10 LUFS, TP <= -1 dBTP). Spotify's -2 dBTP rule applies if it ships louder than -14.
- **Tool support needed:** `--stems` already renders dry per-track WAVs. Add a `type_beat` preset with section markers, "vocal pocket" rules (no lead melody in 1 to 4 kHz during verses), and filenames like `title_140bpm_Fmin.wav`. Music2 should **not** generate producer tags (voice).

## B.7 Meditation / study lo-fi playlists

- Short tracks: most lo-fi playlist tracks run under 2 min, and a stream counts at 30 s ([Spotify](https://support.spotify.com/us/artists/article/how-your-streams-are-counted), [Medium](https://medium.com/@tomdupreeiii/how-lo-fi-producers-are-winning-the-streaming-game-1757149dc3d1)). Part A lo-fi references are 1:32 to 2:52. 24/7 streams (study, sleep, jazz, synthwave, Pomodoro) are Lofi Girl's core format ([Lofi Girl](https://lofigirl.com/)).
- Loudness: normal streaming (-14 LUFS Spotify, -16 Apple), but with **low crest-factor changes**: no sudden drops or builds, consistent density. Meditation and sleep content wants even less contrast and sparse high-frequency energy.
- **Tool support needed:** a `study` preset (70 to 90 BPM, 1:30 to 2:30, 4-bar changes of one layer, no hat rolls, gentle filter, ending that cross-fades cleanly into another track at the same loudness); a `sleep/meditation` preset (drumless or very soft drums, 55 to 70 BPM, pad-led, long fades allowed).

## B.8 Use-case summary table

| Use case | Duration | Structure | Integrated target | TP | Must avoid | Tool features |
|---|---|---|---|---|---|---|
| Shorts/Reels/TikTok bed | 15 / 30 / 60 s exact | Hook in first 1 to 2 s; hard ending or loop | Standalone: -14; bed under VO: about -20 to -24 (6 LU under dialogue) | -1 | Mids at 1 to 4 kHz under voice, long intro | exact-length render, bed mix, stems |
| Product/demo | 30 to 120 s | Steady tempo; edit points every 4 to 8 bars; hard ending | -14 (or bed level) | -1 | Key or tempo change, fade-out ending | cue markers, cut-snap |
| Podcast intro/outro/sting | 5 to 30 s; sting 3 to 5 s | Theme > sting; bed loop | -16 (Apple) / -18 speech-anchored (AES) | -1 | Level jump into dialogue | theme pack |
| Game loop | intro 1 to 4 bars + loop 8 to 32 bars | Integer-bar loop, tail wrapped | Consistent; unspecified | -1 | Seam click, harmonic clash at seam, limiter pump | loop render, loop points, seam check |
| Livestream | hours (playlist) | Low contrast, no stops | Matched within 1 LU | -1 | Drops, silence | batch render, loudness match |
| Type beat | 2:30 to 3:30 (about 80 bars) | Intro 4 to 8 (no kick) > hook/verse 8/16 alternation | Lease: -14 to -10 | -1 (-2 if louder than -14) | Lead melody in verse vocal range | stems, markers, BPM/key filename |
| Study/sleep lo-fi | 1:30 to 2:30 | Loop, 1-layer changes per 4 to 8 bars | -14 / -16 | -1 | Rolls, risers, drops | study/sleep presets |

---

# Recommendations for music2

These are grounded in the current repo state (read 2026-09-28 from github.com/lidge-ai/music2-gen): recipe cards in `src/recipes/cards/*.ts`; genre lint rules `drill_uk/1-7` ... `techno/1-6`; generic lint `clipping_risk / empty_track / out_of_key / unknown_genre`; analysis flags `CLIPPING, EMPTY_HIGH_BAND, KEY_UNCERTAIN, LOW_END_DOMINANCE, LUFS_OFF_TARGET, METER_ASSUMED, NO_BEATS`; `meter.numerator` 2 to 12 with `denominator` fixed at 4; `render --stems`, `--loudnorm`, `tailSeconds`, `master.targetLufs`; and `beats.json`.

## R1. Recipe data changes (arrangement templates, bar counts)

Add an `arrangements` array to each card (named variants). Keep the current single arrangement as `default` only where Part A supports it.

| Card | Variant | Template (bars) | Total | Basis |
|---|---|---|---|---|
| trap | `hook_first` (new default) | intro 4 > hook 8 > verse 16 > hook 8 > verse 16 > hook 8 > outro 4 | 64 | A.0/A.3: 3 of 3 hook-first |
| trap | `long_hook` | intro 4 > hook 16 > verse 24 > hook 16 > verse 24 > hook 16 > outro 4 | 104 | Bad and Boujee |
| trap | `interlude` | intro 4 > hook 8 > verse 16 > hook 8 > breakdown 4 > verse 16 > hook 8 > outro 4 | 68 | Mask Off |
| trap | `beat_switch` | partA{intro 4, verse 16, hook 8, verse 16} > stop 1 > partB (new tempo/808/drums){hook 8, verse 16, hook 8} | ~77 | SICKO MODE |
| drill_uk | `short_single` | intro 4 > hook 8 > verse 16 > hook 8 > outro 4 | 40 to 56 | Doja |
| drill_uk | `posse` | intro 8 > (verse 24 > hook 8) x 3 > outro 8 | 112 to 136 | Kennington |
| drill_ny | `pre_hook` (new default) | intro 4 > pre-hook 4 > hook 16 > verse 16 > pre-hook 4 > hook 16 > verse 16 > hook 16 > outro 4 | 96 | Dior, Welcome to the Party |
| boom_bap | `verse_led` (new default) | intro 4 > verse 24 > hook 4 > verse 24 > hook 4 > verse 16 > hook 8 > outro 4 | 88 | NYSOM, CREAM, Shook Ones |
| boom_bap | `hook_first` | intro 2 > hook 4 > (verse 16 > hook 4) x 3 > outro 4 | 70 | Mass Appeal |
| lofi_hiphop | `vignette` | pickup 2 > groove 16 > groove' 16 > end 2 | 36 | Donuts tracks |
| lofi_hiphop | `waltz` (meter 3/4) | pickup 2 > groove 16 > groove' 16 | 34 | Monday Loop |
| house | `radio` | intro 8 > groove 16 > breakdown 8 > build 8 > drop 32 > breakdown 8 > build 8 > drop 32 > outro 8 | 128 (~4:05 at 125) | EDMProd, FISHER |
| house | `extended` | intro 32 > breakdown 16 > build 8 > drop 32 > breakdown 16 > build 8 > drop 32 > breakdown 8 > build 8 > drop 32 > outro 32 | 224 (~7:10) | EDMProd, Your Love, Around the World |
| techno | `detroit_linear` | full kick from bar 1; add at 9, 17, 33; 1 to 2-bar mutes; 4-bar kick+motif break at ~93; second movement bass-led | ~160 | The Bells |
| techno | `plateau` | intro 32 (drums only) > +bass 32 > +stab 32 > reduction 32 > peak 32 > outro 32 | 192 | Track Sensei |

Other card data changes:
- **Drum variants** (add `drumVariants`, 2-bar where noted):
  - `drill_uk.moving_snare` (bar 1 snare on step 9, bar 2 on step 13).
  - `drill_uk.tresillo_hats` (`hh ~ ~ hh ~ ~ hh ~ hh ~ ~ hh ~ ~ hh ~` with velocity pattern 1 .87 1 / quiet step 16 in bar 1 only).
  - NI kick pair (bar 1: 1, 15; bar 2: 1, 4, 7, 15).
  - `boom_bap.late_answer` (kick 1, 11; snare 5, 13; 16th hats; open hat on step 13 of bar 2).
  - `house.fisher_build` (kick switches to 8ths in the second half of a build; 16th snare roll only while hats/claps are muted).
  - `techno.spastik` (quarter kick, 16th hats, 32nd snare roll instead of backbeat).
- **Per-track swing amount.** Today swing is one song-level value plus a per-track boolean. Boom bap evidence uses **57% on kick/snare and 74% on hats**. House uses about 65% on 16ths. Proposed: `track.swing: number | boolean`.
- **Clap offset:** allow a per-track `nudgeMs` (house pre-shifted clap about -20 ms; boom bap clap a few ms late).
- **Swing defaults:** drill 0 (0.50). Boom bap 0.57 drums / 0.62+ hats. Lo-fi 0.56 to 0.62. House 0.50 to 0.58.
- **Tempo ranges:** drill_uk 138 to 146 (currently 138 to 145; NI uses 146). drill_ny 140 to 144 default 142 (OK). boom_bap 84 to 96 default 90 (OK). lofi 60 to 95 (currently 60 to 90). house 118 to 128. techno 124 to 140, plus a `detroit` default of 138.
- **Keys:** the drill and trap references are commonly *detected* major (F#, Ab, G, D, C). Don't make lint enforce minor. Keep minor as the starter only.
- **Meter:** allow `denominator: 8` (6/8, for the Latch-style house groove) or add a 3/4 lo-fi example using the existing numerator support.

## R2. Arrangement moves as first-class data

Add `moves` a composer can attach to a section boundary. Each move compiles to mutes or pattern overrides:
- `dropout(bars=1|2, keep=[...])`: kill kick+808 (or kick+clap) for the last 1 to 2 bars before a hook or drop. Seen in: The Bells (last 2 bars of a section), EDMProd tech house (kick+bass muted for the last 2 bars of B).
- `turnaround_filter(every=8)`: low-pass sweep on the music group in the final bar of each 8 (Attack drill).
- `bass_cut_before_drop(bars=4|8)` (FISHER).
- `snare_roll_build(division=16|32, bars=2|4|8)`, with rule "only when hats/claps are muted" (FISHER).
- `hat_roll(division=32|triplet, at=bar_end)` (LANDR).
- `stop(beats=1..4)`: a full stop before the hook or beat switch (SICKO MODE-style switch).
- `pickup_808_glide(at=last_8th)`: overlapping note into a glide (NI).
- `one_bar_break(tracks=[hh, ride, cp])` (The Bells bar ~64).
- `mute_toggle(track, period=2|4 bars)` (The Bells low bell).

## R3. New use-case presets

`music2 new --use <preset>` sets duration, structure, loudness and delivery:

| Preset | Duration rule | Structure | master.targetLufs / ceiling | Extra outputs |
|---|---|---|---|---|
| `short_15`, `short_30`, `short_60` | Choose bars so music ends on a downbeat at 15/30/60 s minus 0.5 to 1 s, and let the tail fill the rest | hook at bar 1; last bar a hard hit | -14 / -1 | bed mix (lead muted) |
| `vo_bed` | user length, loopable | constant density; no lead in 1 to 4 kHz | -22 (6 LU under a -16 dialogue) / -1 | stems |
| `podcast_theme` | full 30 s + short 10 s + sting 4 s + bed 60 s | shared motif | -16 / -1 | four files |
| `game_loop` | intro 1 to 4 + loop 8/16/32 bars | loop body integer bars | -16 / -1 | intro.wav, loop.wav (tail wrapped), loop points JSON |
| `stream_playlist` | N tracks x 2 to 3 min | low contrast | -16 matched within 1 LU / -1 | batch |
| `type_beat` | 72 to 88 bars | intro 8 (no kick) > hook 8 > verse 16 ... | -12 / -1 (auto -2 if louder than -14) | stems, markers, `name_BPM_Key.wav` |
| `study_lofi` | 1:30 to 2:30 | 1-layer change per 4 to 8 bars | -14 / -1 | none |
| `trailer_60_30` | 60 s with a false ending at 30 | 10 s intro, 20 s theme, bigger second half | -14 / -1 | 30 s cut-down |

## R4. New analysis and lint checks (to catch non-idiomatic output)

Static (lint, from song JSON):
1. `generic/hook_too_late`: first `hook` placement starts after bar X (trap/drill_ny: 8; drill_uk: 12; house `drop`: 64; techno first new element after bar 33). From A.0 (8 of 12 hook-first) and the house/techno maps.
2. `generic/no_density_contrast`: mean active layers of hook/drop minus verse/breakdown < 1 (hip-hop) or < 2 (house/techno). Generalizes the per-genre `trap/7` and `house/6`.
3. `generic/no_pre_hook_move`: no dropout, stop, fill or roll in the last 1 to 2 bars before a hook/drop (warning only).
4. `generic/static_16`: a section of 16+ bars where every track repeats the same one-bar signature and nothing is muted or changed (warn; allowed in lo-fi/techno with `intentional_loop`).
5. `generic/phrase_misaligned`: section lengths not multiples of 4 (hip-hop) or 8 (house/techno) bars, excluding pickups and stops.
6. `drill_uk/snare_never_moves`: 100% of bars have the snare only on step 9 across 16+ bars (info level).
7. `generic/verse_melody_in_vocal_band`: for `type_beat`/`vo_bed` presets, a note track with notes between about C5 and C7 (523 Hz to 2 kHz fundamentals, harmonics into 1 to 4 kHz) at velocity above 0.6 during verse sections.
8. `generic/duration_mismatch`: rendered length differs from the preset target by more than 0.25 s.

Rendered (analyze, from WAV):
9. `LOOP_SEAM_DISCONTINUITY`: for loop renders, compare the last 50 ms against the first 50 ms (sample-value jump, RMS step > 3 dB, spectral flux spike) and report low-end buildup when the tail is wrapped. The fix hint: shorten final-bar releases, or move the harmony back toward bar 1.
10. `TAIL_TRUNCATED`: energy in the last 100 ms is above -40 dBFS and `tailSeconds` is 0.
11. `VOICE_BAND_BUSY`: for bed presets, the mid+presence (500 Hz to 8 kHz) share is above X and above the same song's intro, or a 1 to 4 kHz sub-band is dominant. Needs a finer band split than the current 6 bands.
12. `SECTION_LOUDNESS_FLAT`: short-term LUFS of hook minus verse < 1 LU (hip-hop) or drop minus breakdown < 3 LU (house/techno). This measures density contrast in audio, not just in JSON.
13. `PLATFORM_TP_RISK`: integrated louder than -14 and true peak above -2 dBTP (Spotify rule).
14. `PLAYLIST_LOUDNESS_SPREAD`: batch renders more than 1 LU apart.

## R5. New example songs worth writing

1. `trap-hook-first-142.song.json`: hook at bar 5, clap 9, 8th hats with 32nd-triplet bar-end rolls, 808 phrase-end glide, 2-bar dropout before hooks 2 and 3.
2. `drill-uk-moving-snare-144.song.json`: 2-bar moving snare, tresillo hats, 0 swing, 8-bar filter turnaround, 808 slides at phrase ends, dark low-passed keys sidechained to the kick.
3. `drill-ny-prehook-142.song.json`: pre-hook 4 > hook 16, stuttering hats, 808 as lead.
4. `boom-bap-verse-led-90.song.json`: 24-bar verses, 4-bar hook, 57% drums / 74% hats, clap late, sample-style keys high-passed with a sine bass underneath.
5. `lofi-waltz-69.song.json`: 3/4 meter, about 34 bars, one layer change per 4 bars, loop-ready ending.
6. `house-extended-125.song.json`: 224-bar DJ extended mix with a 32-bar intro, 3 breakdown/build/drop cycles, bass cut before drops, snare-roll builds only when hats are muted.
7. `techno-detroit-138.song.json`: The Bells-style linear form (kick from bar 1, add at 9/17/33, 1-bar breaks, 4-bar kick+motif break, bass-led second movement), with no fills and all change by mutes.
8. `game-loop-16bar.song.json`: 2-bar intro + 16-bar loop, a final bar that leads back to bar 1, rendered with wrapped tail and loop points.
9. `short-30-bed.song.json`: exactly 30 s, hook at 0 s, lead-muted bed variant, targetLufs -22.
10. `podcast-theme-pack.song.json`: one motif rendered as 30 s / 10 s / 4 s sting / 60 s bed.

## R6. Agent guidance (SKILL.md / genres.md) edits

- Tell agents: "For trap and NY drill, start with the hook (bar 5 to 9). For boom bap, verses are long (24 to 32 bars) and hooks short (4 to 8)."
- "Change something every 8 bars (house/techno every 8 within 16/32 sections). Use mutes before new patterns."
- "Before a hook or drop, remove kick/808 or kick/bass for 1 to 2 bars, or add a roll."
- "If the music will sit under a voice, use the bed preset: lower the lead, keep 1 to 4 kHz clear, target about -22 LUFS."
- Cite these reference facts as ranges and say that detected keys and BPMs are estimates.

---

# Completed steps, failures and caveats

Completed:
1. Surveyed the music2-gen repo (read-only via GitHub API): recipe cards, lint rules, analysis flags, song schema, CLI docs.
2. Four parallel research batches (UK/NY drill; trap/boom bap; lo-fi/house; techno) produced notes in `_notes/`. I researched Part B platform documentation directly.
3. Spot-verified key sources myself: Attack UK Drill, Attack Dutchavelli/M24, NI drill, Attack 90s boom bap, Attack The Bells, EDMProd house and tech house, FISHER "Losing It" deconstruction, SongBPM Homerton B and Monday Loop, Spotify, Apple Podcasts, AES TD1008, SOS Library Work, YouTube and Instagram help.
4. Extracted section order and per-section line counts (no lyric text) from 12 Genius pages.

Failures and caveats:
- **No public timestamped bar maps or MIDI grids exist for almost all rap references.** Per-track drum grids, 808 slide positions and exact section bar counts are U or I. Only "The Bells" has a fully published bar-level arrangement.
- Genius line counts are a proxy for section length, not bar counts.
- Several tracks have conflicting key/BPM metadata (Around the World, Mask Off, Shook Ones, Homerton B at 98/196). Treat them as ranges.
- TikTok and Instagram publish no official loudness target that I could find. The -14 LUFS figures there are third-party.
- One sub-agent first wrote its notes file to the session artifact folder. I moved it into this output folder's `_notes/` and removed the stray empty directories. No other local files were modified.
- Some drill-note URLs from the sub-agent could not be re-verified (the Homerton B YouTube credits URL is malformed; the "Is Ya Ready" Tunebat link points to a different track). They are omitted from the sources below.

---

# Sources

## Production breakdowns and tutorials
- Attack Magazine, UK Drill (Beat Dissected): https://www.attackmagazine.com/technique/beat-dissected/uk-drill/
- Attack Magazine, UK Drill in the style of Dutchavelli/M24: https://www.attackmagazine.com/technique/beat-dissected/make-uk-drill-in-the-style-of-dutchavelli-or-m24
- Native Instruments, How to make a drill beat: https://blog.native-instruments.com/drill/
- Attack Magazine, 90s Boom Bap Hip Hop: https://www.attackmagazine.com/technique/beat-dissected/90s-boom-bap-hip-hop/
- Audeobox, Classic hip-hop MPC workflow: https://www.audeobox.com/learn/mpc-software/classic-hip-hop-workflow/
- ModeAudio, Masters of Sampling: DJ Premier: https://modeaudio.com/magazine/masters-of-sampling-dj-premier
- LANDR, Trap hats: https://blog.landr.com/trap-hats/
- Melodics, Metro Boomin producer deep dive: https://melodics.com/blog/metro-boomin-producer-deep-dive
- Genius Deconstructed, Mike WiLL Made-It "Black Beatles": https://www.youtube.com/watch?v=8jp4I9shmrE
- Power 106, RZA interview (C.R.E.A.M.): https://www.youtube.com/watch?v=yrQPCKSWZmI
- Native Instruments, Lo-fi hip-hop beats: https://blog.native-instruments.com/lo-fi-hip-hop-beats
- ModeAudio, Lo-fi hip hop production essentials: https://modeaudio.com/magazine/lofi-hip-hop-5-production-essentials
- Loopcloud, Lo-fi hip hop in FL Studio: https://www.loopcloud.com/cloud/blog/5182-Mastering-Lo-Fi-Hip-Hop-in-FL-Studio-A-Comprehensive-Guide-with-Loopcloud-Sounds
- Lunacy, How to make lofi music: https://lunacy.audio/news/how-to-make-lofi-music/
- EDMProd, Lofi hip hop: https://www.edmprod.com/lofi-hip-hop
- Red Bull Music Academy, Dilla: Life is a Donut: https://daily.redbullmusicacademy.com/2016/02/dilla-life-is-a-donut-feature
- Nujabes 2003 interview transcript: https://kumomi.org/2023/02/07/nujabes-metaphorical-music-interview-2003/
- EDMProd, How to make house music: https://www.edmprod.com/how-to-make-house-music/
- EDMProd, How to make tech house like FISHER: https://www.edmprod.com/how-to-make-tech-house/
- Top Music Arts, FISHER "Losing It" deconstructed: https://topmusicarts.com/blogs/news/fisher-losing-it-deconstructed-and-hot-to-make-in-ableton
- Native Instruments, House music 101: https://blog.native-instruments.com/house-music-101/
- RBMA, Frankie Knuckles lecture: https://www.redbullmusicacademy.com/lectures/frankie-knuckles-lecture/
- The Guardian, Frankie Knuckles "Your Love": https://www.theguardian.com/music/musicblog/2011/may/19/your-love-frankie-knuckles
- We Rave You, Disclosure "Latch" breakdown: https://weraveyou.com/tech/disclosure-breakdown-how-they-made-latch-feat-sam-smith/
- Imaginando, Disclosure "Latch" sounds (6/8): https://www.imaginando.pt/news/how-to-make-disclosure-latch-blip-and-pad-sounds-in-drc
- Attack Magazine, Jeff Mills "The Bells" deconstructed: https://www.attackmagazine.com/technique/deconstructed/jeff-mills-the-bells
- Attack Magazine, Spastik-style percussive techno: https://www.attackmagazine.com/technique/beat-dissected/spastik-style-percussive-techno/
- Insomniac, From the crate: Plastikman "Spastik": https://www.insomniac.com/music/from-the-crate-plastikman-spastik/
- Track Sensei, How to arrange a techno track: https://tracksensei.com/blog/how-to-arrange-a-techno-track
- Beatport, "Your Mind" release: https://www.beatport.com/release/your-mind/2309440

## Track metadata (BPM / key / length / credits / samples)
- Doja: https://songbpm.com/%40central-cee/doja-EVu4Q8WGX7 , https://en.wikipedia.org/wiki/Doja_(Central_Cee_song)
- Homerton B: https://songbpm.com/@unknown-t/homerton-b , https://music.apple.com/us/album/homerton-b-single/1436711256
- Kennington Where It Started: https://tunebat.com/Info/Kennington-Where-It-Started-Bis-Blanco-ACTIVE-MizOrMac/6YvNpnAsvxCKLDepeHLpKo
- Dior: https://songbpm.com/%40pop-smoke/dior , https://www.youtube.com/watch?v=Oo1ieawmCzU
- Welcome to the Party: https://tunebat.com/Info/Welcome-To-The-Party-Pop-Smoke/0fIffclhgJC5h8AdMMVvkp , https://en.wikipedia.org/wiki/Welcome_to_the_Party_(Pop_Smoke_song)
- Big Drip: https://tunebat.com/Info/Big-Drip-Fivio-Foreign/3hbZsQXQNbPMBmgI7O0CTv , https://en.wikipedia.org/wiki/Big_Drip
- Is Ya Ready: https://www.allmusic.com/album/is-ya-ready-mw0003602682 , https://www.whosampled.com/Kay-Flock/Is-Ya-Ready/
- Bad and Boujee: https://tunebat.com/Info/Bad-and-Boujee-feat-Lil-Uzi-Vert-Migos-Lil-Uzi-Vert/4Km5HrUvYTaSUfiSGPJeQR , https://en.wikipedia.org/wiki/Bad_and_Boujee
- Mask Off: https://songbpm.com/@future/mask-off , https://www.whosampled.com/Future/Mask-Off/ , https://en.wikipedia.org/wiki/Mask_Off
- SICKO MODE: https://tunebat.com/Info/SICKO-MODE-Travis-Scott/2xLMifQCjDGFmkHkpNLD9h , https://en.wikipedia.org/wiki/Sicko_Mode
- Black Beatles: https://tunebat.com/Info/Black-Beatles-Rae-Sremmurd-Gucci-Mane/6fujklziTHa8uoM5OQSfIo , https://en.wikipedia.org/wiki/Black_Beatles
- N.Y. State of Mind: https://getsongbpm.com/song/npointypoint-state-of-mind/JqLgX2
- Shook Ones Pt. II: https://getsongbpm.com/song/shook-ones-part-ii/0V5JXv , https://tunebat.com/Info/Shook-Ones-Pt-II-Mobb-Deep/1oCjPkrPCID3G70Ki4nND0
- Mass Appeal: https://songbpm.com/@gang-starr/mass-appeal , https://genius.com/Gang-starr-mass-appeal-sample/samples
- C.R.E.A.M.: https://getsongbpm.com/song/cpointrpointepointapointmpoint/oWKZ3 , https://en.wikipedia.org/wiki/C.R.E.A.M.
- Feather: https://songbpm.com/@nujabes/feather
- Time: The Donut of the Heart: https://tunebat.com/Info/Time-The-Donut-of-the-Heart-J-Dilla/3fktqaK6zAcydTkT7vfW8B
- Don't Cry: https://tunebat.com/Info/Don-t-Cry-J-Dilla/4jVqbLx0MvlIaj3h2D872X , https://www.hooktheory.com/theorytab/view/j-dilla/dont-cry , https://www.whosampled.com/sample/3505/J-Dilla-Don%27t-Cry-The-Escorts-I-Can%27t-Stand-(To-See-You-Cry)/
- Monday Loop: https://songbpm.com/@tomppabeats/monday-loop
- Around the World: https://tunebat.com/Info/Around-the-World-Daft-Punk/1q4poN5PaGvY1RbEC5gl5s , https://en.wikipedia.org/wiki/Around_the_World_(Daft_Punk_song)
- Your Love: https://tunebat.com/Info/Your-Love-feat-Jamie-Principle-Frankie-Knuckles-Jamie-Principle/6tvtFyEdNpeurBkT2zNMEL
- Latch: https://tunebat.com/Info/Latch-Disclosure-Sam-Smith/1BltsyC5W3SAABdxyrDXwi
- Losing It: https://app.bpmsupreme.com/d/artist/fisher
- The Bells: https://www.beatport.com/track/the-bells/821823
- Spastik: https://tunebat.com/Info/Spastik-Plastikman/0CeI5I7acLxgSYkWc6Wgkh
- Subzero: https://songbpm.com/@ben-klock/subzero
- Your Mind: https://www.beatport.com/track/your-mind/10670339

## Section order (Genius; header order and line counts only)
- https://genius.com/Central-cee-doja-lyrics
- https://genius.com/Unknown-t-homerton-b-lyrics
- https://genius.com/Pop-smoke-dior-lyrics
- https://genius.com/Pop-smoke-welcome-to-the-party-lyrics
- https://genius.com/Fivio-foreign-big-drip-lyrics
- https://genius.com/Future-mask-off-lyrics
- https://genius.com/Rae-sremmurd-black-beatles-lyrics
- https://genius.com/Migos-bad-and-boujee-lyrics
- https://genius.com/Gang-starr-mass-appeal-lyrics
- https://genius.com/Nas-ny-state-of-mind-lyrics
- https://genius.com/Wu-tang-clan-cream-lyrics
- https://genius.com/Mobb-deep-shook-ones-pt-ii-lyrics

## Platform and delivery documentation
- Spotify, Loudness normalization: https://support.spotify.com/us/artists/article/loudness-normalization
- Spotify, How your streams are counted: https://support.spotify.com/us/artists/article/how-your-streams-are-counted
- Apple Podcasts, Audio requirements: https://podcasters.apple.com/support/893-audio-requirements
- AES TD1008 (PDF): https://www.aes.org/wp-content/uploads/2024/01/20210924_TD1008_v3.13.pdf
- AES TD1004: https://aes.org/community/technical-council/aestd1004-recommendation-for-loudness-of-audio-streaming-and-network-file-playback-2015
- Auphonic, Mono loudness: https://auphonic.com/blog/2020/06/09/loudness-normalization-mono-productions
- iZotope, Mastering for streaming platforms: https://www.izotope.com/community/blog/mastering-for-streaming-platforms
- MeterPlugs, YouTube -14 LUFS: https://www.meterplugs.com/blog/2019/09/18/youtube-changes-loudness-reference-to-14-lufs.html
- MeterPlugs, Apple switches to LUFS: https://www.meterplugs.com/blog/2022/03/23/apple-switch-to-lufs.html
- YouTube Help, three-minute Shorts: https://support.google.com/youtube/answer/15424877
- YouTube Help, Upload Shorts (15-second library audio): https://support.google.com/youtube/answer/12779649
- Instagram Help, Reels length: https://help.instagram.com/2720958398006062/
- Adobe, Auto ducking in Premiere: https://helpx.adobe.com/premiere/desktop/add-audio-effects/adjust-volume-and-levels/automatically-duck-audio.html
- Adobe, Remix in Premiere: https://helpx.adobe.com/premiere/desktop/add-audio-effects/apply-audio-effects/remix-in-premiere.html
- DaVinci Resolve ducking summary: https://davinciresolveclub.com/davinci-resolve-audio-ducking
- Media Strategy Lab, Audio ducking: https://mediastrategylab.com/guides/audio-ducking
- CapCut, Audio ducking: https://www.capcut.com/create/audio-ducking-for-clear-dialogue-in-video
- VividSpark, Music volume under voiceover: https://www.vividspark.ai/blog/how-to-optimize-music-volume-for-voiceover-and-dialogue
- Epidemic Sound Adapt tutorial: https://www.epidemicsound.com/tools/adapt/tutorial
- Sound On Sound, Library Work: https://www.soundonsound.com/techniques/library-work
- Gearspace, 15/30/60 edits: https://gearspace.com/board/music-for-picture/988145-edits.html
- Mubert, Podcast intro music: https://mubert.com/blog/podcast-intro-music-how-to-create-a-theme-listeners-remember
- Music Radio Creative, Podcast intro length: https://producer.musicradiocreative.com/podcast-intro-music-length/
- FMOD forum, loops with intro and reverb tail: https://qa.fmod.com/t/how-to-setup-loops-with-intro-and-reverb-tail/18193
- FMOD forum, loop keeping tail: https://qa.fmod.com/t/any-way-to-loop-a-music-segment-while-keeping-the-tail/15591
- Audiokinetic Wwise, Working with cues: https://www.audiokinetic.com/en/library/edge?id=working_with_cues&source=Help
- Audiokinetic Q&A, Next Grid and exit cue: https://www.audiokinetic.com/qa/10882/music-exit-source-next-grid-should-include-the-exit-falls-grid
- OCRemix, Seamless loops for games: https://ocremix.org/community/topic/41570-creating-seamless-loops-for-video-games
- Twitch, Music Guidelines: https://legal.twitch.com/en/legal/music
- Lofi Girl terms: https://www.lofigirl.com/terms
- Lofi Girl: https://lofigirl.com/
- Tom Dupree, lo-fi streaming: https://medium.com/@tomdupreeiii/how-lo-fi-producers-are-winning-the-streaming-game-1757149dc3d1
- BeatStars, Track creation deliverables: https://blog.beatstars.com/posts/what-you-need-to-know-about-track-creation
- BeatPass, How to make a type beat: https://blog.beatpass.ca/how-to-make-a-type-beat/
- Cole Mize Studios, Where your rap verse goes: https://colemizestudios.com/the-quickest-method-to-determining-where-your-rap-verse-should-go/
- Orphiq, How to write a rap song: https://orphiq.com/resources/how-to-write-a-rap-song
- Gearspace, beat tags per song: https://gearspace.com/threads/how-many-beat-tags-per-song.1211956/
- Output, Type beat checklist: https://output.com/blog/type-beat

## Repo inspected (read-only)
- https://github.com/lidge-ai/music2-gen (skills/music2/references/genres.md, SKILL.md, instruments.md, mixing.md, docs/cli.md, docs/song-format.md, src/recipes, src/analyze)
