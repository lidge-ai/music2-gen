# 020 — MIDI SMF export and import (wp3)

**Summary.** Add a deterministic Standard MIDI File (SMF) format-1, 960-PPQ exporter from wp2 ProjectIR and a bounded format-0/1 importer that emits Song v1 absolute `track.notes` lists. The conductor carries tempo, meter, optional key and placement markers; each music2 track gets a named MTrk, a `FF 01` text identity, GM program/drum mapping, and explicit note-offs. Import preserves exact ticks where Song v1 can express them and reports lossy conversions. D4 overrides F17's proposed `FF 04` identity: write/read `FF 01 "music2:<instrument>"` (`evidence/main-decisions.md:6`; `evidence/architect-proposal.md` F17). This unit does not retime the legacy render path, satisfying D10 (`evidence/main-decisions.md:12`; architect F2/F27).

**Depends on:** wp2's `src/shared/ticks.tool.ts` (`PPQ=960`), optional Song v1 `track.notes` and `src/song/timeline-notes.tool.ts`, `src/project` ProjectIR/quantization, and pre-change digest receipt (`evidence/main-decisions.md:3,12`; architect F1–F5/F9/F10/F27). They are not yet present in the current checkout. Current source anchors below are against this checkout, not a presumed wp2 edit.

**Consumed by:** wp7 `.als` and wp8 DAWproject for GM hints, wp10/090 for user-facing `docs/cli.md`, and later wp6 automation-to-CC wiring (`evidence/architect-proposal.md` F12/F21/F22/F23/F29). `export ir` belongs to wp2/parent; this unit only adds `export midi` and `import midi` dispatch.

## Scope

**IN:** type-1 SMF writer; format-0/1 reader with running status, velocity-zero note-off and bounded SysEx skipping; GM pitched/drum/SFX/kit mappings; ProjectIR projection and quantization/loss warnings; Song v1 list-note import and section reconstruction; CLI no-replace/`--force`, `--json`, byte fixtures and focused tests; `devlog/str_func/midi.md`. **OUT:** format-0 writing, SMPTE import, format-2 import, tempo/meter automation in Song v1, audio waveform export, audio tracks and FX reproduction, native DAW automation lanes, and editing `docs/cli.md` here (090 owns that user reference). SMF CC data is instrument-side MIDI control, not a promise of DAW mixer automation (V, `evidence/aside-notes/R1_midi_automation_stems.md` §3.2).

Research citation shorthand below: **R1** = `evidence/aside-notes/R1_midi_automation_stems.md`; each R1 citation names the supporting section. **V** marks a fact verified there; **I** marks a music2 design choice.

## File map

`NEW` rows define proposed responsibilities. Each new `*.tool.ts` has its test immediately below. `MODIFY` rows give current-to-target deltas anchored in **current** code. Keep each new source file near 350 lines and below 400 (`AGENTS.md:14`; architect F26).

