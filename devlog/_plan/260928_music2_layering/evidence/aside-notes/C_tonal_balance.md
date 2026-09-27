# C. Genre tonal-balance targets

Scope: `music2-gen` measures **linear-power share** in six fixed bands: sub 20–60, low 60–250, lowMid 250–500, mid 500–2k, presence 2–8k, air 8–20k Hz. A share is not perceived loudness and cannot be copied from a dB spectrum plot without specifying integration, weighting, channel sum, analysis window, and normalization. `V` = fetched page explicitly states it; `I` = inference/proposed conversion; `U` = located but not directly verified here.

## Facts

- **iZotope’s original Tonal Balance Control broad bands are Low 20–250 Hz, Low-mid 250 Hz–2 kHz, Mid 2–8 kHz, High-mid 8–20 kHz; its blue areas are “typical spectral variation,” not one exact target.** `V` Numbers: 20, 250, 2k, 8k, 20k Hz. URL: https://downloads.izotope.com/docs/ozone8/tonal-balance-control/index.html
- **That version ships Orchestral, Bass Heavy, and Modern curves; its documentation says curves came from numerous genre/style tracks.** `V` Numbers: 3 factory curves. URL: https://downloads.izotope.com/docs/ozone8/tonal-balance-control/index.html
- **Ozone 8 Master Assistant grouped files into 10 genre classes, but reports that most curves fall into three broad classes: Bass Heavy (EDM, Hip/Hop), Orchestral, Modern (Pop/Rock).** `V` Numbers: 10 then 3. URL: https://downloads.izotope.com/docs/ozone8/master-assistant/index.html
- **Current Tonal Balance Control 3 advertises 30+ genre targets and custom references.** `V` Numbers: 30+. URL: https://www.izotope.com/products/tonal-balance-control
- **Mastering The Mix BASSROOM analyzes references and supplies genre presets; it uses five static low bands: 0–20, 20–40, 40–80, 80–160, 160–320 Hz.** `V` Numbers: five bands/cutoffs. URL: https://www.masteringthemix.com/pages/bassroom-manual
- **BASSROOM supports up to 20 imported references and recommends selecting a drop/chorus for bass-target creation.** `V` Numbers: 20 tracks. URL: https://www.masteringthemix.com/pages/bassroom-manual
- **LEVELS’ Bass Space examines 40, 80, 120, 160 Hz on a stem master and deliberately excludes the kick/bass stems when looking for unwanted bass.** `V` Numbers: 4 points. URL: https://www.masteringthemix.com/pages/mixing-with-levels
- **LEVELS publishes average loudness range, not tonal shares: Hip Hop 4.0 LU, House 5.3 LU, Pop 6.4 LU, EDM 5.9 LU.** `V` Numbers as stated. URL: https://www.masteringthemix.com/pages/mixing-with-levels
- **REFERENCE warns that louder playback appears to have fuller bass and clearer highs, and offers level matching including -14 LUFS short-term.** `V` Number: -14 LUFS ST. URL: https://www.masteringthemix.com/pages/reference-2-manual
- **sonible smart:EQ 4 has genre-based whole-mix profiles and can learn a custom profile from a reference. Public page does not publish the curves or numeric profiles.** `V` / numeric target unavailable. URL: https://www.sonible.com/smarteq4/
- **Pestana et al. (AES 135, 2013) measured average spectra by genre. Their log-log spectral-slope descriptor from 100 Hz–10 kHz is Pop -0.9433, Electronic -0.7461, Hip-hop -0.8141, Rock -0.9793, Jazz -1.2929, Folk -1.1824.** `V` Numbers from paper table; descriptor is not automatically dB/oct. URL: https://www.researchgate.net/publication/274511175_Spectral_characteristics_of_popular_commercial_recordings_1950-2010
- **Same table gives spectral centroids: Pop 868 Hz, Electronic 845, Hip-hop 662, Rock 858, Jazz 785, Folk 603. The paper’s genre plot/comment says electronica and hip-hop have unmistakably extended low end.** `V` Numbers as stated. URL: https://www.researchgate.net/publication/274511175_Spectral_characteristics_of_popular_commercial_recordings_1950-2010
- **Elowsson & Friberg (AES 142, 2017) report a mean popular-music LTAS slope of 4.53 dB/oct between about 89 Hz and 4.5 kHz, the range with minimum cross-group slope variance; their fitted slope steepens with frequency.** `V` Numbers: 4.53 dB/oct, 89 Hz–4.5 kHz. URL: https://www.diva-portal.org/smash/get/diva2:1108529/FULLTEXT02.pdf
- **Their table reports local mean-LTAS slopes approximately -2.350, -3.668, -4.985, -6.303, -7.621, -8.938 dB/oct at 200, 400, 800 Hz, 1.6, 3.2, 6.4 kHz.** `V` Numbers as table; sign convention is descending energy with rising frequency. URL: https://www.diva-portal.org/smash/get/diva2:1108529/FULLTEXT02.pdf
- **The same paper summarizes Pestana: hip-hop/rock/pop/electronic have louder lows to 150 Hz and louder highs from 5 kHz than jazz/folk. It does not give a hip-hop-vs-pop dB difference.** `V` Numbers: 150 Hz, 5 kHz. URL: https://www.diva-portal.org/smash/get/diva2:1108529/FULLTEXT02.pdf
- **A 2021 study of Billboard year-end material says tracks with the highest bass fluctuation cluster in electronic/dance, hip-hop/rap and R&B.** `V` No universal share or dB offset reported in fetched extract. URL: https://pure.au.dk/ws/files/209670369/Increased_levels_of_bass_in_popular_music_recordings.pdf
- **TrackScore’s public linear-power metric maps its electronic general profile to sub 27%, bass 54%, low-mid 6%, mid 5%, upper-mid 4%, high 4%, air 0%. Its bands differ above 2 kHz (2–6, 6–16, 16–20).** `V` Numbers: 27/54/6/5/4/4/0%. URL: https://trackscore.ai/blog/frequency-balance-electronic-music
- **TrackScore claims combined 20–250 Hz targets: Deep/Tech/Melodic House 84%; Peak-Time/Minimal Techno 89%; Funky/Disco House 79%; Trance 84%; DnB 81%; Bass Music/Dubstep 76%.** `V` Numbers as stated; vendor methodology/data set not published, so use as a provisional external benchmark. URL: https://trackscore.ai/blog/frequency-balance-electronic-music
- **TrackScore says low-mid targets range 3–7% and high (6–16 kHz) targets 2–4% across its electronic genres.** `V` Numbers as stated. URL: https://trackscore.ai/blog/frequency-balance-electronic-music

