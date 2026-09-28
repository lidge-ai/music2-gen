# 020 — Twelve pitched voices, synthetic drum kits, and lint roles (wp3)

**Summary.** Add twelve named notes voices as deterministic synthesized approximations, four new drum-kit characters behind an integer selector, and deliberate lint classification. The existing `keys`, `bell`, and omitted/zero `drums.kit` paths remain byte-identical. Binding authority: `devlog/_plan/260928_music2_sfx_instruments/evidence/main-decisions.md:9-12,14`; synthesis evidence: `devlog/_plan/260928_music2_sfx_instruments/evidence/sol-synthesis-methods.md:54-76`.

**Depends on:** 010 voice registry/sample-name contract, pre-change legacy receipts, Song v1 numeric params (`src/song/song.schema.ts:21-28,35-42,78-88`), voice kind/param registry (`src/render/voices/registry.tool.ts:16-70`).

**Consumed by:** 030 songs/docs/skill examples and final release gate; `skills/music2/references/instruments.md` cards for the twelve public IDs, selectors, and `drums.kit`.

## Scope

**IN:** piano, epiano, strings, brass, organ, marimba, vibraphone, glockenspiel, kalimba, guitar, flute, choir; `drums.kit` 0..4; register-collision additions; SFX exclusion from rhythm-role discovery; individual acoustic/PCM oracles. **OUT:** real samples or circuit emulation claims, replacement of existing `keys`/`bell`/`808`, named string selectors, changes to genre balance thresholds, a new lint ID, new runtime dependencies. Approximation and I parameter status come from `devlog/_plan/260928_music2_sfx_instruments/evidence/sol-synthesis-methods.md:3-5,54-69`.

## File map

Every `NEW *.tool.ts` row has an immediately following colocated `.test.ts` row. Keep flat paths unless the existing structure audit permits and readability requires the proposed `keys/`, `orchestral/`, `mallets/`, `strings/`, `winds/` grouping; update direct registry imports if moved (`devlog/_plan/260928_music2_sfx_instruments/evidence/architect-proposal.md:19`; `AGENTS.md:12-20`).