| Path | Op | Exact content |
| --- | --- | --- |
| `src/midi/smf.schema.ts` | NEW | Discriminated `SmfFile`/`SmfTrack`/`SmfEvent` types, byte and tick guards, format 0/1 and PPQ constraints, parse-offset diagnostic type; no filesystem or Song import. |
| `src/midi/smf.schema.test.ts` | NEW | Reject invalid format/division/status/data/tick/size; accept an empty valid track. |
| `src/midi/vlq.tool.ts` | NEW | `writeVlq` and `readVlq` (max `0x0FFFFFFF`, at most four bytes, explicit cursor/end bounds); share event-length and delta handling. |
| `src/midi/vlq.test.ts` | NEW | All 12 official values plus 240/960/3840, truncated continuation and fifth-byte errors (V, R1 §1.5). |
| `src/midi/write.tool.ts` | NEW | Pure `writeSmf(file): Uint8Array`; exact big-endian chunk lengths, canonical event order, no running status, explicit EOT, deterministic ASCII text. |
| `src/midi/write.test.ts` | NEW | Exact §2 hex, chunk lengths, deterministic bytes, same-tick off-before-on, max VLQ and oversized-track rejection. |
| `src/midi/read.tool.ts` | NEW | Pure bounded `readSmf(bytes)` with header/alien-chunk/track cursor, channel status and per-track running status, meta/SysEx length skip, warnings. |
| `src/midi/read.test.ts` | NEW | Exact §2 and R1 §7 reader hex, format 0/1, PPQ 96, unknown chunks/metas, extended MThd, running reset, truncation, missing EOT, 16 MiB guard. |
| `src/midi/gm.tool.ts` | NEW | Pure pitched GM and percussion tables, SFX private 84..93 table, `kitMidiMap`, reverse lookups, key-signature conversion; no sample decoding. |
| `src/midi/gm.test.ts` | NEW | Every declared instrument/drum/atom, GM reverse map, tom modulo, kit explicit/fallback/duplicate cases, directly representable key spellings and omitted `Fb major`. |
| `src/midi/from-project.tool.ts` | NEW | Pure `projectToSmf(project, {kitMaps?})`; conductor and channel allocation, same-pitch overlap truncation, quantization/velocity/variant/unsupported-feature warnings. |
| `src/midi/from-project.test.ts` | NEW | Song→ProjectIR→SMF marker vector plus direct `SmfFile` writer fixture in `write.test.ts`; 15/16 melodic channel cases, multiple channel-10 tracks, markers, static CC7/10, quantization warnings, non-note/audio loss. Lane CC vectors are added in wp6. |
| `src/midi/to-song.tool.ts` | NEW | Pure `smfToSong(file, options)`; pair notes, split `(MTrk,channel)`, infer metadata/GM, convert ticks to beat-list notes, reconstruct only aligned marker sections. Return a local `ImportedSong` shape; no `song` import. |
| `src/midi/to-song.test.ts` | NEW | Format-0 channel split, format-1 track split, absent/meta tempo/key/meter, same-pitch FIFO and hanging notes, aligned/unaligned markers, limits, round-trip tolerances. |
| `src/midi/index.ts` | NEW | Public feature boundary: `writeSmf`, `readSmf`, `projectToSmf`, `smfToSong`, GM tables and SMF types; no CLI import. |
| `src/render/render.schema.ts` | MODIFY | Extend `KitManifest` with optional `midi?: Record<string,number>`; currently only version/samples/gainDb/rootMidi (`src/render/render.schema.ts:11`). |
| `src/render/kit.tool.ts` | MODIFY | Current allowed-key set excludes `midi` (`src/render/kit.tool.ts:20-44`); accept only sample-name keys with integer 0..127 and no duplicate note assignment, and add manifest-only `loadKitMidiMap` for CLI use without decoding WAVs. For the CLI lookup, realpath-confine the manifest to the song directory before reading (§5); keep `loadKit` audio path (`:47-98`) unchanged. Return precise `E_SCHEMA` issue path `$.midi.<name>`. |
| `src/render/kit.test.ts` | MODIFY | Extend current malformed-manifest and audio-load tests (`src/render/kit.test.ts:41-65,76-102`) with valid/unknown/duplicate/out-of-range/fractional MIDI maps, symlink escape rejection and no-byte-change legacy kit fixture. |
| `src/cli/commands/export.ts` | MODIFY (created in wp2) | Add `midi` subverb to wp2's `export ir` dispatcher: load/validate song, build Timeline/ProjectIR, resolve kit manifests by song-relative confined paths, project/write, stage `.mid`, return envelope. Leave other export subverbs to their owners. |
| `src/cli/commands/export.test.ts` | MODIFY (created in wp2) | Add exact MIDI CLI bytes, path collision, no-replace/force, kit path validation, single JSON object and warning counters; retain wp2 IR cases. |
| `src/cli/commands/import.ts` | NEW | Add `midi` subverb: bounded read, parse/convert, call `validateSong` and wrap any failure as `E_INTERNAL`, serialize canonical JSON with final newline, stage `.json`, return envelope; `-o` required by D3. |
| `src/cli/commands/import.test.ts` | NEW | Tiny import fixture yields note lists, output collision/force, malformed/unsupported limits, strict tempo, symlink-escaped kit manifest rejection, one JSON object and no partial artifact. |
| `src/cli/files.ts` | MODIFY (created in wp2) | Reuse wp2's `StagedFile[]` helpers for MIDI export/import; extend only if a MIDI-specific need arises, preserving wp2's no-replace/replace rollback and cleanup contracts. |
| `src/cli/files.test.ts` | MODIFY (created in wp2) | Add MIDI caller cases for symlink/input identity, late destination creation, `--force` replacement and temp cleanup; retain wp2's general helper tests. |
| `src/cli/commands/render.ts`, `src/cli/commands/sfx.ts` | NO CHANGE | wp2 already extracted identity/staging/link/rename mechanics into `files.ts`; retain its regression proof for WAV bytes, sidecar order and JSON (`src/cli/commands/render.ts:37-51,92-118`; `src/cli/commands/sfx.ts:38-58,91-117` are pre-wp2 anchors). |
| `src/cli/registry.ts` | MODIFY | Register `import`; wp2 already registers `export`, whose dispatcher gains `midi` here. Current pre-wp2 registry and positional-subverb precedent are at `src/cli/registry.ts:48-55` and `src/cli/commands/skill-path.ts:16-26`. |
| `src/cli/args.ts`, `src/cli/output.ts`, `src/shared/errors.tool.ts` | NO CHANGE | Use current duplicate-scalar parsing, one-object JSON envelope and existing error→exit mapping (`src/cli/args.ts:33-51`; `src/cli/output.ts:4-33`; `src/shared/errors.tool.ts:3-17`). |
| `src/index.ts` | MODIFY | Add library exports from `src/midi/index.ts`; currently exports song/render/etc. but no midi boundary (`src/index.ts:1-21`). |
| `devlog/str_func/midi.md` | NEW | Feature tree, exact exported signatures, dependency direction, byte limits, callers and sync checklist. |
| `devlog/str_func/AGENTS.md` | MODIFY | Add `midi` row to the feature index, which currently ends in `sfx` (`devlog/str_func/AGENTS.md:8-21`). |
| `devlog/str_func/cli.md` | MODIFY | Add export/import/files command responsibilities and signatures; current command tree has no such entries (`devlog/str_func/cli.md:7-38,54-70`). |
| `docs/cli.md` | NO CHANGE | User-facing command examples are deferred to wp10/090; current command table has no MIDI entries (`docs/cli.md:9-24`). |

## 1. Types, bounds and dependency contract

The following signatures are **I** code contracts. `src/midi` follows the single import table in `010_project_ir.md` §3: `project`, `shared`, local files and, from wp6, `automation` CC helpers; the CLI may import `song`, `project`, `midi` and shared file helpers. `render` never imports MIDI (D2; architect F12/F13). `ImportedSong` is structurally Song v1; the CLI checks it with `validateSong` before writing. Types use integer absolute ticks, not seconds:

