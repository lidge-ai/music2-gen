# music2-gen: mids, levels, and genre rules

Research date: 2026-09-28. Tags: **V** = explicitly stated on fetched page; **I** = implementation inference; **U** = useful target still unverified here. Numeric values in a tutorial are examples, not universal mix law.

## Facts

### 4. Mids, presence, masking, panning

- **V** Frequency masking occurs when similar sounds play together or in the same general location; iZotope lists vocals with piano, vocals with pads, and synths with other synths as common collisions. Use complementary EQ: boost a needed band on the priority source and cut that band on the competing source. URL: https://www.izotope.com/en/learn/what-is-frequency-masking
- **V** iZotope’s arrangement example allocates kick to **20-60 Hz** and bass to **60-150 Hz** to reduce low-end collision. It advises prioritizing centered lead elements, drums and bass, and moving secondary/tertiary material sideways. URL: https://www.izotope.com/community/blog/unmasking-your-mix-with-neutron
- **V** An inverse-EQ example: a **+1 dB at 300 Hz** move on one source creates a **-1 dB** complementary move on the other; it also gives **4 kHz** synth-vs-drums as a collision example. URL: https://www.izotope.com/community/blog/unmasking-your-mix-with-neutron
- **V** General panning rule: low-frequency kick/bass nearer centre; higher keys/guitar more to the sides. In LCR, bass, kick, snare and vocal are traditionally centre, while keys/percussion/background voices can be hard L/R. URL: https://www.izotope.com/en/learn/what-is-panning-in-music
- **V** Kick and bass generally sit in the middle; moving hi-hat and a competing high-register part apart can reduce masking. URL: https://www.izotope.com/en/learn/what-is-frequency-masking
- **V** For a vocal pocket, EDMProd demonstrates vocal-triggered ducking on the instrument bus: **2:1**, **30 ms** attack, **250 ms** release, capped at **2-3 dB** gain reduction. URL: https://www.edmprod.com/sidechain-compression/
- **I** “Ear sensitivity peak 2-5 kHz” and a mandatory **1-4 kHz** vocal/lead pocket are not established as numeric rules by the fetched sources. Treat a spectral collision in that range as a priority warning, not a failure.

### 6. Gain staging, relative level, section energy

- **V** Sound On Sound recommends setting the highest-peak source to **-12 to -18 dBFS peak**; it would not expect channel peaks above **-8 to -10 dBFS**. It identifies kick or snare as commonly the highest track in rock/pop. URL: https://www.soundonsound.com/techniques/gain-staging-your-daw-software
- **V** The same source says typical interface nominal peak is broadly **-12 dBFS**, recommends roughly **-10 dBFS** between plug-in stages, and says true inter-sample peaks can exceed samples by **3 dB or more**. URL: https://www.soundonsound.com/techniques/gain-staging-your-daw-software
- **V** A concrete boom-bap tutorial balances drum bus at **-6.5 dB** and music at **-13.9 dB**, explicitly to retain headroom. This is a single arrangement example, not a genre target. URL: https://blog.native-instruments.com/what-is-boom-bap
- **V** LANDR defines integrated loudness as the whole-file LUFS measurement, short-term LUFS as a **3-second** measure, and momentary LUFS as **400 ms**. Its reported normalization points: Spotify desktop **-14 LUFS**, Spotify mobile **-11**, Apple about **-16**, YouTube/TIDAL/Amazon/Deezer about **-14**. URL: https://blog.landr.com/lufs-loudness-metering/
- **I** “Trap master -7 to -9 LUFS”, “lo-fi -12 to -14 LUFS”, “master headroom -6 dB”, fixed kick peak **-6 dBFS**, and hook **+1 to +3 LU** above verse were not verified in this source set. They may be configurable house-style presets, never hard genre conformance checks.
- **V** iZotope says adding more parts increases masking risk; arrangement should use only parts that serve the song. URL: https://www.izotope.com/community/blog/unmasking-your-mix-with-neutron
- **V** A spacious boom-bap example starts with keys + kickless hats/snares for **8 bars**, introduces kick and bass at bar **9**, removes keys for the next eight-bar verse variation, then changes samples/bass for chorus at bar **25**. URL: https://blog.native-instruments.com/what-is-boom-bap

