# Instruments and track controls

Each track needs a unique `id`, a `kind`, an `instrument`, and usually a one-bar `pattern`. Built-in drum atoms are exactly `bd`, `sd`, `cp`, `hh`, `oh`, `rim`, `perc`, `tom`: kick, snare, clap, closed hat, open hat, rim, percussion, tom. A suffix such as `bd:3` selects a zero-based timbre variant; built-in drums wrap indices across four variants. For note voices, use explicit-octave notes (`c4`, `eb3`, `f#2`) or integer MIDI 0–127. The built-in voice IDs and accepted parameters come from the voice registry. Unknown parameters and out-of-range values fail voice validation. All ranges below are inclusive.

| Voice ID | `kind` | Accepted atoms | Numeric `params`: default [minimum, maximum] |
| --- | --- | --- | --- |
| `drums` | `drums` | `bd sd cp hh oh rim perc tom`, optional `:index` | `tone`: 0.5 [0, 1]; `decayMs`: 180 [20, 1000]; `noise`: 0.5 [0, 1]; `kit`: 0 [0, 4] **integer** |
| `808` | `notes` | notes or integer MIDI | `drive`: 2.2 [1, 8]; `decayMs`: 1100 [100, 5000]; `attackMs`: 3 [0, 50] |
| `bass` | `notes` | notes or integer MIDI | `wave`: 0 [0, 1] **integer**; `cutoffHz`: 600 [40, 8000]; `resonance`: 0.15 [0, 0.9]; `releaseMs`: 80 [5, 1000]; `unison`: 1 [1, 9] **integer**; `detuneCents`: 0 [0, 50]; `filterEnvAmount`: 0 [0, 1]; `filterEnvDecayMs`: 500 [20, 5000] |
| `bell` | `notes` | notes or integer MIDI | `ratio`: 3.5 [1, 12]; `index`: 2.2 [0, 10]; `decayMs`: 450 [50, 5000] |
| `keys` | `notes` | notes or integer MIDI | `ratio`: 2 [1, 8]; `index`: 1.4 [0, 8]; `attackMs`: 8 [0, 200]; `releaseMs`: 220 [20, 2000] |
| `pluck` | `notes` | notes or integer MIDI | `damping`: 0.992 [0.8, 0.9999]; `decayMs`: 900 [50, 5000]; `brightness`: 0.7 [0, 1] |
| `pad` | `notes` | notes or integer MIDI | `detuneCents`: 11 [0, 50]; `cutoffHz`: 1800 [80, 12000]; `attackMs`: 400 [10, 5000]; `releaseMs`: 700 [20, 5000]; `unison`: 3 [1, 9] **integer**; `filterEnvAmount`: 0 [0, 1]; `filterEnvDecayMs`: 500 [20, 5000] |
| `lead` | `notes` | notes or integer MIDI | `wave`: 1 [0, 1] **integer**; `vibratoHz`: 5 [0, 12]; `vibratoCents`: 12 [0, 100]; `releaseMs`: 120 [5, 2000]; `unison`: 1 [1, 9] **integer**; `detuneCents`: 0 [0, 50]; `filterEnvAmount`: 0 [0, 1]; `filterEnvDecayMs`: 500 [20, 5000] |
| `supersaw` | `notes` | notes or integer MIDI | `unison`: 7 [1, 9] **integer**; `detuneCents`: 18 [0, 50]; `mix`: 0.75 [0, 1]; `cutoffHz`: 3500 [80, 12000]; `resonance`: 0.2 [0, 0.9]; `filterEnvAmount`: 0.5 [0, 1]; `filterEnvDecayMs`: 500 [20, 5000]; `attackMs`: 20 [0, 5000]; `releaseMs`: 250 [5, 5000] |
| `sfx` | `drums` | `riser pitchriser downlifter impact whoosh revcymbal noisebuild subdrop zap crackle`, optional `:index` | `riserSemitones`: 19 [0, 36]; `sweepFromHz`: 250 [100, 2000]; `sweepToHz`: 8000 [1000, 16000]; `pitchHz`: 220 [55, 880]; `impactDecay`: 0.8 [0.2, 3]; `crackleRate`: 8 [1, 30]; `noiseColor`: 0 [0, 1] **integer** |
| `piano` | `notes` | notes or integer MIDI | `inharmonicity`: 0.0002 [0.0001, 0.0004]; `hammer`: 0.5 [0, 1]; `releaseMs`: 200 [80, 400] |
| `epiano` | `notes` | notes or integer MIDI | `bodyIndex`: 2 [1, 4]; `tineIndex`: 0.5 [0.1, 1.2]; `releaseMs`: 180 [80, 400] |
| `organ` | `notes` | notes or integer MIDI | `d16`: 8 [0, 8] **integer**; `d513`: 8 [0, 8] **integer**; `d8`: 8 [0, 8] **integer**; `d4`: 0 [0, 8] **integer**; `d223`: 0 [0, 8] **integer**; `d2`: 0 [0, 8] **integer**; `d135`: 0 [0, 8] **integer**; `d113`: 0 [0, 8] **integer**; `d1`: 0 [0, 8] **integer**; `releaseMs`: 80 [30, 150] |
| `strings` | `notes` | notes or integer MIDI | `detuneCents`: 10 [3, 12]; `attackMs`: 300 [120, 800]; `releaseMs`: 500 [200, 1500]; `chorusMix`: 0.2 [0, 0.35] |
| `brass` | `notes` | notes or integer MIDI | `cutoffHz`: 600 [350, 1000]; `peakHz`: 4000 [2000, 8000]; `q`: 1 [0.6, 2]; `scoopCents`: 35 [10, 70]; `releaseMs`: 250 [100, 400] |
| `flute` | `notes` | notes or integer MIDI | `breath`: 0.1 [0.03, 0.15]; `attackMs`: 80 [40, 200]; `releaseMs`: 180 [80, 300]; `vibratoCents`: 16 [8, 25] |
| `choir` | `notes` | notes or integer MIDI | `vowel`: 0 [0, 4] **integer**; `attackMs`: 300 [100, 500]; `releaseMs`: 600 [200, 1000]; `detuneCents`: 8 [4, 12] |
| `marimba` | `notes` | notes or integer MIDI | `decayScale`: 1 [0.5, 2]; `strike`: 0.5 [0, 1] |
| `vibraphone` | `notes` | notes or integer MIDI | `decayScale`: 1 [0.5, 2]; `tremoloHz`: 4 [0, 7] |
| `glockenspiel` | `notes` | notes or integer MIDI | `decayScale`: 1 [0.5, 2]; `strike`: 0.5 [0, 1] |
| `kalimba` | `notes` | notes or integer MIDI | `decayScale`: 1 [0.5, 2]; `overtoneRatio`: 6.3 [5.9, 6.8] |
| `guitar` | `notes` | notes or integer MIDI | `type`: 0 [0, 1] **integer**; `pickPosition`: 0.22 [0.12, 0.35]; `releaseMs`: 150 [50, 300] |

