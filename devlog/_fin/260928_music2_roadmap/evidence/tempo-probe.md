# Tempo probe on the PoC drill render (2026-09-28)

Script: spectral flux (2048 Hann / hop 441, log1p(100|X|), 40-10000 Hz), 1 s running-mean detrend, normalized
autocorrelation 50-220 BPM in 0.5 BPM steps, Ellis log-Gaussian weight (tau0 0.5 s, sigma 1.4 octaves).
Input: evidence/poc-render.mjs output (8 bars, 140 BPM, 16-bit stereo, no mastering).

| BPM | raw r | weighted |
|---|---|---|
| 70 | 0.580 | 0.497 |
| 140 | 0.467 | 0.461 |
| 93.33 | 0.380 | 0.368 |
| 105 | 0.032 | 0.032 |

Top weighted: 70 (0.497), 139.5 (0.470), 140 (0.461). Plain weighted autocorrelation picks the half-time
tempo, so 030 adds the hat-subdivision grid score and the 0.85 octave rule (ratio here 0.93 → 140).

## Re-run on the music2 drill render (wp4 P, commit 9477c2f)

Input: examples/drill-140.song.json rendered by music2 (16 bars, 808 level 0.45, snare -3 dB, hats -9 dB).
Top weighted: 140 (0.745), 139.5 (0.742), 140.5 (0.732), 139 (0.721), 70 (0.705). Raw r: 70 0.822, 140 0.754.
Plain weighted autocorrelation already picks 140 here; the guarded octave rule remains as a safety net for sparser mixes.

## Knife-edge found in wp5 (texture threshold)

Lowering every drill track by 4 dB (to clear the static clipping-risk lint) flipped the estimate from 139.83 to 69.95. Autocorrelation
still ranked 140 first (0.741 vs 0.679); the half-time demotion rule fired because the hat grid occupancy at 70 BPM read 0.597 (<= 0.6)
with the texture peak floor at 0.3 of the hat-band maximum, which saw only 89 of 188 hat onsets. With a 0.12 floor all hats count and the
estimate is 139.8 for gain offsets -4, 0, +4, +8 dB; the 75 BPM loud-eighth-hat counterexample still stays at 75. tempo.test.ts now
renders the drill at -4 and +4 dB to guard this.
