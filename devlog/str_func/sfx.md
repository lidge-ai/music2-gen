# SFX — Structure & Functions

`src/sfx/` owns deterministic synthesized transition events and standalone game/UI sounds. It imports only `src/shared/` for errors and seeded random draws. The song voice calls `renderTransition`; the standalone exporter calls `resolveSfx` and `generateSfx`. Neither path constructs a song or imports rendering/CLI code.

## File tree

```text
src/sfx/
├── index.ts                 public feature boundary
├── sfx.schema.ts            input parsing, validation, canonical resolution
├── presets.tool.ts          atom/preset IDs, physical ranges, draw order
├── dsp.tool.ts              local W3C biquad, polyBLEP, bounded noise
├── transition.tool.ts       ten mono transition atoms and tail contract (noise atoms, including revcymbal, end with a 5 ms taper)
├── game.tool.ts             physical-unit game/UI synthesis
├── generate.tool.ts         fixed-length stereo output
└── *.test.ts                adjacent boundary, spectral, temporal tests
```

## Public API

`index.ts` exports `TRANSITION_ATOMS`, `TransitionAtom`, `TRANSITION_PARAMS`, `TransitionParams`, `renderTransition`, `transitionTailSeconds`, `SFX_PRESETS`, `GENERATOR_VERSION`, `parseParamsFlag`, `ResolvedSfx`, `resolveSfx`, and `generateSfx`.

`renderTransition(atom, variant, slotSeconds, sampleRate, seed, params, velocity)` returns mono event PCM. Variants are reduced modulo four and change timbre only. Ordinary events end at the slot; `impact` and `subdrop` may ring until `max(slotSeconds, impactDecay)` seconds. The caller clips events to its render frame count. Samples are finite and bounded to ±1.

`resolveSfx` rejects unknown presets/keys, duplicate or malformed `--params`, non-finite and out-of-range values with `E_INPUT`. Seed is uint32, rate is 44100 or 48000, and seconds is 0.05–30. Realized seconds equals `round(seconds*rate)/rate`. `ResolvedSfx.params` uses declaration order regardless of input map order. `generateSfx` returns two exact-length PCM channels; the right channel duplicates the left.

## Controls and timbre variants

Transition ranges/defaults are declared in `TRANSITION_PARAMS`: `riserSemitones` 19 [0,36], `sweepFromHz` 250 [100,2000], `sweepToHz` 8000 [1000,16000], `pitchHz` 220 [55,880], `impactDecay` .8 [.2,3], `crackleRate` 8 [1,30], and integer `noiseColor` 0 [0,1]. Each atom accepts only its relevant keys in `TRANSITION_KEYS`. For noise atoms, variant 1 enables pink color, variant 2 raises the sweep by 15%, and variant 3 broadens the band-pass. `pitchriser` variants 1/2 use wider/narrower detuning; `impact`/`subdrop` variant 3 softens the sub, while `zap` variants 1/2 change pulse duty. All keep duration and seed addressing stable.

Game/UI controls use physical units in `GAME_PARAMS`: `wave` 0 sine/1 saw/2 pulse/3 noise; `fstart`, `fmin`, `slide` octaves/s, `deltaSlide` octaves/s², `vDepth` cents, `vRate` Hz, `jump` semitones at `tArp`, `duty` and `dutySlope`, `attack`/`sustain`/`punch`/`decay`, `repeat`, `phaserMix`/`phaserDelay`/`phaserSweep`, and `lpHz`/`lpQ`/`lpSweep` plus `hpHz`/`hpSweep`. Exact bounds are in `GAME_PARAMS`; laser alone extends `slide` to −14. All presets accept waveform, base pitch, minimum pitch, slide, envelope, and LP/HP cutoffs. The specific preset's drawn controls and related controls form its additional override allowlist in `GAME_ALLOWED`. Controls outside that list fail `E_INPUT`.

Game preset randomization consumes one wave draw, then table fields in declared order, from `mulberry32(fnv1a32(GENERATOR_VERSION, preset, seed))`. Overrides replace resolved values after all draws. Noise uses a separate addressed stream. Identical inputs on the same Node major/platform yield identical PCM bytes. No wall clock, ambient RNG, asset, or runtime dependency enters synthesis.

## Sync checklist

- Keep `index.ts` exports aligned with the public contract and voice/CLI consumers.
- If a preset table or draw order changes, update `GENERATOR_VERSION` and the frozen vector test.
- Keep the end-user SFX card and CLI help aligned with accepted keys, durations, and variants.
- Verify the focused SFX tests, typecheck, lint, and parent-owned full integration gates after cross-feature wiring.
