# Register slotting and low-mid notes for music2-gen

Scope: static rules that see tracks/notes/registers/onsets/pan/duck, plus rendered-audio checks. These are **defaults and warnings, not genre-independent mix laws**. Sources themselves repeatedly caution against one-size-fits-all EQ.

## Facts

| Tag | Claim (paraphrased) | Numeric value | URL |
|---|---|---:|---|
| V | Kick: punch/fundamental area is 60–80 Hz; 100–200 Hz adds knock; 200–500 Hz is boxiness; click/attack is 1–5 kHz. | 60–80, 100–200, 200–500, 1k–5k Hz | https://www.izotope.com/community/blog/eq-cheat-sheet |
| V | Bass fundamentals/body occupy 40–120/120–250 Hz; mud is 300–500 Hz; articulation/presence is 800 Hz–1 kHz. | 40–120, 120–250, 300–500, 800–1k Hz | https://www.izotope.com/community/blog/eq-cheat-sheet |
| V | An 808 normally belongs in sub-bass, especially 30–60 Hz; save sub for it and put layer texture in mids/highs. | 30–60 Hz, below 80 Hz | https://www.avid.com/resource-center/what-is-an-808 |
| V | Low end is 20–250 Hz; kick/bass commonly carry most energy at 20–160 Hz; low-mids are roughly 250–500 Hz. | 20–250, 20–160, 250–500 Hz | https://www.izotope.com/community/blog/7-tips-for-mixing-the-low-end |
| V | Snare body is 150–250 Hz; its 300–500 Hz area is boxy; attack/cut is 2–3.5 kHz; air begins at 8 kHz. | 150–250, 300–500, 2–3.5k, 8k+ Hz | https://www.izotope.com/community/blog/eq-cheat-sheet |
| V | Hi-hat harshness is commonly 3–7 kHz. Cymbal air is 8–12 kHz. | 3–7k; 8–12k Hz | https://www.izotope.com/community/blog/eq-cheat-sheet |
| V | Piano has possible mud at 200–500 Hz and possible harshness at 2–4 kHz; a gentle broad 200–500 Hz cut is a starting remedy. | 200–500; 2–4k Hz | https://www.izotope.com/community/blog/eq-cheat-sheet |
| V | Vocal low end that may be unnecessary varies below 100–250 Hz; intelligibility/presence spans 1.5–5 kHz; sibilance 5–8 kHz; air 10 kHz+. | <100–250; 1.5–5k; 5–8k; 10k+ Hz | https://www.izotope.com/community/blog/how-to-eq-vocals |
| V | Most signals encroach on 200–500 Hz, which can make a mix muffled/muddy; inspect kick and bass and use static or dynamic EQ only where needed. | 200–500 Hz | https://www.production-expert.com/production-expert-1/6-eq-mistakes-to-avoid-when-mixing |
| V | Removing around 300 Hz from bass can open room for piano/guitar; remove 20–30 Hz and below from bass-heavy sources to recover headroom when it is inaudible. | ~300; <20–30 Hz | https://www.izotope.com/community/blog/7-tips-for-mixing-the-low-end |
| V | Kick and 808/bass overlap produces masking/headroom problems; use the shorter kick to sidechain the sustained bass when their conflict occurs at the same time. | onset-dependent, not a fixed dB | https://www.izotope.com/community/blog/7-tips-for-mixing-the-low-end |
| V | A practical high-pass before reverb starts at 50 Hz then rises until mush disappears. | 50 Hz starting point | https://www.sweetwater.com/insync/effect-tip-use-a-high-pass-filter-before-reverb/ |
| V | Reverb/delay returns have possible mud below 500 Hz. | <500 Hz | https://www.izotope.com/community/blog/eq-cheat-sheet |
| V | Call-and-response is helped by contrasting pitch, intensity, or sound; one example lowers the response by one octave. | 1 octave | https://www.edmprod.com/using-call-and-response/ |
| V | Arrangement advice: the listener can focus on about three elements at once; if vocal is focal, remove distracting instruments. | 3 focal elements | https://www.edmprod.com/production-pyramid/ |
| V | Lower interval limits are guidance, not laws. Sweetwater’s published table puts lowest notes at: m2 E2, M2 Eb2, m3 C2, M3 B1, P4 A1, tritone B0, P5 C1, m6 F1, M6 F1, m7 F1, M7 F1. | pitches listed | https://www.sweetwater.com/insync/low-interval-limit/ |
| V | Modern-pop spectral “broad” regions in iZotope are bass <250 Hz, lower mids 250 Hz–2 kHz, upper mids 2–8 kHz, treble >8 kHz; it uses several-second averaging and warns transient sections may lie outside targets. | <250; 250–2k; 2–8k; >8k; >=5 s averaging | https://www.izotope.com/community/blog/why-izotope-created-the-tonal-balance-control-plug-in |
| I | With the CLI’s finer bands, assign default *owners*: sub 20–60 = 808 or kick; low 60–250 = kick/bass; lowMid 250–500 = one body source (usually keys/pad **or** bass/snare, not all); mid 500–2k = keys/pluck/lead; presence 2–8k = lead/vocal pocket/snare/hats; air 8–20k = hats/bell/reverb. “Owner” means highest permitted sustained share, not exclusivity. | six supplied bands | derived from the frequency facts above |
| I | “Keep close-voiced chords above C3” is a deliberately conservative implementation heuristic, **not** a directly sourced lower-interval limit. The interval table allows many intervals lower, depending on the exact interval/timbre. | C3 heuristic | derived from the Sweetwater table; see Open gaps |