## Genre table

Recommended implementation position: do **not** call a 20–250 Hz share over 0.55 intrinsically wrong. The table is a conservative bootstrap prior, not a claim of published commercial medians. Ranges are `I` except rows/cells explicitly marked `V`; calibrate on a level-matched, genre-labeled reference corpus before shipping as normative targets.

| genre | sub | low | lowMid | mid | presence | air | evidence / tag |
|---|---:|---:|---:|---:|---:|---:|---|
| drill_uk | 22–34 | 32–43 | 7–12 | 7–13 | 4–8 | 1–4 | Bass-Heavy hip-hop family `I`; no drill-specific LTAS found `U` |
| drill_ny | 24–37 | 30–42 | 7–12 | 7–13 | 4–8 | 1–4 | contemporary 808-forward hip-hop prior `I`; no measured drill split `U` |
| trap | 24–38 | 30–42 | 7–12 | 7–13 | 4–8 | 1–4 | hip-hop has extended low end `V`; allocation `I` |
| boom_bap | 12–24 | 34–46 | 9–15 | 10–16 | 5–10 | 2–5 | hip-hop family `V`; less sub / more sampled midrange is `I` |
| lofi_hiphop | 10–22 | 30–43 | 12–20 | 12–20 | 3–7 | 0.5–3 | warm/rolled-off aesthetic prior `I`; no numeric LTAS found `U` |
| house | 22–32 | 47–62 | 4–8 | 4–8 | 3–7 | 1–4 | total 20–250 = 84% for deep/tech/melodic house `V`; six-band allocation `I` |
| techno | 25–36 | 49–60 | 3–7 | 3–7 | 3–7 | 1–4 | total 20–250 = 89% peak/minimal techno `V`; allocation `I` |
| pop (reference) | 10–22 | 28–42 | 10–17 | 12–20 | 7–13 | 3–7 | “Modern” family `V`; share range `I` |

**Conversion note (`I`):** published 4.53 dB/oct describes an LTAS shape, not shares. To turn a slope into a checkable baseline: use PSD power `P(f)=C*f^(-4.53/3.0103)` (because one octave doubles frequency), integrate `P(f)` over each CLI band, normalize the six integrals to 100%, then widen the result heavily for genre and arrangement. Do not use a 0 dB/oct “pink noise” display tilt as a music target: pink noise is 3 dB/oct in power, while the measured commercial mean is about 4.53 dB/oct over 89 Hz–4.5 kHz `V`.

## Proposed checks