```ts
export type SmfChannelEvent =
  | { tick: number; kind: "noteOn" | "noteOff"; channel: number; key: number; velocity: number }
  | { tick: number; kind: "cc"; channel: number; controller: number; value: number }
  | { tick: number; kind: "program" | "channelPressure"; channel: number; value: number }
  | { tick: number; kind: "polyPressure"; channel: number; key: number; value: number }
  | { tick: number; kind: "pitchBend"; channel: number; value14: number };
export type SmfEvent = SmfChannelEvent |
  { tick: number; kind: "meta"; type: number; data: Uint8Array } |
  { tick: number; kind: "sysex"; status: 0xf0 | 0xf7; data: Uint8Array };
export interface SmfTrack { events: SmfEvent[]; endTick: number; sourceIndex: number }
export interface SmfFile { format: 0 | 1; ppq: number; tracks: SmfTrack[]; warnings: string[] }
export function writeVlq(value: number): Uint8Array;
export function readVlq(bytes: Uint8Array, offset: number, end: number): { value: number; next: number };
export function writeSmf(file: SmfFile): Uint8Array;
export function readSmf(bytes: Uint8Array): SmfFile;
export interface MidiProjection { file: SmfFile; warnings: string[]; notes: number; channels: Record<string, number>; dropped: Record<string, number> }
export function projectToSmf(project: ProjectIR, options?: { kitMaps?: Readonly<Record<string, Readonly<Record<string, number>>>> }): MidiProjection;
export interface ImportedSong { version: 1; title: string; bpm: number; meter: { numerator: number; denominator: 4 }; key?: string; tracks: { id: string; kind: "notes" | "drums"; instrument: string; notes: ({ start: number; length: number; pitch: number; velocity: number } | { start: number; length: number; sample: string; velocity: number })[]; gain?: number; pan?: number; mono?: boolean }[]; sections: { id: string; bars: number }[]; arrangement: { section: string; repeats?: number }[] }
export interface MidiImport { song: ImportedSong; warnings: string[]; dropped: Record<string, number>; notes: number; bars: number }
export function smfToSong(file: SmfFile, options?: { title?: string; strict?: boolean; kitMaps?: Readonly<Record<string, Readonly<Record<number, string>>>> }): MidiImport;
export function kitMidiMap(names: readonly string[], explicit?: Readonly<Record<string, number>>): { byName: Record<string, number>; warnings: string[] };
export function keyToSmf(key: string): { sf: number; mi: 0 | 1 } | null; // null => omit FF 59 + KEY_SIGNATURE_OMITTED
export function smfToKey(sf: number, mi: 0 | 1): string;
export async function loadKitMidiMap(songPath: string, instrument: string): Promise<{ names: string[]; explicit: Record<string, number> }>;
```

**V**, SMF chunks use four-byte IDs and uint32 big-endian payload lengths; MThd is six bytes or longer, format 0 has one MTrk, PPQ division uses low 15 bits, and each MTrk event starts with a VLQ delta (`evidence/aside-notes/R1_midi_automation_stems.md` §1.1–1.5). **I**, writer accepts only format 1/PPQ 960 (`E_INPUT` otherwise), preserves supplied track order, emits one EOT per track, requires `0<=delta<=0x0FFFFFFF` and safe nonnegative absolute ticks, and rejects payload > `0xFFFFFFFF`. Reader accepts PPQ 1..32767, format 0/1, `MThd.length>=6`, unknown chunks skipped, and max 16 MiB input (`E_INPUT`); format 2/SMPTE yields `E_CAPABILITY` exit 3 per architect F16, despite R1 §6.2's permissive SMPTE suggestion. Header track count must equal parsed MTrk count and format 0 must declare exactly one; mismatch is `E_PARSE`. A declared chunk beyond EOF, malformed status/data, invalid delta or >4-byte VLQ is `E_PARSE` exit 2 with `{offset,track?}`. Missing EOT is accepted with `MISSING_EOT` warning at the physical track end. All cursor reads are bounded by **chunk end**, not just file end (I).

**V**, channel status bytes are `8n` off, `9n` on, `Bn` CC, `Cn` program (one data byte), `Dn` pressure (one), `En` bend (LSB first); meta is `FF type VLQ-length data`, SysEx `F0/F7 VLQ-length data`, and both meta/SysEx cancel running status (`R1` §1.4, §1.6–1.8). Reader resets running status at each track and after `FF/F0/F7`; a data byte without status is `E_PARSE`. Unknown metas and supported-but-unmapped channel events are retained or skipped without misaligning the cursor. Known metas with excess declared bytes use only their standard prefix; a too-short `FF 51/58/59` is `E_PARSE` (I, compatible with V length handling in R1 §1.4). On read, `FF 2F` sets `SmfTrack.endTick` and is excluded from `events`; on write, an explicit `FF 2F` in `events` is `E_INPUT` because the writer synthesizes it. Writer deliberately emits every channel status (I; D4 permits running status only with fixture proof; F17 prefers no running status). Text metas use printable ASCII, replacing each non-ASCII code point with `?`, max 255 bytes (I; R1 §1.8/§6.1). Non-ASCII source text is therefore lossy and gets `TEXT_REPLACED`.

## 2. Canonical writer bytes and ordering

**I**, conductor event order at tick 0: `FF 03` title, `FF 58 04 nn 02 18 08`, optional `FF 59 02 sf mi`, `FF 51 03 uuuuuu`, then placement `FF 06` markers. Later events sort by `(tick, rank, sourceIndex)`: meta name/meter/key/tempo/marker; program; CC by controller; pitch bend; note-off by pitch; note-on by pitch. EOT is always last at `max(project.lengthTicks,lastEventTick)` in every MTrk. The SMF meanings/field widths are **V** (`R1` §1.3, §1.8); this exact order and common EOT tick are **I** (`R1` §1.10/§6.1). `usPerQuarter = Math.round(60_000_000/bpm)` must fit 24 bits; meter denominator is 4 in Song v1 (`src/song/song.schema.ts:13,99-100`). Key uses signed `sf` (-7..7) and `mi` (major 0/minor 1; V, R1 §1.8). Encode only the key spelling itself when its circle-of-fifths value is in -7..7. For a Song-valid but unrepresentable spelling such as `Fb major`, omit `FF 59` and warn `KEY_SIGNATURE_OMITTED:<key>` while retaining the Song key in ProjectIR; do not silently choose an enharmonic spelling. Never silently substitute C or fail a key already accepted by Song validation. Tempo/meter arrays currently have one point (architect F3); later nonzero tick entries can be emitted without touching SMF encoding, but song-to-ProjectIR ramp support is outside wp3.

At tick 0 each music track emits `FF 03 <track.id>` and `FF 01 "music2:<instrument>"`, then a program only for pitched tracks with a mapped GM program, CC7 and CC10. `FF 01` is a standard Text meta event (**V**, R1 §1.8); using it as a music2 identity is **I** bound by D4. Program wire value is 0-based (**V**, R1 §1.7); CC7 is Channel Volume and CC10 is Pan (**V**, R1 §3). Static mappings (**I**, architect F17): `cc7=clamp(round(127*10^(gainDb/40)),0,127)`; `cc10=clamp(round(64+63*pan),0,127)`; note-on velocity `max(1,round(127*velocity))` and note-off `8n key 40`. At 0 dB/center/velocity 0.8 these are `B0 07 7F`, `B0 0A 40`, `90 3C 66`. Writer sorts and clips same-channel, same-key overlap to the next onset; at equal onset zero-length prior note is dropped. This prevents an off for one overlap from ending the next note (I). Count `velocityClamped`, `overlapTruncated` and `zeroLengthDropped`; do not mutate ProjectIR.