| Path | Op | Exact content |
| --- | --- | --- |
| `src/render/voices/piano.tool.ts` | NEW | Partial-bank stiff-string strike with velocity-dependent brightness, hammer noise, bounded damped note-off; numeric spec in §1. |
| `src/render/voices/piano.test.ts` | NEW | FFT partials match `n*f0*sqrt(1+B*n²)` within one bin, upper partials decay faster, velocity 0.9 brightens >3 kHz relative to 0.3, release reaches −60 dB within bound. |
| `src/render/voices/epiano.tool.ts` | NEW | Two-branch body/tine FM, independently decaying indices and key-off; existing `keys` untouched. |
| `src/render/voices/epiano.test.ts` | NEW | Zero FM indices give sine, nonzero indices add attack sidebands, >3-kHz energy falls by 0.5 s, note-off continuous then decays. |
| `src/render/voices/strings.tool.ts` | NEW | Detuned band-limited saw ensemble, slow ADSR, velocity-controlled LP, delayed-copy chorus with exact dry bypass. |
| `src/render/voices/strings.test.ts` | NEW | First-20-ms RMS below 0.3-s RMS, detuned beats visible, dry bypass exact when chorus off, no high-pitch aliases. |
| `src/render/voices/brass.tool.ts` | NEW | Band-limited saw, envelope-controlled resonant LP, small initial pitch scoop, velocity brightness. |
| `src/render/voices/brass.test.ts` | NEW | First-10-ms frequency below stable f0, high/low ratio rises over attack, v=.9 brighter than v=.3, finite at Q maximum. |
| `src/render/voices/organ.tool.ts` | NEW | Nine Hammond-footage sine ratios and independent integer drawbar levels, short key click, constant nonpercussion sustain. |
| `src/render/voices/organ.test.ts` | NEW | Each enabled drawbar produces predicted line; setting one to zero removes its line; sustained RMS stable, click confined to first 5 ms. |
| `src/render/voices/marimba.tool.ts` | NEW | Modal bar bank ratios 1:3.9:9.23, fast upper-mode decay and short strike. |
| `src/render/voices/marimba.test.ts` | NEW | FFT ratios within one bin; second mode decays faster than fundamental; 1-s tail below vibraphone at same pitch/velocity. |
| `src/render/voices/vibraphone.tool.ts` | NEW | Modal bank 1:4:~10 with longer T60 and optional 2–7 Hz resonator AM. |
| `src/render/voices/vibraphone.test.ts` | NEW | Long tail exceeds marimba; mode-2 line near 4f0; AM sidebands at configured rate and off-mode dry tone exact. |
| `src/render/voices/glockenspiel.tool.ts` | NEW | Bright inharmonic modal bank ratios 1:2.71:5.15 with long high-mode decay. |
| `src/render/voices/glockenspiel.test.ts` | NEW | Peaks near measured ratios without Nyquist fold; upper modes decay within T60; finite and ≤1 across top playable MIDI. |
| `src/render/voices/kalimba.tool.ts` | NEW | Tine bank fundamental plus adjustable measured overtone 5.9..6.8; no unsupported fixed third mode. |
| `src/render/voices/kalimba.test.ts` | NEW | Dominant overtone stays inside 5.9..6.8f0; no persistent third peak; upper mode decays faster than fundamental. |
| `src/render/voices/guitar.tool.ts` | NEW | Seeded Karplus–Strong pluck with fractional-delay tuning, pick comb, nylon/steel `type` integer branch. |
| `src/render/voices/guitar.test.ts` | NEW | E2/E4 fundamentals within 1% at 44.1/48 kHz; loop energy never rises; steel has more >4-kHz attack and longer tail than nylon; note-off damps. |
| `src/render/voices/flute.tool.ts` | NEW | Near-sine core, weak second harmonic, onset breath/chiff, delayed vibrato. |
| `src/render/voices/flute.test.ts` | NEW | Harmonic 2 weaker than 1, first-30-ms high band above mid-sustain, sidebands only after vibrato delay. |
| `src/render/voices/choir.tool.ts` | NEW | Voiced band-limited excitation through three **parallel** formant BPs, vowel integer selector, seeded detuned ensemble. |
| `src/render/voices/choir.test.ts` | NEW | At f0=100 Hz, averaged F1/F2/F3 bands within ±150 Hz of vowel table; `i` F2 > `u` F2; same-seed copies identical and finite. |
| `src/render/voices/drums.tool.ts` | MODIFY | Add `kit` integer 0..4 and branch only when `kit>=1`; keep classic preset data, PRNG, sum order and `renderDrum` call untouched when omitted/0 (`src/render/voices/drums.tool.ts:7-19,29-95`). |
| `src/render/voices/drums.test.ts` | MODIFY | Omitted `kit` equals explicit 0 byte-for-byte; 1–4 give distinct spectral/envelope signatures, seed repeatability, and each named drum finite/peak bounded. |
| `src/render/voices/registry.tool.ts` | MODIFY | Register twelve IDs as notes-kind; preserve existing `keys`, `bell` and kit-manifest bypass; specs validate selectors and bounds (`src/render/voices/registry.tool.ts:16-34,43-70`). |
| `src/render/voices/registry.test.ts` | MODIFY | Assert all twelve IDs, kind mismatch paths, parameter defaults/min/max/integer boundaries, `kit:...` still bypasses voice registry (`src/render/voices/registry.test.ts:25-34`). |
| `src/recipes/lint-layering-harmony.tool.ts` | MODIFY | Add nine focal IDs to `FOCAL`; strings/choir/organ remain bed voices; keep same 7-semitone/75% register rule (`src/recipes/lint-layering-harmony.tool.ts:7-9,51-76`). |
| `src/recipes/lint-layering-harmony.test.ts` | MODIFY | Each added focal voice can collide with lead at same register/slots; each bed voice does not; onset-stagger and ≥8-semitone spacing avoid warning. |
| `src/recipes/lint-geometry.tool.ts` | MODIFY | Restrict `isKick`, `isBackbeat`, `isHat` to `instrument:"drums"` or actual `kit:` sample tracks; `sfx` never plays kit rhythm roles (`src/recipes/lint-geometry.tool.ts:57-68`). |
| `src/recipes/lint-geometry.test.ts` | MODIFY | `sfx` atoms named `bd`/`sd`/`hh` cannot satisfy role predicates, while built-in and `kit:` examples still do; false instrument/kind combinations do not. |
| `src/recipes/lint-rules-dance.tool.ts`, `src/recipes/lint-generic.tool.ts`, `src/recipes/lint-rules.tool.ts` | MODIFY if needed | Audit direct `kind:"drums"` discovery and active-layer rules; route groove/kick/snare/hat roles through the constrained predicates, without erasing actual SFX track from general arrangement density (`src/recipes/lint-rules-dance.tool.ts:34-38`). |
| `src/recipes/lint.test.ts` | MODIFY | End-to-end lint fixture with SFX-only transition cannot satisfy groove; `drums`/`kit:` fixtures keep original verdicts; no new IDs. |
| `skills/music2/references/instruments.md` | MODIFY | Add 12 voice cards, all numeric params/selectors, `drums.kit` names and `kit:` distinction; source table already uses complete track objects (`skills/music2/references/instruments.md:34-75`). |
| `devlog/str_func/render.md`, `devlog/str_func/song.md` | MODIFY | Update registry/voice list, parameter ownership, lint implications and exact legacy branch. |

