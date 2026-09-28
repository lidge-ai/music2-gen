# R2: SFZ sample instruments (and a short SF2 note) for music2

Research date: 2026-09-28. Audience: the coding agent implementing SFZ import/rendering in music2 (MIT, zero-dependency TypeScript, offline, deterministic).

How to read the tags:
- **V** = verified on a page I fetched. The URL is given inline or as a short key such as `[sfz:region]`, which resolves in the Sources section.
- **I** = my own inference, recommendation or design choice. Nothing tagged I is a quote.
- No GPL/LGPL/AGPL source code was read. sfizz (BSD-2) was consulted only through its published opcode status table. Its source code was not read.

Short keys used below (full URLs in Sources): `sfz:<name>` = `https://sfzformat.com/opcodes/<name>/`, `sfzh:<name>` = `https://sfzformat.com/headers/<name>/`.

---

## 0. TL;DR for the implementer

1. SFZ is a plain-text file of `<header>` lines and `opcode=value` pairs that reference external audio files (WAV/FLAC/Ogg/AIFF). V `[sfz-home]`, `[sfz:sample]`
2. Opcodes are inherited through `<global>` → `<master>` → `<group>` → `<region>`. The most specific level wins. `<control>` holds file-level directives. V `[tut-basics]`, `[sfzh:control]`
3. Note names follow IPN, so **c4 = MIDI 60**. V `[legacy]` ("middle C in the keyboard is C4 and the MIDI note number 60"), `[tut-basics]`
4. Pitch: `cents = (key − pitch_keycenter)·pitch_keytrack + 100·transpose + tune`, then `ratio = 2^(cents/1200) · (fileRate/outRate)`. The formula is I, assembled from the V unit definitions in §2.
5. Minimal subset worth supporting (§3): about 35 SFZ v1 opcodes plus `default_path`, `#define`, `#include`, `note_offset`, `octave_offset`, `amplitude`. Both sfizz and sforzando support all of these (V, §3).
6. SF2 is a well-specified binary RIFF format, but faithful playback needs default modulators and more. Recommendation: SFZ first, SF2 later as an optional reader (I, §5).

---

## 1. File structure

### 1.1 Headers and their versions

| Header | Version | Role |
|---|---|---|
| `<region>` | SFZ v1 | Basic unit. At most one sample per region. V `[sfz-headers]`, `[tut-basics]` |
| `<group>` | SFZ v1 | Shared opcodes for the regions that follow. V `[sfz-headers]` |
| `<control>` | SFZ v2 | Special directives: `#define`, `default_path`, `note_offset`, `octave_offset`, `label_ccN`, `set_ccN`. Should come before `<global>`. V `[sfzh:control]` |
| `<global>` | SFZ v2 | Opcodes for all regions. The headers page calls it "one per file", but the global page says ARIA accepts several, each active until the next `<global>`. V `[sfz-headers]`, `[sfzh:global]` |
| `<curve>` | SFZ v2 | Curves `v000`..`v127`. Defaults `v000=0`, `v127=1`. Undefined points are interpolated linearly. Usually at the end of the file. V `[sfzh:curve]` |
| `<effect>` | SFZ v2 | Effect buses. Contents differ widely between players. V `[sfzh:effect]` |
| `<master>` | ARIA | Level between global and group. V `[sfz-headers]`, `[sfzh:master]` |
| `<midi>` | ARIA | (not needed) V `[sfz-headers]` |
| `<sample>` | SFZ v2 (Rapture) | Sample data embedded in the SFZ with a custom byte encoding. V `[sfzh:sample]` |

Built-in ARIA curves 0–6 (V `[sfzh:curve]`): 0 = linear 0..1 (default), 1 = bipolar −1..1, 2 = inverted 1..0, 3 = bipolar inverted, 4 = concave (used for CC7 and amp_veltrack), 5/6 = Xfin/Xfout power curves. Custom curves must use `curve_index` ≥ 7.

### 1.2 Inheritance and scoping

- **V** `[tut-basics]`: an opcode placed between `<group>` and its first `<region>` is inherited by those regions. `<global>` opcodes reach every group and region. A lower level overrides a higher one. Worked example from the page: global `volume=6`, group A `volume=5`, region 1 `volume=4` → region 1 = 4, region 2 (no volume set) = 5, region 3 in group B = 2 (set locally), region 4 = 6 (from global).
- **V** `[tut-basics]`: "a header ends when the next header of that type is started". There is no nesting. "group, global, and master are merely macros … the SFZ file will run as if everything is inside the regions themselves."
- **V** `[sfzh:group]`: group parameters "last till the next group opcode, or till the end of the file". The legacy spec's example annotates a new `<group>` as "previous group parameters reset" `[legacy]`.
- **V** `[tut-modular]`: `<master>` opcodes "remain in force until another `<master>` header is encountered". Opcodes under a `<group>` stop applying at the next `<group>`, even when that next group comes from an `#include`.
- **I (contract)**: effective value lookup order for a region is `region → group → master → global → built-in default`. Starting a header at level L clears the opcode sets of L and of every level below it. Example: a new `<master>` clears master, group and pending region opcodes, and keeps global. A new `<global>` clears global, master and group. `<control>` is a separate scope that is never merged into regions, except `default_path`, which applies to `sample` values. This matches every V example above. The "clears lower levels" part is I.
- **V** `[sfz:key]`: `key` sets lokey, hikey and pitch_keycenter together. Later opcodes override earlier ones inside the same header. The page recommends writing `key` first and `pitch_keycenter` after it. ARIA always honors an explicit pitch_keycenter whatever the order. Other players honor it only if it comes after `key`.
- **I (contract)**: expand `key=N` at parse time into three assignments, in source order within the header. That reproduces the non-ARIA order-dependent behavior. Also emit a lint warning when `pitch_keycenter` appears before `key` in the same header.

### 1.3 Lexical rules

- **V** `[sfzh:region]`, `[legacy]`: opcodes are `name=value` with **no spaces around `=`** (`sample = x.wav` is invalid). Opcodes are separated by spaces, tabs or newlines, and can be on one line or many.
- **V** `[legacy]`: a comment starts with `/` and runs to the end of the line. Every example uses `//`, including a trailing comment after opcodes (`lovel=0 hivel=20 // another comment`).
- **V** `[sfz-basic-template]`: the official template contains an inline block comment (`sample=/*wav or flac file*/`). **I**: support `/* … */` block comments. Strip comments before tokenizing, but not inside a `#include "…"` path.
- **V** `[sfz:sample]`: sample names may contain blanks and special characters except `=`. Paths are relative to the SFZ file's folder, and examples use backslashes (`sample=..\Samples\close\c4_pp_rr3.wav`).
- **I (contract)**: a value extends to the end of the line, or to the start of the next token matching `\s+[A-Za-z_][A-Za-z0-9_$]*=` or `<header>` or `//`. Trim trailing whitespace. This is required so `sample=My Piano C4.wav lokey=60` parses correctly. Normalize `\` to `/` in paths.
- **V** `[sfz:sample]`: ARIA accepts built-in oscillators `sample=*sine|*saw|*square|*triangle|*tri|*noise|*silence`, where `*` is literal. **I**: support at least `*silence` (used for choke regions) and `*sine` (useful for tests).
- **V** `[sfz:sample]`: if the sample file is not found, the player ignores the whole region.

### 1.4 `#define`, `#include`, `default_path`

- `#define $NAME value`: SFZ v2. Names start with `$`, and `$NAME` is replaced wherever it appears later. The page shows it under `<control>` and warns that redefining a variable mid-file "does not work well" in ARIA. V `[sfz:define]`. Several variables may be used on one line (e.g. `label_cc$MIC_MIX_CC=$MIC_NAME`), and a name that is a prefix of another (`$SNARE` vs `$SNARE_RIMSHOT`) "will fail in at least some SFZ players". V `[tut-modular]`.
  - **I (contract)**: process defines in source order (after includes are expanded) as a textual pre-pass. Replace with **longest-match-first** so `$SNARE_RIMSHOT` never becomes `38_RIMSHOT`. A redefinition takes effect for text after it.
