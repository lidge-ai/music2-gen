# Sound effects: transition atoms, tape stop, and `music2 sfx`

music2 synthesizes its effects; it ships no audio samples. There are two separate tools. The `sfx` **voice** puts transition effects inside a song, on the song's grid. The `music2 sfx` **command** writes a standalone one-shot WAV (for a video edit, a game, or an app) with a JSON sidecar that records how to reproduce it. Every sound is a synthesized approximation, and the same inputs give the same bytes on the same pinned Bun version and platform.

## In-song transition atoms

Use a `drums`-kind track with `"instrument": "sfx"`. Its pattern accepts exactly these ten atoms, each with an optional `:index` timbre variant (0–3; larger indices wrap, so `riser:5` is variant 1):

| Atom | Sound | Variants 0 / 1 / 2 / 3 | Track params that shape it |
| --- | --- | --- | --- |
| `riser` | Noise through a band-pass sweeping up; rises in level | base / darker sweep / brighter sweep / wider band | `sweepFromHz`, `sweepToHz`, `noiseColor` |
| `pitchriser` | Five detuned saws gliding up exponentially | detune 7 / 11 / 3 / 15 cents | `pitchHz`, `riserSemitones` |
| `downlifter` | Noise sweep falling, fading out | as `riser` | `sweepFromHz`, `sweepToHz`, `noiseColor` |
| `impact` | Sub sine falling ~150→40 Hz under a noise/click transient | transient-to-body balance | `impactDecay` |
| `whoosh` | Noise band sweeping 300→6000→300 Hz, swelling in the middle | as `riser` | `noiseColor` |
| `revcymbal` | Bright 4–10 kHz noise growing toward a stop with a 5 ms fade, so it lands on the next downbeat without a click | as `riser` | `noiseColor` |
| `noisebuild` | Pulsing noise that gets brighter and louder | pulse rate and color | `sweepFromHz`, `sweepToHz`, `noiseColor` |
| `subdrop` | Low sine falling ~130→35 Hz | transient-to-body balance | `impactDecay` |
| `zap` | Pulse wave falling ~1800→180 Hz | pulse width | none |
| `crackle` | Quiet hiss with random vinyl clicks | base / softer clicks / louder clicks / louder hiss | `crackleRate`, `noiseColor` |

Track params (numeric, inclusive ranges): `riserSemitones` 19 [0, 36], `sweepFromHz` 250 [100, 2000], `sweepToHz` 8000 [1000, 16000], `pitchHz` 220 [55, 880], `impactDecay` 0.8 s [0.2, 3], `crackleRate` 8 clicks/s [1, 30], `noiseColor` 0 [0, 1] integer (0 white, 1 pink).

**Length is the slot.** An atom lasts its whole weighted pattern slot; track `gate` is ignored for `sfx`. `@n` sets relative length inside the bar, not seconds: `riser@3 impact@1` rises for the first three beats of a 4/4 bar and hits on beat 4. A one-atom pattern (`"riser"`) fills the whole bar. Only `impact` and `subdrop` ring past their slot, up to `impactDecay` seconds, and never past the end of the render.

**Put transitions in sections.** Leave the base track pattern out (the track is silent unless a section plays it) and write the effect into the section that needs it with a per-section pattern override:

```json
{
  "tracks": [{ "id": "fx", "kind": "drums", "instrument": "sfx", "gain": -9, "sends": { "reverb": 0.25 } }],
  "sections": [
    { "id": "build", "bars": 4, "patterns": { "fx": "<~ ~ ~ riser>" } },
    { "id": "drop", "bars": 8, "patterns": { "fx": "<impact ~ ~ ~ ~ ~ ~ ~>" } }
  ]
}
```

`<...>` picks one element per bar, so the riser fills the whole fourth build bar and the impact lands once, on the drop's first downbeat (a plain `"impact ~ ~ ~"` would hit at the start of every drop bar). Check real onset times with `music2 events`.

Unknown atoms fail at render time with `E_SCHEMA` and the exact pattern path, including section overrides that are never placed. An `sfx` track never counts as kick, snare, or hat for lint: an SFX-only song still needs a real `drums` or `kit:` track for groove.

## Placement practice

These habits come from public production guides; the exact numbers in music2 are its own defaults.

