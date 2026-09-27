# Key estimation on the drill render (wp4 B, 2026-09-28)

examples/drill-140.song.json is declared C minor. Chroma with a 40 Hz floor: full mix and the 808 solo were nearly identical
(C 31, G 27, D 13, A 12, D# 6 percent) and the estimate was C major; bell solo and pad solo each gave C minor. The driven 808's
harmonic series dominates the pitch-class profile. Raising the chroma floor: 100 Hz gives C minor (KK 0.74 vs G minor 0.73,
confidence 0.09, so KEY_UNCERTAIN is raised); 150 Hz gives D# major. Chosen floor: 100 Hz, plus 4th/5th-harmonic down-weighting.
Consequence for agents: the report shows declared and estimated key together, and a low confidence marks the estimate as advisory.
