# Effects in song v1

Effects are optional. A track `fx` array runs in order before pan, gain, ducking, dry stem capture, and sends. `master.fx` runs after dry and wet returns (and loop-tail folding), before loudness targeting and final limiting. Omitted arrays resolve to `[]`. A track without inserts keeps the original mono mixing path.

```json
{
  "tracks": [{ "id": "lead", "kind": "notes", "instrument": "lead", "pattern": "c4 ~ ~ ~",
    "fx": [{ "type": "filter", "mode": "highpass", "cutoffHz": 150 },
           { "type": "chorus", "mix": 0.2 }],
    "sends": { "reverb": 0.12, "delay": 0.1 } }],
  "fx": { "reverb": { "type": "plate", "decaySeconds": 1.8 },
          "delay": { "time": "1/8d", "feedback": 0.35 } },
  "master": { "fx": [{ "type": "compressor", "ratio": 2, "thresholdDb": -12 }] }
}
```

The fragment shows only effect-related fields; add `version`, `bpm`, `sections`, and `arrangement` for a valid song. `sends` feed shared **wet-only** returns. Bus `mix` scales that wet return; insert `mix` blends dry and processed track signal. An omitted bus keeps the legacy reverb or delay algorithm. `song.fx: {}` also keeps both. An explicit configured bus `mix: 0` silences its wet return. `tailSeconds` bounds audible tails; loop songs fold the tail into the body. Stems contain processed dry tracks after pan, gain, and ducking, excluding bus returns and master effects. `--bars` starts each effect at zero state for the selected range.

All ranges are inclusive. Unlisted keys and unknown effect types fail with `E_SCHEMA`; integers are required where stated. Defaults and bounds come from `src/render/fx/fx.schema.ts`.

| Track insert | Parameters: default (range) | Starting use |
| --- | --- | --- |
| `eq` | `lowGainDb`, `midGainDb`, `highGainDb`: 0 (-18..18); `lowHz`: 120 (40..500); `midHz`: 1000 (200..6000); `highHz`: 8000 (2000..18000); `midQ`: 0.7 (0.2..5). Frequencies must ascend. | Broad ±1–3 dB tone shaping; cut 200–500 Hz mud on keys. |
| `filter` | `mode`: `lowpass` (`lowpass`, `highpass`, `bandpass`); `cutoffHz`: 1000 (20..18000); `q`: 0.707 (0.2..10); `lfoRateHz`: 0 (0..20); `lfoDepthOct`: 0 (0..4); `mix`: 1 (0..1). | Highpass keys around 100 Hz, pads around 150 Hz, hats around 250 Hz; adjust by ear. |
| `drive` | `amount`: 2 (1..12); `toneHz`: 8000 (500..18000); `mix`: 1 (0..1). | Light harmonic color on 808/bass at `mix` 0.15–0.35. |
| `compressor` | `thresholdDb`: -18 (-60..0); `ratio`: 4 (1..20); `attackMs`: 10 (0.1..100); `releaseMs`: 100 (10..2000); `kneeDb`: 6 (0..24); `makeupDb`: 0 (-12..24). | Try ratio 2–4 on a lead or master, then set threshold by measured gain reduction. |
| `chorus` | `rateHz`: 0.35 (0.05..5); `depthMs`: 5 (0..15); `baseMs`: 15 (5..35); `feedback`: 0 (-0.8..0.8); `mix`: 0.5 (0..1). | Keys or pads at `mix` 0.1–0.3. |
| `phaser` | `rateHz`: 0.3 (0.05..5); `depth`: 0.7 (0..1); `stages`: 4 (integer 2..12, odd values round up to the next even stage count); `feedback`: 0 (-0.8..0.8); `mix`: 0.5 (0..1). | Subtle motion on keys, pluck, or pad. |
| `width` | `amount`: 1 (0..2); `monoBelowHz`: 120 (80..250). | Widen upper pad/keys; keep 808/bass centered. The Linkwitz-Riley high-pass removes low side content; retained side is -6 dB at the crossover and approaches unity above it. The matching low/high filters sum to a flat-magnitude allpass. Mid is unchanged. |
| `crush` | `bits`: 8 (integer 4..16); `downsample`: 2 (integer 1..32); `mix`: 1 (0..1). | Quiet lo-fi texture, usually with partial wet mix. |
| `tremolo` | `rateHz`: 4 (0.05..20); `depth`: 0.5 (0..1); `phaseDegrees`: 0 (0..180); `mix`: 1 (0..1). | Rhythmic pad/keys pulse. |
| `tapestop` | `startBar`: 1 (1..1024, integer, absolute 1-based song bar); `beats`: 2 (0.25..16 quarter notes). Track only. | Slow a track to a stop into a drop or break; see [sound effects](sfx.md). |
| `delay` | `time`: `1/8d` (note division); `feedback`: 0.35 (0..0.95); `pingPong`: false; `lowCutHz`: 20 (20..1000); `highCutHz`: 18000 (1000..18000); `mix`: 0.35 (0..1). Low cut must stay below high cut. | Dotted eighth pluck/lead echo. |