1. **Replace global `LOW_END_DOMINANCE > .55`.** Use `lowEnd = sub+low`; warn only after a genre target and tolerance. Bootstrap **warn thresholds**: drill_uk .78, drill_ny .80, trap .80, boom_bap .72, lofi .70, house .90, techno .93, pop .64. All `I`; house/techno thresholds deliberately sit above TrackScore’s 84%/89% targets to avoid flagging target-adjacent tracks.
2. **Make severity relative, not binary.** `info` at target upper edge; `warn` at +5 percentage points; `error` at +10 pp, plus a separate `SUB_EXCESS` if sub exceeds genre upper edge by 6 pp. Report both sub and low: 20–60 Hz 808/rumble is not the same failure as 60–250 Hz boom.
3. **`LOWMID_MUD`:** warn when lowMid exceeds table upper bound by 4 pp (or is >12% for house/techno). TrackScore’s published electronic low-mid envelope is 3–7% `V`; keep its numeric threshold as a soft warning, not truth for hip-hop.
4. **`AIR_DEFICIT`:** for trap/drill/boom_bap/house/techno/pop, warn below air 1% **only when presence is also below range**; this avoids punishing legitimate bandwidth limits. For lofi, no deficit warning below 3%; instead `LOFI_AIR_EXCESS` if air >5% `I`.
5. **`PRESENCE_HARSHNESS`:** warn when presence > genre upper +5 pp, but exempt short transient-heavy sections; analyze integrated track and loudest 30–60 s separately. Ozone recommends a spectral target at the end of master processing; Master Assistant needs about 30 s and recommends loudest section `V`.
6. **Add reference mode before genre mode.** Median band shares from 10–20 level-matched references in the same subgenre/era, then use median ± robust spread. This is more defensible than treating labels such as “trap” as acoustically homogeneous; both iZotope and BASSROOM support custom/reference-derived targets `V`.
7. **Implementation guardrails:** disclose metric as unweighted linear spectral energy; specify FFT/window/channel policy; ignore <20 Hz; normalize to 20 Hz–20 kHz total; calculate after loudness normalization or use ratios only. Emit “provisional genre prior” until reference corpus is installed.

## Sources

Fetched and used: iZotope TBC manual (https://downloads.izotope.com/docs/ozone8/tonal-balance-control/index.html); iZotope Master Assistant manual (https://downloads.izotope.com/docs/ozone8/master-assistant/index.html); iZotope TBC3 product page (https://www.izotope.com/products/tonal-balance-control); Mastering The Mix BASSROOM manual (https://www.masteringthemix.com/pages/bassroom-manual); REFERENCE manual (https://www.masteringthemix.com/pages/reference-2-manual); LEVELS manual (https://www.masteringthemix.com/pages/mixing-with-levels); sonible smart:EQ4 (https://www.sonible.com/smarteq4/); AES landing page for Pestana et al. (https://aes.org/e-lib/browse.cfm?elib=17010); publisher record (https://ciencia.ucp.pt/en/publications/spectral-characteristics-of-popular-commercial-recordings-1950-20); Pestana full-text host (https://www.researchgate.net/publication/274511175_Spectral_characteristics_of_popular_commercial_recordings_1950-2010); Elowsson & Friberg PDF (https://www.diva-portal.org/smash/get/diva2:1108529/FULLTEXT02.pdf); bass-in-popular-music PDF (https://pure.au.dk/ws/files/209670369/Increased_levels_of_bass_in_popular_music_recordings.pdf); TrackScore electronic profile (https://trackscore.ai/blog/frequency-balance-electronic-music); MusicTech TBC2 report (https://www.musictech.com/news/gear/izotope-release-tonal-balance-control-2/); Mastering The Mix BASSROOM product page (https://www.masteringthemix.com/products/bassroom); AudioScienceReview discussion, secondary only (https://www.audiosciencereview.com/forum/index.php?threads/why-there-is-a-difference-in-frequency-shape-bass-lows-between-music-genres.64575/). Additional fetched pages that yielded no usable numeric curve: Sonarworks URL returned 503; Gullfoss page had no extractable specification; two legacy iZotope/SOS links returned 404/410.

## Open gaps

- No fetched peer-reviewed dataset provided **six-band linear-energy percentiles** for drill_uk, drill_ny, trap, boom_bap, or lofi_hiphop. Do not present the bootstrap numbers as measurements.
- Pestana’s published table provides descriptors and a graph, but not band-integrated dB/share values nor drill-era subgenres. Digitizing its plotted curves would still not replace a current corpus.
- Vendor targets are useful design evidence but proprietary: iZotope/BASSROOM/sonible do not publish target arrays or reference-track lists.
- Required next research/data step: collect 30–100 mastered tracks per requested genre, loudness-match, run the exact `music2-gen` analyzer, publish median/P10/P90 per band and per-section (full track, hook/drop), then revise thresholds from quantiles.