Exact tiny **writer-only** fixture (I): construct `SmfFile` directly, without Song/ProjectIR; no marker is intentional here. A separate `projectToSmf` vector below requires one marker per section placement. The fixture has one 4/4 bar, title `T`, track id `p`, `piano`, C4 on at tick 0/vel 0.8, off at 960, and EOT at `endTick=4×960=3840` (101 bytes). Conductor EOT delta is 3840 = VLQ `9E 00`; music EOT delta is 3840−960=2880 = VLQ `96 40`. Conductor payload is 5+8+7+5=25 (`0x19`) bytes; music payload is 5+16+3+4+4+4+5+5=46 (`0x2E`) bytes; total is 14-byte MThd + (8+25) + (8+46) = 101 bytes. Spaces/line breaks are presentation only; output bytes must match:

```text
4D 54 68 64 00 00 00 06 00 01 00 02 03 C0
4D 54 72 6B 00 00 00 19
00 FF 03 01 54
00 FF 58 04 04 02 18 08
00 FF 51 03 07 A1 20
9E 00 FF 2F 00
4D 54 72 6B 00 00 00 2E
00 FF 03 01 70
00 FF 01 0C 6D 75 73 69 63 32 3A 70 69 61 6E 6F
00 C0 00
00 B0 07 7F
00 B0 0A 40
00 90 3C 66
87 40 80 3C 40
96 40 FF 2F 00
```

Exact tiny **reader-only** fixture (V source fixture F5, `R1` §7; format 0, PPQ 96, running status, velocity-zero off; 39 bytes):

```text
4D 54 68 64 00 00 00 06 00 00 00 01 00 60
4D 54 72 6B 00 00 00 11
00 90 3C 64 60 3C 00 00 40 64 60 40 00 00 FF 2F 00
```

Expected `C4(60)` `[0,96)` and `E4(64)` `[96,192)`, velocities 100/127, EOT at 192. `9n kk 00` equals Note Off (**V**, R1 §1.7). Also decode the independently sourced R1 §1.9 official 81-byte format-0 example and §7 F2 conductor/tempo-change example; the latter must yield the declared note ticks, not the original writer's inferred ticks.

## 3. GM, kits, SFX and channels

**I**, table values are architect F18 design choices; GM program and Channel-10 semantics are **V** only where R1 §1.7/§1.10 records the standard. Use 0-based program bytes: `piano 0`, `epiano 4`, `keys 5`, `organ 16`, `guitar 25`, `bass 38`, `808 39`, `strings 48`, `choir 52`, `brass 61`, `flute 73`, `lead 80` (81 if `wave` means saw), `supersaw 81`, `pad 89`, `bell 14`, `pluck 45`, `marimba 12`, `vibraphone 11`, `glockenspiel 9`, `kalimba 108`. Reverse lookup picks the first canonical instrument in that order; unknown program defaults to `piano` with `PROGRAM_FALLBACK`. An explicit `music2:` identity wins over GM **only** for supported voice IDs and a resolvable `kit:`; an invalid/unknown identity warns and falls back to GM. `sfz:` is a later wp5 instrument and is not promised as a self-contained MIDI import (I).

**I**, standard drum names map `bd→36`, `sd→38`, `cp→39`, `rim→37`, `hh→42`, `oh→46`, `tom:0..3→45,47,48,50`, `perc→56`. GM percussion 35..81 and the named common notes are **V** (`R1` §1.10); `perc→56`, the tom variant order and aliases are product mappings. Drum-kind `drums`, `kit:` and `sfx` use channel 10/index 9 (D4, architect F18). SFX private note range 84..93 follows `TRANSITION_ATOMS` order: `riser 84`, `pitchriser 85`, `downlifter 86`, `impact 87`, `whoosh 88`, `revcymbal 89`, `noisebuild 90`, `subdrop 91`, `zap 92`, `crackle 93` (`src/sfx/presets.tool.ts:3`). Those notes have no GM sound promise; warn `SFX_PRIVATE_NOTES`. `gm.test.ts` compares this table to `src/sfx/presets.tool.ts:3` without adding a production import edge. Variants are not encoded, warn/count `drumVariantsDropped` except toms; for sfx any nonzero variant is dropped. Arbitrary kit sample names map by explicit manifest `midi` first, then aliases `kick/bd`, `snare/sd`, `clap/cp`, `hat/hh`, `oh`, `rim`, `tom`, `perc`, then unused notes ascending from 60 in manifest key order with `KIT_FALLBACK_NOTE` (I, architect F18). An explicit kit `midi` map is validated in `render/kit.tool.ts`; CLI `loadKitMidiMap` reads only the manifest after lexical and realpath confinement to the song directory (§5), without sample decoding. The CLI supplies its `kitMaps` keyed by `ProjectTrack.id` to pure `projectToSmf`; import `kitMaps` is keyed by the exact `kit:<ref>` identity.

**I**, melodic channels allocate indices `0..8,10..15` in track order. Sixteenth melodic track reuses index 0 round-robin with `CHANNEL_REUSED` (architect F18); channel-10 drum tracks necessarily share one channel. Per-track MTrk boundaries still exist, but FL Studio's “one channel per track” import option groups by MIDI channel (**V**, R1 §2.1), so both cases warn `DAW_CHANNEL_MERGE`. Program/CC on a shared melodic channel may overwrite another track's setup; preserve bytes but warn. On channel 10, omit per-track program and emit CC7/10 only for the first drum-kind track; later drum track gain/pan differences warn `DRUM_MIX_LOSS` because shared-channel CC cannot represent independent static mixes (I). For best sound fidelity, downstream `--content both` exports include audio (architect F14); MIDI alone is a note interchange format.

## 4. ProjectIR projection and warning contract