`808` and `bass` require `mono: true` (also their default). Other voices default to polyphonic. All voices use the track controls below; omitted controls take the stated defaults.
Explicit `unison` or filter envelope controls select the PolyBLEP path for lead, bass, and pad; lead/bass also select it when `detuneCents` is supplied. Omitted controls retain the original sound. `filterEnvAmount` opens the low-pass cutoff by up to four octaves before decay to its base value.
For supersaw, `mix` sets the relative level of side oscillators: 0 keeps the center oscillator (or center pair for even counts), and 1 gives equal weight to all oscillators. The sum is normalized by its total weight.

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

### Transition effects (sfx)

Each atom fills its whole weighted slot (`@n` sets relative length; `gate` is ignored), so `riser@3 impact@1` rises for three quarters of the bar and hits on beat 4. See `sfx.md` for placement and the standalone `music2 sfx` generator.

```json
{ "id": "fx", "kind": "drums", "instrument": "sfx", "pattern": "riser@3 impact@1", "gain": -8, "params": { "sweepFromHz": 250, "sweepToHz": 8000, "impactDecay": 0.8 } }
```

### Drum kit characters

The `drums` voice has one synthetic kit selector, `params.kit`: 0 classic (the original sound, also used when `kit` is omitted), 1 909-style (pitched-sine kick with a click, bright noisy snare), 2 808-style (long boomy kick, six-oscillator metallic hats where a closed hat chokes a ringing open hat), 3 acoustic-ish (beater kick, rattly snare, falling toms, noisy cymbal tails), 4 lo-fi (the kit through sample-rate and bit reduction). All five keep the same eight atoms and `:0..3` variants, and all count as drums for lint. `params.kit` is different from `"instrument": "kit:<manifest>"`, which plays your own WAV files. To switch the built-in drums example above to a 909-style kit, add `"kit": 1` to its `params`.