- `#include "path"`: listed as ARIA on sfzformat. Supported by sfizz. The path **must be in double quotes**. The included file is pasted in place, and includes can nest ("recursion must be avoided"). The extension may be `.sfz` or `.sfzh`. V `[sfz:include]`. Paths in included files, both includes and samples, resolve **relative to the main SFZ file's folder**, not the included file's folder. V `[sfz:include]`, `[tut-modular]`.
  - **I (contract)**: fail on include cycles and on depth > 32. Reject includes that escape a configured sandbox root, since this is a CLI that reads user files.
- `default_path`: SFZ v2, under `<control>`. It is a prefix concatenated with `sample`, so it needs a trailing slash. Relative or absolute is allowed in ARIA, BassMIDI and sfizz. Cakewalk allows relative only. In ARIA a new `<control>` resets default_path only. V `[sfz:default_path]`, `[sfzh:control]`.
  - **I (contract)**: `resolvedPath = normalize(dir(mainSfz) + "/" + default_path + sample)`. If the sample is absolute, ignore default_path.
- `note_offset` (−127..127 semitones) and `octave_offset` (−10..10 octaves), SFZ v2, under `<control>`. They shift **incoming** MIDI notes. V `[sfz:note_offset]`, `[sfz:octave_offset]`. **I**: `effectiveKey = key + note_offset + 12·octave_offset`. Drop the note if the result falls outside 0..127.

### 1.5 Note names and octave convention

- **V** `[legacy]`: "Notes are expressed in MIDI Note Numbers, or in note names according to the International Pitch Notation (IPN) … middle C … is C4 and the MIDI note number 60." `pitch_keycenter` default is `60 (C4)`. Note-name range is `C-1 to G9`.
- **V** `[tut-basics]`: C1=24, C2=36, C3=48, C4=60, C5=72, C6=84, C7=96. The page adds that many samplers use C3=60 instead. `octave_offset=-1` "allows changing IPN notation into MMA, so C4 will be MIDI note 48" `[sfz:octave_offset]`.
- **V** examples: `key=c5` == `key=72` `[sfz:key]`. `c#2` `[sfz:pitch_keycenter]`. `D#4` `[sfz:lokey]`. `Cb3` (sw_down) `[legacy]`. Note names are written in both upper and lower case.
- **I (contract)**: `noteName := [A-Ga-g] ('#'|'b')? '-'? [0-9]`, case-insensitive letter. `midi = 12·(octave+1) + pc + accidental`, with pc: C0 D2 E4 F5 G7 A9 B11, `#`=+1, `b`=−1. So c4→60, a4→69, c-1→0, g9→127, cb3→47. Reject results outside 0..127, except the explicit `-1` for key/lokey/hikey (SFZ v2: "not triggered by keys") `[sfz:lokey]`.

---

## 2. Core opcodes: semantics, defaults, ranges, version

Version, type, default, range and unit come from each opcode page's info table (V, URL `sfz:<name>`) and the opcode index `[sfz-opcodes]`. "Notes" gives the page's semantics (V) unless tagged I.

