# music2: layering, low end and tonal balance as lint and analysis rules

Research date: 2026-09-28. Scope: public web only. Target: `lidge-ai/music2-gen` at commit `1da22d7`. I read the repo from a scratch clone; no repo files were changed.

Tags: **V** means a fetched page states the fact. **V\*** means the page text was read through a search-engine extract because a direct fetch returned 403. **I** means an inference, conversion or proposed policy. **U** means unverified: forum posts, third-party blogs, or snippets only. All thresholds below are **I** (proposed policy) unless they repeat a V number.

Working notes, including per-lane fact tables and full source lists, are in `_notes/`:
- `0_repo_context.md`
- `A_register_lowmids.md`
- `B_low_end.md`
- `C_tonal_balance.md`
- `D_mids_levels_genre.md`
- `E_verification_and_calibration.md`

---

## 0. Why `LOW_END_DOMINANCE > 0.55` fires on every hip-hop song

**Current behavior**
- `src/analyze/analyze.tool.ts:110-111` warns when `sub + low > 0.55` for every genre.
- `bands.tool.ts` computes these shares from a mono sum using unweighted linear FFT power over 20 Hz to 20 kHz.
- Music naturally puts most of its power in the low bands, so in this metric "0.55" does not mean "the bass is too loud". It is closer to "a bit bassier than an average pop LTAS". **I**, shown below.

**Evidence**
- **V** A published tool uses the *same first four band edges* as music2: 20-60 / 60-250 / 250-500 / 500-2k Hz, measured as linear-power %. Its electronic profile is sub 27 / bass 54 / low-mid 6 / mid 5 / 2-6k 4 / 6-16k 4 / 16-20k 0 %.
- **V** Its combined sub+bass targets by genre are:
  - deep/tech house 84%
  - funky/disco house 79%
  - peak-time/minimal techno 89%
  - DnB 81%
  - dubstep 76%
  - trance 84%
  - Source: https://trackscore.ai/blog/frequency-balance-electronic-music
- By that published data, a *correct* house or techno track sits at 0.79-0.89. A 0.55 threshold will always fire on it.
- **V** iZotope's Master Assistant grouped its 10 genre classes into 3 broad curve families. "Bass Heavy" covers EDM and Hip-Hop together, separate from "Modern" (pop/rock) and "Orchestral". Source: https://downloads.izotope.com/docs/ozone8/master-assistant/index.html
- **V** Pestana et al. (AES 2013) give mean spectral centroids of hip-hop 662 Hz, electronic 845 Hz and pop 868 Hz. Hip-hop is the lowest centroid of the modern genres. Source: https://www.researchgate.net/publication/274511175_Spectral_characteristics_of_popular_commercial_recordings_1950-2010
- **I** Hip-hop's centroid is lower than electronic's, so hip-hop should be *at least* as low-heavy as house/techno in music2's metric (~0.8-0.9+). This is an inference from the centroid, not a measurement in this metric.

**Calibration.** I ran `music2 analyze` on the repo's own example songs (details in `_notes/E_...`).

| example | sub | low | lowMid | mid | presence | air | sub+low | tilt dB* | current warnings |
|---|---|---|---|---|---|---|---|---|---|
| drill-140 | .362 | .540 | .019 | .049 | .024 | .006 | .902 | +9.6 | LOW_END_DOMINANCE |
| drill-uk-moving-snare-144 | .313 | .621 | .007 | .015 | .017 | .027 | .934 | +11.5 | LOW_END_DOMINANCE |
| trap-150 | .476 | .479 | .023 | .013 | .004 | .005 | .955 | +13.3 | LOW_END_DOMINANCE |
| type-beat-trap-140 | .638 | .326 | .004 | .002 | .008 | .021 | .964 | +14.3 | LOW_END_DOMINANCE |
| house-124 | .124 | .618 | .142 | .095 | .011 | .011 | .742 | +4.6 | LOW_END_DOMINANCE |
| boom-bap-90 | .061 | .371 | **.534** | .028 | .002 | .003 | .432 | -1.2 | none |
| lofi-75 | .000 | .382 | **.603** | .015 | .000 | .000 | .382 | -2.1 | EMPTY_HIGH_BAND |

\* `tiltDb = 10*log10((sub+low)/(1-(sub+low)))` (**I**). Tilt is easier to read than a share near 1.0: 0.55 is +0.9 dB, 0.84 is +7.2 dB, 0.89 is +9.1 dB, and 0.95 is +12.8 dB.

**What the calibration shows (I)**
1. Every 808 genre fails the current threshold, even when its balance is plausible for the genre.
2. The real problem in boom-bap and lo-fi is the *opposite* one: low-mid mud, at 53-60% of power in 250-500 Hz. Nothing warns on it today.
3. Presence plus air is under 5% in every example, and under 1% in trap-150, so hats barely register. A top-end-deficit check would catch more real problems than the low-end check does.

**Slope model (I).**
- **V** The mean LTAS of commercial popular music falls about 4.53 dB/oct between 89 Hz and 4.5 kHz, and gets steeper at higher frequencies. Local slopes are about -2.35 dB/oct at 200 Hz, -4.99 at 800 Hz and -7.62 at 3.2 kHz. Source: Elowsson & Friberg 2017, https://www.diva-portal.org/smash/get/diva2:1108529/FULLTEXT02.pdf
- **I** I integrated that curve over music2's bands with a 30 Hz HPF. It gives sub .08, low .36, lowMid .22, mid .27, presence .06, air .004, so sub+low is about 0.44.
- **I** Tilting the curve 1 dB/oct darker gives about 0.60.
- **I** A pure power law gives 0.36 at 3 dB/oct (pink), 0.74 at 4.5 dB/oct and 0.82 at 5 dB/oct.
- **I** So 0.55 is roughly "average pop + 1 dB/oct". That is a reasonable bar for pop and far too low for the Bass Heavy family.

---

## 1. Frequency slotting and arrangement by register

### Facts