`projectToSmf` takes wp2 `ProjectIR` without altering its `quantization`. Pattern events are already projected to ticks by `src/project/build.tool.ts`; list notes are tick-native (architect F2–F4; `010_project_ir.md` §3). `ProjectNote.tick`, `lengthTicks>=1` and velocity become note events. Note end is `max(on+1,on+lengthTicks)`, then overlap clipping. Do not derive pitch from `TimedEvent.time` again. ProjectIR track order becomes MTrk order. Track 0 markers use `ProjectMarker.name` at `tick`, one per placement; marker count and order are stable (architect F3). Audio tracks and inserts/ducks/sends/master/voice params have no SMF equivalent and produce counted warning IDs; no silent output change. Per-song `quantization.inexact>0` emits `QUANTIZED_PATTERN_EVENTS: inexact=<n>, maxErrorTicks=<x>`; zero counts emit none. At 960 PPQ an inexact nearest-tick event differs by at most 0.5 tick before any same-pitch truncation; at 40 BPM that is 0.78125 ms (**I**, architect F2). The CLI `data.quantization` copies `{events,inexact,maxErrorTicks}` unchanged and `warnings` includes each nonzero lossy category. **D10:** never route existing `render`, `events`, `validate`, `lint` or old `--stems` through ProjectIR; optional fields stay absent-in/absent-out (`evidence/main-decisions.md:3,12`; architect F2/F9/F27).

wp3 emits static CC7/CC10 only. When a `gain` or `pan` lane exists, its **first point's value** replaces the corresponding track static field for the tick-0 CC; later points do not create CCs in wp3. Emit exactly one `MIDI_AUTOMATION_OMITTED:<trackId>.<target>` warning per input automation lane, including `gain` and `pan`, because the lane's time variation is absent from wp3 MIDI. The first channel-10 drum-kind track alone may emit CC7/10 (§3); an omitted later drum lane still gets the omission warning. wp6 adds gain/pan lanes to `src/midi/from-project.tool.ts` and `src/midi/to-song.tool.ts` (and their tests), using `src/automation/cc.tool.ts`: sample linear lanes at 120-tick grid positions plus exact point ticks, emit changed integer CC values, and emit a hold step at its new endpoint only. Gain interpolation is in dB before the CC law; pan is linear. In wp6, remove `MIDI_AUTOMATION_OMITTED` **only** for a gain→CC7 or pan→CC10 lane actually exported on that track; every other lane retains exactly one warning (D6; `050_automation.md` §4). No undocumented CC mapping is implied. Do not claim that DAWs convert those CCs into mixer-fader automation (V/I, R1 §3.2).

## 5. Reader-to-Song conversion

**I**, read all MTrk events first, then pair notes FIFO by `(sourceIndex,channel,key)`; a Note On of the same key while one is open remains a second queue entry, and each Note Off closes the oldest. This resolves F17's explicit FIFO against R1 §6.2's optional “close previous on retrigger” suggestion. An unmatched off warns/drops; an open note closes at that track's EOT/physical end with `UNTERMINATED_NOTE`. A zero-length pair becomes one output tick and warns `ZERO_LENGTH_EXTENDED`. Format 0 splits by channel; format 1 splits by `(MTrk,channel)`, except conductor-only MTrk is ignored. Stable sort is `(startTick,key,sourceIndex,eventIndex)`. An empty file still produces one empty notes track so `tracks` meets Song v1's minimum (`src/song/song.schema.ts:113-115`). Maximum is 32 tracks and 20,000 notes per track; overflow raises `E_CAPABILITY` exit 3 (architect F16). Any projected tick outside a safe integer or Song's arrangement capacity also raises `E_CAPABILITY`.

The first valid `FF 51` supplies `bpm=round((60e6/usPerQuarter)*1000)/1000`; absent tempo defaults to 120, absent `FF 58` to 4/4 (**V**, R1 §1.3). Reject bpm outside Song's 40..240 range (`src/song/song.schema.ts:98`) with `E_CAPABILITY`; do not clamp it. Later tempo or meter changes retain note tick positions but warn `TEMPO_CHANGE_DROPPED`/`METER_CHANGE_DROPPED`; `--strict` makes either `E_CAPABILITY`. Reader accepts `FF 51/58/59/06` from track 0 in format 1; format 0 reads them from its only track. Meta from other format-1 tracks may be considered if conductor has none, with `NONCONDUCTOR_META` warning (I). Meter `nn/2^dd` becomes `numerator=nn*4/2^dd` only if integral in 2..12 and denominator 4 in Song v1; e.g. 6/8→3/4 with `METER_REWRITTEN` (architect F17; V encoding R1 §1.8). Other meter is `E_CAPABILITY`. `FF 59` maps signed fifths to canonical Song spelling (`0:C major/A minor`, sharps `G,D,A,E,B,F#,C#` and relative minors; flats `F,Bb,Eb,Ab,Db,Gb,Cb` and relative minors); unsupported or conflicting key events warn/drop rather than produce invalid Song key. `FF 06` text is metadata; a DAW's locator import is not guaranteed (V/I, R1 §2.1–2.5).

