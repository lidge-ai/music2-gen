# E. Parent verification + calibration (2026-09-28)

## Re-verified by direct fetch (parent)
- SOS "Mixing Bass" (Mike Senior) https://www.soundonsound.com/techniques/mixing-bass
  - with >1 bass part choose one main low-end source, HPF others ~100 Hz (V)
  - kick vs bass is "most critical sub-100Hz conflict"; they carry most of mix-bus level (V)
  - bass guitar low E 41 Hz frees bottom octave for kick; kick 60-70 Hz region trade-off (V)
  - bass "warmth" battleground below ~300 Hz; 200-400 Hz compensatory cut (V)
  - kick->bass ducking: rarely more than ~2-3 dB per hit before bass sounds odd (V)
  - bass reverb: roll out sub-100 and recess up to ~500 Hz (V)
  - 1 kHz zone for bass audibility on small speakers; 3-6 kHz presence/harshness band (V)
  - 20-30 Hz HPF for safety with shelving boost (V)
- SOS "Mix Mistakes" (Mike Senior) https://www.soundonsound.com/techniques/mix-mistakes
  - HPF anything that doesn't need low end musically (V)
  - HPF most effect returns "well above 100Hz" in pop/rock/electronica (V)
  - 2-5 kHz: hearing most sensitive; piling it on everything -> harsh (V)
  - >3-4 EQ bands / >3-4 dB per band / Q>1 suggests reassessment (V)
- NI lo-fi https://blog.native-instruments.com/lo-fi-hip-hop-beats
  - 60-90 BPM; drum LPF gentle from 3.12 kHz; HPF 20 Hz; many lo-fi tracks no dedicated bass; keys+kick cover low end (V)
- Attack rolling techno bass https://www.attackmagazine.com/technique/tutorials/warehouse-rolling-techno-bass
  - three strata: sub layer LPF ~80 Hz; bassline G2 (98 Hz) HPF ~65 Hz / LPF ~350 Hz; kick scooped -4.5 dB at 98 Hz; first 16th of each beat left empty for kick; sidechain (V)
- TrackScore https://trackscore.ai/blog/frequency-balance-electronic-music
  - bands 20-60/60-250/250-500/500-2k identical to music2's first four; linear power % (V)
  - general electronic 27/54/6/5/4(2-6k)/4(6-16k)/0(16-20k) (V)
  - sub+bass: deep/tech house 84, funky/disco house 79, peak-time/minimal techno 89, DnB 81, dubstep 76, trance 84 (V)
  - sub targets 22% (funky house) to 45% (dubstep); low-mid 3-7%; high 6-16k 2-4% (V)
  - HPF bass synths 30-40 Hz, kick 25-30 Hz; only dedicated sub below 60 Hz (V)
- iZotope 808 https://www.izotope.com/community/blog/how-to-mix-808s
  - TR-808 bass drum ~50 Hz sine; shorten kick decay to avoid masking 808 tail; dynamic EQ notch at kick fundamental (62 Hz example) keyed from kick; ~6 dB headroom; 808 at -3..0 on K-20 (i.e. ~-23..-20 dBFS RMS) (V)
- Sweetwater low interval limit table (search excerpt of page; direct fetch 403) -> U-/V-snippet. Berklee-style table (Quizlet excerpt) is ONE OCTAVE HIGHER in note-naming: m2 E3-F3, M2 Eb3-F3, m3 C3-Eb3, M3 Bb2-D3. Sweetwater names middle C "C3" (so its E2 = scientific E3). => Use scientific-pitch (C4=middle C, MIDI 60) values: m2 lower note >= E3 (52), M2 >= Eb3 (51), m3 >= C3 (48), M3 >= Bb2/B2 (46-47), P4 >= A2/Bb2 (45-46), tritone >= B2 (47), P5 >= Bb1/C2 (34-36), m6/M6 >= F2 (41), m7 >= F2 (41), M7 >= F2 (41). Sub-agent A mapped Sweetwater names to MIDI without the octave shift -> corrected here.
- music2 pitch naming: values.tool.ts `(octave+1)*12 + pc` => c4 = 60 (scientific). So "c3" in song JSON = MIDI 48 = 130.8 Hz.

## Not verified (keep U)
- 808 vs kick relative level in dB: only Reddit/Gearspace anecdotes (808 ~0 to -5 dB vs kick). U.
- Genre master LUFS (trap -7..-9, lofi -12..-14): only third-party blogs (audeobox: lofi -12..-14). U.
- Lofi mix-bus LPF 8-12 kHz (songer.co blog) U; NI 3.12 kHz on drums V; Mode Audio drum LPF ~2 kHz, bass LPF <=150 Hz (search excerpt) U.

## Calibration: music2 renders of repo examples (commit 1da22d7, parent ran `music2 analyze examples/*.song.json`)
| example | LUFS | sub | low | lowMid | mid | pres | air | sub+low | warnings |
|---|---|---|---|---|---|---|---|---|---|
| drill-140 | -15.9 | .362 | .540 | .019 | .049 | .024 | .006 | .902 | LOW_END_DOMINANCE |
| drill-uk-moving-snare-144 | -15.0 | .313 | .621 | .007 | .015 | .017 | .027 | .934 | LOW_END_DOMINANCE |
| trap-150 | -14.6 | .476 | .479 | .023 | .013 | .004 | .005 | .955 | LOW_END_DOMINANCE |
| type-beat-trap-140 | -13.4 | .638 | .326 | .004 | .002 | .008 | .021 | .964 | LOW_END_DOMINANCE |
| house-124 | -14.6 | .124 | .618 | .142 | .095 | .011 | .011 | .742 | LOW_END_DOMINANCE |
| boom-bap-90 | -14.7 | .061 | .371 | .534 | .028 | .002 | .003 | .432 | - |
| lofi-75 | -14.3 | .000 | .382 | .603 | .015 | .000 | .000 | .382 | EMPTY_HIGH_BAND |
Observations: (1) every 808 genre example trips .55; (2) boom-bap and lofi are lowMid-DOMINANT (.53/.60) — the opposite failure (mud) is currently unwarned; (3) presence+air are <5% in every example, i.e. drums/hats are dark in this synth; (4) house has sub only .124 (kick/bass mostly in 60-250).

## Slope -> share model (parent, I)
Power-law PSD with slope s dB/oct integrated over music2 bands (no HPF):
- 3.0 (pink): sub .157 low .205 lowMid .100 mid .201 pres .202 air .134 (sub+low .36)
- 4.5: sub .434 low .304 lowMid .086 mid .104 pres .053 air .019 (sub+low .74)
- 5.0: .522/.299/.070/.072/.029/.009 (.82)
Elowsson curved mean LTAS (slope -2.35 dB/oct at 200 Hz, steepening 1.318 dB/oct per octave), 30 Hz HPF: sub .081 low .363 lowMid .221 mid .274 pres .058 air .004 (sub+low .44); same curve tilted 1 dB/oct darker: sub+low .60. => A mean pop LTAS already lands ~0.44 sub+low in music2's metric; ~1 dB/oct extra bass tilt (typical hip-hop/EDM "bass heavy") pushes it to ~0.6, and 808-driven material sits 0.75-0.95. The .55 threshold is roughly "pop mean + a bit", which is why it fires on all hip-hop.