### Virtual instruments

These twelve voices are synthesized approximations of acoustic and electric instruments, built from public descriptions of how each one makes sound (stiff-string partials, FM tines, drawbar sine ratios, modal bars, plucked-string delay lines, vowel formants). They are not samples and not models of a specific product. Sustained voices (strings, brass, organ, flute, choir) sit within about 3 dB of `pad` at the same velocity; struck and plucked voices peak comparably. As with `keys` and `bell`, a single note peaks at or below full scale, while chords sum above it before the mix; set track `gain` for the chord density you write. `piano`, `epiano`, `guitar`, `flute`, `brass` and the four mallets count as focal voices for the register-collision lint, like `lead`; `strings`, `choir` and `organ` are beds, like `pad`.

| Voice | What it models and how to use it |
| --- | --- |
| `piano` | Hammered stiff string: slightly sharp upper partials (`inharmonicity`), brighter at higher velocity, a short hammer thump (`hammer`). Chords, ballads, pop verses. |
| `epiano` | Two-operator FM tine piano: a warm body (`bodyIndex`) and a bell-like tine attack (`tineIndex`) that fades faster. Lo-fi, neo-soul, R&B chords. |
| `organ` | Nine drawbars (`d16` 16', `d513` 5⅓', `d8` 8', `d4` 4', `d223` 2⅔', `d2` 2', `d135` 1⅗', `d113` 1⅓', `d1` 1'), each 0–8, with a short key click and no decay. `8,8,8,0,...` is the classic full-bodied registration; add `d4`/`d2` for brightness. |
| `strings` | An in-tune principal saw carries the fundamental; five unevenly detuned players with their own light vibrato add width above it, so a held chord stays steady instead of swelling. Slow bow attack (`attackMs`), spread (`detuneCents`) and optional chorus (`chorusMix`). Pads, swells, cinematic beds; voice chords in the middle register, and keep `releaseMs` shorter than the gap to the next chord to avoid smear. |
| `brass` | Saw through a resonant low-pass that opens with each note; a small pitch scoop (`scoopCents`) at the start; velocity makes it brighter. Stabs and fanfares. |
| `flute` | Near-sine tone with breath noise (`breath`) on the attack and a delayed vibrato (`vibratoCents`). Airy leads and counter-melodies above the vocal range. |
| `choir` | Voiced source through three parallel vowel formants (`vowel`: 0 "a", 1 "e", 2 "i", 3 "o", 4 "u"; approximate English vowel labels), several detuned voices. "Ooh/aah" beds. |
| `marimba` | Wooden bar: fundamental plus overtones near 3.9x and 9.2x that die quickly (`decayScale`, `strike` hardness). Short, dry; good for game loops and afrobeats-style riffs. |
| `vibraphone` | Metal bar with a long ring and motor tremolo (`tremoloHz`: 0 off, or 2–7 Hz). Jazz and lo-fi colour. |
| `glockenspiel` | Small bright steel bars with inharmonic overtones and a long shimmer. Sparkle on top; keep it sparse and high. |
| `kalimba` | Plucked tine: fundamental plus one overtone at `overtoneRatio` (5.9–6.8x) that fades fast. Gentle ostinatos. |
| `guitar` | Plucked string (Karplus–Strong) with `type` 0 nylon (soft, shorter) or 1 steel (brighter, longer), and `pickPosition` for tone. Arpeggios and strums (`c3,e3,g3,c4`). |

```json
{ "id": "piano", "kind": "notes", "instrument": "piano", "pattern": "c4,e4,g4 ~ a3,c4,e4 ~", "params": { "inharmonicity": 0.0002, "hammer": 0.5, "releaseMs": 200 } }
```

```json
{ "id": "rhodes", "kind": "notes", "instrument": "epiano", "pattern": "d4,f4,a4,c5 ~ ~ ~", "sends": { "reverb": 0.2 }, "params": { "bodyIndex": 2, "tineIndex": 0.5, "releaseMs": 180 } }
```

```json
{ "id": "organ", "kind": "notes", "instrument": "organ", "pattern": "c4,e4,g4", "gain": -6, "params": { "d16": 8, "d513": 8, "d8": 8, "d4": 4, "d223": 0, "d2": 0, "d135": 0, "d113": 0, "d1": 0 } }
```

```json
{ "id": "strings", "kind": "notes", "instrument": "strings", "pattern": "c4,eb4,g4", "gain": -6, "params": { "detuneCents": 10, "attackMs": 300, "releaseMs": 500, "chorusMix": 0.2 } }
```

```json
{ "id": "brass", "kind": "notes", "instrument": "brass", "pattern": "~ c4,e4,g4 ~ ~", "params": { "cutoffHz": 600, "peakHz": 4000, "q": 1, "scoopCents": 35 } }
```

```json
{ "id": "flute", "kind": "notes", "instrument": "flute", "pattern": "g5 a5 c6 ~", "params": { "breath": 0.1, "vibratoCents": 16 } }
```

```json
{ "id": "choir", "kind": "notes", "instrument": "choir", "pattern": "c4,g4", "gain": -6, "params": { "vowel": 4, "attackMs": 300, "releaseMs": 600 } }
```

```json
{ "id": "marimba", "kind": "notes", "instrument": "marimba", "pattern": "c5 e5 g5 e5", "params": { "decayScale": 1, "strike": 0.5 } }
```

```json
{ "id": "vibes", "kind": "notes", "instrument": "vibraphone", "pattern": "e5,g5,b5 ~ ~ ~", "params": { "decayScale": 1, "tremoloHz": 4 } }
```

```json
{ "id": "glock", "kind": "notes", "instrument": "glockenspiel", "pattern": "~ ~ g6 ~", "gain": -8, "params": { "decayScale": 1, "strike": 0.5 } }
```

```json
{ "id": "kalimba", "kind": "notes", "instrument": "kalimba", "pattern": "c5 g4 e5 g4", "params": { "decayScale": 1, "overtoneRatio": 6.3 } }
```

```json
{ "id": "guitar", "kind": "notes", "instrument": "guitar", "pattern": "[c3 e3 g3 c4]*2", "params": { "type": 0, "pickPosition": 0.22, "releaseMs": 150 } }
```

### Lead

```json
{ "id": "lead", "kind": "notes", "instrument": "lead", "pattern": "c5 ~ g4 ~", "params": { "wave": 1, "vibratoHz": 5, "vibratoCents": 12, "releaseMs": 120 } }
```

### Supersaw

```json
{ "id": "saw", "kind": "notes", "instrument": "supersaw", "pattern": "c4,eb4,g4", "gain": -9, "params": { "unison": 7, "detuneCents": 18, "mix": 0.75, "cutoffHz": 3500, "filterEnvAmount": 0.5 } }
```

### User-owned sample kit

`kit:<relative-path>` names a `kit.json` relative to the **song file**. For example, if the song and `samples/kit.json` share a directory, use `"instrument": "kit:samples/kit.json"`. The path may also name the directory `kit:samples`; music2 appends `kit.json`. This is a sample instrument, separate from the nine built-in voice IDs. A drum kit accepts the names present in its manifest; a note kit plays its `note` sample (or first sample key) pitched from `rootMidi`.

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