For source PPQ `P`, convert absolute ticks once with `targetTick=Math.round(sourceTick*960/P)`, then `start=targetTick/960`, `length=max(1,endTargetTick-startTargetTick)/960`, `pitch` numeric 0..127, `velocity=v/127`. PPQ 960 is tick-exact; PPQ 96 scales by 10 exactly. Other PPQs can incur ≤0.5 target tick per endpoint; warn `IMPORT_QUANTIZED` with count/max error. Import static CC7/10 at tick 0 using `gain=cc7===0 ? -60 : clamp(40*log10(cc7/127),-60,12)` and `pan=clamp((cc10-64)/63,-1,1)`; default gain 0/pan 0 absent CC. Incoming CC7 0..3 clamps below the Song −60 dB floor, and CC10 0 clamps to pan −1 (which re-exports as CC10 1); emit `MIDI_CC_CLAMPED:<trackId>.<controller>@<tick>=<value>` once per affected retained CC event, including wp3's tick-0 static CC, as specified in `050_automation.md` §4. Later CC7/10 cannot become Song automation until wp6 and warn `CC_AUTOMATION_DROPPED`; wp6 adds the reader/writer CC lane inverse. Preserve `music2:` identity only when valid/resolvable; channel 10 otherwise uses reverse drum names, unknown drum notes warn/drop (`UNKNOWN_DRUM_NOTE`). A `kit:` identity with no manifest falls back to `drums` with `KIT_IDENTITY_DROPPED`; do not produce non-renderable sample names. Before any export/import manifest lookup from `kit:`, reject absolute paths, `..` components and NUL in the ref without filesystem access. The CLI resolves the relevant input/output Song directory with `realpath`, resolves the candidate manifest with `realpath` before reading, and accepts it only when `relative(songRoot,manifestRealpath)` is neither `..` nor starts with `../` nor absolute; a lexical path or symlink escaping the song directory is `E_ACCESS` exit 4. An existing but unreadable manifest is `E_ACCESS`; only an absent manifest permits the import fallback (I; confinement follows `src/render/kit.tool.ts:15-18,51-62`). SFX 84..93 with explicit identity become atom names; without it they are unknown drums and warn/drop. This is inherently lossy for arbitrary kit variants and unrecognized programs (I).