### 7. Genre specifics

- **V** UK drill is characterized here by halftime melodies, sparse patterns and gliding 808s. The supplied hat treatment uses **64%** spread; a layered percussion part is **20L**. URL: https://www.attackmagazine.com/technique/beat-dissected/uk-drill
- **V** A second UK-drill recipe specifies **144 BPM**, **0% swing**, a subtle hat at **17L/-9 dB**, and slidey 808; its 808 example uses attack **130 ms**, decay **1 ms**, release **13.7 ms**, level **-7.43 dB**. These are tutorial settings, not universal drill constants. URL: https://www.attackmagazine.com/technique/beat-dissected/make-uk-drill-in-the-style-of-dutchavelli-or-m24/
- **V** Boom bap recipe: **93 BPM**; hats eighth notes, snare on beats 2/4, swing hat velocity **85** vs base hits **100**. It foregrounds snappy vintage drums, swing, jazzy influences and smooth bass. URL: https://blog.native-instruments.com/what-is-boom-bap
- **V** Another boom-bap example gives MPC-3000 8th swing **57**, 16th hat swing **74**, a kick lift around **60 Hz**, and a dip around **150 Hz**; it emphasizes kick-snare. URL: https://www.attackmagazine.com/technique/beat-dissected/90s-boom-bap-hip-hop/
- **V** Lo-fi hip-hop commonly uses vinyl/analogue/field-recording texture, chopped jazz/soul/R&B samples, hand-played percussion layered with a loop, active/groovy bass, and tape-like hiss/crackle/distortion/wow/flutter. URL: https://blog.landr.com/how-to-make-lo-fi-hip-hop/
- **U** Splice search result describes lo-fi range **60-90 BPM**, but fetched page did not expose that range. Low-pass **10-12 kHz** is likewise unverified here.
- **V** Techno/dub-techno example is **145 BPM**, 4-to-the-floor kick plus offbeat hat; its hat low end is cut and top boosted, and ambient chords/percussion/bass are sidechained to kick. Bass lows below about **37 Hz** are reduced. URL: https://www.attackmagazine.com/technique/beat-dissected/basic-channel-style-dub-techno
- **V** EDMProd’s kick-bass example uses sidechain **5:1**, **4 ms** attack, **60 ms** release; it identifies house-style 4/4 pumping and calls house/techno relevant to ghost sidechain. URL: https://www.edmprod.com/sidechain-compression/

## Proposed checks

All are warnings unless marked error. Numeric bounds below are product policy (**I**), derived from the facts rather than falsely presented as source requirements.