| role | fundamental / key regions | tag | source |
|---|---|---|---|
| kick | 60-80 Hz punch, 100-200 Hz knock, 200-500 Hz boxy, 1-5 kHz click | V | https://www.izotope.com/community/blog/eq-cheat-sheet |
| kick (808-style) | TR-808 bass drum is about a 50 Hz sine. Shorten kick decay so it does not mask the 808 tail | V | https://www.izotope.com/community/blog/how-to-mix-808s |
| kick vs bass | Kick and bass carry most of the mix-bus level. The sub-100 Hz kick/bass conflict is "the most critical" one in modern mixes | V | https://www.soundonsound.com/techniques/mixing-bass |
| 808 / sub | An 808 lives in sub-bass, mostly 30-60 Hz. Keep the sub for the 808 and add texture higher up | V | https://www.avid.com/resource-center/what-is-an-808 |
| sub (EDM) | Sub-bass is roughly 25-80 Hz | V | https://www.edmprod.com/sub-bass/ |
| bass | 40-120 Hz fundamental, 120-250 Hz body, 300-500 Hz mud, 800 Hz-1 kHz articulation | V | https://www.izotope.com/community/blog/eq-cheat-sheet |
| bass (small speakers) | The 1 kHz zone makes bass audible on small speakers. 3-6 kHz is the presence/harshness band | V | https://www.soundonsound.com/techniques/mixing-bass |
| snare/clap | 150-250 Hz body, 300-500 Hz boxy, 2-3.5 kHz snap | V | https://www.izotope.com/community/blog/eq-cheat-sheet |
| hats | 3-7 kHz harshness, 8-12 kHz air | V | same |
| piano/keys | Mud at 200-500 Hz, harshness at 2-4 kHz | V | same |
| lead | 500 Hz-2 kHz is where "lead synth fundamentals" sit | V | https://trackscore.ai/blog/frequency-balance-electronic-music |
| vocal pocket | Presence and intelligibility at 1.5-5 kHz. Hearing is most sensitive at 2-5 kHz | V | https://www.izotope.com/community/blog/how-to-eq-vocals ; https://www.soundonsound.com/techniques/mix-mistakes |
| techno strata | Rolling-bass example: sub layer low-passed at ~80 Hz, bassline on G2 (98 Hz) with HPF ~65 Hz and LPF ~350 Hz, kick cut -4.5 dB at 98 Hz | V | https://www.attackmagazine.com/technique/tutorials/warehouse-rolling-techno-bass |
| focus limit | A listener can focus on about three elements at once | V | https://www.edmprod.com/production-pyramid/ |
| call/response | Separate call and response by pitch, intensity or timbre. One example drops the response by an octave | V | https://www.edmprod.com/using-call-and-response/ |
| masking | Similar sounds in the same range and position mask each other. Common collisions are vocal+pad, vocal+piano and synth+synth | V | https://www.izotope.com/en/learn/what-is-frequency-masking |

### Pitch to band mapping for static lint (I)

music2 uses scientific pitch: `c4` is MIDI 60 (`src/pattern/values.tool.ts:17`), and `f = 440 * 2^((m-69)/12)`. The band edges fall at these pitches:

