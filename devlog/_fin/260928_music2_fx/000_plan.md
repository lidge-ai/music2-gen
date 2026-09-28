# 000 — Production effects and synth upgrade

**Summary.** music2 rendered with a fixed Schroeder reverb, one dotted-eighth delay, a tanh/limiter master and naive aliasing oscillators, so songs sounded dry and thin even when the arrangement and balance passed every check. This unit adds a production effect system that coding agents set in song JSON: a per-track insert chain (EQ, filter with LFO sweep, drive with oversampling, compressor, chorus, phaser, stereo width with mono lows, bitcrush, tremolo, tempo-synced delay), configurable send buses (plate reverb after Dattorro, room/hall feedback delay networks with pre-delay and Abbey Road style return filtering; tempo-synced filtered ping-pong delay), a master insert chain (EQ, glue compressor, drive, width) ahead of loudness targeting, and synth upgrades (a band-limited supersaw voice and optional unison, detune and filter envelopes on lead, bass and pad). A song that uses none of the new fields renders byte-identically to before.

## Research

| Track | Output |
|---|---|
| Aside exec: production practice, parameter ranges, per-genre chains, public DSP references | evidence/aside-notes/A–D (reverb/delay/stereo, modulation/synth/lo-fi, saturation/EQ/compression/chains, DSP references) |
| sol DSP researcher: clean-room algorithms from public papers and specs with test oracles | evidence/sol-dsp-algorithms.md |
| sol architect: contract, signal order, compatibility, validation, budget | evidence/architect-proposal.md (F1–F9) |

Clean-room rule: processors are written from public descriptions (RBJ Audio EQ Cookbook, Zavalishin's TPT SVF, Dattorro 1997 "Effect Design Part 1", Jot FDN, Giannoulis–Massberg–Reiss 2012 compressor tutorial, Välimäki polyBLEP, Szabo's supersaw thesis); no GPL/AGPL source is read or copied.

## Dispositions

| ID | Proposal | Disposition |
|---|---|---|
| F1 | Additive v1 fields `track.fx`, `song.fx`, `master.fx`; no-FX songs byte-identical | Accept; frozen digest regression test |
| F2 | Stereo insert path before pan, gain, duck and send taps; stems are post-insert dry | Accept |
| F3 | Ten insert effects with bounded parameters | Accept; the filter also gets an LFO (`lfoRateHz`, `lfoDepthOct`) for sweeps and builds |
| F4 | Configurable reverb (room/plate/hall) and delay buses replacing only the configured legacy processor | Accept; a second reverb bus is deferred |
| F5 | Master inserts (eq, compressor, drive, width) before loudness targeting and limiting | Accept |
| F6 | Supersaw voice; optional unison/detune/filter envelope with legacy branches | Accept |
| F7 | One declarative spec source for validation, defaults and JSON Schema; E_SCHEMA paths | Accept; specs live in `src/render/fx/fx.schema.ts` |
| F8 | 180 s performance and memory budget | Accept; measured on the examples |
| F9 | Tests, docs, advisory lint (reverb on low tracks, runaway feedback, widened lows) | Accept |

## Lanes (parallel subagents, disjoint write scopes)

| Lane | Scope |
|---|---|
| Filters and dynamics | biquad, SVF, eq, filter, compressor, drive |
| Modulation, time, stereo, lo-fi | delay line, chorus, phaser, tempo delay and delay bus, width, crush, tremolo |
| Reverb | plate and FDN room/hall bus |
| Synth voices | polyBLEP oscillators, supersaw, optional unison/filter envelopes with legacy branches |
| Integration | validation, song schema and JSON Schema, mixer signal path, dispatch, lint, docs |

## Acceptance

1. Typecheck, lint, full test suite, build, structure audit, genre-doc check and privacy scan exit 0.
2. A no-FX song renders to the frozen pre-change digest.
3. Every processor has oracle tests (frequency/impulse/step response, RT60, stereo behaviour, finite output at maximum settings, determinism).
4. Invalid effect configurations fail with `E_SCHEMA` and precise paths; `schema/song.v1.json` matches the in-code schema.
5. A 180 s song with about ten tracks and 30+ inserts renders within the budget in F8.
6. The K-pop and Chicago drill songs, re-rendered with genre effect chains, still pass strict lint and analyze without balance warnings.

## Review and results

Independent sol reviewer, two rounds. Round 1 FAIL: the reverb summed L and R so an antiphase send vanished; the compressor detected peaks instead of stereo-linked RMS; the width split was not phase-matched; phaser stages accepted odd counts; byte identity was proven only for one WAV. Fixes: both channels feed the plate and FDN tanks (antiphase wet energy 0.095/0.466/0.042 room/plate/hall at 48 kHz); mean-square detector with the Giannoulis–Massberg–Reiss gain computer (a −12 dBFS RMS sine at threshold −18, ratio 4 settles at −16.52 dBFS); matched LR4 side split with mid untouched (−48 dB at 30 Hz, −6.02 dB at the 120 Hz crossover, −0.03 dB at 480 Hz); odd phaser stages round up to even; legacy digests from pre-change HEAD `0737e13` now cover the drill WAV, loop, `--bars`, per-track stems and peak mastering (pinned to Node 24 on macOS, skipped elsewhere). Round 2 PASS.

Measured: processors run in 16–1,516 ms each for 180 s of 48 kHz stereo; Neon Letter (146 s, 9 tracks, 21 inserts, 3 master inserts, plate and delay buses) renders in about 17 s. Gates: 490 tests, 487 pass, 0 fail, 3 skipped; typecheck, lint, build, structure audit, genre docs and privacy scan clean. Neon Letter with effects: sub+low 0.523, presence+air 0.094, no balance warnings; South Side Winter with effects: sub+low 0.881, presence+air 0.061, no balance warnings.
