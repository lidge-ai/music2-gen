# Reference cases for composing with music2

These are form and production references, not transcriptions. **V** means a cited source states a fact directly; **M** means BPM, key, or length from a music database; **S** means public section-header order and rough relative size; **I** means an inference or a music2 recipe choice; **U** means no reliable source in the [research report](https://github.com/lidge-ai/music2-gen/blob/main/devlog/_fin/260928_music2_flow_practice/evidence/aside-real-world-report.md). BPM and key are database estimates, often reported at half or double time or with conflicting keys. Genius line counts indicate relative section size, not exact bars. No record lyrics, melodies, or exact drum grids are reproduced; step grids below come from [producer tutorials](https://blog.native-instruments.com/drill/), not records.

Use the numbers as starting ranges. The named arrangements and bar totals are original music2 choices in the [implementation plan](https://github.com/lidge-ai/music2-gen/blob/main/devlog/_fin/260928_music2_flow_practice/020_real_world_checks.md), not measured transcriptions.

Read the evidence in this order when choosing a form:

1. Use a linked **S** section order to decide whether the first full section is a hook or verse; translate lyric-line sizes only into rough proportions ([Genius header survey](https://github.com/lidge-ai/music2-gen/blob/main/devlog/_fin/260928_music2_flow_practice/evidence/aside-real-world-report.md)).
2. Use **M** tempo and length to choose a working range, then test half-time and double-time interpretations where needed ([Homerton B](https://songbpm.com/@unknown-t/homerton-b), [Mask Off](https://songbpm.com/@future/mask-off)).
3. Use **V tutorial** grids for an original groove, then write your own melody and changes ([NI drill](https://blog.native-instruments.com/drill/), [Audeobox boom bap](https://www.audeobox.com/learn/mpc-software/classic-hip-hop-workflow/)).
4. Treat every planned bar count below as **I** until a public bar map proves it; the [research report](https://github.com/lidge-ai/music2-gen/blob/main/devlog/_fin/260928_music2_flow_practice/evidence/aside-real-world-report.md) found one detailed published track map, for [The Bells](https://www.attackmagazine.com/technique/deconstructed/jeff-mills-the-bells).

For a song with vocals, an early hook is a useful starting form in the sampled [trap](https://genius.com/Future-mask-off-lyrics) and [NY drill](https://genius.com/Pop-smoke-welcome-to-the-party-lyrics) records; the sampled [boom bap](https://genius.com/Nas-ny-state-of-mind-lyrics) forms justify a long verse first. A music2 pattern is an authored response to that form, not a claim about any reference recording's MIDI.

## First hook: cross-genre reference order (A.0)

The sizes below are rough **S** lyric-line counts from the linked public section headers, never bar counts.

| Track | Order after intro | Rough relative size (lines) |
| --- | --- | --- |
| UK: [Doja](https://genius.com/Central-cee-doja-lyrics) | hook → verse → hook | 4 / 20 / 9 |
| UK: [Homerton B](https://genius.com/Unknown-t-homerton-b-lyrics) | verse → hook → verse → hook | 26 / 10 / 33 / 10 |
| NY: [Dior](https://genius.com/Pop-smoke-dior-lyrics) | pre-hook → hook → verse → pre-hook → hook | 8 / 13 / 23 / 8 / 12 |
| NY: [Welcome to the Party](https://genius.com/Pop-smoke-welcome-to-the-party-lyrics) | hook → verse → hook → verse → hook | 15 / 13 / 15 / 12 / 16 |
| NY: [Big Drip](https://genius.com/Fivio-foreign-big-drip-lyrics) | hook → verse → hook | 12 / 35 / 12 |
| Trap: [Mask Off](https://genius.com/Future-mask-off-lyrics) | hook → verse → hook → interlude → verse → hook | 8 / 13 / 8 / 3 / 13 / 8 |
| Trap: [Black Beatles](https://genius.com/Rae-sremmurd-black-beatles-lyrics) | hook → verse → hook → verse → hook → verse → hook | 8 / 14 / 8 / 12 / 8 / 12 / 9 |
| Trap: [Bad and Boujee](https://genius.com/Migos-bad-and-boujee-lyrics) | hook → verse → hook → verse → hook → verse → hook | 16 / 32 / 16 / 28 / 16 / 30 / 17 |
| Boom bap: [Mass Appeal](https://genius.com/Gang-starr-mass-appeal-lyrics) | hook → verse → hook → verse → hook → verse → hook | 4 / 15 / 4 / 17 / 4 / 15 / 4 |
| Boom bap: [N.Y. State of Mind](https://genius.com/Nas-ny-state-of-mind-lyrics) | verse → hook → verse → hook | 42 / 4 / 36 / 4 |
| Boom bap: [C.R.E.A.M.](https://genius.com/Wu-tang-clan-cream-lyrics) | verse → hook → verse → hook | 25 / 6 / 30 / 12 |
| Boom bap: [Shook Ones Pt. II](https://genius.com/Mobb-deep-shook-ones-pt-ii-lyrics) | verse → hook → verse → hook | 34 / 12 / 25 / 17 |

## UK drill (A.1)

**Agree.** [NI's 146 BPM tutorial](https://blog.native-instruments.com/drill/) and [Attack's 144 BPM tutorial](https://www.attackmagazine.com/technique/beat-dissected/uk-drill/) support straight timing, sparse kicks, 3+3+2 hat accents, and an alternating snare on steps 9 and 13 of successive bars (**V tutorial**). [NI](https://blog.native-instruments.com/drill/) uses an occasional phrase-end 808 glide; [Attack](https://www.attackmagazine.com/technique/beat-dissected/uk-drill/) describes dark keys and eight-bar turnarounds (**V tutorial**).

**Varies / compose.** [Doja](https://genius.com/Central-cee-doja-lyrics) is hook-first while [Homerton B](https://genius.com/Unknown-t-homerton-b-lyrics) is verse-first (**S**). Start a short single around 138–146 BPM, first hook within roughly 4–8 bars, a two-bar snare cycle, and one change or turnaround every eight bars; the 40/64/112-bar `short_single`/`default`/`posse` forms are music2 choices inspired by the [short](https://songbpm.com/%40central-cee/doja-EVu4Q8WGX7) and [long](https://tunebat.com/Info/Kennington-Where-It-Started-Bis-Blanco-ACTIVE-MizOrMac/6YvNpnAsvxCKLDepeHLpKo) references (**I**).

| Reference | BPM / key / length | Section order or limit |
| --- | --- | --- |
| [Doja](https://songbpm.com/%40central-cee/doja-EVu4Q8WGX7) (2022) | **M** 140 / F# major / 1:37 | **S** [hook → verse → hook](https://genius.com/Central-cee-doja-lyrics) |
| [Homerton B](https://songbpm.com/@unknown-t/homerton-b) (2018) | **M** 98 or 196 / key **U** / 3:10 | **S** [intro → verse → hook → verse → hook → outro](https://genius.com/Unknown-t-homerton-b-lyrics); 147 feel is **I**, not measured |
| [Kennington Where It Started](https://tunebat.com/Info/Kennington-Where-It-Started-Bis-Blanco-ACTIVE-MizOrMac/6YvNpnAsvxCKLDepeHLpKo) (2017) | **M** 138 / Ab major / 3:57 | **U** public section map; posse-rotation reading is **I** |

## NY / Brooklyn drill (A.2)

**Agree.** The three public [Dior](https://genius.com/Pop-smoke-dior-lyrics), [Welcome to the Party](https://genius.com/Pop-smoke-welcome-to-the-party-lyrics), and [Big Drip](https://genius.com/Fivio-foreign-big-drip-lyrics) header maps reach a hook before the first verse (**S**); tempo estimates cluster around 140–143 BPM (**M**, links below). [Dior](https://genius.com/Pop-smoke-dior-lyrics) has a pre-hook build; [Big Drip](https://en.wikipedia.org/wiki/Big_Drip) is described with stuttering hats.

**Varies / compose.** Hooks range from roughly 8 to 16 lines and verses from 12 to 35 lines (**S**); the key estimates below are often major despite a dark sound (**M**). Try `pre_hook`: intro 4 → build 4 → hook 16 → verse 16, with later repeats, for 96 chosen bars and first hook at B09; vary hook density and keep bass muted in the build (**I** from [Dior's order](https://genius.com/Pop-smoke-dior-lyrics)).

| Reference | BPM / key / length | Section order |
| --- | --- | --- |
| [Dior](https://songbpm.com/%40pop-smoke/dior) (2019) | **M** 142 / G major / 3:36 | **S** [intro → pre-hook → hook → verse → pre-hook → hook → outro](https://genius.com/Pop-smoke-dior-lyrics) |
| [Welcome to the Party](https://tunebat.com/Info/Welcome-To-The-Party-Pop-Smoke/0fIffclhgJC5h8AdMMVvkp) (2019) | **M** 143 / D major / 3:35 | **S** [hook → verse → hook → verse → hook](https://genius.com/Pop-smoke-welcome-to-the-party-lyrics) |
| [Big Drip](https://tunebat.com/Info/Big-Drip-Fivio-Foreign/3hbZsQXQNbPMBmgI7O0CTv) (2019) | **M** 140 / C major / 2:48 | **S** [intro → hook → long verse → hook](https://genius.com/Fivio-foreign-big-drip-lyrics) |

## Trap (A.3)

**Agree.** All three [Mask Off](https://genius.com/Future-mask-off-lyrics), [Black Beatles](https://genius.com/Rae-sremmurd-black-beatles-lyrics), and [Bad and Boujee](https://genius.com/Migos-bad-and-boujee-lyrics) header maps put a hook before a verse (**S**). [Melodics](https://melodics.com/blog/metro-boomin-producer-deep-dive) describes sparse drums and heavy 808s; [LANDR](https://blog.landr.com/trap-hats/) teaches brief hat rolls rather than an always-busy grid (**V tutorial**).

**Varies / compose.** Hook sizes are about 8 or 16 lines (**S**); BPM estimates span 127–150 with half-time interpretations (**M**). Use `hook_first` as a 64-bar start, `long_hook` as 104 chosen bars, or `interlude` as 68 chosen bars; try the first hook after a 4-bar intro, 8–16-bar hooks, 12–32-bar verses, sparse 808/kick interplay, and a short breakdown where [Mask Off](https://genius.com/Future-mask-off-lyrics) suggests one (**I**).

| Reference | BPM / key / length | Section order |
| --- | --- | --- |
| [Mask Off](https://songbpm.com/@future/mask-off) (2017) | **M** 150 / D tonic, mode disputed / 3:24 | **S** [intro → hook → verse → hook → interlude → verse → hook → outro](https://genius.com/Future-mask-off-lyrics) |
| [Black Beatles](https://tunebat.com/Info/Black-Beatles-Rae-Sremmurd-Gucci-Mane/6fujklziTHa8uoM5OQSfIo) (2016) | **M** 146 / key **U** / 4:52 | **S** [intro → hook → verse → hook → verse → hook → verse → hook](https://genius.com/Rae-sremmurd-black-beatles-lyrics) |
| [Bad and Boujee](https://tunebat.com/Info/Bad-and-Boujee-feat-Lil-Uzi-Vert-Migos-Lil-Uzi-Vert/4Km5HrUvYTaSUfiSGPJeQR) (2016) | **M** 127 / B major / 5:43 | **S** [intro → long hook → verse, repeated](https://genius.com/Migos-bad-and-boujee-lyrics) |

## Boom bap (A.4)

**Agree.** Three of four header maps are verse-first: [N.Y. State of Mind](https://genius.com/Nas-ny-state-of-mind-lyrics), [C.R.E.A.M.](https://genius.com/Wu-tang-clan-cream-lyrics), and [Shook Ones Pt. II](https://genius.com/Mobb-deep-shook-ones-pt-ii-lyrics) (**S**). [Audeobox](https://www.audeobox.com/learn/mpc-software/classic-hip-hop-workflow/) teaches 85–100 BPM, roughly 54–62% swing, snare on steps 5/13, and a late kick answer (**V tutorial**).

**Varies / compose.** [Mass Appeal](https://genius.com/Gang-starr-mass-appeal-lyrics) reverses the order with a short hook first (**S**). Choose `verse_led` for 24-bar opening verses and 4-bar hooks (88 chosen bars), or `hook_first` for its exception (70 chosen bars); use 1–3 layer mutes/stabs for contrast rather than changing the core loop, following [DJ Premier's sample approach](https://modeaudio.com/magazine/masters-of-sampling-dj-premier) (**I**).

| Reference | BPM / key / length | Section order |
| --- | --- | --- |
| [N.Y. State of Mind](https://getsongbpm.com/song/npointypoint-state-of-mind/JqLgX2) (1994) | **M** 84 / key **U** / 4:54 | **S** [intro → long verse → short hook → long verse → hook](https://genius.com/Nas-ny-state-of-mind-lyrics) |
| [C.R.E.A.M.](https://getsongbpm.com/song/cpointrpointepointapointmpoint/oWKZ3) (1993/94) | **M** 92 / key **U** / 4:12 | **S** [intro → verse → hook → verse → hook → outro](https://genius.com/Wu-tang-clan-cream-lyrics) |
| [Shook Ones Pt. II](https://tunebat.com/Info/Shook-Ones-Pt-II-Mobb-Deep/1oCjPkrPCID3G70Ki4nND0) (1995) | **M** 93–94 / Bb minor / 5:26 | **S** [intro → verse → hook → verse → hook](https://genius.com/Mobb-deep-shook-ones-pt-ii-lyrics) |
| [Mass Appeal](https://songbpm.com/@gang-starr/mass-appeal) (1994) | **M** 96 / Bb minor / 3:41 | **S** [hook → verse → hook, repeated](https://genius.com/Gang-starr-mass-appeal-lyrics) |

## Lo-fi hip-hop (A.5)

**Agree.** Tutorials span [60–80](https://modeaudio.com/magazine/lofi-hip-hop-5-production-essentials) to [65–95 BPM](https://lunacy.audio/news/how-to-make-lofi-music/) (**V tutorial**). [NI](https://blog.native-instruments.com/lo-fi-hip-hop-beats/) recommends one layer added or removed every 4–8 bars over a repeating idea (**V tutorial**).

**Varies / compose.** [Monday Loop](https://songbpm.com/@tomppabeats/monday-loop) is 3/4 (**M**) and the [J Dilla](https://daily.redbullmusicacademy.com/2016/02/dilla-life-is-a-donut-feature) examples are short vignettes. Use roughly 69–95 half-time BPM, 0–4 intro bars, one-layer changes each 4–8 bars, and `vignette` at 38 chosen bars; 3/4 need not become a new 6/8 claim (**I**).

| Reference | BPM / key / length | Section order or limit |
| --- | --- | --- |
| [Time: The Donut of the Heart](https://tunebat.com/Info/Time-The-Donut-of-the-Heart-J-Dilla/3fktqaK6zAcydTkT7vfW8B) (2006) | **M** 187 (~93.5 half-time) / F minor / 1:39 | **U** public header map; vignette reading **I** from [Donuts context](https://daily.redbullmusicacademy.com/2016/02/dilla-life-is-a-donut-feature) |
| [Don't Cry](https://tunebat.com/Info/Don-t-Cry-J-Dilla/4jVqbLx0MvlIaj3h2D872X) (2006) | **M** 173 (~87 half-time) / C# major / 1:59 | **U** public header map; chopped-sample form **I** from [sample evidence](https://www.whosampled.com/sample/3505/J-Dilla-Don%27t-Cry-The-Escorts-I-Can%27t-Stand-(To-See-You-Cry)/) |
| [Monday Loop](https://songbpm.com/@tomppabeats/monday-loop) (year **U**) | **M** 69 / Bb major / 1:32; 3/4 | **U** public header map; loop form **I** from [metadata](https://songbpm.com/@tomppabeats/monday-loop) |

## House (A.6)

**Agree.** [EDMProd](https://www.edmprod.com/how-to-make-house-music/) teaches a 120–130 BPM four-on-floor base, 16–32-bar DJ intro/outro, and changes on eight-bar boundaries (**V tutorial**). [FISHER's breakdown](https://topmusicarts.com/blogs/news/fisher-losing-it-deconstructed-and-hot-to-make-in-ableton) documents repeated breakdown → build → drop cycles and bass cuts before drops (**V**).

**Varies / compose.** [Latch](https://www.imaginando.pt/news/how-to-make-disclosure-latch-blip-and-pad-sounds-in-drc) is described in 6/8; do not claim music2 supports that meter. For 4/4, use `radio` at 128 chosen bars or `extended` at 224; give the first drop roughly B33–B65, change one element each eight bars, and use roughly 2–3 layers in a breakdown against 6–8 at peak as a recipe target (**I** from [EDMProd](https://www.edmprod.com/how-to-make-house-music/) and [FISHER](https://topmusicarts.com/blogs/news/fisher-losing-it-deconstructed-and-hot-to-make-in-ableton)).

| Reference | BPM / key / length | Section order or limit |
| --- | --- | --- |
| [Around the World](https://tunebat.com/Info/Around-the-World-Daft-Punk/1q4poN5PaGvY1RbEC5gl5s) (1997) | **M** 121 / G major or E minor / ~7:10 | **U** public section map; fixed-palette variation **I** from [documented repetition](https://en.wikipedia.org/wiki/Around_the_World_(Daft_Punk_song)) |
| [Your Love](https://tunebat.com/Info/Your-Love-feat-Jamie-Principle-Frankie-Knuckles-Jamie-Principle/6tvtFyEdNpeurBkT2zNMEL) (1986) | **M** 118 / E minor / 6:47 | **U** public section map; [synth/bass identity](https://www.theguardian.com/music/musicblog/2011/may/19/your-love-frankie-knuckles) **V** |
| [Losing It](https://app.bpmsupreme.com/d/artist/fisher) (2018) | **V** [125 / G / 6:40](https://topmusicarts.com/blogs/news/fisher-losing-it-deconstructed-and-hot-to-make-in-ableton) | **V** [intro → breakdown → build → drop, repeated three times → outro](https://topmusicarts.com/blogs/news/fisher-losing-it-deconstructed-and-hot-to-make-in-ableton) |

## Techno (A.7)

**Agree.** [The Bells deconstruction](https://www.attackmagazine.com/technique/deconstructed/jeff-mills-the-bells) maps kick plus motif at B01, hats B09, clap B17, bells around B33, and later short mutes (**V**). [Track Sensei](https://tracksensei.com/blog/how-to-arrange-a-techno-track) instead proposes 32-bar blocks with one element changing at a time (**V tutorial**). Both support identity through sparse layer addition/removal (**I** from those sources).

**Varies / compose.** `detroit_linear` uses a chosen 154-bar sequence with 2–4-bar reductions and early full pulse; `plateau` uses 192 chosen bars in 32-bar blocks. Start 125–138 BPM, change each 8 bars in the linear form or 32 in the plateau, and keep density low during the breaks; only [The Bells](https://www.attackmagazine.com/technique/deconstructed/jeff-mills-the-bells) has a published bar map (**I** for music2 totals).

| Reference | BPM / key / length | Section order or limit |
| --- | --- | --- |
| [The Bells](https://www.beatport.com/track/the-bells/821823) (1997) | **V** [137.52 / A minor / ~4:40–4:52](https://www.attackmagazine.com/technique/deconstructed/jeff-mills-the-bells) | **V** [kick+motif → hats → clap → bells → bass-led second movement; 1–4-bar reductions](https://www.attackmagazine.com/technique/deconstructed/jeff-mills-the-bells) |
| [Spastik](https://tunebat.com/Info/Spastik-Plastikman/0CeI5I7acLxgSYkWc6Wgkh) (1993) | **M** 126 / key **U** / 9:17 | **U** bar map; sparse opening and long growth **V** [in profile](https://www.insomniac.com/music/from-the-crate-plastikman-spastik/) |
| [Subzero](https://songbpm.com/@ben-klock/subzero) (2009) | **M** 125 / F# minor / 6:26 | **U** public section map |

## Arrangement moves

There is no move DSL in this plan. Make a one- or two-bar pre-hook/drop dropout as a distinct section whose `patterns` set kick and 808/bass to `null`; keep the returning full section separate ([tech-house tutorial](https://www.edmprod.com/how-to-make-tech-house/), [The Bells](https://www.attackmagazine.com/technique/deconstructed/jeff-mills-the-bells)). In a build, place a short snare-roll pattern only while hats/claps are muted ([Losing It](https://topmusicarts.com/blogs/news/fisher-losing-it-deconstructed-and-hot-to-make-in-ableton)); at an eight-bar drill boundary, change or mute one music layer, without claiming a filter-automation command ([Attack UK drill](https://www.attackmagazine.com/technique/beat-dissected/uk-drill/)). Add a brief bar-end hat roll ([LANDR](https://blog.landr.com/trap-hats/)), phrase-end 808 glide ([NI drill](https://blog.native-instruments.com/drill/)), or one-bar percussion break ([The Bells](https://www.attackmagazine.com/technique/deconstructed/jeff-mills-the-bells)) as authored pattern overrides. Keep every change deterministic and audible in the chosen section.

## Traceability: planned recipe changes

These links are the report's source URLs. Case IDs identify evidence; they do not certify music2's chosen bars as record-accurate.

| Recipe change | Case basis | Source URLs |
| --- | --- | --- |
| `drill_uk`: `short_single`/`posse`, 146 max, straight swing, alternating snare and 3+3+2 hats | A.1 / Doja, Kennington, NI tutorial | [Doja M](https://songbpm.com/%40central-cee/doja-EVu4Q8WGX7), [Kennington M](https://tunebat.com/Info/Kennington-Where-It-Started-Bis-Blanco-ACTIVE-MizOrMac/6YvNpnAsvxCKLDepeHLpKo), [NI V](https://blog.native-instruments.com/drill/), [Attack V](https://www.attackmagazine.com/technique/beat-dissected/uk-drill/) |
| `drill_ny`: `pre_hook`, 16-bar hook | A.2 / Dior, Welcome to the Party | [Dior S](https://genius.com/Pop-smoke-dior-lyrics), [Welcome S](https://genius.com/Pop-smoke-welcome-to-the-party-lyrics) |
| `trap`: `hook_first` default | A.0/A.3 / Mask Off, Black Beatles, Bad and Boujee | [Mask Off S](https://genius.com/Future-mask-off-lyrics), [Black Beatles S](https://genius.com/Rae-sremmurd-black-beatles-lyrics), [Bad and Boujee S](https://genius.com/Migos-bad-and-boujee-lyrics) |
| `trap`: `long_hook`, `interlude` | A.3 / Bad and Boujee, Mask Off | [Bad and Boujee S](https://genius.com/Migos-bad-and-boujee-lyrics), [Mask Off S](https://genius.com/Future-mask-off-lyrics) |
| `boom_bap`: `verse_led`, `hook_first`, longer verse/short hook, late kick | A.0/A.4 / N.Y. State of Mind, C.R.E.A.M., Shook Ones Pt. II, Mass Appeal; Audeobox | [Nas S](https://genius.com/Nas-ny-state-of-mind-lyrics), [Wu-Tang S](https://genius.com/Wu-tang-clan-cream-lyrics), [Mobb Deep S](https://genius.com/Mobb-deep-shook-ones-pt-ii-lyrics), [Gang Starr S](https://genius.com/Gang-starr-mass-appeal-lyrics), [Audeobox V](https://www.audeobox.com/learn/mpc-software/classic-hip-hop-workflow/) |
| `trap`: bar-end hat roll in the starter hats | A.3 / LANDR trap hats, Black Beatles walkthrough | [LANDR V](https://blog.landr.com/trap-hats/), [Mike WiLL Made-It V](https://www.youtube.com/watch?v=8jp4I9shmrE) |
| `lofi_hiphop`: breakdown mutes kick, bass and melody (a sparse reset before the loop returns) | A.5 / NI lo-fi, EDMProd lo-fi | [NI V](https://blog.native-instruments.com/lo-fi-hip-hop-beats), [EDMProd V](https://www.edmprod.com/lofi-hip-hop) |
| `lofi_hiphop`: `vignette`, BPM max 95 | A.5 / Time, Don't Cry, Lunacy | [Time M](https://tunebat.com/Info/Time-The-Donut-of-the-Heart-J-Dilla/3fktqaK6zAcydTkT7vfW8B), [Don't Cry M](https://tunebat.com/Info/Don-t-Cry-J-Dilla/4jVqbLx0MvlIaj3h2D872X), [Lunacy V](https://lunacy.audio/news/how-to-make-lofi-music/) |
| `house`: `radio`, `extended`, pre-drop bass mute | A.6 / EDMProd, Losing It, Your Love, Around the World | [EDMProd V](https://www.edmprod.com/how-to-make-house-music/), [FISHER V](https://topmusicarts.com/blogs/news/fisher-losing-it-deconstructed-and-hot-to-make-in-ableton), [Your Love M](https://tunebat.com/Info/Your-Love-feat-Jamie-Principle-Frankie-Knuckles-Jamie-Principle/6tvtFyEdNpeurBkT2zNMEL), [Daft Punk M](https://tunebat.com/Info/Around-the-World-Daft-Punk/1q4poN5PaGvY1RbEC5gl5s) |
| `techno`: `detroit_linear`, `plateau`, short mutes | A.7 / The Bells, Track Sensei, Spastik | [The Bells V](https://www.attackmagazine.com/technique/deconstructed/jeff-mills-the-bells), [Track Sensei V](https://tracksensei.com/blog/how-to-arrange-a-techno-track), [Spastik tutorial V](https://www.attackmagazine.com/technique/beat-dissected/spastik-style-percussive-techno/) |

## Candidate checks not implemented yet

The [research recommendations](https://github.com/lidge-ai/music2-gen/blob/main/devlog/_fin/260928_music2_flow_practice/evidence/aside-real-world-report.md) proposed these; the [disposition](https://github.com/lidge-ai/music2-gen/blob/main/devlog/_fin/260928_music2_flow_practice/001_real_world_practice.md) defers them. Do not report them as current lint/analyze results.

- `generic/no_pre_hook_move`, `generic/static_16`, `generic/phrase_misaligned`, `drill_uk/snare_never_moves`, `generic/verse_melody_in_vocal_band`, and `generic/duration_mismatch`.
- `TAIL_TRUNCATED`, `VOICE_BAND_BUSY`, `PLATFORM_TP_RISK`, and `PLAYLIST_LOUDNESS_SPREAD`.