## Proposed checks

| id | surface | rule | threshold | rationale / source |
|---|---|---|---|---|
| REG001_sub_owner | lint | In each section, permit at most one sustained `808`/`bass` voice below MIDI 36 (C2), unless the tracks have mutual ducking. Kick is exempt only for short onsets. | >1 sustained low voice, no duck | Prevents sub masking; 808 30–60 Hz and low-end overlap facts. https://www.avid.com/resource-center/what-is-an-808 |
| REG002_low_unison | lint | Flag kick and 808/bass note-on overlap when 808/bass sustains through a kick onset and no `duck` relation exists. | overlap >= 60 ms | Static proxy for the documented kick-vs-sustained-bass conflict; 60 ms is I, tune per genre. https://www.izotope.com/community/blog/7-tips-for-mixing-the-low-end |
| REG003_chord_floor | lint | For simultaneous notes in `keys`, `pad`, or `pluck`, flag close intervals at low register: m2/M2 whose lower note < MIDI 40 (E2/Eb2), m3 <36 (C2), M3 <35 (B1), P4 <33 (A1), P5 <24 (C1). | Sweetwater table pitches | Directly encodes published lower-interval-limit guidance. Warn only, never fail. https://www.sweetwater.com/insync/low-interval-limit/ |
| REG004_close_voicing_register | lint | Flag a pad/keys chord with >=3 notes and any adjacent interval <=M3 when its lowest note is below MIDI 48 (C3). | bottom < C3 | Conservative readability rule (I), designed to keep dense synth/piano body out of 200–500 Hz. |
| REG005_melodic_density | lint | Count simultaneous melodic voices (`bell, keys, pluck, pad, lead`) that have note activity in a rolling window; exempt a held pad at gain <= -12 dB relative to lead. | >3 active focal voices for >1 beat | Encodes “about three elements” attention guidance while allowing accompaniment. https://www.edmprod.com/production-pyramid/ |
| REG006_response_space | lint | If `lead` and `pluck/bell/keys` share the same register (median pitches within 7 semitones), warn when both have onsets in the same 1/8-note slots for most of a 2-bar phrase. | >=75% co-onset slots | Prefer call/response or octave contrast; 7 semitones/75% are I. https://www.edmprod.com/using-call-and-response/ |
| REG007_stereo_focal | lint | Flag two simultaneous focal tracks (lead and bell/pluck) panned within 0.15 of center and sharing a median register within one octave. | pan distance <0.15; <=12 semitones | Makes the “three focus” rule actionable; static masking proxy (I). |
| AN001_band_owner | analyze | Per section, calculate time-averaged band energy. Warn if non-owner tracks collectively dominate a designated band, or if two owner candidates are within 1.5 dB. | owner not top, or delta <1.5 dB | Turns frequency slotting into a check. Start from genre/template owners, not universal target shares. |
| AN002_lowmid_congestion | analyze | In 250–500 Hz, warn when section band share exceeds the matched reference/template by >3 dB, and identify tracks contributing most. | +3 dB vs reference | 200–500/250–500 is documented mud territory; +3 dB is a tunable I threshold. https://www.production-expert.com/production-expert-1/6-eq-mistakes-to-avoid-when-mixing |
| AN003_lowmid_kick_bass | analyze | During kick-onset frames, compare 250–500 Hz to adjacent non-kick frames; warn on persistent low-mid bloom from kick+bass. | >3 dB median increase | Kick boxiness and bass mud are 200/300–500 Hz; threshold is I. https://www.izotope.com/community/blog/eq-cheat-sheet |
| AN004_vocal_pocket | analyze | If a vocal/lead is declared focal, warn where accompaniment energy in 1.5–5 kHz exceeds focal energy over voiced/lead-active frames. | accompaniment > focal, >=50% active frames | Vocal intelligibility/presence range. `lead` is an instrumental proxy. https://www.izotope.com/community/blog/how-to-eq-vocals |
| AN005_reverb_lowcut | analyze | If isolated send/return stems exist, warn if reverb-return energy below 500 Hz is high relative to its 500 Hz–2 kHz energy. | low band within 6 dB of mid band | Effects-return mud guidance. A 50 Hz HPF is only a starting point, not a pass/fail cutoff. https://www.sweetwater.com/insync/effect-tip-use-a-high-pass-filter-before-reverb/ |
| AN006_tonal_reference | analyze | Use >=5-second averaged band analysis and compare each section against a user-selected genre/reference envelope, not a global band-share target. | >=5 s average | iZotope explicitly frames spectral targets as reference/genre-dependent. https://www.izotope.com/community/blog/why-izotope-created-the-tonal-balance-control-plug-in |

