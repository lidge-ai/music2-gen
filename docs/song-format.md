# Song v1 format

A song is JSON, validated by [the Song v1 schema](../schema/song.v1.json) and `bun bin/music2.js validate song.json`. The TypeScript source of truth is `src/song/song.schema.ts`. Unknown object keys fail validation; malformed JSON returns `E_INPUT`, while an invalid song or mini-notation pattern returns `E_SCHEMA` with issue paths (and a parse offset when available).

## Complete small song

Save this as `/tmp/music2-small.song.json`, then run `bun bin/music2.js validate /tmp/music2-small.song.json --json`.

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
| `fx` | Optional shared `reverb` and/or `delay` bus settings. | `null`; legacy send processors |
| `tracks` | Required array of 1–32 track objects with unique IDs. | — |
| `audioTracks` | Optional array of 0–16 audio tracks with song-relative WAV clips. | Absent |
| `sections` | Required array of 1–64 section objects with unique IDs. | — |
| `arrangement` | Required array of 1–256 section references. | — |

`master.gainDb` is -24–12 dB, `master.ceilingDb` is -6–0 dB, and optional `master.targetLufs` is -30–-6 LUFS. `targetLufs:null` is a resolved default, not a valid explicit JSON value. A set target selects built-in LUFS mastering on render; `render --loudnorm` explicitly uses ffmpeg.

`master.fx` is an ordered array of up to 4 `eq`, `compressor`, `drive`, or `width` inserts. It runs after dry and wet signals (and loop folding), before loudness targeting and the final limiter. An omitted array resolves to `[]`. See [effect parameters and examples](../skills/music2/references/effects.md).

## DAW bridge fields in Song v1

All fields here are optional and keep `version: 1`. Missing `notes`, `automation` and `audioTracks` stay absent in resolved JSON, preserving legacy songs and render behavior. See [the directly renderable note example](../examples/daw-notes-automation.song.json) and [the SFZ/clip template](../examples/daw-bridge/audio-sfz.song.json); the latter needs the [fixture builder](../examples/daw-bridge/make-fixtures.mjs) before rendering.

| Field | Meaning and bounds |
| --- | --- |
| `tracks[].notes[]` | `start` and `length` are beats from song start, independent of section repeats. `kind:"notes"` uses `pitch` (MIDI number 0–127 or note name); `kind:"drums"` uses `sample`. Each note has optional `velocity` 0–1. A list track cannot also have `pattern`, a velocity pattern or track swing. Explicit length is not shortened by `gate`. |
| `tracks[].automation[]` | Each lane has a unique `target` and ordered `points` of `{at,value,curve?}`. `at` is an absolute beat; `curve:"linear"` interpolates toward the next point, while `"hold"` keeps the current value until it. Accepted targets are `gain` (-60..12 dB), `pan` (-1..1), `send.reverb` and `send.delay` (0..1), supported numeric `fx.<insert index>.<parameter>`, and music-track `param.<voice parameter>`. Voice parameters are sampled at note onset. Automation lanes are absolute: while a lane is active its value replaces the track's static `gain` or send; it is not added to it. A track with `"gain": -27` that should dip 8 dB into a build uses points like `-27 → -35 → -27`; writing `0 → -8 → 0` plays it 27 dB above its static level. `music2 lint` reports `generic/automation_gain_jump` when a gain lane rises more than 12 dB above the static gain and `generic/automation_send_jump` when a send lane rises more than 12 dB above a nonzero static send. |
| `audioTracks[]` | Up to 16 tracks with unique IDs, optional gain/pan/sends/inserts/duck/automation and at least one `clips[]`. These mix after music tracks. `param.*` automation does not apply to audio tracks. |
| `audioTracks[].clips[]` | `file` is a confined song-relative `.wav` path. `start` and `length` are beats; `offset`, `fadeIn`, and `fadeOut` are seconds. Optional `gain` is dB and `pitch` is semitones. Clips on one lane cannot overlap. |
| `clips[].stretch` | `{ "mode":"none" }`, `{ "mode":"varispeed", "ratio":1 }`, `{ "mode":"tempo", "sourceBpm":120 }`, or `{ "mode":"fit", "sourceSeconds":1 }`. Effective stretch ratio is bounded to 0.25..4. |
| `tracks[].instrument` with `sfz:` | `kind:"notes"` can use `sfz:<song-relative .sfz path>`. WAV sample paths inside the SFZ stay confined to the SFZ directory. Music2 supports a documented SFZ subset and reports unsupported opcodes as warnings; it does not promise full SFZ player compatibility. |
| `tracks[].instrument` with `lib:` | `kind:"notes"` can use `lib:grand-piano`, `lib:strings`, `lib:strings-staccato`, `lib:brass`, or `lib:brass-staccato`. Samples ship with music2-gen and resolve from its package directory. `params` are not accepted for these instruments. Run `music2 instruments --json` for roles, ranges, sources and licenses. |

