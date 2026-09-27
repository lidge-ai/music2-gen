# Song v1 format

A song is JSON, validated by [the Song v1 schema](../schema/song.v1.json) and `node bin/music2.js validate song.json`. The TypeScript source of truth is `src/song/song.schema.ts`. Unknown object keys fail validation; malformed JSON returns `E_INPUT`, while an invalid song or mini-notation pattern returns `E_SCHEMA` with issue paths (and a parse offset when available).

## Complete small song

Save this as `/tmp/music2-small.song.json`, then run `node bin/music2.js validate /tmp/music2-small.song.json --json`.

```json
{
  "version": 1,
  "title": "Small Beat",
  "genre": "boom_bap",
  "bpm": 90,
  "key": "D minor",
  "seed": 7,
  "tracks": [
    { "id": "drums", "kind": "drums", "instrument": "drums", "pattern": "bd sd bd sd" },
    { "id": "bass", "kind": "notes", "instrument": "bass", "pattern": "d2 ~ a2 ~" }
  ],
  "sections": [
    { "id": "verse", "bars": 2, "role": "verse" },
    { "id": "breakdown", "bars": 1, "role": "breakdown", "patterns": { "drums": null, "bass": "d2 ~ ~ ~" } }
  ],
  "arrangement": [
    { "section": "verse", "repeats": 2 },
    { "section": "breakdown" }
  ]
}
```

This produces five bars: the two-bar verse repeats twice, followed by one breakdown bar. A section pattern string replaces that track's base pattern; `null` mutes it for that section. An omitted override inherits the track pattern. A track with no base pattern is silent except where a section supplies one.

## Top-level fields

| Field | Type and accepted values | Default |
| --- | --- | --- |
| `version` | Required, exactly `1`. | — |
| `title` | String, at most 120 characters. | `"untitled"` |
| `genre` | String; recognized recipe IDs add genre lint rules. | `null` |
| `bpm` | Required finite number, 40–240. | — |
| `meter` | Object with integer `numerator` 2–12 and `denominator` exactly 4. | `4/4` |
| `key` | String such as `C minor`, `F# major`, or `Bb minor`; letter A–G, optional sharp/flat, major/minor. | `null` |
| `seed` | Integer 0–4294967295. | `1` |
| `swing` | Number 0.5–0.75; applied only to tracks with `swing:true`. | `0.5` |
| `sampleRate` | `44100` or `48000` Hz. | `44100` |
| `tailSeconds` | Number 0–10 added after the final bar. | `2` |
| `master` | Optional gain/ceiling/target object; see below. | `gainDb:0`, `ceilingDb:-1`, `targetLufs:null` |
| `tracks` | Required array of 1–32 track objects with unique IDs. | — |
| `sections` | Required array of 1–64 section objects with unique IDs. | — |
| `arrangement` | Required array of 1–256 section references. | — |

`master.gainDb` is -24–12 dB, `master.ceilingDb` is -6–0 dB, and optional `master.targetLufs` is -30–-6 LUFS. `targetLufs:null` is a resolved default, not a valid explicit JSON value. A set target selects built-in LUFS mastering on render; `render --loudnorm` explicitly uses ffmpeg.

## Tracks

| Field | Type and accepted values | Default |
| --- | --- | --- |
| `id` | Required unique ID: lowercase initial, then up to 31 lowercase letters, digits, `_`, or `-`. | — |
| `kind` | Required `"drums"` or `"notes"`. | — |
| `instrument` | Required nonempty string. Built-in drums use `"drums"`; note voices are `"808"`, `"bass"`, `"bell"`, `"keys"`, `"pluck"`, `"pad"`, `"lead"`; `kit:<relative kit.json>` uses a supplied kit. | — |
| `pattern` | One-bar mini-notation string, repeated through each section unless overridden. | Silent (`null` resolved) |
| `velocity` | Number 0–1 or mini-notation string containing numeric atoms. | `0.8` |
| `gain` | Number -60–12 dB. | `0` |
| `pan` | Number -1–1, left to right. | `0` |
| `gate` | Number 0.05–1, event length fraction for non-mono tracks. | `0.9` |
| `mono` | Boolean; bass and 808 require true. | True for bass/808; false otherwise |
| `glide` | Number 0–500 ms. | `0` |
| `transpose` | Integer -24–24 semitones. | `0` |
| `swing` | Boolean; shifts qualifying offbeat sixteenth onsets according to song swing. | `false` |
| `sends` | Object with `reverb` and/or `delay`, each 0–1. | Both `0` |
| `duck` | Object with required `by` (another track ID) and `amount` 0–1; optional `releaseMs` >=0. Cannot duck itself. | `null`; release 180 ms when set |
| `params` | Voice-specific finite numeric parameters, within the voice registry's ranges. | Voice defaults |

The JSON Schema accepts numeric `params` keys, then the voice registry checks supported names and bounds during rendering. `validate` checks the song and pattern syntax; `render` resolves the voice and its parameters. A built-in drum pattern uses sample atoms such as `bd`, `sd`, and `hh`; a note pattern uses pitches such as `d2`, `f4`, `bb3`, or MIDI numbers 0–127. Drum `name:index` selects a timbre variant. A `kit:` manifest points to user-owned PCM WAV files and is resolved relative to the song; sample paths must stay within the kit directory. No sample files are bundled.

## Sections and arrangement

| Field | Type and accepted values | Default |
| --- | --- | --- |
| `sections[].id` | Required unique ID with the same syntax as track IDs. | — |
| `sections[].bars` | Required integer 1–256. | — |
| `sections[].role` | `intro`, `verse`, `hook`, `build`, `breakdown`, `groove`, `outro`, or `bridge`. Roles affect some lint rules. | `null` |
| `sections[].patterns` | Map of existing track IDs to mini-notation strings or `null` mutes. | Empty map |
| `arrangement[].section` | Required ID of an existing section. | — |
| `arrangement[].repeats` | Integer 1–64. | `1` |

Each pattern cycle occupies one bar, regardless of the number of atoms. A whitespace sequence divides the cycle into equal slots; `[ ]` subdivides a slot, `~` rests, `< >` alternates bars, and `,` stacks simultaneous notes. The parser stores onset positions as exact `Fraction` values before converting to seconds, so repeated sections restart their pattern cycle exactly. Song `swing` affects only tracks opting in with `swing:true`; it delays qualifying offbeat sixteenth onsets rather than changing the declared BPM. See [mini-notation reference](../skills/music2/references/mini-notation.md) for supported operators and bounds.