| Opcode | Ver | Type | Default | Range / unit | Notes |
|---|---|---|---|---|---|
| `sample` | v1 | string | — | path | Relative to the SFZ folder. SFZ1 formats: WAV, Ogg Vorbis. SFZ2 adds AIFF. FLAC is supported by ARIA (not mandated). V `[sfz:sample]` |
| `lokey` / `hikey` | v1 | int | 0 / 127 | 0..127 (v2 allows −1) | Inclusive. Note names allowed. V `[sfz:lokey]` |
| `key` | v1 | int | — | 0..127 (−1 allowed) | = lokey=hikey=pitch_keycenter=N. V `[sfz:key]` |
| `lovel` / `hivel` | v1 | int | 1 / 127 | 1..127 | Plays if lovel ≤ vel ≤ hivel. Velocity 0 is note-off. V `[sfz:hivel]`. (The drum tutorial says "default value for lovel is 0". Treat 0 and 1 as equivalent, because vel 0 never triggers. I) |
| `pitch_keycenter` | v1 | int | 60 | 0..127 (index), legacy −127..127 | Root key. v2: value `sample` reads the root from file metadata, and falls back to 0 if the file has none. V `[sfz:pitch_keycenter]`, `[legacy]` |
| `pitch_keytrack` | v1 | int | 100 | −1200..1200 cents/key | 0 means every key plays the same pitch (drums). V `[sfz:pitch_keytrack]` |
| `tune` (alias `pitch`, ARIA) | v1 | int | 0 | −100..100 cents | ARIA accepts at least ±2400 and float values. V `[sfz:tune]` |
| `transpose` | v1 | int | 0 | −127..127 semitones | V `[sfz:transpose]` |
| `pitch_veltrack` | v1 | int | 0 | −9600..9600 cents | "how much the pitch changes with incoming note velocity". V `[sfz-opcodes]` |
| `volume` | v1 | float | 0 | −144..6 dB | Many players allow more than +6 (sfz.dll +24, ARIA ≥ +144). V `[sfz:volume]` |
| `amplitude` | **ARIA** | float | 100 | 0..100 % | Linear percentage. ARIA/sforzando don't clamp it, and negative values invert the signal. V `[sfz:amplitude]` |
| `pan` | v1 | float | 0 | −100..100 % | Mono: position. Stereo: relative channel amplitude. Negative = left. V `[sfz:pan]` |
| `width` | v1 | float | 100 | −100..100 % | Stereo only. 0 = mono, negative = channels swapped. V `[sfz:width]` |
| `position` | v1 | float | 0 | −100..100 % | Stereo only, applied after width. V `[sfz-opcodes]` |
| `offset` | v1 | int | 0 | 0..2^32 sample frames | Playback start frame. V `[sfz:offset]` |
| `end` | v1 | int | unspecified (= last frame) | 0..2^32 frames | **Inclusive**. `end=-1` means the region does not sound but is still "triggered", so it can choke others. Frames number from 0. V `[sfz:end]` |
| `count` | v1 | int | 0 | 0..2^32 | Plays the sample N times and forces one_shot. count=0 behavior differs between players. V `[sfz:count]` |
| `loop_mode` | v1 | string | `no_loop` if the file has no loop, `loop_continuous` if it has one | `no_loop`, `one_shot`, `loop_continuous`, `loop_sustain` | See 2.1. V `[sfz:loop_mode]` |
| `loop_start` / `loop_end` | v1 | int | 0 / 0 (effective: the file's first loop) | frames | Override the file loop. loop_end is **inclusive**. No effect with no_loop. V `[sfz:loop_start]`, `[sfz:loop_end]` |
| `direction` | v2 | string | forward | forward/reverse | V `[sfz-opcodes]` |
| `trigger` | v1 | string | `attack` | `attack`, `release`, `first`, `legato` (v1). `release_key` (v2) | See 2.2. V `[sfz:trigger]` |
| `ampeg_delay` | v1 | float | 0 | 0..100 s | Time from note-on to the start of attack. Counted after the region `delay`. V `[sfz:ampeg_delay]` |
| `ampeg_start` | v1 | float | 0 | 0..100 % | Envelope level at the start of attack. V `[sfz:ampeg_start]` |
| `ampeg_attack` | v1 | float | 0 | 0..100 s | V `[sfz:ampeg_attack]` |
| `ampeg_hold` | v1 | float | 0 | 0..100 s | Holds at the maximum level. V `[sfz:ampeg_hold]` |
| `ampeg_decay` | v1 | float | 0 | 0..100 s | V `[sfz:ampeg_decay]` |
| `ampeg_sustain` | v1 | float | 100 | 0..100 % | V `[sfz:ampeg_sustain]` |
| `ampeg_release` | v1 | float | **0.001** | 0..100 s | Spec and Cakewalk default is 0.001. **ARIA uses 0.03**. V `[sfz:ampeg_release]` |
| `amp_veltrack` | v1 | float | 100 | −100..100 % | At 100: `Gain(v) = 20·log10((v/127)^2)` dB. V `[sfz:amp_veltrack]`, `[legacy]` |
| `amp_velcurve_N` | v1 | float | standard curve | 0..1, N = 0..127 | Piecewise linear. `_127` defaults to 1, `_0` is effectively 0. V `[sfz:amp_velcurve_N]` |
| `amp_keytrack` / `amp_keycenter` | v1 | float / int | 0 / 60 | −96..12 dB per key / 0..127 | V `[sfz-opcodes]`, `[legacy]` |
| `amp_random` | v1 | float | 0 | 0..24 dB | V `[sfz-opcodes]` |
| `pitch_random` | v1 | int | 0 | 0..9600 cents | V `[sfz-opcodes]` |
| `group` (alias `polyphony_group`, ARIA) | v1 | int | 0 | int32 | Exclusive group id. V `[sfz:group]` |
| `off_by` | v1 | int | 0 | int32 | This region is turned off when a region whose `group` equals this value starts. V `[sfz:off_by]` |
| `off_mode` | v1 | string | `fast` | `fast`, `normal` (v1). `time` (ARIA) | V `[sfz:off_mode]` |
| `off_time` | ARIA | float | 0.006 s | | V `[sfz-opcodes]` |
| `seq_length` / `seq_position` | v1 | int | 1 / 1 | 1..100 | Round robin. V `[sfz:seq_length]`, `[sfz:seq_position]` |
| `lorand` / `hirand` | v1 | float | 0 / 1 | 0..1 | Plays if `lorand ≤ r < hirand`, with a new r in [0,1) on each note-on. V `[sfz:lorand]` |
| `rt_decay` | v1 | float | 0 | 0..200 dB/s | Release regions only: attenuation per second since the matching attack note-on. V `[sfz:rt_decay]` |
| `delay` | v1 | float | 0 | 0..100 s | Region start delay. V `[sfz-opcodes]` |
| `sw_lokey`/`sw_hikey`/`sw_last` | v1 | int | −1 | 0..127 | Sticky keyswitch. V `[sfz:sw_last]` |
| `sw_default` | v2 | int | — | 0..127 | Keyswitch selected at load. V `[sfz:sw_default]` |
| `polyphony` | v2 | int | — | | Voice cap per group/header. `legato_high/last/low` → 1. V `[sfz:polyphony]` |
| `note_polyphony` | v2 | int | — | | V `[sfz-opcodes]` |
| `default_path`, `note_offset`, `octave_offset`, `#define` | v2 | | | | §1.4 |
| `#include` | ARIA (per sfzformat) | | | | §1.4 |
| `global_volume`, `master_volume`, `group_volume`, `global_amplitude`, … | ARIA | | 0 dB / 100 % | | V `[sfz:volume]`, `[sfz-opcodes]` |
| `ampeg_attack_shape` etc. | ARIA | float | 0 | | Curvature per stage. V `[sfz-opcodes]`, `[sfz-eg]` |

On the SFZ v2 vs ARIA split: sfzformat counts as "SFZ v2" anything in Simon Cann's *Cakewalk Synthesizers* book, and as an "ARIA extension" anything that works in ARIA but no Cakewalk product. It also says new players need not support every opcode. V `[sfz-versions]`

### 2.1 loop_mode semantics (V `[sfz:loop_mode]` unless tagged)

- `no_loop`: plays from start to end, or until note-off (then release), whichever comes first. The release can be cut short when the sample ends.
- `one_shot`: plays from start to end and **ignores note-off**. Used for drums. Set automatically when `count` is defined. In ARIA and Cakewalk, one_shot ignores file loop points.
- `loop_continuous`: loops from reaching the loop point until the voice ends, **including during release**. A release longer than the loop simply keeps looping.
- `loop_sustain`: loops while the note is held (key down, or CC64 sustain). No looping in release, so playback continues past loop_end toward the end of the sample.
- Default: whatever the file's loop metadata implies (first loop). With no loop in the file, no_loop.
- `trigger=release`/`release_key` regions behave as one_shot. A release region inheriting loop_continuous would loop forever, so the page recommends setting one_shot explicitly on release regions. V `[sfz:trigger]`, `[sfz:loop_mode]`
- ARIA quirk: loop_continuous or loop_sustain with no loop in the file and no loop_end loops the whole file. V `[sfz:loop_mode]`, `[sfz:loop_end]`
- File loop metadata comes from the WAV `smpl` chunk. Layout (V `[wav-smpl]`): chunk id `smpl`, u32 size, then at offset 0x08: manufacturer u32, product u32, samplePeriod u32 (ns), **MIDIUnityNote u32 (0..127)**, **MIDIPitchFraction u32** (fraction of a semitone, 0x80000000 = 50 cents), SMPTEFormat u32, SMPTEOffset u32, **numSampleLoops u32** at 0x24, samplerDataBytes u32 at 0x28, then loops of 24 bytes each starting at 0x2C: id u32, type u32 (0 forward, 1 alternating, 2 backward), **start u32**, **end u32 (end sample is also played)**, fraction u32, playCount u32 (0 = infinite). All little-endian (I: RIFF convention). **I**: use `loops[0].start/end` as the default loop. Use `MIDIUnityNote` for `pitch_keycenter=sample`, and `MIDIPitchFraction/2^32·100` cents as extra tune.

### 2.2 trigger semantics (V `[sfz:trigger]`)

- `attack`: plays on note-on (default).
- `release`: plays on note-off, or on sustain-pedal release if the pedal was holding the note. Uses the **velocity of the matching note-on**.
- `first`: note-on only when no other note is sounding. `legato`: note-on only when another note is held.
- `release_key` (v2): plays on note-off and ignores the sustain pedal.
- Player differences: ARIA/sforzando require a still-playing matching attack region for `release` but not for `release_key`. rgc sfz requires neither. Cakewalk requires both unless `rt_dead=on`. "Corresponding" means same MIDI note and same velocity range. Round robins need not match. `rt_decay` scales the release volume by the time since the attack.
- **I (contract)**: don't require a matching attack region. Scale release regions by `rt_decay`: `gain_dB = −rt_decay · (t_noteoff − t_noteon)`. Example: rt_decay=3 and a 2 s note gives −6 dB (×0.501187).

### 2.3 Exclusive groups (choke) (V `[sfz:group]`, `[sfz:off_by]`, `[sfz:off_mode]`)

- When a region with `group=G` starts, every sounding voice whose `off_by == G` is turned off.
- Both default to 0, which would literally make everything monophonic. rgc sfz, Cakewalk, BassMIDI and LinuxSampler special-case `group=0, off_by=0` as "no muting". ARIA instead uses a default off_by of 4294967295.
- `off_mode=fast` (default): voice stops immediately. ARIA uses a 6 ms fade. `off_mode=normal`: voice enters its release stage (ampeg_release).
- A region that makes no sound (`end=-1`, or `sample=*silence`) still triggers, so it can choke others. V `[sfz:end]`, `[sfz:sample]`
- **I (contract)**: choke only when `off_by ≠ 0`. Evaluate choking **before** starting the new voice. A new voice never chokes itself or other voices started by the same note-on event. For `fast`, apply a linear 6 ms fade-out (deterministic, click-free) rather than a hard cut. Document the 6 ms.

### 2.4 Round robin: seq_length / seq_position (V `[sfz:seq_length]`, `[sfz:seq_position]`)

- "The player will keep an internal counter creating a consecutive note-on sequence for each region, starting at 1 and resetting at seq_length." A region plays if its counter equals seq_position. seq_position is combined with the other conditions, so irregular mappings can produce silent steps.
- Some players track the sequence per velocity range, which causes gaps when sequence steps have different velocity splits. ARIA doesn't track position globally.
- seq_length=0 acts like 1 in Cakewalk, sfizz and BassMIDI. seq_position=0 acts like 1 in sfizz and silences the region in most other players.
- **I (contract), deterministic and matching the V description**: each region has a counter `c`, initially 1. On each note-on, for every region whose *other* conditions (key, vel, rand, keyswitch, trigger) match: the region plays iff `c == seq_position`, then `c = (c mod seq_length) + 1`. Regions in one round-robin set share identical conditions, so their counters advance together. Clamp seq_length and seq_position to ≥ 1.

### 2.5 Random: lorand / hirand (V `[sfz:lorand]`)

- Condition `lorand ≤ r < hirand` with r ∈ [0,1) drawn on each note-on. Adjacent regions must share boundaries (`hirand` of one = `lorand` of the next). Otherwise gaps give silence.
- ARIA draws a separate r per region, which breaks multi-mic alignment.
- **I (contract)**: draw **one r per note-on event** from a seeded PRNG (for example mulberry32 or xorshift32 seeded from `songSeed ^ trackIndex ^ noteIndex`). Share it across all regions for that event. Treat `hirand ≥ 1` as including r values just below 1. Record the seed in render metadata so renders are reproducible.

### 2.6 Velocity → amplitude (V formulas, I combination)

- V `[sfz:amp_veltrack]`: with amp_veltrack=100, `Gain_dB(v) = 20·log10((v/127)^2)`, so linear gain = `(v/127)^2`. v=127 → 0 dB. v=100 → 0.620001 (−4.152 dB). v=64 → 0.253953 (−11.905 dB). The legacy spec states the same curve as `20 log(127^2/v^2)` of attenuation `[legacy]`.
- V `[sfz:amp_velcurve_N]`: `amp_velcurve_N` points give linear amplitude 0..1 at velocity N, interpolated linearly between defined points. `_127` defaults to 1 if unset, `_0` is effectively 0. Example: `_1=0.2 _3=0.3` gives `_2=0.25`.
- **Conflict (V, both on sfzformat)**: the amp_velcurve_N page says that with no points set "the volume … is the same as if amp_velcurve_1=0.007874016", which is linear v/127. The amp_veltrack page and the legacy spec give the squared curve. **I (contract)**: with no `amp_velcurve_N` defined, use `(v/127)^2`, which matches two of the three sources, including the legacy spec. With any point defined, use piecewise-linear interpolation over {0→0 unless set, defined points, 127→1 unless set}.
- **I (contract)** for amp_veltrack between −100 and 100 (the formula is not on sfzformat): `t = amp_veltrack/100`, `c = curve(v)` from the rule above. For t ≥ 0, `g = 1 − t + t·c`. For t < 0, `g = 1 + t·c` (so −100 silences v=127, as the page describes). Mark this as an approximation, and test only t ∈ {0, 100} against real players.

---

## 3. Player support and recommended subset

### 3.1 What the major free players support

- **sforzando** (Plogue, freeware, Windows/macOS/Linux): "A free, highly SFZ 2.0 compliant sample player. Supports almost all SFZ v1 and v2 opcodes, plus ARIA extensions." V `[sfz-players]`. Sforzando "offers the most complete SFZ standard support". V `[sfz-players]`. It converts SF2, DLS and acidized WAV to SFZ 2.0 on drop. V `[sforzando]`.
- **sfizz** (BSD-2-Clause, library plus AU/LV2/VST3). V `[sfz-players]`. From its published opcode support table (829 rows, read 2026-09-28; V `[sfizz-status]`):
  - SFZ v1: 186 supported, 2 in progress (`lobpm`, `hibpm`), 4 unsupported (`lochan`, `hichan`, `sync_beats`, `sync_offset`).
  - SFZ v2: 209 supported, 220 unsupported, 2 in progress. ARIA: 80 supported, 92 unsupported.
  - **Every opcode in §2's table is marked supported by sfizz**, including `amplitude` (ARIA), `#include` (ARIA), `off_time` (ARIA), `global/master/group_volume` (ARIA), `default_path`, `#define`, `note_offset`, `octave_offset`, `direction`, `loop_crossfade`, and `pitch_keycenter` with the `sample` value. `ampeg_attack_shape` (ARIA) is **not** supported.
- Sample formats (V `[sfz-engines]`): sfizz reads AIFF, FLAC, MP3, Ogg, WAV and WavPack. ARIA reads AIFF, FLAC, Ogg and WAV (as far as the rendered table shows). SFZ1 mandates only WAV and Ogg Vorbis. V `[sfz:sample]`.
- Other: liquidsfz (LGPL-2.1) and others publish opcode lists (links on `[sfz-players]`, not read). The sfzformat Players page also lists `sfz-web-player` as a CC0-1.0 TypeScript Web Audio player (V `[sfz-players]`). Its code was not read. A CC0 license would permit reading it if desired.

### 3.2 Recommended minimal subset (I, based on V usage in tutorials and libraries)

The drum tutorial says "even highly complicated instruments with thousands of samples will usually only use a dozen or two different opcodes". Its essentials are sample, key, lovel/hivel, amp_velcurve_N, seq_length/seq_position, lorand/hirand and loop_mode. The sustained-note tutorial adds lokey/hikey, pitch_keycenter, xfin/xfout, locc/hicc, keyswitching, group, off_by and off_mode. V `[sfz-home]`, `[tut-drum]`.

**Tier A (must):**
- Headers: `<control> <global> <master> <group> <region>`.
- Directives: `#include`, `#define`, `default_path`, `note_offset`, `octave_offset`.
- Opcodes: `sample` (+ `*silence`, `*sine`), `lokey hikey key lovel hivel pitch_keycenter pitch_keytrack tune pitch transpose volume amplitude pan offset end loop_mode loop_start loop_end trigger(attack, release, release_key, first, legato) ampeg_delay ampeg_start ampeg_attack ampeg_hold ampeg_decay ampeg_sustain ampeg_release amp_veltrack amp_velcurve_N group polyphony_group off_by off_mode seq_length seq_position lorand hirand rt_decay`, plus the aliases `loopmode loopstart loopend offby`.
- File formats: WAV (PCM 16/24/32-bit int, 32-bit float), including the `smpl` chunk.

**Tier B (nice):** `sw_lokey sw_hikey sw_last sw_default` (keyswitch articulations, e.g. Salamander remap and VSCO), `width position`, `amp_keytrack amp_keycenter`, `count`, `delay`, `direction=reverse`, `polyphony`, `note_polyphony`, `global_volume master_volume group_volume`, `pitch_keycenter=sample`.

**Tier C (parse, then warn and ignore):** all `*_onccN`/`*_ccN` modulations, `locc/hicc` (**I**: evaluate with CC defaults set by `set_ccN`, default 0, as static conditions so CC-gated regions choose sensibly), filters (`fil_type`, `cutoff`, `resonance`, `fileg_*`), LFOs, flex EGs `egN_*`, `xfin_*/xfout_*`, `<curve>` (store the curves, use them only when a supported opcode references one), `<effect>`, `<sample>`, `<midi>`.

**Codecs:** FLAC and Ogg need decoders. Many free libraries ship FLAC (Salamander, Greg Sullivan, FreePats, Big Rusty Drums, Virtuosity Drums; §4). A zero-dependency FLAC decoder is feasible (roughly 600–900 LOC in TypeScript, I). Ogg Vorbis is much larger. **I**: WAV in v1, FLAC in v2, Ogg not planned. Report "unsupported codec" per region rather than failing the whole instrument.

---

## 4. Free, redistributable SFZ libraries (document only, do not bundle)

License filter: CC0 / CC-BY / public domain. Sizes are as stated by the publisher, not measured by me. Everything in this table was verified on the linked pages by a research subagent.

| Library (author) | License | Size (as published) | Format | URL |
|---|---|---|---|---|
| **FreePats Upright Piano KW, small** (Gonzalo & Roberto) | CC0 1.0 V | 2.9 MiB compressed / 3.3 MiB unpacked V | SFZ + FLAC | https://freepats.zenvoid.org/Piano/acoustic-grand-piano.html → https://freepats.zenvoid.org/Piano/UprightPianoKW/UprightPianoKW-small-SFZ+FLAC-20190703.7z |
| **FreePats Sweep Pad** (synthesized, ZynAddSubFX/Yoshimi) | CC0 1.0 V | 2.9 MiB / 3.0 MiB V | SFZ + FLAC | https://freepats.zenvoid.org/Synthesizer/synth-pad.html → https://github.com/freepats/sweep-pad/releases/download/2019-08-13/SweepPad-SFZ+FLAC-20190813.7z |
| **FreePats Hang in D minor** | CC0 1.0 V | 13 MiB compressed V | SFZ + FLAC | https://freepats.zenvoid.org/ChromaticPercussion/hang.html |
| **Salamander Grand Piano V3** (Alexander Holm) | **CC-BY 3.0** V | 707 MiB (FLAC, 48 kHz/24-bit) or 394 MiB (WAV 44.1 kHz/16-bit) V | SFZ + FLAC or WAV. 16 velocity layers, sampled every minor third, release and resonance samples V | https://freepats.zenvoid.org/Piano/acoustic-grand-piano.html, https://archive.org/details/SalamanderGrandPianoV3 |
| **VSCO 2 Community Edition 1.1.0** (Versilian Studios) | CC0 1.0 V | ≈2.3 GB ZIP V (catalog estimate) | SFZ + WAV 44.1 kHz. Publisher calls the mapping "vanilla" V | https://github.com/sgossner/VSCO-2-CE (LICENSE), https://versilian-studios.com/vsco-community |
| **Greg Sullivan E-Pianos** (remap by kinwie) | CC-BY 3.0 Unported V | ≈21.5 MB V | SFZ v2 + ARIA extensions, FLAC V | https://github.com/sfzinstruments/GregSullivan.E-Pianos |
| **Karoryfer Meatbass** | CC0 1.0 V | 242 MB V | SFZ + WAV | https://shop.karoryfer.com/pages/free-meatbass |
| **Karoryfer Emilyguitar** | CC0 1.0 V | 98 MB V | SFZ + WAV 44.1 kHz/24-bit V | https://shop.karoryfer.com/pages/free-emilyguitar |
| **Big Rusty Drums 1.100** (Karoryfer) | CC0 1.0 V | Current ZIP size not stated. 2.3 GB of samples historically (WAV era) V | SFZ + mostly FLAC in 1.100 V | https://github.com/sfzinstruments/karoryfer.big-rusty-drums |
| **Virtuosity Drums 0.925** (Versilian + Karoryfer) | CC0 1.0 V | ≈1.1 GB installed V | SFZ + FLAC 48 kHz/24-bit V. Uses `#include`/`<master>` heavily (V `[tut-basics]` cites it as the include example) | https://versilian-studios.com/virtuosity-drums |

Karoryfer's blanket CC0 statement for its free libraries excludes Marie Ork. V https://shop.karoryfer.com/pages/free-samples

**Rejected:**
- Virtual Playing Orchestra 3.3: a license mix including CC Sampling Plus 1.0 and CC-BY-SA 3.0/4.0, so it fails the filter. V https://virtualplaying.com/virtual-playing-orchestra/
- jRhodes3c: CC-BY-NC-SA 4.0. V https://sfzinstruments.github.io/pianos/jrhodes3c
- jRhodes3d: samples are CC-BY-NC 4.0. V https://sfzinstruments.github.io/pianos/jrhodes3d
- FreePats as a whole is not blanket CC0; check each instrument. V https://freepats.zenvoid.org/about.html

**Caveat (V):** the SFZ Instruments remap of Salamander (https://github.com/sfzinstruments/SalamanderGrandPiano) uses SFZ v2/ARIA extensions and keyswitches between patches, and warns that non-ARIA players may misplay it. The FreePats archive has a simpler mapping.

**I, recommendations:**
- For **tests**, don't depend on any download. Generate synthetic WAVs in the test suite (sine, impulse, DC ramp). Tests stay deterministic, small and license-free.
- For **user docs / optional smoke tests**: Upright Piano KW small (2.9 MiB, CC0, acoustic, FLAC) and Sweep Pad (2.9 MiB, CC0, synthetic).
- For **"big library" docs**: VSCO 2 CE (CC0, WAV) and Salamander (CC-BY 3.0, requires attribution to Alexander Holm).

---

## 5. SF2 (SoundFont 2.04) in brief

All facts below were verified by a subagent against the E-mu/Creative *SoundFont Technical Specification 2.04* PDF (page numbers in brackets), at https://raw.githubusercontent.com/davy7125/soundfont-standard-v3/master/sfspec24.pdf. The FreePats mirror returned 404.

### 5.1 Container

- V [pp. 11–16]: little-endian RIFF. A chunk is `FourCC[4] ckSize:u32 payload[ckSize]`, plus a pad byte after odd payloads (not counted in ckSize). Root: `RIFF <size> 'sfbk'` → `LIST 'INFO'`, `LIST 'sdta'`, `LIST 'pdta'`, in that order.
- V [pp. 13, 16–20]: INFO. Mandatory: `ifil` (wMajor u16, wMinor u16), `isng`, `INAM`. Optional: `irom`, `iver`, `ICRD`, `IENG`, `IPRD`, `ICOP`, `ICMT`, `ISFT`. Strings are zero-terminated and padded to even length, at most 256 bytes.
- V [p. 20]: sdta. `smpl` holds signed 16-bit LE PCM. Optional `sm24` (new in 2.04) holds 1 low byte per point; ignore it if its size ≠ smpl bytes/2 (+pad) or if ifil < 2.04. Each sample is followed by ≥ 46 zero points.
- V [pp. 21–29]: **pdta "hydra"**, 9 mandatory subchunks in fixed order, each an array of fixed-size records:

| Chunk | Bytes | Fields |
|---|---:|---|
| `phdr` | 38 | name[20], wPreset u16, wBank u16, wPresetBagNdx u16, dwLibrary u32, dwGenre u32, dwMorphology u32 |
| `pbag` | 4 | wGenNdx u16, wModNdx u16 |
| `pmod` | 10 | srcOper u16, destOper u16, amount i16, amtSrcOper u16, transOper u16 |
| `pgen` | 4 | genOper u16, genAmount (i16 / u16 / {lo u8, hi u8}) |
| `inst` | 22 | name[20], wInstBagNdx u16 |
| `ibag` | 4 | wInstGenNdx u16, wInstModNdx u16 |
| `imod` | 10 | as pmod |
| `igen` | 4 | as pgen |
| `shdr` | 46 | name[20], dwStart, dwEnd, dwStartloop, dwEndloop, dwSampleRate (u32 each), byOriginalPitch u8, chPitchCorrection i8, wSampleLink u16, sfSampleType u16 |

- V: zones span from index[i] to index[i+1], so every list ends with a terminal record (EOP/EOI/EOS). The first zone is global if it doesn't end in `instrument` (41, preset level) or `sampleID` (53, instrument level). shdr positions count sample points, `dwEndloop` is the first point *after* the loop, byOriginalPitch 255 means 60, sfSampleType 1 mono / 2 right / 4 left / 8 linked.
- V key generators: 0–3 address offsets, and 4/12/45/50 coarse offsets (×32768). 17 pan (0.1 %, −500..500). 33–38 volume envelope (timecents, default −12000; sustain 37 in cB). 43 keyRange, 44 velRange. 48 initialAttenuation (cB). 51 coarseTune (semitones), 52 fineTune (cents). 53 sampleID. 54 sampleModes (0 none, 1 continuous, 3 loop while held). 56 scaleTuning (cents per key, default 100). 57 exclusiveClass. 58 overridingRootKey. `seconds = 2^(tc/1200)` [p. 50].
- V [pp. 24, 27–28, 50–51]: instrument-level generators are absolute. Preset-level ones **add** to them (key/vel ranges intersect instead). Default modulators are implicit, for example velocity → initialAttenuation through a concave curve up to 960 cB, and velocity → filter cutoff −2400 cents [pp. 41–42].
- V: the spec's prose on the byte order of keyRange/velRange contradicts its union labels. **I**: use lo byte = min, hi byte = max, and test against real banks.
- V (FluidSynth wiki, docs only): SF3 is an **unofficial** Vorbis-compressed variant.

### 5.2 Is SF2 worth it versus SFZ? (I)

- **Pro SF2:** it's a single self-contained file (no path resolution), with a precise binary spec and many GM banks. Parsing takes about 300–500 LOC. 16-bit PCM needs no codec.
- **Con SF2:** audible fidelity requires default and explicit modulators, the concave velocity curve, the filter (velocity → cutoff), timecent/centibel envelopes with SF2-specific curves, stereo linking, preset/instrument additive semantics and the key-range byte ambiguity. Many popular free SF2s carry unclear licenses. SF3 would need a Vorbis decoder.
- **Pro SFZ:** text is easy to diff and test. The opcode subset in §3.2 covers most free libraries. The semantics map directly onto a sample voice. The major free libraries in §4 are SFZ.
- **Recommendation:** ship SFZ (Tier A plus WAV) first. Later, SF2 could be added as **an import path that converts SF2 to the same internal region model** (as sforzando does, V `[sforzando]`), supporting generators 0–5, 12, 17, 33–38, 41, 43–45, 48, 50–54, 56–58 and only the default velocity → attenuation modulator. Warn and ignore other modulators and the filter.

---

## 6. Implementation contract suggestions

Everything in §6 is **I** (design) unless it cites a V fact from above.

### 6.1 Parser rules

1. Read the file as UTF-8, falling back to Latin-1 if decoding fails. Normalize CRLF to LF.
2. **Preprocess**, in one pass that keeps line numbers for diagnostics:
   a. Expand `#include "rel/path"` recursively. Paths are relative to the main file's directory (V §1.4). Error on a cycle or depth > 32.
   b. Strip `/* … */` and `// …` comments. A lone `/` followed by a non-`/` character is kept as a path character.
   c. Collect `#define $NAME value` (value = rest of line, trimmed) and substitute later occurrences, longest name first.
3. **Tokenize**: `<name>` → Header, `name=value` → Opcode, using the value rule in §1.3. Opcode names are ASCII `[a-z0-9_]+` with a `$`-free final form. Treat names as case-sensitive lowercase, and warn on uppercase.
4. **Scopes**: `control`, `global`, `master`, `group`, and the current region. Opening a header resets that level and all lower levels (§1.2). A region is emitted when the next header starts or at EOF. The emitted opcode map is `merge(global, master, group, region)` in that order, later wins. `control` values `default_path`, `note_offset`, `octave_offset` and `set_ccN` are captured **at the time the region is emitted**, so a new `<control>` with a different `default_path` affects later regions only (V ARIA behavior).
5. **Typed coercion** per opcode: int = `parseInt` after optional note-name conversion, only for `*key*`, `pitch_keycenter`, `sw_*` and `amp_keycenter`. float = `Number()`. Clamp to the spec range and emit a warning when clamping. Unknown opcodes produce a warning, not an error, and are recorded in a "not supported" report.
6. Aliases: `pitch→tune`, `polyphony_group→group`, `loopmode→loop_mode`, `loopstart→loop_start`, `loopend→loop_end`, `offby→off_by`, `gain_ccN→volume_ccN` (ignored), `*_ccN ≡ *_onccN`.
7. Output a frozen `Instrument { regions: Region[], curves, warnings[], unsupported: Set<string> }` with fully defaulted numeric fields. That makes the rendering stage a pure function.

### 6.2 Minimal Region model with defaults (V defaults from §2)

```ts
interface Region {
  sample: string;          // resolved absolute path, or "*silence" | "*sine"
  lokey: number;  // 0     (key → sets lokey/hikey/pitch_keycenter)
  hikey: number;  // 127
  lovel: number;  // 1
  hivel: number;  // 127
  pitchKeycenter: number | 'sample'; // 60
  pitchKeytrack: number;   // 100 cents/key
  pitchVeltrack: number;   // 0 cents
  tune: number;            // 0 cents
  transpose: number;       // 0 semitones
  volume: number;          // 0 dB
  amplitude: number;       // 100 %
  pan: number;             // 0 (−100..100)
  width: number;           // 100
  position: number;        // 0
  offset: number;          // 0 frames
  end: number | null;      // null = last frame; −1 = silent-but-triggered
  loopMode: 'no_loop'|'one_shot'|'loop_continuous'|'loop_sustain'|null; // null = from file
  loopStart: number | null; loopEnd: number | null; // null = from file smpl loop[0]
  trigger: 'attack'|'release'|'release_key'|'first'|'legato'; // 'attack'
  ampeg: { delay: 0; start: 0; attack: 0; hold: 0; decay: 0; sustain: 100; release: 0.001 };
  ampVeltrack: number;     // 100
  ampVelcurve: Map<number, number>; // empty = default curve
  ampKeytrack: number; ampKeycenter: number; // 0 dB/key, 60
  group: number; offBy: number; offMode: 'fast'|'normal'; // 0, 0, 'fast'
  seqLength: number; seqPosition: number; // 1, 1
  lorand: number; hirand: number;         // 0, 1
  rtDecay: number;                        // 0 dB/s
  swLokey: number; swHikey: number; swLast: number; // −1 = unused
}
```

Contract choice: `ampeg_release` default = **0.001 s** (spec). Expose a `compat: 'spec' | 'aria'` switch that sets 0.03 s and a 6 ms `off_mode=fast` fade for users matching sforzando (V: ARIA 0.03 s, off_time 0.006 s).

### 6.3 Region selection algorithm

On note-on `(key0, vel, t)` with `vel ≥ 1` (vel 0 counts as note-off, V `[tut-basics]`):
1. `key = key0 + note_offset + 12·octave_offset`. Drop the note if it falls outside 0..127.
2. If `sw_lokey ≤ key ≤ sw_hikey` for the instrument, set `lastSwitch = key`. By default, keyswitch keys don't also play notes unless a region matches them (I). Initialize `lastSwitch` from `sw_default`, else −1.
3. Draw `r = prng.next()` ∈ [0,1) once for this event (§2.5).
4. `candidates` = regions with `trigger ∈ {attack, first, legato}` such that:
   - `lokey ≤ key ≤ hikey` and `lovel ≤ vel ≤ hivel`
   - `swLast == −1 || swLast == lastSwitch`
   - `lorand ≤ r < hirand` (treat `hirand ≥ 1` as matching r up to 1)
   - `trigger == first` only if no other note is held; `legato` only if another note is held
5. For each candidate, in file order: apply the §2.4 seq counter rule. It plays iff `counter == seqPosition`, and the counter always advances.
6. **All** regions that pass sound together (layering: multi-mic, unison and so on are standard, V `[sfz:trigger]`).
7. Before starting them, for each new region with `group = G ≠ 0`, turn off all sounding voices with `offBy == G` (§2.3). Then start the new voices.
8. On note-off (or sustain-pedal release, if pedal events are supported), move `attack/first/legato` voices of that key to release, unless their loop mode is one_shot. Then trigger regions with `trigger = release` (uses the stored note-on velocity, key match, same rand/seq rules) or `release_key`, and apply the `rt_decay` gain.

### 6.4 Sample playback math

- Sample-accurate position `p` in source frames (float64).
- `cents = (key − pkc)·pitch_keytrack + 100·transpose + tune + pitch_veltrack·(vel/127)`. With `pitch_keycenter=sample`: `pkc = smpl.MIDIUnityNote` and `tune += smpl.MIDIPitchFraction/2^32·100` (the veltrack scaling is I).
- `step = 2^(cents/1200) · (srcRate / outRate)`. p starts at `offset` and advances by `step` per output frame.
- `lastFrame = (end ?? nFrames−1)`, inclusive (V). The voice ends when `p > lastFrame` (non-looping).
- Loops, with `ls = loopStart`, `le = loopEnd` (inclusive, V) and `L = le − ls + 1`: while looping is active and `p > le + 1 − 1e-9`, set `p -= L`. The interpolator reads frame `le+1` as frame `ls` inside the loop (wrap-aware reads). Looping is active for `loop_continuous` always, and for `loop_sustain` only while the note is held (then it continues to `lastFrame`). Guard against invalid loops: if `ls ≥ le` or `le ≥ nFrames`, disable looping and warn (V: some editors write off-by-one loop ends, `[sfz:loop_end]`).
- Interpolation: **4-point, 3rd-order Hermite (Catmull-Rom)** as the default, with linear available as `--interp linear` for bit-exact simple oracles. Hermite for frac `f`, samples `y−1, y0, y1, y2`: `c0=y0; c1=0.5(y1−y−1); c2=y−1−2.5y0+2y1−0.5y2; c3=0.5(y2−y−1)+1.5(y0−y1); out=((c3 f + c2) f + c1) f + c0`. There is no anti-alias filter when `step > 1`. Document that as a known limitation, or add an optional windowed-sinc mode later.
- Gain per voice, per output frame:
  `g = dbToLin(volume + ampKeytrack·(key − ampKeycenter) − rtDecayTerm) · (amplitude/100) · velGain(vel) · env(t)`, where `dbToLin(x) = 10^(x/20)` and velGain follows §2.6.
- Pan (the law isn't specified on sfzformat; I choose equal-power): `θ = (pan+100)/200 · π/2`, `gL = cos θ · √2`, `gR = sin θ · √2`, normalized so center = unity (1.0/1.0). Document it. For a mono source: `L = x·gL`, `R = x·gR`. For stereo: apply `width` as mid/side (`w = width/100`: `M=(L+R)/2`, `S=(L−R)/2·w`, `L'=M+S`, `R'=M−S`), then `position` as a pan of the result, then `pan` as a balance (`gL`, `gR` as above) (I).
- Determinism: compute everything in float64 and write float32 or PCM output at the end. Make no time-of-day or unseeded random calls.

### 6.5 Envelope math (DAHDSR; stage order V `[sfz-eg]`)

Stages: Delay → Attack → Hold → Decay → Sustain → Release. Times are in seconds and levels are 0..1 (`start = ampeg_start/100`, `S = ampeg_sustain/100`).
- **Delay**: level 0 (I: level = 0 rather than `start`) for `ampeg_delay` s, after region `delay` (V).
- **Attack**: **linear** from `start` to 1 over `A` s (V: attack is linear in ARIA and sfizz, `[sfz-eg]`). If `A = 0`, jump to 1.
- **Hold**: 1.0 for `H` s (V).
- **Decay**: exponential. `x[n+1] = x[n]·μ_D` with `μ_D = exp(−8/(D·sr))`, stopping at S (V: decay "stops once it hits the sustain level", and ARIA's step size is approximately `μ = exp(−8/(t·s))`, `[sfz-eg]`, `[sfz:ampeg_attack]`). After D seconds of uninterrupted decay the level would be `e^−8 = 3.3546e−4` (−69.49 dB). So D is the time for a **full-scale** fall, and reaching a nonzero sustain takes `ln(1/S)·D/8` s. For S = 0.5 and D = 1 s that is 0.08664 s. If `S = 0`, cut to 0 when the level falls below 1e−4 (I). If `D = 0`, jump to S.
- **Sustain**: S until note-off. For one_shot the voice ignores note-off and ends at the end of the sample, or when the level would reach 0 if S = 0.
- **Release**: from the current level `x_r`, `x[n+1] = x[n]·μ_R` with `μ_R = exp(−8/(R·sr))`. The voice ends after R seconds, when the level is `x_r·e^−8`, with a forced 0 (I, prevents endless tails). With the spec default `R = 0.001` s at 48 kHz, μ = exp(−8/48) = 0.846482 and the release lasts 48 frames.
- Note-off during attack, hold or decay goes straight to release from the current level.
- Sample-rate independence: evaluate envelopes per output frame at `outRate` (I).

### 6.6 Test oracles

All oracles use synthetic WAVs generated in the test (mono float32 or 16-bit PCM at 48 000 Hz unless stated). Measure frequency by counting zero crossings over ≥ 1 s, or with a Goertzel peak search at ±0.1 Hz resolution. Tolerance ±0.05 % in frequency and ±0.01 dB in level unless stated. Every row is I (test design) built on the V rules cited in its right-hand column.

| # | Setup | Expected | Rule |
|---|---|---|---|
| 1 | 440 Hz sine, `<region> sample=a.wav pitch_keycenter=69`, play key 81 | **880 Hz** | 2^((81−69)·100/1200) = 2 |
| 2 | Same, play key 69 | 440 Hz | root plays unchanged, V `[sfz:sample]` |
| 3 | Same, play key 60 | 261.6256 Hz | 440·2^(−9/12) |
| 4 | Same, but `key=69`, play 69 | 440 Hz, and **silence** on key 70 | key sets lokey=hikey=69 |
| 5 | No pitch_keycenter (default 60), 440 Hz file, play 72 | 880 Hz | default pkc 60 |
| 6 | `pitch_keycenter=69 tune=100`, play 69 | 466.1638 Hz | 440·2^(100/1200) |
| 7 | `tune=-50`, play at root | 427.4741 Hz | cents |
| 8 | `transpose=12`, play at root | 880 Hz | semitones |
| 9 | `pitch_keytrack=0`, play key 81 (pkc 69) | 440 Hz | V `[sfz:pitch_keytrack]` |
| 10 | `pitch_keytrack=50`, key 81, pkc 69 | 622.2540 Hz | 12·50 = 600 cents |
| 11 | 440 Hz file at **44 100 Hz**, render at 48 000 Hz, play root | 440 Hz, step = 0.91875 | rate ratio |
| 12 | Note names: `key=c4`, `key=a4`, `lokey=c#2`, `key=cb3`, `key=c-1`, `key=g9` | 60, 69, 37, 47, 0, 127 | IPN, V `[legacy]` |
| 13 | `<control> octave_offset=-1`, region `key=48`, play MIDI 60 | region sounds | incoming note shift |
| 14 | Inheritance: global volume=6, group A volume=5 with region1 volume=4 and region2 unset, group B with region3 volume=2 and region4 unset | effective volumes 4, 5, 2, 6 dB | V `[tut-basics]` |
| 15 | New `<group>` resets: `<group> lovel=64 <region> … <group> <region> …` | 2nd group's region has lovel=1 | V `[legacy]` |
| 16 | `volume=-6`, full-scale DC sample (amp_veltrack=0) | output = 0.501187 | 10^(−6/20) |
| 17 | `amplitude=50`, veltrack 0 | 0.5 | linear % |
| 18 | Velocity, default veltrack=100, vel 127 / 100 / 64 | gain 1.0 / 0.620001 / 0.253953 | (v/127)^2, V `[sfz:amp_veltrack]` |
| 19 | `amp_veltrack=0`, vel 1 | gain 1.0 | no tracking |
| 20 | `amp_velcurve_1=0.2 amp_velcurve_3=0.3`, vel 2 | 0.25 | V `[sfz:amp_velcurve_N]` |
| 21 | `hivel=31 amp_velcurve_31=1`, vel 31 / vel 32 | 1.0 / silence | V example |
| 22 | Pan: `pan=0` mono DC 1.0 | L = R = 1.0 (normalized equal power); `pan=-100` → L = 1.4142, R = 0; `pan=50` → L = 0.541196, R = 1.306563 | chosen law, §6.4 |
| 23 | `offset=1000 end=1999`, ramp sample `x[n]=n` | exactly 1000 frames rendered at step 1, first = 1000, last = 1999 | end inclusive |
| 24 | `end=-1` with `group=1`; another voice `off_by=1` sounding | new region silent, old voice fades out in 6 ms (fast) | V `[sfz:end]`, `[sfz:off_by]` |
| 25 | `loop_mode=loop_continuous loop_start=100 loop_end=199` on a ramp, root key, hold 1000 frames | output frames 0..199, then 100..199 repeated; frame 200 → value 100 | loop_end inclusive |
| 26 | Same with `loop_sustain`, note-off at frame 450 | resumes linear playback past 199 after note-off, up to the end or the release end | V `[sfz:loop_mode]` |
| 27 | `one_shot`, 1 s sample, note length 10 ms | full 1 s rendered (plus the release is ignored) | ignores note-off |
| 28 | `no_loop`, note length 0.5 s, `ampeg_release=0.001`, 48 kHz | voice ends at 0.5 s + 48 frames | release |
| 29 | Attack: `ampeg_attack=0.1`, DC 1.0 | level at t = 0.05 s = 0.5 (linear) ±1 frame | V linear attack |
| 30 | Decay: `ampeg_decay=1 ampeg_sustain=50` | level reaches 0.5 at t = 0.086643 s after the decay start ±1 frame, then holds 0.5 | μ = exp(−8/(t·sr)) |
| 31 | Release: `ampeg_release=1`, from level 1 | after 1 s = 3.3546e−4 (−69.49 dB), then 0 | same law |
| 32 | `ampeg_start=100 ampeg_attack=0.5` | level 1.0 from frame 0 | V `[sfz:ampeg_start]` |
| 33 | Round robin: seq_length=3, positions 1..3 with distinct DC levels 0.1/0.2/0.3, play 7 notes | levels 0.1, 0.2, 0.3, 0.1, 0.2, 0.3, 0.1 | V `[sfz:seq_length]` |
| 34 | Random: 4 regions [0,.25), [.25,.5), [.5,.75), [.75,1), fixed seed | the sequence equals a golden list stored in the test, and 10 000 draws give each region 2 500 ±150 hits, never zero regions | V `[sfz:lorand]` |
| 35 | Random gap: `hirand=0.249` / `lorand=0.25`, with a PRNG stub returning 0.2495 | silence (documents the V gap behavior) | V |
| 36 | Choke: hi-hat open `group=1 off_by=2`, closed `group=2`. Open sounding, then closed played | open voice ends ≤ 6 ms (fast); with `off_mode=normal` it follows ampeg_release | V `[sfz:off_mode]` |
| 37 | group=0/off_by=0 defaults, two notes | both sound (no mono) | V special-case |
| 38 | `trigger=release`, `rt_decay=3`, note held 2 s | release region plays at 0.501187 relative gain, vel = note-on vel | V `[sfz:rt_decay]` |
| 39 | `#define $K 36`, `#define $K_RIM 40`, regions `key=$K`, `key=$K_RIM` | keys 36 and 40 (not "36_RIM") | longest match |
| 40 | `#include "maps/a.sfz"` where a.sfz has `sample=s/x.wav` | resolved relative to the **main** file dir | V `[sfz:include]` |
| 41 | `<control> default_path=samples/` then `sample=x.wav` | `samples/x.wav`. A later `<control> default_path=other/` affects only later regions | V `[sfz:default_path]` |
| 42 | `sample=My Piano C4.wav lokey=60` | sample = "My Piano C4.wav", lokey = 60 | V spaces allowed |
| 43 | `key=72 pitch_keycenter=70` vs `pitch_keycenter=70 key=72` | first → pkc 70, second → pkc 72 (plus a lint warning) | V `[sfz:key]` non-ARIA order rule |
| 44 | Missing sample file | region dropped with a warning; other regions still render | V `[sfz:sample]` |
| 45 | WAV with a `smpl` chunk (unity 57, loop 1000..1999), no loop opcodes | loop_mode defaults to loop_continuous with that loop, and `pitch_keycenter=sample` → 57 | V `[sfz:loop_mode]`, `[wav-smpl]` |
| 46 | Determinism: render the same song twice, and on two machines | byte-identical output (hash) | contract |

---

## 7. Open questions and unverified items

- The pan law used by sforzando and sfizz is not documented on the pages I read. §6.4 chooses equal-power normalized to unity at center (I).
- The amp_veltrack formula for intermediate values (between 0 and 100) is not given on sfzformat (I in §2.6). The default velocity curve is stated two different ways on sfzformat (squared vs linear, see the conflict note in §2.6).
- The "counter per region" wording for seq_position is ambiguous about which events advance the counter (I in §2.4).
- sfizz support was read from its status table only. It was not tested by rendering, and actual behavior may differ from the table.
- Library sizes are as published. No archives were downloaded or measured.
- No blocker prevented completing this file.

---

## Sources

SFZ format (sfzformat.com, official community site):
- `[sfz-home]` https://sfzformat.com/
- `[tut-basics]` https://sfzformat.com/tutorials/basics/
- `[sfz-headers]` https://sfzformat.com/headers/
- `[sfz-opcodes]` https://sfzformat.com/opcodes/
- `[sfz-versions]` https://sfzformat.com/versions/
- `[legacy]` https://sfzformat.com/legacy/ (mirror of the original rgc:audio SFZ v1 spec)
- `[sfz-basic-template]` https://sfzformat.com/tutorials/basic_sfz_file/
- `[tut-drum]` https://sfzformat.com/tutorials/drum_basics/
- `[tut-modular]` https://sfzformat.com/tutorials/modular_instruments/
- `[sfz-eg]` https://sfzformat.com/modulations/envelope_generators/
- `[sfz-players]` https://sfzformat.com/software/players/
- `[sfz-engines]` https://sfzformat.com/software/engines/
- https://sfzformat.com/misc/categories/
- Headers: https://sfzformat.com/headers/control/, /headers/global/, /headers/master/, /headers/group/, /headers/region/, /headers/curve/, /headers/effect/, /headers/sample/
- Opcodes (each `https://sfzformat.com/opcodes/<name>/`): sample, key, lokey, hivel, pitch_keycenter, pitch_keytrack, pitch_veltrack, tune, pitch, transpose, volume, amplitude, pan, width, position, offset, end, count, loop_mode, loop_start, loop_end, direction, trigger, ampeg_attack, ampeg_decay, ampeg_sustain, ampeg_release, ampeg_hold, ampeg_delay, ampeg_start, amp_veltrack, amp_velcurve_N, amp_keytrack, group, off_by, off_mode, seq_length, seq_position, lorand, rt_decay, polyphony, note_selfmask, sw_last, sw_default, default_path, note_offset, octave_offset, define, include

Players:
- `[sfizz-status]` https://sfz.tools/sfizz/development/status/opcodes/ (sfizz, BSD-2; docs table only)
- `[sforzando]` https://www.plogue.com/products/sforzando.html

WAV metadata:
- `[wav-smpl]` https://www.recordingblogs.com/wiki/sample-chunk-of-a-wave-file

SF2:
- https://raw.githubusercontent.com/davy7125/soundfont-standard-v3/master/sfspec24.pdf (E-mu/Creative SoundFont 2.04 spec PDF)
- https://www.fluidsynth.org/wiki/SoundFont3Format (docs only)

Libraries (license and size pages):
- https://freepats.zenvoid.org/Piano/acoustic-grand-piano.html
- https://freepats.zenvoid.org/Synthesizer/synth-pad.html
- https://freepats.zenvoid.org/ChromaticPercussion/hang.html
- https://freepats.zenvoid.org/about.html
- https://archive.org/details/SalamanderGrandPianoV3
- https://github.com/sfzinstruments/SalamanderGrandPiano
- https://github.com/sgossner/VSCO-2-CE (and /blob/master/LICENSE, /releases/tag/1.1.0)
- https://versilian-studios.com/vsco-community
- https://sfzinstruments.github.io/orchestra/vcso_ce
- https://github.com/sfzinstruments/GregSullivan.E-Pianos
- https://sfzinstruments.github.io/pianos/greg_sullivan_e-pianos/
- https://shop.karoryfer.com/pages/free-samples
- https://shop.karoryfer.com/pages/free-meatbass
- https://github.com/sfzinstruments/karoryfer.meatbass
- https://shop.karoryfer.com/pages/free-emilyguitar
- https://github.com/sfzinstruments/karoryfer.big-rusty-drums (and /releases)
- https://shop.karoryfer.com/pages/free-big-rusty-drums
- https://versilian-studios.com/virtuosity-drums
- https://www.kvraudio.com/product/virtuosity-drums-by-versilian-studios
- https://virtualplaying.com/virtual-playing-orchestra/ (rejected: mixed license)
- https://sfzinstruments.github.io/pianos/jrhodes3c (rejected: NC-SA)
- https://sfzinstruments.github.io/pianos/jrhodes3d (rejected: NC samples)