The supported SFZ subset includes `<region>` sample/key/velocity ranges, pitch center and tuning, volume/pan, sample offset/end, loop modes, attack/release triggers, amplitude envelopes, groups/choking, sequencing and deterministic random selection. Unknown or unsupported opcodes produce warnings; do not assume full SFZ player compatibility. An SFZ sample or clip file must exist for rendering and audio export; structural `validate` checks the Song JSON but does not synthesize missing media. Plugin inserts, if present, use the separate opt-in host described in the [CLI reference](cli.md). Export MIDI retains notes and selected CC7/CC10 but cannot carry the original samples or complete DSP; stems carry sound without editable notes.

## Tracks

| Field | Type and accepted values | Default |
| --- | --- | --- |
| `id` | Required unique ID: lowercase initial, then up to 31 lowercase letters, digits, `_`, or `-`. | — |
| `kind` | Required `"drums"` or `"notes"`. | — |
| `instrument` | Required nonempty string. Built-in drums use `"drums"` and synthesized transition effects use `"sfx"` (both `kind: "drums"`); note voices are listed in the [instrument reference](../skills/music2/references/instruments.md); `kit:<relative kit.json>` uses a supplied kit. | — |
| `pattern` | One-bar mini-notation string, repeated through each section unless overridden. | Silent (`null` resolved) |
| `notes` | Optional arrangement-absolute note list, exclusive with `pattern`. | Absent |
| `automation` | Optional ordered automation lanes. | Absent |
| `velocity` | Number 0–1 or mini-notation string containing numeric atoms. | `0.8` |
| `gain` | Number -60–12 dB. | `0` |
| `pan` | Number -1–1, left to right. | `0` |
| `gate` | Number 0.05–1, event length fraction for non-mono tracks. Ignored by `sfx`, whose atoms always fill their slot. | `0.9` |
| `mono` | Boolean; bass and 808 require true. | True for bass/808; false otherwise |
| `glide` | Number 0–500 ms. | `0` |
| `transpose` | Integer -24–24 semitones. | `0` |
| `swing` | Boolean; shifts qualifying offbeat sixteenth onsets according to song swing. | `false` |
| `sends` | Object with `reverb` and/or `delay`, each 0–1. | Both `0` |
| `fx` | Ordered array of up to 12 insert effects, applied before pan/gain/duck/sends. Includes the track-only `tapestop` (`startBar` absolute 1-based bar, `beats`). | `[]` |
| `duck` | Object with required `by` (another track ID) and `amount` 0–1; optional `releaseMs` >=0. Cannot duck itself. | `null`; release 180 ms when set |
| `params` | Voice-specific finite numeric parameters, within the voice registry's ranges. | Voice defaults |

The JSON Schema accepts numeric `params` keys, then the voice registry checks supported names and bounds during rendering. `validate` checks the song, pattern syntax and the voice rules `render` applies (known instrument, track kind, `mono` for bass/808, parameter names and bounds), so an out-of-range parameter exits 2 at `validate`; `render` additionally loads kits and samples. A built-in drum pattern uses sample atoms such as `bd`, `sd`, and `hh`; an `sfx` pattern uses the transition atoms `riser`, `pitchriser`, `downlifter`, `impact`, `whoosh`, `revcymbal`, `noisebuild`, `subdrop`, `zap`, `crackle` (see [sound effects](../skills/music2/references/sfx.md)). `render` rejects unknown atoms in a track's base pattern and in every section override for that track, even sections that are never placed, with `E_SCHEMA` and the exact pattern path; a note pattern uses pitches such as `d2`, `f4`, `bb3`, or MIDI numbers 0–127. Drum `name:index` selects a timbre variant. A `kit:` manifest points to user-owned PCM WAV files and is resolved relative to the song; sample paths must stay within the kit directory. Its optional `startMs` object trims the start of named samples (0–10000 ms) for loop slices whose attack arrives late. The `lib:` SFZ and WAV files are bundled.

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

Saw-based `lead` (`wave: 0`), `bass` (`wave: 0`), `supersaw`, and `pad` are normal synth choices. For acoustic strings and brass, use the corresponding `lib:` samples; synthesized `strings` and `brass` are for explicitly wanted synth timbres and trigger `generic/synthetic_acoustic`. `choir` is also saw-based, has no bundled sampled alternative, and is best used sparingly.