## 1. Pitched voice parameter contracts

All twelve entries are `kind:"notes"`, receive MIDI and velocity through `VoiceEvent` (`src/render/render.schema.ts:7-10`), return track-length mono PCM, and expose numeric `VoiceSpec.params`. Interpret all listed ranges/defaults as **I** product parameters; the acoustical mechanisms and measured ratios are cited separately. Implementers may choose small internal constants within Sol's ranges but public knob names, defaults, bounds, and units below are the intended contract. `releaseMs` is the public millisecond form of Sol's seconds; note-off begins from the current envelope amplitude. `velocity` remains the existing track control, not a new voice param (`skills/music2/references/instruments.md:21-27`).

| Voice | Public numeric params: default [min,max] | Synthesis contract and source status |
| --- | --- | --- |
| `piano` | `inharmonicity` 0.0002 [0.0001,0.0004]; `hammer` 0.5 [0,1]; `releaseMs` 200 [80,400] | ≤32 stiff-string partials, `f_n=n f0 sqrt(1+B n²)`, velocity-brightened strike, 2–8 ms hammer noise. Stiff-string principle V via Sol R5/R7; B/knobs I (`devlog/_plan/260928_music2_sfx_instruments/evidence/sol-synthesis-methods.md:60,84-86`). |
| `epiano` | `bodyIndex` 2 [1,4]; `tineIndex` 0.5 [0.1,1.2]; `releaseMs` 180 [80,400] | 1:1 FM body and 14:1 tine branch, index T60 0.2..1.5 s, body T60 1.5..5 s. FM principle V; patch I (`devlog/_plan/260928_music2_sfx_instruments/evidence/sol-synthesis-methods.md:61,87`). |
| `strings` | `detuneCents` 7 [3,12]; `attackMs` 300 [120,800]; `releaseMs` 700 [200,1500]; `chorusMix` 0.2 [0,0.35] | 3–7 detuned band-limited saws, LP 0.8..5 kHz, optional delay-copy chorus; topology I (`devlog/_plan/260928_music2_sfx_instruments/evidence/sol-synthesis-methods.md:62`). |
| `brass` | `cutoffHz` 600 [350,1000]; `peakHz` 4000 [2000,8000]; `q` 1 [0.6,2]; `scoopCents` 35 [10,70]; `releaseMs` 250 [100,400] | Velocity controls bright LP excursion; 10..70-cent initial pitch scoop; I (`devlog/_plan/260928_music2_sfx_instruments/evidence/sol-synthesis-methods.md:63`). |
| `organ` | `d16,d513,d8,d4,d223,d2,d135,d113,d1`: defaults `8,8,8,0,0,0,0,0,0`, each integer [0,8]; `releaseMs` 80 [30,150] | Ratios 0.5,1.5,1,2,3,4,5,6,8 times f0; footage ordering V from Sol R9, gain mapping/click I (`devlog/_plan/260928_music2_sfx_instruments/evidence/sol-synthesis-methods.md:64,88`). |
| `marimba` | `decayScale` 1 [0.5,2]; `strike` 0.5 [0,1] | Modes (1,3.9,9.23), base T60 (.8,.35,.12) s; measured illustration V, envelope I (`devlog/_plan/260928_music2_sfx_instruments/evidence/sol-synthesis-methods.md:65,89-91`). |
| `vibraphone` | `decayScale` 1 [0.5,2]; `tremoloHz` 4 [0,7] | Modes (1,4,~10), base T60 (5,2,1) s; second mode V, third/AM I (`devlog/_plan/260928_music2_sfx_instruments/evidence/sol-synthesis-methods.md:65`). `0` disables AM; nonzero 2..7 Hz. |
| `glockenspiel` | `decayScale` 1 [0.5,2]; `strike` 0.5 [0,1] | Modes (1,2.71,5.15), base T60 (4,3,1) s; ratios V measured, envelope I (`devlog/_plan/260928_music2_sfx_instruments/evidence/sol-synthesis-methods.md:65`). |
| `kalimba` | `decayScale` 1 [0.5,2]; `overtoneRatio` 6.3 [5.9,6.8] | Two modes, base T60 (1.8,.12) s; overtone interval V measured via Sol R12; fixed third omitted (`devlog/_plan/260928_music2_sfx_instruments/evidence/sol-synthesis-methods.md:65,91`). |
| `guitar` | `type` 0 [0,1] integer (0 nylon, 1 steel); `pickPosition` 0.22 [0.12,0.35]; `releaseMs` 150 [50,300] | Karplus–Strong seeded excitation/comb, fractional delay and stable loop filter; method V via Sol R13, selector/timbres I (`devlog/_plan/260928_music2_sfx_instruments/evidence/sol-synthesis-methods.md:66,92`). |
| `flute` | `breath` 0.1 [0.03,0.15]; `attackMs` 80 [40,200]; `releaseMs` 180 [80,300]; `vibratoCents` 16 [8,25] | Near-sine plus second harmonic/noise, delayed 4..7 Hz vibrato; I (`devlog/_plan/260928_music2_sfx_instruments/evidence/sol-synthesis-methods.md:67`). |
| `choir` | `vowel` 0 [0,4] integer (0 a,1 e,2 i,3 o,4 u); `attackMs` 300 [100,500]; `releaseMs` 600 [200,1000]; `detuneCents` 8 [4,12] | Three parallel BP formants per copy, 3–5 detuned copies; formant means V as English proxies, implementation I (`devlog/_plan/260928_music2_sfx_instruments/evidence/sol-synthesis-methods.md:68,93-94`). |