Delay note divisions are `1/16`, `1/8`, `1/4`, or `1/2`, each optionally suffixed `d` (dotted) or `t` (triplet). Tempo follows song `bpm`. An insert delay processes the full allocated track buffer, so its tail can appear in dry stems.

| Shared bus | Parameters: default (range) |
| --- | --- |
| `fx.reverb` | `type`: `room` (`room`, `plate`, `hall`); `decaySeconds`: 1.5 (0.2..8); `preDelayMs`: 0 (0..250); `damping`: 0.5 (0..1); `lowCutHz`: 80 (20..1000); `highCutHz`: 16000 (1000..18000); `width`: 1 (0..2); `mix`: 1 (0..1). |
| `fx.delay` | Same `time` divisions as insert delay, default `1/8d`; `feedback`: 0.35 (0..0.95); `pingPong`: true; `lowCutHz`: 20 (20..1000); `highCutHz`: 18000 (1000..18000); `mix`: 1 (0..1). |

Both buses require `lowCutHz < highCutHz`. A maximum of 12 inserts per track and 4 on the master is allowed. The master accepts only `eq`, `compressor`, `drive`, and `width` with the same parameters above. Stereo balance pan attenuates the opposite channel without folding it; extreme pan can lose stereo information. Master width centers the low side before mastering, but track pan can shift that low band afterward.

## Starting chains by instrument and style

These are listening starting points, not universal targets. Source notes: [EQ and compression](https://www.uaudio.com/blogs/ua/multiband-eq-mix-fix), [saturation](https://www.izotope.com/community/blog/what-is-audio-saturation), [sidechain mixing](https://www.izotope.com/en/learn/what-is-sidechain-compression), and the [BTS “Fake Love” mix breakdown](https://www.soundonsound.com/techniques/inside-track-bts-fake-love). The exact music2 parameter choices below are adaptations of the local research notes, not settings prescribed by those sources.

| Style | Track chain ideas | Shared sends and master |
| --- | --- | --- |
| K-pop/pop | Lead: highpass `filter` 150 Hz → `compressor` ratio 3 → light `drive`/`chorus`. Keys: highpass 100 Hz → gentle `eq` mid cut → chorus. Bass: light drive → compressor. | Plate on lead around 0.12, hall on pad around 0.18; dotted-eighth delay on pluck. Master gentle EQ → ratio-2 compressor. |
| Trap/drill | 808: centered, highpass 20–30 Hz → drive `mix` 0.25–0.4 → compressor; use existing kick `duck`. Lead: highpass 150 Hz → drive → short delay. | Keep low-track reverb below 0.15. Short room/plate on snare, sparse echo on lead; gentle master compression. |
| House/techno | Kick: corrective EQ → moderate compressor/drive. Bass: highpass 25–30 Hz → drive → kick duck. Keys/pad: highpass → chorus or phaser → delay. | Short room and tempo delay; master EQ → ratio-2 compressor, measure low-end and loudness afterward. |
| Lo-fi | Keys: highpass 100–150 Hz → `crush` partial mix → slow `chorus`. Pad: lowpass → tremolo. | Short room or plate, restrained delay; preserve some high-frequency detail. |
| Boom bap | Drums: gentle EQ → compressor → mild drive. Bass: centered EQ/drive. Keys: highpass → slow chorus. | Short room on snare/keys, limited delay, gentle master compression. |

Render, listen, and compare `analyze` measurements against the preceding version. `generic/clipping_risk` is a static onset warning; it does not model compression, limiting, or bus processing.