| id | surface | rule / threshold | rationale / source URL |
|---|---|---|---|
| core-center-pan | lint | bd, sd, 808, bass, lead pan must be 0 by default; warn when abs(pan) > **0.10**. Allow explicit pan-motion exception. | Centre priority/low sources, LCR practice. https://www.izotope.com/en/learn/what-is-panning-in-music |
| side-support-width | lint | Warn if all active hh, oh, rim, perc, keys, pluck, pad have abs(pan) < **0.10**; recommend one side support layer when >=3 exist. | Side placement reduces crowding. Same URL. |
| low-mono | analyze | Error if side energy share below **150 Hz** exceeds **15%**. | Low sources conventionally centre; cutoff is inference. |
| presence-collision | analyze | Warn if two active melodic stems each contribute >=**20%** of section energy in **1-4 kHz** and onset overlap >**50%**; escalate if one is lead. | Vocal/pad/synth collisions and 4 kHz example. https://www.izotope.com/en/learn/what-is-frequency-masking |
| lead-pad-competition | lint | Warn if lead plus pad/keys share register and are unmuted with pan distance <**0.25**, unless a duck/send annotation exists. | Arrangement/pan before EQ. https://www.izotope.com/community/blog/unmasking-your-mix-with-neutron |
| section-melodic-density | lint | Warn at >**4** simultaneous melodic voices; info at 4. Exclude bass/808. | Conservative masking-risk heuristic, not a cited producer count. |
| mix-input-headroom | analyze | Warn if any rendered stem peak >**-8 dBFS**; target highest peak **-12 to -18 dBFS** pre-master. | https://www.soundonsound.com/techniques/gain-staging-your-daw-software |
| pre-master-true-peak | analyze | Warning above **-3 dBTP** for mix render; error at >=**0 dBTP**. | SOS notes inter-sample peaks; -3 is policy headroom. |
| hook-energy | analyze | Info if hook short-term LUFS is not at least **+0.8 LU** versus preceding verse, when hook has no intentional-down flag. | Contrast is useful, but threshold is inference. |
| hook-layer-build | lint | Info if hook active-track count is below preceding verse. Exception minimalHook. | Energy/contrast policy, not universal law. |
| drill-profile | lint | For drill_uk: info outside **140-145 BPM**, warn if 808 has no glide and no pitch-slide notes; warn if hats have no 1/32-or-shorter roll/variation. | 144 BPM and gliding 808 / hat rolls. Attack drill URLs above. |
| boom-bap-profile | lint | Info outside **85-100 BPM**; warn if snare lacks beats 2/4 in >**80%** bars; info when no velocity/timing variation. | 93 BPM, 2/4 snare, swing/velocity facts. https://blog.native-instruments.com/what-is-boom-bap |
| lofi-profile | lint/analyze | Info if tempo outside **60-90 BPM** (U) or if air (8-20k) share >**18%**; do not require noise. | Range unverified; texture facts are V. |
| house-techno-kick-bass | lint | For house/techno, warn if bass/808 overlaps kick onset and duck is absent; require explicit opt-out for a non-4/4 kick. | Sidechain clears kick/bass; 4-to-floor techno. https://www.edmprod.com/sidechain-compression/ |
| house-techno-duck-audio | analyze | When kick+bass overlap, warn unless bass drops >=**2 dB** within **20 ms** after kick onset; info if recovery >**250 ms** at >=120 BPM. | Product thresholds; source gives 5:1/4 ms/60 ms example. https://www.edmprod.com/sidechain-compression/ |
| lofi-air-texture | analyze | Info, not failure, if lofi air share >**18%** or true-peak harshness is high; recommend optional filtering/saturation. | Lo-fi is deliberately degraded, not necessarily dark. https://blog.landr.com/how-to-make-lo-fi-hip-hop/ |

## Sources

Fetched and used: Sound On Sound gain staging; iZotope frequency masking, Neutron unmasking and panning; Attack UK Drill, Attack Dutchavelli/M24 drill, Attack 90s boom bap, Attack dub techno; Native Instruments boom bap; EDMProd sidechain compression; LANDR LUFS and lo-fi hip-hop; Splice lo-fi genre page. Exact URLs are attached to the claims above.

## Open gaps

1. No fetched primary/credible page supplied a defensible universal lead/vocal EQ pocket bandwidth, 2-5 kHz sensitivity curve, or fixed arrangement layer count.
2. No verified source here supports genre-specific final-master LUFS such as trap -7/-9 or lo-fi -12/-14. Keep streaming normalization targets separate from creative master targets.
3. Need further sources for NY-drill-specific tempo/arrangement, mainstream house **120-130 BPM**, general techno **125-140 BPM**, and lofi low-pass **10-12 kHz**.
4. music2-gen JSON has no EQ-band or stereo-width parameter. Presence/pocket rules therefore need rendered stem analysis or new metadata: register, rolePriority, duckTarget, panMotion.