For `vibraphone.tremoloHz`, the disjoint off/2..7 range requires an explicit validator on top of numeric min/max. Do not let 0.1..1.9 silently pass; the table is the public contract. If a parameter spec cannot express the disjoint range, apply a voice-specific check with an exact `tracks[i].params.tremoloHz` path. All other params use `ParamSpec`'s finite/range/integer checks (`src/render/voices/registry.tool.ts:58-70`). Invalid selector fractions, unknown keys, and any notes/drums kind mismatch yield `E_SCHEMA`, not a fallback tone.

Choir's formant centers, `(F1,F2,F3)` Hz by vowel: `a=(660,1720,2410)`, `e=(530,1840,2480)`, `i=(270,2290,3010)`, `o=(570,840,2410)`, `u=(300,870,2240)`. `/e/` and `/o/` are approximated from English `/ɛ/` and `/ɔ/`; docs must say these are timbre labels, not universal phonetic targets (`devlog/_plan/260928_music2_sfx_instruments/evidence/sol-synthesis-methods.md:68,93-94`). The formants run in parallel, never cascaded. Skip modes/partials at or above `0.45 Fs`, clamp filter states, precompute angular increments and coefficients outside the inner sample loop when possible (`devlog/_plan/260928_music2_sfx_instruments/evidence/sol-synthesis-methods.md:7-9,71-76`).

## 2. Drum-kit selector and preserved branch

The current `drums` voice defines eight sample names and four per-atom variants, with a single classic renderer (`src/render/voices/drums.tool.ts:4-19,29-95`). Add `params.kit` as default **0**, inclusive integer **0..4**. Its values are 0 classic, 1 909-style, 2 808-style, 3 acoustic-ish, 4 lo-fi. `kit` is a *synthetic character selector*, distinct from the existing user-supplied `instrument:"kit:<relative manifest>"` (`src/render/voices/registry.tool.ts:25-34`; `src/render/kit.tool.ts:49-53`).