| edge | pitch | notes whose fundamental is in the band below the edge |
|---|---|---|
| 60 Hz | ≈ B1 (61.7 Hz, MIDI 35) | notes ≤ MIDI 34 (A#1) have their fundamental in **sub** |
| 250 Hz | ≈ B3 (MIDI 59) | notes 35-58 are **low** |
| 500 Hz | ≈ B4 (MIDI 71) | notes 59-70 are **lowMid** |
| 2 kHz | ≈ B6 (MIDI 95) | notes 71-94 are **mid**; above that is **presence** |

**Default band owners (I, from the facts above).** "Owner" means the one sustained source allowed to dominate that band in a section:

| band | owner | notes |
|---|---|---|
| sub 20-60 | 808 or bass (one) | kick only as a short transient |
| low 60-250 | kick body + the same low owner | snare body 150-250 |
| lowMid 250-500 | one body source: keys *or* pad *or* bass harmonics | |
| mid 500-2k | lead / keys / pluck | |
| presence 2-8k | lead or vocal pocket, snare snap, hats | |
| air 8-20k | hats, bell overtones, reverb | |

### Rules
- **Octave separation (I).** Two melodic layers with medians within 12 semitones, the same rhythm and the same pan will mask each other. Move one an octave (EDMProd, V) or turn it into call-and-response.
- **Maximum simultaneous layers.** ~3 focal elements (V). Held pads and quiet support do not count as focal.

### Proposed checks
- `generic/band_owner_conflict` (lint)
- `generic/focal_layer_count` (lint)
- `generic/same_register_unison` (lint)
- `generic/vocal_pocket` (lint)

Thresholds are in the consolidated table.

---

## 2. Low end

### Facts
- **V** If a song has more than one bass part, choose *one* main low-end source and high-pass the others around 100 Hz. This avoids phase cancellation you cannot fix in the mix. Source: https://www.soundonsound.com/techniques/mixing-bass
- **V** Kick-to-bass ducking: you can rarely push it past about **2-3 dB per hit** before the bass sounds odd. Source: https://www.soundonsound.com/techniques/mixing-bass
- **V** With subtle kick-keyed compression on bass you can usually reach **~6 dB** before pumping is noticeable. Release should follow the kick decay and the BPM. Source: https://www.attackmagazine.com/technique/tutorials/ten-production-tips-for-better-basslines/4/
- **V** Starting settings:
  - Kick-sub sidechain release 50-150 ms: https://www.edmprod.com/sub-bass/
  - Subtle start of 2:1, 1 ms attack, 30 ms release: https://www.waves.com/sidechain-compression-explained-fundamental-techniques
  - House-style example of 5:1, 4 ms attack, 60 ms release: https://www.edmprod.com/sidechain-compression/
- **V** 808 practice from iZotope (https://www.izotope.com/community/blog/how-to-mix-808s):
  - Shorten the kick decay so it gives the punch and the 808 gives the sustain.
  - Put a kick-keyed dynamic EQ notch in the 808 at the kick fundamental (62 Hz in the example).
  - Add full-band ducking with a short release.
- **V** Tune the kick to the song key, or move bass notes and timing around the kick fundamental. Source: https://www.izotope.com/community/blog/how-to-mix-kick-and-bass
- **V** Tune the kick first, since its pitch sets the bassline key. In the rolling-techno example the bassline leaves **the first 16th of every beat empty** for the kick, and sidechain handles the remaining tail overlap. Source: https://www.attackmagazine.com/technique/tutorials/warehouse-rolling-techno-bass
- **V** Mono guidance varies by source:
  - EDMProd says mono below 120 Hz and centered below 200 Hz: https://www.edmprod.com/synth-bass/ , https://www.edmprod.com/mono-vs-stereo/
  - iZotope shows a side-channel HPF at 100 Hz: https://www.izotope.com/community/blog/what-is-midside-processing
  - Armada says 50-120 Hz belongs in the center: https://www.armadamusic.com/university/music-production-articles/how-to-mix-your-kick-and-bass-5-must-know-methods
- **V** High-pass anything that does not need low end for musical reasons. Source: https://www.soundonsound.com/techniques/mix-mistakes
- **V** Specific HPF points:
  - Vocals often at 100 Hz: https://mastering.com/high-pass-filter/
  - Bass synths 30-40 Hz, kick 25-30 Hz, and only the dedicated sub below 60 Hz: https://trackscore.ai/blog/frequency-balance-electronic-music
- **V** A sine 808 has no overtones and won't be heard on many speakers. Adding 3rd harmonics (square blend) and 2nd harmonics (tube saturation) helps it translate. Source: https://www.izotope.com/community/blog/how-to-mix-808s
- **V** 808 level: leave about 6 dB of headroom, and aim for **-3 to 0 on a K-20 meter** (about -23 to -20 dBFS average). Source: https://www.izotope.com/community/blog/how-to-mix-808s
- **U** The level of the 808 relative to the kick has no credible numeric source. Forums suggest "808 0 to -5 dB vs kick" (https://www.reddit.com/r/trapproduction/comments/1afuyil/kick_808_loudness ; https://gearspace.com/threads/808db-in-mix.1147466/). Do not lint on it.

### How music2's `duck` maps to these numbers (read from code, `src/render/fx.tool.ts:73-90`)
- `amount` is a linear gain floor applied at each trigger, so depth in dB is `-20*log10(1-amount)`:

  | amount | depth |
  |---|---|
  | 0.2 | 1.9 dB |
  | 0.3 | 3.1 dB |
  | 0.45 | 5.2 dB |
  | 0.5 | 6.0 dB |
  | 0.75 | 12 dB |

- Recovery is exponential with time constant `releaseMs`, so the bass is about 95% recovered after `3*releaseMs`. The default 180 ms therefore takes about 540 ms to recover. That is longer than one beat at any tempo above 111 BPM. **I**
- The kick voice (`drums.tool.ts:54-57`) sweeps from 160 Hz down to `48*(0.85+0.3*tone)*pitch` Hz. At pitch 1 that settles between 40.8 and 55.2 Hz (about E1 to A1), so kick tuning can be computed statically. **I**
- The reverb return (`fx.tool.ts` comb/allpass) has **no high-pass filter** and adds stereo spread. Any reverb send on a low source therefore puts low end into the side channel. **V** from code. SOS says to high-pass most effect returns "well above 100Hz" (**V**).

### Proposed checks
- `generic/low_owner_overlap`
- `generic/kick_bass_collision`
- `generic/duck_depth`
- `generic/duck_release`
- `generic/sub_floor`
- `generic/kick_tuning`
- `generic/low_pan`
- `generic/low_send`
- `generic/nonowner_low_notes`
- Analysis: `SUB_EXCESS`, `SUB_TRANSLATION`, `LOW_SIDE_ENERGY`
- Render change: default HPF on the reverb return

---

## 3. Low-mids (200-500 Hz, "mud")

### Facts
- **V** Most signals spill into 200-500 Hz, which makes a mix muddy. Check the kick and bass first. Source: https://www.production-expert.com/production-expert-1/6-eq-mistakes-to-avoid-when-mixing
- **V** Bass warmth competes in the region below ~300 Hz. A compensating cut at **200-400 Hz** is typical. Reverb on bass should roll out sub-100 Hz *and* pull back the region up to ~500 Hz. Source: https://www.soundonsound.com/techniques/mixing-bass
- **V** 250-500 Hz is where kick body, bass harmonics and pad warmth stack up. Remedies: a 2-3 dB cut near 300 Hz; electronic low-mid targets are 3-7%. Real uploads more often run heavy than light in the low-mids. Source: https://trackscore.ai/blog/frequency-balance-electronic-music
- **V** A broad gentle cut at 200-500 Hz is the usual first remedy for piano mud. Source: https://www.izotope.com/community/blog/eq-cheat-sheet
- **V** High-pass effect returns "well above 100 Hz", plus low cuts in the couple of octaves above that. Delays and reverbs with long low-end decay make "thick soup". Source: https://www.soundonsound.com/techniques/mix-mistakes
- **V** A practical HPF before reverb starts at 50 Hz and rises until the mush goes away. Source: https://www.sweetwater.com/insync/effect-tip-use-a-high-pass-filter-before-reverb/
- **V\*** Low-interval limits: the lowest pitch at which each interval stays clear. They are guidelines, not laws, and should assume the root is present even when it is only implied. Sources:
  - Sweetwater "Low Interval Limit": https://www.sweetwater.com/insync/low-interval-limit (search extract; direct fetch 403)
  - Hoffmann: https://www.robin-hoffmann.com/dfsb/low-interval-limits/ (V)
  - Funnell PDF: https://funnelljazz.eu/wp-content/uploads/2020/12/Low-Interval-Limits.pdf
  - Berklee flashcards: https://quizlet.com/144457106/lower-interval-limits-berklee-flash-cards/ (search extract)
- **I, octave-naming correction.** Sweetwater calls middle C "C3". Berklee (m2 E3-F3, M2 Eb3-F3, m3 C3-Eb3, M3 Bb2-D3) matches Sweetwater exactly one octave up. So in music2's scientific pitch, where c4 = 60, the limits are:

  | interval (semitones) | lowest lower note | MIDI | tag |
  |---|---|---|---|
  | m2 (1) | E3 | 52 | V\* |
  | M2 (2) | Eb3 | 51 | V\* |
  | m3 (3) | C3 | 48 | V\* |
  | M3 (4) | Bb2 | 46 | V\*; Sweetwater B2 = 47 |
  | P4 (5) | A2 | 45 | V\* Sweetwater |
  | tritone (6) | B1 | 35 | V\* Sweetwater |
  | P5 (7) | Bb1 | 34 | I; Sweetwater extract lost the octave |
  | m6 / M6 / m7 (8-10) | F2 | 41 | V\* Sweetwater |
  | M7 (11) | F2 | 41 | I, standard chart |
  | P8 | unlimited | - | V |

  In plain terms: no thirds below C3/Bb2, no seconds below Eb3/E3, and fifths are fine down to about Bb1.

- **I, register rule.** For pad and keys, keep the lowest chord tone at or above C3 (MIDI 48, 131 Hz) whenever an 808 or bass is active. This rests on:
  - SOS: "HPF what doesn't need low end" (V)
  - HPF secondary parts at ~100 Hz (V)
  - C3 is the lowest pitch that keeps a third clear (V\*)
- **V** Lo-fi exception: many lo-fi tracks have no dedicated bass, and the keys plus kick cover the low end. Source: https://blog.native-instruments.com/lo-fi-hip-hop-beats

### Proposed checks
- `generic/low_interval_limit` (lint)
- `generic/nonowner_low_notes` (lint)
- `generic/lowmid_stack` (lint)
- `LOWMID_MUD` (analyze)
- Reverb-return HPF (render)

---

## 4. Mids and presence (500 Hz-8 kHz), panning and width

### Facts
- **V** Complementary EQ: boost a band on the priority source and cut the same band on the competitor. Example: +1 dB at 300 Hz on one, -1 dB on the other; synth vs drums at 4 kHz. Keep lead, drums and bass centered and move secondary parts to the sides. Source: https://www.izotope.com/community/blog/unmasking-your-mix-with-neutron
- **V** Low sources such as kick and bass sit near center; higher keys and guitar go wider. In LCR panning, bass, kick, snare and vocal stay center, while keys, percussion and backing parts can go hard left/right. Source: https://www.izotope.com/en/learn/what-is-panning-in-music
- **V** Moving a hi-hat away from a competing high-register part reduces masking. Source: https://www.izotope.com/en/learn/what-is-frequency-masking
- **V** Hearing is most sensitive at 2-5 kHz. Piling 2-5 kHz onto everything makes a harsh mix. Source: https://www.soundonsound.com/techniques/mix-mistakes
- **V** Vocal-pocket ducking on the instrument bus: 2:1, 30 ms attack, 250 ms release, 2-3 dB of gain reduction. Source: https://www.edmprod.com/sidechain-compression/
- **V** Example pan values: a UK drill hat at 64% spread with percussion at 20L (https://www.attackmagazine.com/technique/beat-dissected/uk-drill), and a subtle hat at 17L / -9 dB (https://www.attackmagazine.com/technique/beat-dissected/make-uk-drill-in-the-style-of-dutchavelli-or-m24/).
- **V** Keep the deepest sub centered. Add width only above the sub, using a filtered duplicate or saturation. Source: https://hotgroovesamples.com/blogs/news/create-rolling-basslines-quickly
- **I** Width policy for music2's `pan`:

  | track | pan |
  |---|---|
  | bd, sd, cp, 808, bass | 0 (±0.1) |
  | lead | 0 to ±0.2 |
  | hats, perc, rim, pluck, bell, keys doubles | ±0.2-0.7 |
  | pad | kept wide by the voice itself |

  Two focal parts in the same register should be separated by pan distance ≥ 0.25 *or* by an octave.

### Proposed checks
- `generic/low_pan`
- `generic/side_support_width`
- `generic/same_register_unison`
- `generic/vocal_pocket` (lint)
- `PRESENCE_HARSH`, `TOP_END_DEFICIT` (analyze)

---

## 5. Tonal balance targets by genre

### Published targets and measurements
- **V** iZotope Tonal Balance Control (original) uses broad bands of 20-250 / 250-2k / 2k-8k / 8k-20k Hz. The shaded areas show typical variation, not one exact target. It ships Bass Heavy, Modern and Orchestral curves. Source: https://downloads.izotope.com/docs/ozone8/tonal-balance-control/index.html
- **V** TBC 3 offers 30+ genre targets, but the numeric curves are not published. Source: https://www.izotope.com/products/tonal-balance-control
- **V** Mastering The Mix BASSROOM builds targets from up to 20 references using the bands 0-20/20-40/40-80/80-160/160-320 Hz. It recommends measuring the drop or chorus. Source: https://www.masteringthemix.com/pages/bassroom-manual
- **V** LEVELS publishes loudness range averages (Hip Hop 4.0 LU, House 5.3, Pop 6.4, EDM 5.9) but no tonal shares. Source: https://www.masteringthemix.com/pages/mixing-with-levels
- **V** sonible smart:EQ 4 has genre profiles but publishes no numbers. Source: https://www.sonible.com/smarteq4/
- **V** Pestana 2013:
  - Hip-hop, rock, pop and electronic have louder lows up to ~150 Hz and louder highs from 5 kHz than jazz or folk.
  - The log-log slope descriptor for 100 Hz-10 kHz is hip-hop -0.81, pop -0.94, electronic -0.75.
  - Centroids are listed in §0.
  - Sources: https://www.researchgate.net/publication/274511175_Spectral_characteristics_of_popular_commercial_recordings_1950-2010 ; summary in https://www.diva-portal.org/smash/get/diva2:1108529/FULLTEXT02.pdf
- **V** Mean commercial LTAS slope is 4.53 dB/oct from 89 Hz to 4.5 kHz, steepening with frequency. This is the "real music" tilt; pink noise is 3 dB/oct. Source: Elowsson & Friberg, same PDF.
- **V** Billboard bass study: tracks with the most bass fluctuation cluster in electronic/dance, hip-hop/rap and R&B. Source: https://pure.au.dk/ws/files/209670369/Increased_levels_of_bass_in_popular_music_recordings.pdf
- **V** TrackScore gives in-metric numbers (listed in §0), plus:
  - Sub targets run from 22% (funky house) to 45% (dubstep).
  - Low-mid targets are 3-7%.
  - 6-16 kHz targets are 2-4%.
  - Source: https://trackscore.ai/blog/frequency-balance-electronic-music

### How much more low end hip-hop carries (answer)
- No public source gives a trap/drill vs house (or vs pop) difference in dB or band share. **U** as a measured number.
- The best-supported statements are:
  - (a) iZotope puts hip-hop and EDM in the same "Bass Heavy" family (V).
  - (b) Hip-hop's centroid is about 0.39 octave below pop's and 0.35 octave below electronic's (V numbers; I arithmetic).
  - (c) In music2's metric, published house/techno targets are +5.8 to +9.1 dB low-vs-rest (V).
  - (d) Under the Elowsson model, pop is about -1 dB (I).
- Therefore **I**: Bass Heavy genres sit about 6-10 dB more "low-vs-rest" than an average pop LTAS. 808 genres plausibly sit at or above house/techno. music2's current 808 renders measure +9.6 to +14.3 dB.
- This needs corpus calibration (see Open gaps).

### Genre tonal balance table
The values are expected ranges in music2's metric (mono-sum linear power share over 20 Hz-20 kHz). All ranges are **I** unless a cell cites V. They are a bootstrap prior until a reference corpus is measured.

| genre | sub 20-60 | low 60-250 | lowMid 250-500 | mid 500-2k | presence 2-8k | air 8-20k | sub+low (tilt dB) warn ceiling | basis |
|---|---|---|---|---|---|---|---|---|
| house | .18-.32 | .48-.62 | .03-.10 | .03-.08 | .02-.06 | .01-.04 | target .79-.84 (V); warn > .90 (+9.5 dB) | TrackScore house 84 / funky 79 (V); electronic profile 27/54/6/5 (V) |
| techno | .22-.38 | .48-.60 | .03-.08 | .02-.07 | .02-.06 | .01-.04 | target .89 (V); warn > .93 (+11 dB) | TrackScore peak-time/minimal 89 (V) |
| trap | .30-.50 | .35-.55 | .02-.08 | .02-.07 | .02-.06 | .005-.03 | warn > .94 (+12 dB) | Bass Heavy family (V); hip-hop centroid below electronic (V); renders .90-.96 |
| drill_ny | .30-.50 | .35-.55 | .02-.08 | .02-.07 | .02-.06 | .005-.03 | warn > .94 (+12 dB) | as trap; no drill-specific LTAS found (U) |
| drill_uk | .25-.45 | .40-.62 | .02-.08 | .02-.07 | .02-.06 | .005-.03 | warn > .94 (+12 dB) | sliding 808 in the upper sub/low region; render .93 |
| boom_bap | .06-.25 | .40-.60 | .06-.20 | .04-.12 | .02-.06 | .005-.03 | warn > .85 (+7.5 dB) | bass line + sample; kick-snare forward (V, NI/Attack); ranges I |
| lofi_hiphop | .02-.20 | .35-.60 | .10-.30 | .05-.15 | .005-.04 | ≤ .02 | warn > .82 (+6.6 dB) | drums low-passed ~3.1 kHz, often no dedicated bass (V, NI); ranges I |
| pop (reference only) | .05-.15 | .30-.45 | .15-.25 | .20-.30 | .04-.10 | .003-.02 | warn > .64 (+2.5 dB) | Elowsson mean LTAS integrated (I from V slopes) |

Notes:
- **I** The presence ranges assume music2's synth drums. Real masters carry more presence and air. Pestana: hip-hop, pop and electronic have louder highs from 5 kHz than jazz or folk (V).
- Calibration against the §0 examples:
  - drill-140 and drill-uk pass the new ceilings.
  - trap-150 (+13.3 dB) and type-beat-trap (+14.3 dB, sub .638) are flagged. That looks deserved: presence plus air is 0.9-2.9%.
  - house-124 passes the new ceiling but is out of profile (sub .124, lowMid .142), which the band-level checks report.
  - boom-bap and lo-fi get `LOWMID_MUD` instead.

---

## 6. Gain staging and relative levels

- **V** Set the highest-peaking source to **-12 to -18 dBFS** peak. Channel peaks above **-8 to -10 dBFS** are unexpected. The kick or snare is usually the highest track. Inter-sample peaks can exceed sample peaks by **3 dB or more**. Source: https://www.soundonsound.com/techniques/gain-staging-your-daw-software
- **V** 808: about 6 dB of headroom, and -3 to 0 on K-20. At the loudest points a balanced mix reaches about +4/+5 on K-20. Source: https://www.izotope.com/community/blog/how-to-mix-808s
- **V** In a boom-bap example the drum bus sits at -6.5 dB and the music bus at -13.9 dB, so the drums are about 7.4 dB above the music. The arrangement builds as:
  - bars 1-8: keys and kickless hats/snare
  - bar 9: kick and bass enter
  - next verse: keys removed
  - chorus at bar 25: samples and bass change
  - Source: https://blog.native-instruments.com/what-is-boom-bap
- **V** Lo-fi arrangement: bring in one element at a time over 4- or 8-bar phrases, and take things out when they get repetitive. Source: https://blog.native-instruments.com/lo-fi-hip-hop-beats
- **V** More parts means more masking; keep only the parts that serve the song. Source: https://www.izotope.com/community/blog/unmasking-your-mix-with-neutron
- **V** Streaming normalization: Spotify -14 LUFS (mobile -11), Apple about -16, YouTube/TIDAL/Amazon/Deezer about -14. Short-term LUFS uses 3 s, momentary 400 ms. Source: https://blog.landr.com/lufs-loudness-metering/
- **U** Genre master loudness (trap/drill -7 to -9 LUFS, lo-fi -12 to -14) is only in third-party blogs, e.g. https://www.audeobox.com/learn/fl-studio/how-to-make-lofi-beats-in-fl-studio/ for lo-fi -12..-14. Keep music2's -14 target (V as a streaming reference). Do not add genre LUFS targets without better sources.
- **U** 808 vs kick level in dB: forums only (see §2).
- **Layer counts.** No credible source gives a fixed verse vs hook track count. The evidence supports the *direction*: fewer layers in the verse or breakdown, more in the hook/drop, entering in 4/8-bar phrases (V, NI).
  - music2 already enforces hook minus verse ≥ 1 active track (≥ 2 for dance) in `generic/no_density_contrast`. Keep it, and treat the numbers as policy (I).
  - Add a focal cap of 3 (V, EDMProd).
- **I** Proposed static level check: in hip-hop, kick, snare/clap and 808 should be the three loudest *static* contributions (gain + 20·log10(mean velocity)). Hats should sit at least 3 dB below the snare. Info only, because the numbers are U.

---

## 7. Genre specifics

**trap / drill_ny / drill_uk**
- **V** The 808 carries both bass and melody. Shorten the kick for punch and let the 808 carry the sustain. Duck at the kick's fundamental. Source: https://www.izotope.com/community/blog/how-to-mix-808s
- **V** UK drill: halftime melodies, sparse patterns, gliding 808s. Source: https://www.attackmagazine.com/technique/beat-dissected/uk-drill
- **V** Dutchavelli/M24 example: 144 BPM, 0% swing, slide 808, subtle panned hat. Source: https://www.attackmagazine.com/technique/beat-dissected/make-uk-drill-in-the-style-of-dutchavelli-or-m24/
- **I** Mono 808 (music2 already lints `808_polyphony`). Glide ties 808 notes together, so the kick collides with a sustained tail rather than an onset. The collision check must look at *sounding* notes, not only note starts.
- **U** No NY-drill-specific source for tempo or arrangement was found.

**boom_bap**
- **V** 93 BPM example: eighth-note hats, snare on 2 and 4, swing through hat velocity 85 vs 100, smooth bass. Source: https://blog.native-instruments.com/what-is-boom-bap
- **V** MPC-3000 swing 57 (8ths) / 74 (16th hats). Kick lift around 60 Hz and dip around 150 Hz. Kick-snare forward. Source: https://www.attackmagazine.com/technique/beat-dissected/90s-boom-bap-hip-hop/
- **V** A bass guitar's low E at 41 Hz frees the bottom octave for the kick. For a deep bass tone, give the bass room at 40-80 Hz. Source: https://www.soundonsound.com/techniques/mixing-bass
- **I** Put the bass line in E1-E2 (MIDI 28-40) and sample chords above C3.

**lofi_hiphop**
- **V** 60-90 BPM. Drums get a gentle low-pass from 3.12 kHz and a 20 Hz HPF. Often no dedicated bass; if there is one, it plays the chord roots with a warm sub. Source: https://blog.native-instruments.com/lo-fi-hip-hop-beats
- **V** Vinyl, tape hiss, crackle, wow/flutter, and chopped jazz/soul samples. Source: https://blog.landr.com/how-to-make-lo-fi-hip-hop/
- **U** Mix-bus low-pass at 8-12 kHz (https://songer.co/blog/posts/the-lo-fi-sound-explained-how-to-build-chill-beats-from-the-ground-up) and drum low-pass around 2 kHz (Mode Audio, from a search extract).
- **I** Suppress `EMPTY_HIGH_BAND` for lo-fi. Warn on low-mid mud instead of air deficit.

**house / techno**
- **V** Off-beat bass notes sit between the kicks. Bass sidechained to the kick pulls down the notes that land on the kick. Source: https://www.attackmagazine.com/technique/tutorials/low-end-theory-exploring-eight-common-bassline-styles/
- **V** Rolling techno bass:
  - Leave the first 16th of each beat empty.
  - Sub layer low-passed at ~80 Hz.
  - Bassline around G2 with HPF ~65 Hz and LPF ~350 Hz.
  - Kick notched at the bassline's note, sidechained.
  - Source: https://www.attackmagazine.com/technique/tutorials/warehouse-rolling-techno-bass
- **V** Deep tech house 125-130 BPM (https://www.attackmagazine.com/technique/beat-dissected/deep-tech-house). Jazzy house 123 BPM (https://www.attackmagazine.com/technique/beat-dissected/jazzy-house). Dub techno 145 BPM, with ambient chords, percussion and bass all sidechained to the kick (https://www.attackmagazine.com/technique/beat-dissected/basic-channel-style-dub-techno).
- **I** The kick owns 40-100 Hz on each beat. The bass owns the off-beats. Pumping (duck ≥ 6 dB) is a genre-legitimate choice here and should not be flagged.

---

## Proposed music2 checks (consolidated)

Severity follows music2's existing lint `warning` model. "info" means advisory text in `fix`. Every threshold is **I** (policy) unless it repeats a V number in the Source column.

**Genre profile.** Profiles live on `RecipeCard.mixTargets` (new `bands` field). Bass Heavy = trap, drill_ny, drill_uk, house, techno. Warm = boom_bap, lofi_hiphop. Unknown genre uses the pop row.

| id | surface | rule | threshold | source |
|---|---|---|---|---|
| `LOW_END_DOMINANCE` (revise) | analyze | `sub+low` (also report `tiltDb`) above the genre ceiling | pop/unknown .64 (+2.5 dB); lofi .82; boom_bap .85; house .90; techno .93; trap/drill .94. Warn at the ceiling, error at +2 dB tilt | TrackScore house .84 / techno .89 (V); iZotope Bass Heavy family (V); Pestana centroids (V); Elowsson slope (V→I); music2 renders (§0) |
| `SUB_EXCESS` | analyze | `sub` share above the genre max | trap/drill .50; techno .40; house .35; boom_bap .25; lofi .20; pop .18 | TrackScore sub targets 22-45%, dubstep max 45% (V) |
| `SUB_TRANSLATION` | analyze | Sub dominates its own harmonics, so the 808 may vanish on small speakers | `sub/low > 1.2` → info (type-beat-trap = 1.96) | iZotope: a sine 808 is inaudible on many speakers; add 2nd/3rd harmonics (V) |
| `LOWMID_MUD` | analyze | `lowMid` share above the genre max | house/techno .10; trap/drill .10; boom_bap .20; lofi .30; pop .25. Warn at max, error at 1.5×max | TrackScore low-mid 3-7% (V); SOS 200-400 Hz cut (V); Production Expert 200-500 Hz (V) |
| `TOP_END_DEFICIT` (replaces `EMPTY_HIGH_BAND` except lofi) | analyze | `presence+air` below the genre min | trap/drill/house/techno .02; boom_bap .015; pop .04; lofi disabled | TrackScore 2-16 kHz ≈ 8% (V); Pestana louder >5 kHz for hip-hop/electronic (V) |
| `LOFI_AIR_EXCESS` | analyze | lofi `air` too high for a rolled-off aesthetic | air > .03 → info | NI lo-fi drum LPF 3.12 kHz (V) |
| `PRESENCE_HARSH` | analyze | `presence` above the genre max, excluding sections < 4 bars | > profile max + .05 | SOS 2-5 kHz harshness (V); TrackScore 6-16 kHz 2-4% (V) |
| `LOW_SIDE_ENERGY` | analyze | New M/S metric: side power < 120 Hz ÷ total power < 120 Hz | > 0.10 (-10 dB) warn | EDMProd mono < 120 Hz (V); iZotope side HPF 100 Hz (V) |
| `DUCK_DEPTH_MEASURED` | analyze (stems) | 40-120 Hz level of the ducked stem 0-30 ms after the kick onset vs 150-250 ms after | hip-hop < 2 dB → info "duck ineffective"; dance < 3 dB → warn | SOS 2-3 dB/hit (V); Attack ≤ 6 dB subtle (V) |
| `SECTION_LOUDNESS_FLAT` (keep) | analyze | Hook vs verse (dance: groove/hook vs breakdown) | unchanged | existing; direction supported by NI arrangement examples (V) |
| `generic/low_owner_overlap` | lint | 808 and bass (or two 808s) both have notes < MIDI 43 (G2, ~98 Hz) sounding at the same time | overlap > 1 beat per section → warn | SOS: one main low-end source, HPF others ~100 Hz (V) |
| `generic/kick_bass_collision` | lint | Share of `bd` onsets where an 808/bass note starts within ±30 ms or is still sounding, when that track has no `duck.by` = kick track | hip-hop > 50% → warn; house/techno > 25% → warn | iZotope shorten kick + duck (V); Attack empty first 16th / off-beat bass (V) |
| `generic/duck_depth` | lint | `duck.amount` → dB = -20·log10(1-a) | hip-hop: a > 0.5 (> 6 dB) → info "audible pump"; house/techno bass: a < 0.2 (< 2 dB) → info "ineffective" | Attack ≤ 6 dB before pumping (V); SOS 2-3 dB (V) |
| `generic/duck_release` | lint | Exponential recovery reaches ~95% at 3·releaseMs | dance: releaseMs > 20000/BPM (3τ > 1 beat) → warn; hip-hop: releaseMs > 30000/BPM (τ > 1/8 note) → info; outside 30-150 ms → info | EDMProd 50-150 ms (V); Waves 30 ms (V); Attack: follow kick decay and BPM (V) |
| `generic/sub_floor` | lint | 808/bass notes below MIDI 23 (B0, 30.9 Hz) → warn. Info if > 50% of 808 notes are below E1 (MIDI 28) | as stated | EDMProd lowest octave may not reproduce (V); TrackScore/Splice HPF bass 30-40 Hz (V) |
| `generic/kick_tuning` | lint | Kick settle frequency `48·(0.85+0.3·tone)·pitch` vs key root/5th in the 808/bass octave | > 50 cents from root or 5th → info | iZotope / Attack: tune the kick to the key (V); 50 cents is I |
| `generic/kick_decay_vs_808` | lint | `bd` `decayMs` when kick and 808 collide | decayMs > 250 with collision → info "shorten kick" | iZotope: short kick punch, 808 sustain (V); 250 ms is I (default 180) |
| `generic/low_pan` | lint | `abs(pan)` on bd, sd, cp, 808, bass | > 0.1 → warn (lead > 0.2 → info) | iZotope LCR: kick/bass/snare/vocal center (V) |
| `generic/low_send` | lint | `sends.reverb` or `sends.delay` > 0 on bd, 808, bass | > 0.05 → warn (music2 reverb has no return HPF and adds stereo) | SOS HPF returns "well above 100 Hz" (V); code read `fx.tool.ts` (V) |
| `generic/nonowner_low_notes` | lint | pad/keys/pluck/bell/lead notes below C3 (MIDI 48) while an 808/bass is active | > 10% of the track's notes → warn; any below C2 (MIDI 36) → warn. Skip when no 808/bass is active (lo-fi) | SOS HPF non-bass (V); vocal HPF 100 Hz (V); NI lo-fi keys cover low end (V) |
| `generic/low_interval_limit` | lint | For simultaneous notes in one track, and for chord track + sounding 808/bass root, every interval (mod octave, ≤ M10) whose lower note is below the limit | m2 < E3(52), M2 < Eb3(51), m3 < C3(48), M3 < Bb2(46), P4 < A2(45), TT < B1(35), P5 < Bb1(34), 6ths/7ths < F2(41) → warn | Sweetwater / Berklee / Hoffmann low-interval limits (V\*/V); octave conversion I |
| `generic/lowmid_stack` | lint | Count tracks whose sounding-note fundamentals are in MIDI 59-70 (250-500 Hz) at once | > 2 sustained tracks → info | TrackScore / SOS low-mid stacking (V) |
| `generic/band_owner_conflict` | lint | Per section, sustained (gate ≥ 0.5 or note ≥ 1/8) tracks whose fundamental is in the sub band (≤ MIDI 34) | > 1 → warn | Avid 808 owns 30-60 Hz (V); SOS one low source (V) |
| `generic/focal_layer_count` | lint | Melodic tracks (lead, bell, pluck, keys with onsets; pads excluded) with onsets in the same bar | > 3 for > 25% of section bars → warn | EDMProd ~3 focal elements (V) |
| `generic/same_register_unison` | lint | Two melodic tracks with median pitch within 12 semitones, ≥ 75% shared 16th-step onsets in a 2-bar window, pan distance < 0.25 | → info "octave-shift or call/response" | EDMProd call/response, octave contrast (V); iZotope masking (V) |
| `generic/side_support_width` | lint | ≥ 3 support tracks (hh, oh, perc, rim, pluck, bell, keys) all at abs(pan) < 0.1 | → info | iZotope panning and hi-hat separation (V) |
| `generic/vocal_pocket` | lint | Verse sections (useCase for vocals) where lead/bell/pluck sounds with fundamentals in MIDI 72-96 (523 Hz-2.1 kHz, harmonics into 1.5-5 kHz) in > 50% of bars | → info | iZotope vocal presence 1.5-5 kHz (V); SOS 2-5 kHz sensitivity (V) |
| `generic/level_order` | lint | Hip-hop static contribution (gain + 20·log10 mean velocity): kick, snare/clap, 808 in the top 3; hats ≥ 3 dB below snare | → info | NI drum bus above music bus (V); ordering numbers U |
| render: `reverb.returnHpf` | render | Add a fixed HPF on the reverb/delay return | 150 Hz, 12 dB/oct default | SOS returns "well above 100 Hz" (V); Sweetwater 50 Hz start (V); SOS recess to 500 Hz for bass reverb (V) |

**Suggested implementation shape (I).** Extend `RecipeMixTargets` in `src/recipes/recipe.schema.ts` with:

```
bands?: { subLowMax: number; subMax: number; lowMidMax: number; presAirMin: number | null; airMax?: number; presenceMax?: number }
duckProfile?: "subtle" | "pump"
```

Then have `warnings()` in `analyze.tool.ts` read the resolved song genre, falling back to the pop row for unknown or WAV-only input. Emit `observed`, `threshold` and `details.tiltDb` so agents see how far over the line they are. The "pump" profile is for house/techno.

---

## Open gaps
1. **No measured six-band percentiles exist publicly for trap, drill, boom-bap or lo-fi.** Only electronic genres (TrackScore) are published in this metric.
   - Next step: loudness-match 30-100 reference masters per genre and run music2's own `measureBands`.
   - Publish P10/P50/P90 per band for the full track and the loudest 30 s, then replace the I ranges above.
   - This matches iZotope's and BASSROOM's reference-driven approach (V).
2. The 808 vs kick level in dB, genre master LUFS, and lo-fi mix-bus LPF cutoff are U only.
3. The Sweetwater page itself could not be fetched directly (403). The table was read from a search extract and cross-checked against Berklee's flashcards (one octave shifted) and Hoffmann.
   - The P5 and M7 limits come from the standard chart (I).
4. `LOW_SIDE_ENERGY` and `DUCK_DEPTH_MEASURED` need new analysis code:
   - an M/S band split, and
   - per-stem envelopes (`render --stems` exists).
5. The pop reference row is a model: Elowsson's curve, extrapolated below 89 Hz. It is the least certain row.
6. Presence/air minimums are tuned to music2's synth voices. Recheck them if the drum voices change.

## Sources
Primary sources I fetched and confirmed in this pass:
- https://www.soundonsound.com/techniques/mixing-bass (Mike Senior)
- https://www.soundonsound.com/techniques/mix-mistakes (Mike Senior)
- https://www.soundonsound.com/techniques/gain-staging-your-daw-software
- https://trackscore.ai/blog/frequency-balance-electronic-music
- https://www.izotope.com/community/blog/how-to-mix-808s
- https://www.attackmagazine.com/technique/tutorials/warehouse-rolling-techno-bass
- https://blog.native-instruments.com/lo-fi-hip-hop-beats
- https://www.robin-hoffmann.com/dfsb/low-interval-limits/

Sources fetched by the research lanes (tags and details in `_notes/A-D`):
- iZotope:
  - https://www.izotope.com/community/blog/eq-cheat-sheet
  - https://www.izotope.com/community/blog/7-tips-for-mixing-the-low-end
  - https://www.izotope.com/community/blog/how-to-mix-kick-and-bass
  - https://www.izotope.com/community/blog/how-to-eq-vocals
  - https://www.izotope.com/community/blog/how-to-eq-bass
  - https://www.izotope.com/community/blog/6-ways-to-use-a-high-pass-filter-when-mixing
  - https://www.izotope.com/community/blog/what-is-midside-processing
  - https://www.izotope.com/community/blog/unmasking-your-mix-with-neutron
  - https://www.izotope.com/community/blog/why-izotope-created-the-tonal-balance-control-plug-in
  - https://www.izotope.com/en/learn/what-is-frequency-masking
  - https://www.izotope.com/en/learn/what-is-panning-in-music
  - https://downloads.izotope.com/docs/ozone8/tonal-balance-control/index.html
  - https://downloads.izotope.com/docs/ozone8/master-assistant/index.html
  - https://www.izotope.com/products/tonal-balance-control
- Attack Magazine:
  - https://www.attackmagazine.com/technique/tutorials/ten-production-tips-for-better-basslines/4/
  - https://www.attackmagazine.com/technique/tutorials/low-end-theory-exploring-eight-common-bassline-styles/
  - https://www.attackmagazine.com/technique/beat-dissected/uk-drill
  - https://www.attackmagazine.com/technique/beat-dissected/make-uk-drill-in-the-style-of-dutchavelli-or-m24/
  - https://www.attackmagazine.com/technique/beat-dissected/90s-boom-bap-hip-hop/
  - https://www.attackmagazine.com/technique/beat-dissected/basic-channel-style-dub-techno
  - https://www.attackmagazine.com/technique/beat-dissected/deep-tech-house
  - https://www.attackmagazine.com/technique/beat-dissected/jazzy-house
- EDMProd:
  - https://www.edmprod.com/sub-bass/
  - https://www.edmprod.com/synth-bass/
  - https://www.edmprod.com/mono-vs-stereo/
  - https://www.edmprod.com/sidechain-compression/
  - https://www.edmprod.com/production-pyramid/
  - https://www.edmprod.com/using-call-and-response/
- Waves / FabFilter:
  - https://www.waves.com/sidechain-compression-explained-fundamental-techniques
  - https://www.waves.com/how-to-mix-kick-bass-perfection
  - https://www.fabfilter.com/learn/compression/side-chain-compression
- Native Instruments / LANDR:
  - https://blog.native-instruments.com/what-is-boom-bap
  - https://blog.landr.com/lufs-loudness-metering/
  - https://blog.landr.com/how-to-make-lo-fi-hip-hop/
- Mastering The Mix:
  - https://www.masteringthemix.com/pages/bassroom-manual
  - https://www.masteringthemix.com/pages/mixing-with-levels
  - https://www.masteringthemix.com/pages/reference-2-manual
- Other vendors and tutorials:
  - https://www.sonible.com/smarteq4/
  - https://www.avid.com/resource-center/what-is-an-808
  - https://www.production-expert.com/production-expert-1/6-eq-mistakes-to-avoid-when-mixing
  - https://www.sweetwater.com/insync/effect-tip-use-a-high-pass-filter-before-reverb/
  - https://www.sweetwater.com/insync/low-interval-limit (V\*)
  - https://splice.com/blog/mixing-tips-tighter-bass/
  - https://www.musicradar.com/tuition/tech/9-ways-you-can-use-eq-to-slot-your-kick-and-bass-together-639143
  - https://www.musicradar.com/tuition/tech/4-ways-to-process-a-roland-tr-808-bass-drum-633187
  - https://mastering.com/high-pass-filter/
  - https://www.armadamusic.com/university/music-production-articles/how-to-mix-your-kick-and-bass-5-must-know-methods
  - https://hotgroovesamples.com/blogs/news/create-rolling-basslines-quickly
- Research:
  - Pestana et al. 2013: https://www.researchgate.net/publication/274511175_Spectral_characteristics_of_popular_commercial_recordings_1950-2010 ; https://aes.org/e-lib/browse.cfm?elib=17010
  - Elowsson & Friberg 2017: https://www.diva-portal.org/smash/get/diva2:1108529/FULLTEXT02.pdf
  - Bass-in-pop study: https://pure.au.dk/ws/files/209670369/Increased_levels_of_bass_in_popular_music_recordings.pdf
- Low-interval charts:
  - https://funnelljazz.eu/wp-content/uploads/2020/12/Low-Interval-Limits.pdf
  - https://quizlet.com/144457106/lower-interval-limits-berklee-flash-cards/ (search extract)

Unverified (U) sources, used only to mark gaps:
- https://www.reddit.com/r/trapproduction/comments/1afuyil/kick_808_loudness
- https://gearspace.com/threads/808db-in-mix.1147466/
- https://www.audeobox.com/learn/fl-studio/how-to-make-lofi-beats-in-fl-studio/
- https://songer.co/blog/posts/the-lo-fi-sound-explained-how-to-build-chill-beats-from-the-ground-up
- https://modeaudio.com/magazine/lofi-hip-hop-5-production-essentials
