# Layering pass: give each band a job

Use this after writing a song and before treating its render as finished: run `music2 lint`, render, then run `music2 analyze` with `--song`. Lint flags arrangement risks from notes and controls; `analyze` measures the **whole rendered file**. A band share is normalized 20 Hz–20 kHz linear FFT power, not loudness, an isolated stem, or a judgment that someone heard the mix. The band edges and checks below are music2's **I (product) rules**; external mix advice is marked **V (source-stated)**. [TrackScore's linear-power comparison](https://trackscore.ai/blog/frequency-balance-electronic-music), [iZotope's genre-dependent ranges](https://www.izotope.com/community/blog/why-izotope-created-the-tonal-balance-control-plug-in).

## Assign owners before adding layers

An owner is the part you want to carry a band's main musical job, not an exclusive filter or a promise about the rendered share. This is an **I arrangement map** from [iZotope's instrument ranges](https://www.izotope.com/community/blog/eq-cheat-sheet), [Avid's 808 range](https://www.avid.com/resource-center/what-is-an-808), and [iZotope's masking examples](https://www.izotope.com/en/learn/what-is-frequency-masking).

| music2 band | Range | First owner to choose | Other roles to leave room for |
| --- | --- | --- | --- |
| `sub` | 20–60 Hz | 808 sustain **or** kick's deepest hit | Bass/pad should not sustain another sub line. |
| `low` | 60–250 Hz | Bass/808 body, with kick punch | Snare body may visit briefly; keep pad roots controlled. |
| `lowMid` | 250–500 Hz | One keys/pad body or bass articulation | Avoid piling low chords, bass harmonics, and snare boxiness. |
| `mid` | 500–2,000 Hz | Keys, pluck, or lead phrase | Give the focal melody a clear register. |
| `presence` | 2,000–8,000 Hz | Lead/vocal pocket, snare attack | Let hats and bells answer around the focal phrase. |
| `air` | 8,000–20,000 Hz | Hats/cymbals or bell top | Reverb texture can be wide and quiet. |

### One low owner at a time

Choose whether the sustained floor is `808`, `bass`, or a low `pad`; let the kick own its transient. If two low tracks play together, set one section's `patterns` override to `null`, shorten or stagger its notes, or move its line up an octave. Use a `filter` insert with `mode: "highpass"` on the secondary sound, or revoice/remove its low notes; an octave-up line alone is not a high-pass. [Sound On Sound: choose one main bass source (V)](https://www.soundonsound.com/techniques/mixing-bass), [iZotope: kick/bass masking (V)](https://www.izotope.com/community/blog/how-to-mix-kick-and-bass).

For house/techno bass that sounds across kick hits, put `"duck": {"by":"kick","amount":0.2,"releaseMs":110}` on the **bass** track, where `kick` is the ID of a drum track playing `bd`. `amount` 0.2–0.35 is an **I starting range**, then listen and remeasure; it is roughly 2–3.7 dB of instantaneous attenuation in music2's envelope. The lint rule treats a duck below 0.1 as effectively unmanaged, and its kick test requires an actual `bd` source. A source track containing hats or snare also triggers ducking on those events, so a dedicated kick track is easier to control. [Sound On Sound: modest kick ducking (V)](https://www.soundonsound.com/techniques/mixing-bass), [Attack: rolling techno kick space (V)](https://www.attackmagazine.com/technique/tutorials/warehouse-rolling-techno-bass), [EDMProd: 50–150 ms sub recovery guide (V)](https://www.edmprod.com/sub-bass/).

Trap/drill can deliberately align a short `bd` punch with a sustaining 808; shorten the kick's `params.decayMs` or stagger the next 808 note if the tail obscures it. A co-onset alone is not music2's house/techno duck warning. Use the 808's `params.drive` if small speakers need harmonics, then verify the rendered bands. [iZotope: short kick and 808 tail (V)](https://www.izotope.com/community/blog/how-to-mix-808s), [MusicRadar: 808 harmonics (V)](https://www.musicradar.com/tuition/tech/4-ways-to-process-a-roland-tr-808-bass-drum-633187).

### Voice chords above the mud

These **I music2 lower-note floors** translate a timbre-dependent low-interval guide into scientific note names. Here `c3` = MIDI 48 and `c4` = MIDI 60. A simultaneous pair with the named interval is a voicing prompt only when its lower note is **below** the floor; the exact floor passes. The source's octave naming and other authors' examples differ, so do not treat these cells as measured acoustic limits. [Sweetwater guide (not directly fetched in the research pass)](https://www.sweetwater.com/insync/low-interval-limit/), [Robin Hoffmann's discussion](https://www.robin-hoffmann.com/dfsb/low-interval-limits/), [Music SE discussion](https://music.stackexchange.com/questions/77173/lower-interval-limits/77176).

| Interval | m2 | M2 | m3 | M3 | P4 | Tritone | P5 | m6 | M6 | m7 | M7 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Lowest lower note | e3 (52) | eb3 (51) | c3 (48) | bb2 (46) | bb2 (46) | b2 (47) | bb1 (34) | g2 (43) | f2 (41) | f2 (41) | f2 (41) |

Move the root to the `bass`/`808` track and move close chord tones up an octave: a low keys chord `[c2,eb2,g2]` can become bass `c2` plus keys `[eb3,g3,c4]`. These bracketed comma groups are valid music2 chords; use `~ [eb3,g3,c4] ~` to place one chord inside a longer line. Inspect `events` to check actual overlaps. This arrangement change follows the documented 200–500 Hz mud risk; the result still needs a render check. [Production Expert: shared 200–500 Hz range (V)](https://www.production-expert.com/production-expert-1/6-eq-mistakes-to-avoid-when-mixing), [iZotope: piano mud range (V)](https://www.izotope.com/community/blog/eq-cheat-sheet).

### Keep a mids and presence pocket

Give `lead` (or a future vocal) the phrase you want heard. Let `keys`, `pluck`, or `bell` answer in its rests, an octave away, or on a different rhythm; for example lead `c5 ~ ~ g5` and pluck `~ c4 ~ ~`. If both focal tracks repeatedly attack on the same 16th-note steps in the same register, change one pattern or transpose its line. `generic/register_collision` is an **I** timing/register proxy, not measured masking. [EDMProd: call and response by pitch/intensity/sound (V)](https://www.edmprod.com/using-call-and-response/), [iZotope: vocal/pad/synth masking (V)](https://www.izotope.com/en/learn/what-is-frequency-masking).

Center `808`/`bass` (`"pan":0`) and the kick. Pan higher support parts such as hats, keys, and bell for width when it helps the focal part. Music2's track pan moves the entire voice; `generic/low_pan` checks that control, not frequency-specific mono compatibility. [EDMProd: mono lows guidance (V)](https://www.edmprod.com/mono-vs-stereo/), [iZotope: mid/side low-frequency control (V)](https://www.izotope.com/community/blog/what-is-midside-processing), [iZotope: secondary parts to the sides (V)](https://www.izotope.com/en/learn/what-is-panning-in-music).

### Levels are starting conventions

As a **convention**, place kick and sustained bass first, then bring hats and melody up until they read without covering the focal part. One trap producer's starting sheet puts hats roughly 10–12 dB and melody 12–15 dB below kick/808; another generic template puts pads 10–14 dB below kick. Those are examples, not music2 `gain` requirements. Music2 voices and their parameters produce different energy, so a JSON `gain` offset does **not** predict their rendered relative level. Change `gain`, velocity, note duration, or voice parameters, then read `analyze` bands and peak/loudness results. [Trap starting sheet (V)](https://louisromani.com/blog/how-to-mix-trap-drums), [generic level template (V)](https://pointprimerecordings.com/blog/volume-balancing-cheat-sheet/), [Sound On Sound: gain staging and headroom (V)](https://www.soundonsound.com/techniques/gain-staging-your-daw-software).

## Stack layers inside a role

Keep the role's pattern on one track. `layers` play those same events with their own instrument, gain, pan, velocity multiplier and inserts; notes layers can transpose, and drums layers can filter atom names with `only`. A layer cannot write its own pattern. Layer IDs are unique within a track; `main` is reserved for its original source.

Start supporting layer `gain` at −6 to −12 dB. This offset is relative to the main source before track gain, not a promise about measured RMS: different timbres have different energy. Track gain then controls the complete sum. For non-loop songs use `balance --target bass.mid=-8` to match the mid layer to `bass.main`, and `--target bass=-2 --reference kick` to match the summed bass track to kick. Keep sub mono and centered; only one source should carry the sustained fundamental. Put drive before a highpass when drive creates low harmonics. See [balance](mixing.md#match-levels-with-music2-balance).

This complete bass sketch keeps a triangle-like main under a driven octave layer. Save it as `bass-stack.song.json`, then validate and render:

```json
{
  "version": 1,
  "bpm": 124,
  "key": "C minor",
  "seed": 124,
  "tracks": [
    { "id": "kick", "kind": "drums", "instrument": "drums", "pattern": "bd*4", "gain": -9, "params": { "kit": 1, "decayMs": 100 } },
    { "id": "bass", "kind": "notes", "instrument": "bass", "pattern": "c2 ~ g2 ~", "mono": true, "pan": 0, "gain": -12,
      "params": { "wave": 2, "cutoffHz": 180 },
      "duck": { "by": "kick", "amount": 0.25, "releaseMs": 110 },
      "layers": [
        { "id": "mid", "instrument": "bass", "transpose": 12, "gain": -8,
          "params": { "wave": 0, "cutoffHz": 1800 },
          "fx": [{ "type": "drive", "amount": 2, "mix": 0.25 }, { "type": "filter", "mode": "highpass", "cutoffHz": 180 }] }
      ] }
  ],
  "sections": [{ "id": "drop", "bars": 2, "role": "groove" }],
  "arrangement": [{ "section": "drop" }]
}
```

This complete kick/clap sketch adds short kick body and snare/clap crack. `only` matches atom names before their `:index` variants: the body plays `bd` and `bd:1`, while the crack plays only `sd`/`cp`. It prevents a kick layer from doubling hats or backbeats on a mixed drum track.

```json
{
  "version": 1,
  "bpm": 124,
  "seed": 125,
  "tracks": [
    { "id": "kick", "kind": "drums", "instrument": "drums", "pattern": "bd ~ bd:1 ~", "gain": -9,
      "params": { "kit": 1, "decayMs": 100 },
      "layers": [{ "id": "body", "instrument": "drums", "gain": -9, "only": ["bd"], "params": { "kit": 2, "decayMs": 140 } }] },
    { "id": "clap", "kind": "drums", "instrument": "drums", "pattern": "~ [sd,cp] ~ [sd,cp]", "gain": -12,
      "params": { "kit": 3 },
      "layers": [{ "id": "crack", "instrument": "drums", "gain": -8, "only": ["sd", "cp"], "params": { "kit": 1, "tone": 0.8 },
        "fx": [{ "type": "filter", "mode": "highpass", "cutoffHz": 500 }] }] }
  ],
  "sections": [{ "id": "drop", "bars": 2, "role": "hook" }],
  "arrangement": [{ "section": "drop" }]
}
```

`generic/thin_peak_layers` is an `info` reminder, not a strict-lint failure. It inspects arranged `hook`/`groove` sections and reports one finding per audible, unlayered kick, backbeat, bass/808 or first audible melody track. Its `observed` lists the peak section IDs and its fix points to `layers`. An intentional single source can stay; a declared layer does not prove useful energy, so check layer RMS after rendering. Tracks muted or with no positive-velocity events in the peak do not count.

## Read genre balance as a warning guide

The table gives music2's **I warning thresholds**, not targets or published genre percentiles. Compare a song-backed render using its declared `genre`; WAV-only or unknown genre uses the fallback. TrackScore's club figures are provisional **V vendor examples** in a similar linear-power metric: its first four edges match music2's, while its high bands differ. It reports 79% funky/disco house, 84% deep/tech/melodic house, and 89% peak/minimal techno for combined 20–250 Hz; no equivalent six-band hip-hop corpus was found. [TrackScore](https://trackscore.ai/blog/frequency-balance-electronic-music), [iZotope: bass-heavy genre ranges](https://www.izotope.com/community/blog/why-izotope-created-the-tonal-balance-control-plug-in).

| Declared genre | `LOW_END_DOMINANCE` when `sub+low` is… | How to read it |
| --- | --- | --- |
| `trap`, `drill_uk`, `drill_ny` | > 0.92 | 808/kick may crowd the song; inspect body and top as well. |
| `house`, `techno` | > 0.92 | Above the provisional TrackScore club examples (79–89%) plus margin. |
| `boom_bap`, `lofi_hiphop` | > 0.85 | Check bass against keys and sample body. |
| unknown genre or WAV without `--song` | > 0.55 | Conservative fallback only; it is **not** a blanket bass limit. |

The other **I whole-file** guards apply to non-silent audio: `LOW_MID_BUILDUP` if `lowMid > 0.25` (all genres); `SUB_WITHOUT_BODY` if `sub/(sub+low) > 0.65` **and** `sub+low > 0.50`; `HIGH_END_THIN` if `presence+air < 0.02` except `lofi_hiphop`. A silent six-zero result skips these tonal prompts. TrackScore's electronic lowMid examples are about 3–7%; the 25% guard is deliberately broad. The sub/body guard is a translation prompt, not a saturation mandate, and the lo-fi high-end exemption reflects a documented rolled-off drum sound. [TrackScore (V)](https://trackscore.ai/blog/frequency-balance-electronic-music), [iZotope: 808 translation (V)](https://www.izotope.com/community/blog/how-to-mix-808s), [Native Instruments: lo-fi drum filtering (V)](https://blog.native-instruments.com/lo-fi-hip-hop-beats).

## Fix the song JSON, then rerender

Each row is an **I music2 warning response**, grounded in the arrangement and frequency sources linked above. Lint sees source events; analyze sees the finished whole-file balance. [Sound On Sound: low ownership](https://www.soundonsound.com/techniques/mixing-bass), [iZotope: masking](https://www.izotope.com/en/learn/what-is-frequency-masking), [TrackScore: band comparison](https://trackscore.ai/blog/frequency-balance-electronic-music).

| Warning | Concrete song JSON edit to try |
| --- | --- |
| `generic/low_end_overlap` | Keep one low `808`/`bass`/pad pattern per section; set the secondary `sections[].patterns[trackId]` to `null`, or move its notes above `bb2`. The lint guard starts at ≥25% overlapping section time for distinct audible low tracks. |
| `generic/low_chord_spacing` | Raise the offending close note in the `keys`/`pad` pattern by an octave; leave the root on `bass`. Use the table's exact lower-note floor. |
| `generic/low_pan` | Set the low track's `pan` to `0`; split a wide pad into a low centered part and higher side part if needed. The lint tolerance is `abs(pan)>0.1`. |
| `generic/kick_bass_unducked` | In house/techno, put `duck` on bass/808 with `by` pointing to a `bd` track and `amount` at least 0.1, or move bass attacks away from kick hits. |
| `generic/register_collision` | Change one lead/bell/pluck/keys `pattern` to answer in rests or transpose it by an octave. The warning compares focal register and shared 16th-note onsets, counting a chord once; moving one line an octave away or onto 16th steps the other leaves empty clears it. |
| `generic/sub_floor` | Move pitched notes at MIDI ≤22 up an octave, or remove them from the pattern; inspect whether the intended sub still translates. |
| `LOW_END_DOMINANCE` | Shorten or lower 808/bass, reduce its `gain`/velocity, or restore audible mid/high parts; rerender to check the selected genre guide. |
| `LOW_MID_BUILDUP` | Revoice low keys/pad chords upward, shorten overlapping notes, or lower the contributing part's `gain`; remeasure `lowMid`. |
| `SUB_WITHOUT_BODY` | Try more 808 `params.drive` or a bass part voiced above the sub, while retaining one low owner; remeasure `sub` versus `low`. |
| `HIGH_END_THIN` | Restore quiet `hh`/`oh` events or a higher lead/bell response, or raise their velocity/gain; remeasure `presence+air`. |

## Automation lanes replace static levels

Automation lanes are absolute: while a lane is active its value replaces the track's static `gain` or send; it is not added to it. A track with `"gain": -27` that should dip 8 dB into a build uses points like `-27 → -35 → -27`; writing `0 → -8 → 0` plays it 27 dB above its static level. `music2 lint` reports `generic/automation_gain_jump` when a gain lane rises more than 12 dB above the static gain and `generic/automation_send_jump` when a send lane rises more than 12 dB above a nonzero static send.