| Selector | New branch behavior / proposed I constants | Test oracle |
| --- | --- | --- |
| 0 classic | Exact existing render loop, `PRESETS`, random hash and summation order. | Omitted and explicit 0 `Float32Array`/16-bit WAV hashes identical; old fixture unchanged. |
| 1 909-style | Kick sine `50+150e^(-t/.03)` Hz, T60 .4..1.2 s (default .7), 1–3 ms click; snare 180/330 Hz tones and 1.5–6 kHz noise. | Kick pitch approaches ~50 Hz from ~200; early snare noise-band energy > late; no peak >1. |
| 2 808-style | Six band-limited hat oscillators near 205.3/304.4/369.6/522.7/540/800 Hz, HP/BP brightening; closed ~50 ms, open .09..0.6 s. | Pre-filter six lines, closed T60 < open, closed event chokes prior open tail. |
| 3 acoustic-ish | Lower-bend beater kick, two-mode/rattly snare, descending tom and inharmonic/noise cymbal tails. | Distinct kick bend from 909, snare noise decay, tom falling mode and long cymbal tail; bounded/finite. |
| 4 lo-fi | Kit hit then sample hold 8..24 kHz and 6..12-bit quantization; retain original output Fs metadata. | ≤`2^b` levels before optional LP, lower high-band energy than classic, no metadata sample-rate change. |

The hardware descriptions above are timbral labels, not circuit-equivalence claims. Sol R6/R14 supply public component context; all numeric voice settings here are proposed I (`devlog/_plan/260928_music2_sfx_instruments/evidence/sol-synthesis-methods.md:3-5,69,84-92`). For `kit>=1`, branch **before** the old render loop so no new operation changes kit 0. Respect current per-atom variants and voice-level `tone`, `decayMs`, `noise` values (`src/render/voices/drums.tool.ts:77-92`); document any new-kit mapping of these controls. Add a test at both rates and at the same event seed. Verify classic bytes before accepting any refactor or helper extraction.

## 3. Lint and arrangement ownership

Add **piano, epiano, guitar, flute, brass, marimba, vibraphone, glockenspiel, kalimba** to the focal set used for `generic/register_collision`; **strings, choir, organ** are bed voices like pad. These are D7's exact classifications (`devlog/_plan/260928_music2_sfx_instruments/evidence/main-decisions.md:11`), applied to the existing median-register ≤7 semitone and shared-onset ≥75% rule (`src/recipes/lint-layering-harmony.tool.ts:7-9,51-76`). New voice IDs already pass generic low-MIDI and pan checks as notes; do not add a fictitious MIDI pitch to `subdrop` (`devlog/_plan/260928_music2_sfx_instruments/evidence/architect-proposal.md:25`; `src/recipes/lint-layering-low.tool.ts:62-79`).

`isKick`, `isBackbeat`, `isHat` currently test only `kind:"drums"` plus atom names (`src/recipes/lint-geometry.tool.ts:57-65`). Restrict their owning track to built-in `drums` or `kit:` and require a parsed sample event. Therefore an `sfx` track never satisfies kick/snare/hat role, even if a malformed/unknown atom shares a kit name. Audit direct percussion lookups such as dance/techno's first drum track (`src/recipes/lint-rules-dance.tool.ts:34-38`) and genre-specific discovery in `src/recipes/lint-rules.tool.ts:34-56`. General density can still count an audible SFX track; document any new-song density warnings. Do not alter existing genre or balance thresholds to quiet those warnings. No new lint ID is needed.

The `drums.kit` parameter never changes rhythm roles: all five synthetic kit values still count as `drums`. User `kit:` sample names count only when their manifests provide the role-named sample; do not infer a role from arbitrary file names outside the event's declared sample. For a SFX-only song, strict groove lint must still fail missing drums; adding a genuine `drums` or `kit:` track restores the prior result. Analyze's rendered six-band balance naturally measures low-band SFX energy; keep the A1–A4 thresholds and whole-file semantics (`docs/cli.md:27`).

## 4. Shared synthesis and legacy checks

For each voice, test fixed seed/params/Fs/Node major/platform byte identity, finite output, peak ≤1 pre-mix, release continuity, Nyquist avoidance, and one timbre-specific oracle from its file-map row (`devlog/_plan/260928_music2_sfx_instruments/evidence/sol-synthesis-methods.md:71-76`). Compare sustained-voice RMS at velocity 0.8 against `pad` within ±3 dB (strings, brass, organ, flute, choir); transient voices use peak ≤1 and appropriate envelope/spectral targets. A different seed should alter noise/excitation yet leave deterministic nominal pitch. Avoid whole-track per-note allocations; bound active polyphony and per-note state. The source remains near 400 lines per file (`AGENTS.md:12-20`).