Song JSON shape (I; `track.notes` is wp2's F5 addition) for the reader fixture's two notes, with absent source metadata defaults:

```json
{
  "version": 1, "title": "imported", "bpm": 120,
  "meter": { "numerator": 4, "denominator": 4 },
  "tracks": [{ "id": "track_1", "kind": "notes", "instrument": "piano",
    "notes": [
      { "start": 0, "length": 1, "pitch": 60, "velocity": 0.7874015748031497 },
      { "start": 1, "length": 1, "pitch": 64, "velocity": 0.7874015748031497 }
    ] }],
  "sections": [{ "id": "part_1", "bars": 1 }],
  "arrangement": [{ "section": "part_1" }]
}
```

`id` is lowercased ASCII, nonmatching runs become `_`, leading nonletter gets `track_`, max 32 chars, then stable `_2`, `_3` suffixes; this obeys `^[a-z][a-z0-9_-]{0,31}$` (`src/song/song.schema.ts:55`). Title uses `--title` if given, otherwise conductor `FF 03`, otherwise `imported`, clipped to 120 characters (`src/song/song.schema.ts:97`). Track names come from per-MTrk `FF 03`, falling back to `track_N`. All note tracks use absolute `notes`, never `pattern`, `velocity` string or `swing:true`; `mono:true` for `bass`/`808` as current resolution defaults (`src/song/song.schema.ts:356-359`; architect F5). The CLI passes the generated object through `validateSong`; a failure is `E_INTERNAL`, since invalid output is an implementation bug (architect F17).

Markers become section boundaries only when every marker tick is a unique multiple of the **resolved bar length** (`numerator*960`) and lies in `[0,endTick)`. Insert an implicit tick-0 boundary when needed; name each span from the marker text after ID sanitization, keep arrangement order, and cap each section at 256 bars and the list at 64 (`src/song/song.schema.ts:90-93,116-120`). If any marker is unaligned, duplicated at a tick, or produces a span beyond the schema limits, use **one** `sections` entry `part_1` and warn `MARKERS_NOT_SECTIONS`; do not round a marker. The single section has `bars=totalBars` when `totalBars<=256`, otherwise `bars=1` and `arrangement` repeats it in chunks of ≤64, up to 256 entries. `totalBars=max(1,ceil(endTick/barTicks))`; notes may end within the final bar. This preserves absolute note positions and one section definition even for long files (I, user wp3 requirement; overrides architect F17's “bar-rounded” and multi-part fallback). If it cannot fit one-section/arrangement limits, raise `E_CAPABILITY`.

## 6. CLI errors, output and round trip

`music2 export midi <song.json> -o <file.mid> [--force] [--json]`; `music2 import midi <file.mid> -o <song.json> [--title text] [--strict] [--force] [--json]`. Exactly one path argument and required `-o`; suffixes `.mid` and `.json` are checked before work (I; D3). `--json` returns one envelope from `src/cli/output.ts:4-33`. The command and file helpers use these signatures (I):

```ts
export const exportCommand: CommandSpec; // src/cli/commands/export.ts
export const importCommand: CommandSpec; // src/cli/commands/import.ts
export interface StagedFile { temporary: string; final: string } // src/cli/files.ts, created in wp2
export function assertDistinct(inputs: string[], outputs: string[]): Promise<void>;
export function stage(final: string): StagedFile;
export function commitNoReplace(staged: StagedFile[]): Promise<void>; // link; E_ACCESS on EEXIST
export function commitReplace(staged: StagedFile[]): Promise<void>; // rename; --force only
```

`--title` is a nonempty string up to 120 characters (`E_INPUT` otherwise); `--strict` and `--force` are booleans (I). All paths in CLI `data` are absolute, while artifact bytes contain no destination path. The exact success `data` shapes are:

```json
{ "mid": "/abs/out.mid", "format": 1, "ppq": 960, "tracks": 2,
  "notes": 1, "channels": { "p": 1 },
  "quantization": { "events": 1, "inexact": 0, "maxErrorTicks": 0 },
  "dropped": { "drumVariantsDropped": 0, "zeroLengthDropped": 0 } }
{ "written": "/abs/imported.song.json", "bpm": 120,
  "meter": { "numerator": 4, "denominator": 4 }, "bars": 1,
  "tracks": 1, "notes": 2, "dropped": {} }
```

`tracks` on export counts MTrks including conductor; `channels` values are human MIDI channels 1..16, while internal events use 0..15 (I). `artifacts` has the one output path; `warnings` lists deterministic ID-prefixed strings in stable category order, with counts. Failure gets `{ok:false,command,error,meta}` and exactly one stdout object (current `src/cli/output.ts:19-33`; `src/cli/main.ts:12-33`). Invalid flags/subverb/suffix/collision and absent song yield `E_INPUT`/`E_NOT_FOUND` exit 2; malformed SMF `E_PARSE` exit 2; unsupported format/division/schema representability/strict changes/limits `E_CAPABILITY` exit 3; existing destination or unreadable kit path/write failure `E_ACCESS` exit 4; unexpected generated invalid Song `E_INTERNAL` exit 1 (`src/shared/errors.tool.ts:3-17`; architect F16). Source and output identity is checked before staging, including symlink/realpath aliases. Stage in destination directory, then `link()` with no replacement by default; `--force` stages then `rename()`. Preexisting files are never deleted during rollback. Current `render` replacement and `sfx` no-replace behavior remain equivalent after helper extraction (architect F15).

**I**, round-trip oracle is `validateSong(import(write(project)))` plus rebuilt ProjectIR, not identical Song JSON: patterns become note lists, meter may be rewritten, programs/variants/FX can be lossy (architect F17; R1 §2.5). For PPQ-960 list notes without overlap, compare note on/end tick and pitch exactly; velocity differs by ≤0.5/127 after 7-bit encoding when the rounded velocity is at least 1; an input velocity 0 becomes 1/127 and carries `velocityClamped`. Compare CC7/10 as integers at retained message ticks, not arbitrary dB floats: CC7 4..127 and CC10 1..127 import→export exactly; CC7 0..3→4 and CC10 0→1 are warned `MIDI_CC_CLAMPED` exceptions (`050_automation.md` §4). BPM difference is at most 0.0005 from importer 0.001 rounding **plus** tempo-microsecond rounding; compare against `60e6/round(60e6/originalBpm)` before the 0.001 step. For source PPQ other than 960, each converted endpoint differs by ≤0.5 target tick; duration can differ by ≤1 target tick. Key, aligned markers and recognized instrument IDs survive semantically, modulo sanitization. `format 0` necessarily loses MTrk grouping; shared-channel drums and fallback kits have the documented warnings. Same input/options produce identical SMF/JSON bytes across platforms; no clock, random ID or absolute path enters file bytes (architect F25). CLI envelope contains paths, so compare its `data` only after path normalization.

## 7. Legacy compatibility and research boundary

No source render path imports MIDI/ProjectIR, and no existing song receives default `notes:[]` or other new resolved keys; this is the D10 byte-identity condition (`evidence/main-decisions.md:3,12`; architect F2/F9/F27). The F15 helper extraction is behavior-preserving for old `render`/`sfx` commands and must be checked against wp2's baseline manifest, existing darwin/Node-24 pins and Linux CI digests. Preserve current `render` WAV, `--stems`, `validate --json`, `events --json`, and `lint --json` bytes for examples. A missing platform-pinned digest is a skip, not passing proof. `src/render/kit.tool.ts` adds only an optional manifest key; a kit without it resolves/plays exactly as before. MIDI export/import does not run DSP and must remain platform-independent.

**V** external SMF/CC/DAW claims above are from `evidence/aside-notes/R1_midi_automation_stems.md` §§1–3,6–7, whose source ledger lists the MMA RP-001 public exhibit, MIDI Association messages/CC pages and vendor import manuals. **I** defaults, sanitization, warnings, private note numbers, channel reuse and fallback mappings are music2 decisions, not statements of MIDI or DAW guarantees. Do not use GPL/AGPL/LGPL source (D11). FL tempo/marker import and GarageBand tempo/CC import remain unverified in R1 §8, so CLI docs must not promise them.

## Boundary vectors

These are concrete implementation test vectors; expected values are proposed, not measured by this docs-only pass.

1. `writeVlq(0), (127), (128), (240), (960), (3840), (0x0FFFFFFF)` produce `00`, `7F`, `81 00`, `81 70`, `87 40`, `9E 00`, `FF FF FF 7F` (V/I, R1 §1.5).
2. `readVlq(80 80 80 80 00)` is `E_PARSE` at the fifth byte; `81` at chunk end is `E_PARSE`, never a read into the next chunk.
3. The direct-`SmfFile` 101-byte writer fixture in §2 has MThd track count 2, payload lengths `0x19`/`0x2E`, on `(0,60,102)`, off `(960,60,64)` and EOT 3840 on both tracks.
4. A one-placement Song→ProjectIR→SMF test emits one `FF 06` at tick 0 with the section name and EOT at `project.lengthTicks`; repeated placements emit `hook` then `hook (2)`. A Song key of `Fb major` emits no `FF 59` and warns `KEY_SIGNATURE_OMITTED`, while directly representable spellings emit the legal signed-fifths byte.
5. The 39-byte reader fixture in §2 yields PPQ 96 and notes `(0,96,60,100)` and `(96,192,64,100)`; `smfToSong` yields beat spans `[0,1)` and `[1,2)` after ×10 tick scaling.
6. An MThd length 8 with two extra bytes parses after skipping them; an alien chunk before MTrk is skipped (V, R1 §1.2/§7).
7. A data byte at track start or just after `FF 06` without a new channel status gives `E_PARSE` with the data-byte offset (V, R1 §1.6/§7).
8. `F0 03 01 02 F7` and `F7 02 7E 00` with valid deltas are skipped by declared length; truncating either payload gives `E_PARSE` at its length/payload boundary (V, R1 §1.4).
9. A track with no `FF 2F` parses with `MISSING_EOT` and closes an open note at physical track end; an EOT followed by bytes inside the declared MTrk gives `E_PARSE` (I; V EOT-last rule R1 §1.4).
10. A 4/4 bar at PPQ 960 is 3840 ticks; 120 BPM writes `07 A1 20`; 140 BPM writes `06 8A 1B` (V/I, R1 §1.5/§1.8).
11. `FF 59 02 FD 00` imports E-flat major; `FF 59 02 00 01` imports A minor (V bytes/I spelling, R1 §1.8).
12. `bd`, `hh`, `sd` on a `drums` track write channel-10 on keys 36,42,38; `tom:3` writes 50, while `hh:1` writes 42 and increments `drumVariantsDropped` (I; R1 §1.10).
13. SFX atoms `riser` and `crackle` write notes 84/93 with `FF 01 music2:sfx`; `riser:1` warns variant loss; importing a bare ch-10 note 84 without identity drops it with `UNKNOWN_DRUM_NOTE` (I).
14. Kit manifest `samples:{kick:[…],clay:[…]}`, `midi:{kick:36,clay:62}` maps exactly; `midi:{clay:128}`, duplicate 36 or unknown sample key is `E_SCHEMA` at `$.midi.<name>` (I).
    A `kit:assets/kit` identity whose in-directory `assets/kit/kit.json` symlink points outside the output Song directory fails `E_ACCESS` before the target is read; an ordinary in-directory manifest resolves and imports (I; `src/render/kit.tool.ts:15-18,51-62`).
15. Sixteenth pitched track reuses MIDI channel 1 and warns `CHANNEL_REUSED`/`DAW_CHANNEL_MERGE`; two drum-kind tracks share channel 10 and the later track with different gain warns `DRUM_MIX_LOSS` (I; DAW behavior V, R1 §2.1).
16. Gain -6 dB writes `round(127*10^(-6/40))=90` (`5A`); center pan writes 64 (`40`); normalized velocity 0 becomes note-on 1 and increments `velocityClamped` (I, architect F17).
17. Same-key `[0,960)` then `[960,1920)` sorts off before on at 960. `[0,1200)` then `[960,1920)` truncates first off to 960 and increments `overlapTruncated` (I).
18. `ProjectIR.quantization={events:3,inexact:1,maxErrorTicks:0.4}` appears verbatim in `data.quantization` and a `QUANTIZED_PATTERN_EVENTS` warning; it does not alter legacy render timing (D10).
19. A 6/8 `FF 58` at PPQ 960 maps to Song 3/4 with `METER_REWRITTEN`; a 5/8 meter is `E_CAPABILITY` because `5*4/8=2.5` (I; V field layout R1 §1.8).
20. Markers at 0 and 3840 for a two-bar 4/4 file create two one-bar sections. A marker at 1920 creates **one** two-bar `part_1` section plus `MARKERS_NOT_SECTIONS`; no rounded midpoint.
21. With no markers and 257 bars, produce one `part_1` section of one bar and arrangement repeat chunks `64,64,64,64,1` (five entries); imported note starts remain absolute.
22. A format-0 file with notes on channel 1 and channel 10 produces two Song tracks; format-1 conductor plus one music track produces one Song track (I; V format definition R1 §1.2).
23. First tempo 120 BPM and later 140 BPM: default import keeps tick positions/120 BPM and warns; `--strict` returns `E_CAPABILITY` exit 3 with no output file.
24. A `.mid` larger than 16 MiB returns `E_INPUT` exit 2 before parse; format 2 and SMPTE `E7 28` return `E_CAPABILITY` exit 3 (architect F16; R1 §1.2/§7).
25. Existing output returns `E_ACCESS` exit 4 and leaves it unchanged; a symlink alias to input returns `E_INPUT` exit 2; `--force` replaces only the named output (F15).
26. Running `export midi` twice with identical source/options in different destination directories writes identical `.mid` bytes; generated JSON import output is byte-identical for the same title/options.
27. A track with static gain −12/pan 0 and `gain` points `(tick 960,−6),(tick 1920,0)`, `pan` points `(tick 480,−1),(tick 960,1)` emits only tick-0 CC7=90 and CC10=1 in wp3, using each lane's first value; it emits one `MIDI_AUTOMATION_OMITTED:<trackId>.<target>` for each of those two lanes. An additional `send.reverb` lane gets one more warning. In wp6, gain/pan warning entries disappear only when their CC curves are emitted; `send.reverb` remains warned.
28. Importing a tick-0 CC7 value 0,1,2 or 3 produces gain −60 dB and `MIDI_CC_CLAMPED:<trackId>.7@0=<value>`; re-export yields CC7=4. Importing CC10=0 produces pan −1 and `MIDI_CC_CLAMPED:<trackId>.10@0=0`; re-export yields CC10=1. CC7 4 and CC10 1 produce no clamp warning and re-export unchanged.

## Verification handoff

This docs-only unit runs no test suite. The parent should map these wp3 criteria into the live goalplan IDs; no goalplan for this DAW-bridge unit was present in the current checkout. Commands below are future implementation gates, not results.

| Goalplan criterion | Future command / test | Required observation |
| --- | --- | --- |
| wp3-1 SMF bytes and parser bounds (D4/F17, R1 §1/§7) | `node --test src/midi/vlq.test.ts src/midi/write.test.ts src/midi/read.test.ts` | §2 exact fixtures match; format 0/1/running/SysEx/alien chunks decode; malformed offsets and 16 MiB cap have specified codes. |
| wp3-2 GM/drum/kit/SFX mapping (D4/F18) | `node --test src/midi/gm.test.ts src/midi/from-project.test.ts src/render/kit.test.ts` | All table vectors and warnings in §3/Boundary vectors, including channel reuse and no legacy kit change. |
| wp3-3 import Song and round trip (F5/F17) | `node --test src/midi/to-song.test.ts src/song/song.test.ts` | Note ticks/velocity tolerance, default/strict tempo, meter rewrite, exact aligned-marker behavior, and `validateSong` success. |
| wp3-4 CLI output and safety (D3/F14–F16) | `node --test src/cli/commands/export.test.ts src/cli/commands/import.test.ts src/cli/files.test.ts src/cli/commands/render.test.ts src/cli/commands/sfx.test.ts` | One JSON object, expected exit codes, no partial/stale artifacts, `--force` only named output, old commands unchanged. |
| wp3-5 D10 legacy byte identity | `node --test tests/e2e/legacy-render.test.ts tests/e2e/daw-legacy.test.ts src/render/mixer.test.ts` plus wp2 baseline receipt | Exact same-platform/Node-major hashes for render/stems/validate/events/lint; skips reported, not counted green. |
| wp3-6 structure/build gates | `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`, `npm run audit:structure` | Five exit-0 results on implementation HEAD; `src/midi` files under budget and `devlog/str_func/midi.md`/index in sync. |
| wp3-7 hosted CI | Parent wp10/090 exact-head run receipt after an authorized push | Expected jobs actually ran on the intended SHA/event/attempt and concluded success; pending/skipped/cancelled is not success. |
