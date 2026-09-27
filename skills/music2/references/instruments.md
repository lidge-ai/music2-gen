# Instruments and track controls

Each track needs a unique `id`, a `kind`, an `instrument`, and usually a one-bar `pattern`. Built-in drum atoms are exactly `bd`, `sd`, `cp`, `hh`, `oh`, `rim`, `perc`, `tom`: kick, snare, clap, closed hat, open hat, rim, percussion, tom. A suffix such as `bd:3` selects a zero-based timbre variant; built-in drums wrap indices across four variants. For note voices, use explicit-octave notes (`c4`, `eb3`, `f#2`) or integer MIDI 0–127. The eight built-in voice IDs and accepted parameters come from the voice registry. Unknown parameters and out-of-range values fail voice validation. All ranges below are inclusive.

| Voice ID | `kind` | Accepted atoms | Numeric `params`: default [minimum, maximum] |
| --- | --- | --- | --- |
| `drums` | `drums` | `bd sd cp hh oh rim perc tom`, optional `:index` | `tone`: 0.5 [0, 1]; `decayMs`: 180 [20, 1000]; `noise`: 0.5 [0, 1] |
| `808` | `notes` | notes or integer MIDI | `drive`: 2.2 [1, 8]; `decayMs`: 1100 [100, 5000]; `attackMs`: 3 [0, 50] |
| `bass` | `notes` | notes or integer MIDI | `wave`: 0 [0, 1] **integer**; `cutoffHz`: 600 [40, 8000]; `resonance`: 0.15 [0, 0.9]; `releaseMs`: 80 [5, 1000] |
| `bell` | `notes` | notes or integer MIDI | `ratio`: 3.5 [1, 12]; `index`: 2.2 [0, 10]; `decayMs`: 450 [50, 5000] |
| `keys` | `notes` | notes or integer MIDI | `ratio`: 2 [1, 8]; `index`: 1.4 [0, 8]; `attackMs`: 8 [0, 200]; `releaseMs`: 220 [20, 2000] |
| `pluck` | `notes` | notes or integer MIDI | `damping`: 0.992 [0.8, 0.9999]; `decayMs`: 900 [50, 5000]; `brightness`: 0.7 [0, 1] |
| `pad` | `notes` | notes or integer MIDI | `detuneCents`: 11 [0, 50]; `cutoffHz`: 1800 [80, 12000]; `attackMs`: 400 [10, 5000]; `releaseMs`: 700 [20, 5000] |
| `lead` | `notes` | notes or integer MIDI | `wave`: 1 [0, 1] **integer**; `vibratoHz`: 5 [0, 12]; `vibratoCents`: 12 [0, 100]; `releaseMs`: 120 [5, 2000] |

`808` and `bass` require `mono: true` (also their default). Other voices default to polyphonic. All voices use the track controls below; omitted controls take the stated defaults.

| Track control | Default | Accepted value and use |
| --- | --- | --- |
| `velocity` | 0.8 | Number 0–1 or numeric mini-notation pattern sampled at each onset. |
| `gain` | 0 | Decibels, -60 to +12. Set track balance before `master.gainDb`. |
| `pan` | 0 | -1 left to +1 right. Keep deep bass centered. |
| `gate` | 0.9 | 0.05–1 times each note's slot duration. |
| `mono` | true for `808`/`bass`; false otherwise | Boolean; `808` and `bass` reject false. |
| `glide` | 0 | 0–500 ms; useful for mono 808/bass pitch transitions. |
| `transpose` | 0 | Integer semitones -24 to +24. |
| `swing` | false | Boolean; uses song `swing` (0.5–0.75) on selected 16th offbeats. |
| `sends` | `{ "reverb": 0, "delay": 0 }` | Each send 0–1. |
| `duck` | absent | `{ "by": "kick", "amount": 0.4, "releaseMs": 180 }`; `by` is another track ID, `amount` 0–1, optional release >=0 ms. |

The following are complete **track objects**. Copy one into a song's `tracks`, change its ID and pattern, then run `validate` and `events`. Drum kits and note voices use the same track shape.

### Built-in drums

```json
{ "id": "drums", "kind": "drums", "instrument": "drums", "pattern": "bd ~ sd hh:3", "params": { "tone": 0.5, "decayMs": 180, "noise": 0.5 } }
```

### 808

```json
{ "id": "sub", "kind": "notes", "instrument": "808", "pattern": "c2 ~ eb2 ~", "mono": true, "glide": 60, "pan": 0, "params": { "drive": 2.2, "decayMs": 1100, "attackMs": 3 } }
```

### Bass

```json
{ "id": "bass", "kind": "notes", "instrument": "bass", "pattern": "c2 ~ g2 ~", "mono": true, "params": { "wave": 0, "cutoffHz": 600, "resonance": 0.15, "releaseMs": 80 } }
```

### Bell

```json
{ "id": "bell", "kind": "notes", "instrument": "bell", "pattern": "c5 ~ eb5 ~", "gain": -6, "params": { "ratio": 3.5, "index": 2.2, "decayMs": 450 } }
```

### Keys

```json
{ "id": "keys", "kind": "notes", "instrument": "keys", "pattern": "c4 ~ eb4 g4", "sends": { "reverb": 0.2 }, "params": { "ratio": 2, "index": 1.4, "attackMs": 8, "releaseMs": 220 } }
```

### Pluck

```json
{ "id": "pluck", "kind": "notes", "instrument": "pluck", "pattern": "c4 ~ g4 ~", "params": { "damping": 0.992, "decayMs": 900, "brightness": 0.7 } }
```

### Pad

```json
{ "id": "pad", "kind": "notes", "instrument": "pad", "pattern": "c4,eb4,g4", "gain": -9, "params": { "detuneCents": 11, "cutoffHz": 1800, "attackMs": 400, "releaseMs": 700 } }
```

### Lead

```json
{ "id": "lead", "kind": "notes", "instrument": "lead", "pattern": "c5 ~ g4 ~", "params": { "wave": 1, "vibratoHz": 5, "vibratoCents": 12, "releaseMs": 120 } }
```

### User-owned sample kit

`kit:<relative-path>` names a `kit.json` relative to the **song file**. For example, if the song and `samples/kit.json` share a directory, use `"instrument": "kit:samples/kit.json"`. The path may also name the directory `kit:samples`; music2 appends `kit.json`. This is a sample instrument, separate from the eight built-in voice IDs. A drum kit accepts the names present in its manifest; a note kit plays its `note` sample (or first sample key) pitched from `rootMidi`.

Manifest `samples` must be a nonempty object of names mapped to nonempty arrays of WAV paths relative to `kit.json`:

```json
{
  "version": 1,
  "gainDb": 0,
  "rootMidi": 60,
  "samples": { "bd": ["bd.wav", "bd-alt.wav"], "sd": ["sd.wav"] }
}
```

`gainDb` defaults to 0 and accepts -60 to +12; `rootMidi` defaults to 60 and accepts 0–127. `bd:3` wraps across the number of `bd` variants. Input files may be mono or stereo PCM 16/24/32-bit or float32 WAV at 8–192 kHz; music2 folds stereo to mono and resamples when needed. Manifest sample paths must stay inside the kit directory, including after symlink resolution. No samples ship with music2: provide WAVs you own or are licensed to use, and keep proof of that license outside the song JSON.