The old voice list is frozen, not retuned (`src/render/voices/registry.tool.ts:4-19`). Retain all pre-existing voice PCM digests, mixer drill WAV and `tests/e2e/legacy-render.test.ts:10-40`; compare classic drums absent `kit` against explicit `kit:0` at both PCM and WAV layers. Pin machine/Node for hash claims; an existing platform-skipped digest is absence of proof. For new voice audio quality, listen to short deterministic samples after numerical gates and record any perceptual defect separately; neither listening nor FFT alone replaces the concrete tests.

## Verification handoff

This docs unit does not execute the suite. The implementation owner records actual status against the final SHA.

### Boundary vectors and spectral measurement rules

The following vectors turn the per-voice research oracles into reviewable tests. They are design targets; a future test must show the measured window/FFT settings rather than accept an arbitrary passing snapshot.

1. Test every pitched voice at MIDI 57 (A3, 220 Hz) and velocity 0.8 at both 44100 and 48000 Hz.
2. Test the top accepted MIDI against Nyquist to prove harmonics/modal peaks are omitted, never folded.
3. Compare `Float32Array` bytes twice with the same seed and call parameters on the same Node major/platform.
4. Change only the seed for a stochastic voice and expect changed attack/noise samples without nominal f0 drift.
5. Change an unrelated track's seed/event count and verify the target voice's addressed event bytes stay fixed.
6. For every voice, assert track-length output exactly equals `ctx.frames`, with finite samples and peak ≤1 before mix.
7. For each ADSR voice, the first sample after note-off starts from the last held amplitude before release attenuation.
8. For a note ending at render frame count, no release write can exceed that frame count.
9. For monophonic note tracks, next-onset stop still takes priority under `src/render/mixer.tool.ts:42-49`.
10. For polyphonic voices, simultaneous notes sum deterministically in event order and remain bounded before mix.
11. Piano at fixed velocity has a fundamental and inharmonic partials; a long FFT resolves partial 2 above exactly 2f0 when B>0.
12. Piano's highest included partial has lower T60 than its fundamental; don't demand a 60-dB drop from a too-short capture.
13. Piano v=0.9 has a larger high/low band ratio than v=0.3, while neither peaks above 1.
14. Piano note-off damping enters at the current amplitude and reaches its release target within 400 ms.
15. Epiano bodyIndex/tineIndex at zero in an internal kernel fixture yield a sine; public numeric specs may require positive indices.
16. Epiano with tine enabled shows high sidebands during attack, less high energy by 0.5 s.
17. Epiano body and tine index changes alter the intended branch without changing note duration or output buffer length.
18. Strings under a 20-ms window are quieter than a window near 300 ms after onset.
19. Strings `chorusMix=0` uses the dry path exactly; increasing mix creates beating without strong low-frequency gain.
20. Brass pitch during its first 10 ms is below stable f0 by the configured scoop; after decay, pitch centers on f0.
21. Brass high-band/low-band ratio rises through attack; a stronger velocity produces greater high-band ratio.
22. Organ with only `d8=8` has a dominant f0 line; enabling `d16` adds 0.5f0 and enabling `d513` adds 1.5f0.
23. Organ all drawbars zero leaves only the short key click then silence, never NaN from normalization by total gain zero.
24. Organ steady sustain without percussion remains at a constant RMS after attack; note-off fades under 150 ms.
25. Marimba mode peaks follow 1:3.9:9.23 within FFT-bin tolerance where Nyquist permits.
26. Marimba's 9.23 mode cannot wrap into low frequencies at a high MIDI note.
27. Vibraphone at 1 s retains more tail energy than marimba under equal pitch, velocity and output scaling.
28. Vibraphone `tremoloHz=0` gives no modulation; 4 Hz gives symmetric AM sidebands around stable partials.
29. Vibraphone `tremoloHz=1` fails exact parameter-path validation; 2 and 7 pass.
30. Glockenspiel partials match 2.71 and 5.15 multiples of f0 where below the 0.45Fs ceiling.
31. Glockenspiel's long ringing high modes stay finite for the full song and stop at `ctx.frames`.
32. Kalimba's dominant overtone can be adjusted from 5.9 to 6.8f0 with no invented fixed third partial.
33. Kalimba's overtone falls faster than the fundamental, matching the proposed short upper T60.
34. Guitar nylon/steel selector accepts exact integers 0 and 1; `0.5`, `-1`, `2` fail `E_SCHEMA`.
35. Guitar E2 and E4 fundamental estimates are within 1% at both supported rates with fractional delay enabled.
36. Guitar loop energy declines monotonically within a broad envelope, rather than requiring every individual sample to shrink.
37. Guitar steel has more >4 kHz energy in its attack than nylon, where both pitches permit that band.
38. Guitar seeded pick excitation repeats exactly; pick comb notch moves with `pickPosition` rather than output pitch.
39. Flute's second harmonic is weaker than its fundamental; breath onset has more high-band noise than mid-sustain.
40. Flute vibrato sidebands appear after the configured delay but not in an equal-length pre-delay window.
41. Choir `vowel` 0..4 maps to a/e/i/o/u; 1.5 and 5 fail rather than coercing to a vowel.
42. Choir at f0=100 Hz has broad F1/F2/F3 peaks within ±150 Hz of the table where filter Q allows resolution.
43. Choir `i` has higher F2 than `u`, including when seeded ensemble copies vary in detune.
44. Choir ensemble seed changes individual copy phase/noise, never the chosen vowel centers.
45. All sustained voices are within ±3 dB RMS of `pad` at v=0.8 in a steady window; state the window and f0.
46. Drum `kit` omitted and 0 have the same PCM bytes for `bd sd cp hh oh rim perc tom` across :0..3 variants.
47. Drum kit 1 kick starts near 200 Hz and approaches 50 Hz; snare early noise dominates its late tail.
48. Drum kit 2 open hat has a longer T60 than closed hat; a later closed hit suppresses the prior open tail.
49. Drum kit 4 quantized stage has at most `2^b` unique levels before any smoothing filter.
50. Drum-kit branch selection does not change output sample-rate metadata or sample-name validation.
51. A synthetic `drums` track with `params.kit: 4` (the selector, not the `kit:<manifest>` instrument spelling) still satisfies a true `bd` groove event.
52. A user sample-kit instrument `kit:custom.json` is not interpreted as selector 4 or any synthetic kit.
53. A `sfx` track whose event atom happens to be `bd` does not satisfy `isKick` even before render rejects the atom.
54. A `sfx` `impact` event does not count as snare, hat, or kick by acoustic resemblance.
55. A `kit:` sample `hh` counts as a hat only when it is an actual parsed event on that kit track.
56. A song with only an SFX transition never passes a groove predicate that requires a kick/backbeat/hat.
57. A song adding SFX to a valid drum groove retains its rhythm roles but may change general density counts.
58. `piano` and `flute` at median distance 7 semitones and 75% shared eighth slots trigger `register_collision`.
59. The same pair at distance 8 or 74% shared slots does not trigger the warning.
60. A `strings`/`choir`/`organ` pair never enters the focal collision set, regardless of shared slots.
61. Generic low-MIDI/pan checks still see a low piano or guitar note; they do not invent MIDI for `subdrop`.
62. Existing no-new-voice songs preserve their prior warning IDs/order and rendered bytes.