- **Build window.** Start a riser or a snare build in the last 1–8 bars before the drop; the last bar can lose percussion or get high-passed so the drop hits harder. ([EDMProd](https://www.edmprod.com/tension/), [MusicRadar house transition](https://www.musicradar.com/tuition/tech/how-to-build-a-house-transition-585840))
- **Layer by role.** One long tension layer (`riser` or `pitchriser`), one rhythmic layer (a snare roll written with `sd` on the drum track, e.g. `"sd*4"` → `"sd*8"` → `"sd*16"`), and one short cue (`revcymbal`, `whoosh`). There is no snare-build atom; the roll is a drum pattern. ([EDMProd](https://www.edmprod.com/tension/))
- **Resolve sharply.** End rising material at the downbeat and put `impact` or `subdrop` on it. A reverse cymbal should end exactly where the next section starts. ([Native Instruments on trailer impacts](https://blog.native-instruments.com/sound-in-film/), [reverse cymbal as a transition](https://smabellakoppenaudio.wordpress.com/2015/08/12/production-technique-2-reverse-cymbal-as-transitional-effect))
- **Make room.** Mute or thin other parts at the hit so reverb and releases do not smear it. ([MusicRadar transitions](https://www.musicradar.com/tuition/tech/9-ways-to-create-better-transitions-641798))
- **Protect the low end.** `impact` and `subdrop` put energy below 100 Hz. Keep the track centered, lower its gain against the kick and 808, or duck it, and re-run `analyze` for balance warnings. ([Soundfly on stereo width](https://flypaper.soundfly.com/produce/stereo-widening/))
- **Keep crackle quiet.** `crackle` is texture: -18 to -24 dB track gain under lo-fi keys is typical.

## Tape stop insert

`{"type": "tapestop", "startBar": 9, "beats": 2}` is a track insert. From the start of song bar `startBar` (1-based, absolute, meter-aware: in 3/4 each bar is three beats) it slows the track's playback to a stop over `beats` quarter notes, so pitch and speed fall together along a `(1-u)^2` curve, then fades the last 15 ms and stays silent. Params: `startBar` 1 [1, 1024] integer, `beats` 2 [0.25, 16]. It is a track insert only (not allowed on the master); to stop the whole mix, add it to every audible track with the same values. Tape stops are a common way to introduce a drop or break. ([Attack Magazine](https://www.attackmagazine.com/technique/tutorials/creative-tape-stop-effects/), [MusicRadar](https://www.musicradar.com/news/10-time-tips))

`render --bars` is zero-based and half-open while `startBar` is 1-based: `--bars 8:12` renders song bars 9–12. A partial render of a tape-stop track pre-rolls from the start of the song, so the crop matches the full render.

## Standalone generator: `music2 sfx`

```sh
mkdir -p out
bun bin/music2.js sfx --preset pickup --seed 41 -o out/music2-pickup.wav --json
bun bin/music2.js sfx --preset riser --seconds 2 --params sweepFromHz=250,sweepToHz=8000 -o out/music2-riser.wav --json
```

Each call writes a 16-bit stereo WAV and `<basename>.sfx.json` beside it (`out/music2-pickup.sfx.json`); `artifacts` lists both. The sidecar holds `generatorVersion`, `preset`, `seed`, `seconds`, `frames`, `sampleRate` and the fully resolved `params`, in that order, with no paths or timestamps. Pass the same values back to regenerate the same bytes. Change `--seed` for a new variation of the same preset.

| Flag | Default | Rule |
| --- | --- | --- |
| `--preset` | required | One of the 21 presets below. |
| `-o`, `--out` | required | Path ending in `.wav`. An existing WAV **or** sidecar is refused with `E_ACCESS` (exit 4); nothing is overwritten. |
| `--seed` | 1 | Unsigned integer 0–4294967295. |
| `--seconds` | per preset | 0.05–30. Frames are `round(seconds × rate)`; the sidecar reports `frames / rate`. |
| `--sample-rate` | 44100 | 44100 or 48000. |
| `--params` | none | `key=value,...`, numeric; unknown, duplicate, empty, non-finite or out-of-range keys fail with `E_INPUT` (exit 2). |
| `--json` | off | Prints exactly one JSON object, on success or failure. |

**Transition presets** are the ten atoms above, rendered with variant 0 (defaults: riser, pitchriser, downlifter 2 s; impact, subdrop 0.8 s; whoosh 0.7 s; revcymbal, noisebuild 1 s; zap 0.14 s; crackle 2 s). Each accepts the track params listed for it in the atom table.

**Game and UI presets** use a physical-unit vocabulary inspired by the public descriptions of classic game-sound generators (implemented from scratch; the numbers are music2's own). Each seed draws the preset's randomized fields in a fixed order; `--params` then overrides any allowed key without changing the other draws.

| Preset | Character | Default length |
| --- | --- | --- |
| `pickup` | Coin/item: bright tone with an upward arpeggio jump | 0.2 s |
| `laser` | Fast downward sweep, square or saw | 0.18 s |
| `explosion` | Low filtered noise, long decay | 0.8 s |
| `powerup` | Rising, repeating, slightly vibrato | 0.6 s |
| `hit` | Short punchy noise/square fall | 0.15 s |
| `jump` | Upward slide that flattens | 0.25 s |
| `blip` | Short steady menu tick | 0.08 s |
| `alert` | Two-step pitched attention cue | 0.4 s |
| `click` | Very short high click | 0.05 s |
| `confirm` | Upward two-note "ok" | 0.22 s |
| `error` | Downward two-note "no" | 0.4 s |

Keys every game preset accepts: `wave` (integer 0 sine, 1 saw, 2 square, 3 noise), `fstart` Hz [40, 4000], `fmin` Hz [20, 1000] (the sound stops when a falling slide reaches it), `slide` octaves/s [-10, 8] (laser down to -14), `attack` s [0, 0.5], `sustain` s [0.002, 1], `punch` [0, 1], `decay` s [0.01, 2], `lpHz` [100, 21600], `hpHz` [20, 8000]. Presets also accept the fields they randomize (for example `jump` semitones [-24, 24] and `tArp` s [0, 0.5] for pickup, alert, confirm and error; `repeat` s and `vDepth` cents for powerup; `duty` for laser; `lpSweep` for explosion). A key a preset does not accept fails with `E_INPUT` and names the key. The sidecar of any game preset lists the full resolved parameter set, which is the easiest way to see the drawn values before overriding one.