## Sources list

1. iZotope EQ Cheat Sheet: https://www.izotope.com/community/blog/eq-cheat-sheet
2. iZotope Low-End Mixing: https://www.izotope.com/community/blog/7-tips-for-mixing-the-low-end
3. iZotope Vocal EQ: https://www.izotope.com/community/blog/how-to-eq-vocals
4. iZotope Tonal Balance: https://www.izotope.com/community/blog/why-izotope-created-the-tonal-balance-control-plug-in
5. Avid 808 guide: https://www.avid.com/resource-center/what-is-an-808
6. Production Expert EQ mistakes: https://www.production-expert.com/production-expert-1/6-eq-mistakes-to-avoid-when-mixing
7. EDMProd call/response: https://www.edmprod.com/using-call-and-response/
8. EDMProd Production Pyramid: https://www.edmprod.com/production-pyramid/
9. Sweetwater reverb HPF: https://www.sweetwater.com/insync/effect-tip-use-a-high-pass-filter-before-reverb/
10. Sweetwater low interval limit (search located it; direct fetch was 403): https://www.sweetwater.com/insync/low-interval-limit/
11. Robin Hoffmann low interval discussion: https://www.robin-hoffmann.com/dfsb/low-interval-limits/
12. Sound On Sound frequency chart landing page: https://www.soundonsound.com/sound-advice/sos-audio-frequency-chart
13. Icon Collective 808 layering: https://www.iconcollective.edu/808-mixing-tips
14. Native Instruments synth-layer interview: https://blog.native-instruments.com/modestep/

## Open gaps

- No credible fetched source established a universal **maximum 3–4 melodic tracks**. The defensible direct source says the listener can focus on “about three elements”; therefore REG005 is a focal-attention warning, not a track-count law.
- No fetched orchestration textbook gave a source-backed “no thirds below C3/E3” rule. The exact Sweetwater lower-interval table is stronger and should be the primary static rule; C3 is intentionally labeled I.
- Static JSON cannot know sample timbre, EQ, saturation, octave harmonics, or reverb. Register lint should predict risk only; audio checks must adjudicate.
- No universal numeric band-share percentages are defensible across trap, EDM, lo-fi, orchestral, or sections such as breakdowns. Build template/reference envelopes from approved renders; use relative deltas rather than absolute shares.
- The requested `cp`, `rim`, `perc`, `tom`, `bell`, `pluck`, `pad`, and `lead` role ranges need additional role-specific source capture if they must become hard lint thresholds.