| Criterion | Future command / test | Required observation |
| --- | --- | --- |
| c-1 gates | `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`, `npm run audit:structure` | All five exit 0 after both 010 and 020; `npm run docs:genres:check` if recipe cards change. |
| c-2 oracle tests per SFX preset and voice | `node --test src/render/voices/*.test.ts src/sfx/*.test.ts` | Each of twelve new voices has its file-map oracle; all five drum kits and 21 SFX presets have deterministic finite bounded oracles. |
| c-3 legacy byte identity | `node --test src/render/voices/drums.test.ts src/render/mixer.test.ts tests/e2e/legacy-render.test.ts` plus pinned pre-change hashes | Omitted `kit`/explicit 0 and old songs match PCM/WAV bytes, frames and events on same platform. |
| c-4 deterministic standalone WAV+JSON | `node --test src/cli/commands/sfx.test.ts` | Every preset's two artifacts repeat byte-for-byte; invalid inputs exit 2 and existing file exit 4. |
| c-5 example songs | `node --test tests/e2e/examples.test.ts` in 030 | New voice songs validate, strict-lint clean, and analyze without A1–A4 balance warnings. |
| c-6 hosted CI | 030 exact-SHA hosted receipt after identity check | Required jobs actually execute at pushed main SHA and succeed; skipped/pending is not success. |
