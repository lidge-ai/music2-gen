# Song — Structure & Functions

Song v1 accepts optional `loop:boolean` and `useCase:UseCaseId`. Resolution
defaults these to `false` and `null`; the version stays 1. `loop` signals a
whole-song render body with its post-FX tail wrapped to sample zero.

Validate a song v1 JSON document, expand its arrangement, and derive a deterministic timeline.

## File Tree

```text
src/song/
├── index.ts             # public song boundary
├── song.schema.ts       # song types, JSON Schema, validation, normalization
├── song.test.ts         # schema, cross-reference, pattern validation cases
├── song-daw.schema.ts   # optional note lists, audio clips and automation contract
├── song-daw.test.ts     # DAW field bounds, paths and resolved defaults
├── load.tool.ts         # JSON file loading and read/parse diagnostics
├── load.test.ts         # missing file and malformed JSON cases
├── arrange.tool.ts      # repeated-section placement expansion
├── arrange.test.ts      # ordinal, occurrence, and start-bar cases
├── timeline.tool.ts     # pattern evaluation and timed events
├── timeline-notes.tool.ts # list notes projected to ordinary timed events
├── timeline-notes.test.ts # list timing, ordering and cap vectors
└── timeline.test.ts     # timing, swing, velocity, and determinism cases
```

## Module Responsibility

FX additions: `song.schema.ts` imports only the declarative `render/fx/fx.schema.ts` contract, generates discriminated JSON Schema branches, validates exact effect paths and frequency ordering, and resolves missing insert/bus values. `validateFxFields(input)` is also available for direct resolved-song render validation. Absent track/master chains resolve to empty arrays; absent `song.fx` resolves to `null`.

`src/song` owns the song v1 contract from raw input through a timed event list.
The optional DAW fields keep version 1. A track note list is arrangement-absolute
in beats and exclusive with its pattern. `song-daw.schema.ts` validates note,
clip and automation boundaries, then resolves positions to 960-PPQ ticks.
Absent `notes`, `automation` and `audioTracks` stay absent in resolved JSON.
Audio clips now feed the render sampler/clip mixer as absolute tick placements; automation remains metadata for wp6. An `sfz:` instrument is valid only for notes tracks and keeps a confined song-relative `.sfz` reference.
`timeline-notes.tool.ts` appends list events only for tracks with a `notes`
field; the legacy pattern loop and its sort comparator are unchanged.
`song.schema.ts` publishes the JSON Schema, checks its structural constraints,
validates cross-references and mini-notation atoms, and fills defaults into a
`ResolvedSong`. It reports validation findings as paths rooted at `$`.

`load.tool.ts` reads one UTF-8 JSON file and hands the parsed value to
`validateSong`. `arrange.tool.ts` expands each arrangement entry and repeat
into a placement with absolute bar position. `timeline.tool.ts` applies track
patterns and section overrides to those placements, then converts pattern
onsets into seconds, note pitches or sample references, and velocities.
For `instrument:"sfx"`, event duration equals the weighted pattern slot even
when `gate` is lower than one; other instruments retain their existing gate
and mono timing rules.

The module does not render audio. Its timeline is the input for later audio
work and for the current `validate` and `events` CLI commands. All source
consumers outside this folder import its public `index.ts` boundary.

## Key Function Signatures

These signatures are the exact exported declarations in implementation files.
`src/song/index.ts` re-exports the listed functions, value, and types.

| Exported signature | Source | Purpose |
|---|---|---|
| `export function validateSong(input: unknown): ResolvedSong` | `song.schema.ts` | Validate raw song input and apply defaults. |
| `export async function loadSong(path: string): Promise<ResolvedSong>` | `load.tool.ts` | Read, parse, and validate one song file. |
| `export function arrange(song: ResolvedSong): Placement[]` | `arrange.tool.ts` | Expand entries and repeats to ordered placements. |
| `export function buildTimeline(song: ResolvedSong): Timeline` | `timeline.tool.ts` | Produce placements and timed events. |
| `export function appendListEvents(song: ResolvedSong, events: TimedEvent[], counts: Map<string, number>): void` | `timeline-notes.tool.ts` | Add absolute tick notes under the shared 20k event cap. |
| `export function parseTarget(target: string): AutomationTarget` | `song-daw.schema.ts` | Parse the lane target grammar. |
| `export function resolveLanes(input: LaneInput[] \| undefined, context: { path: string; bodyBeats: number; inserts: readonly ResolvedInsert[] }): ResolvedLane[] \| undefined` | `song-daw.schema.ts` | Resolve automation positions. |
| `export function validateDawFields(input: unknown, issues: { path: string; message: string }[]): void` | `song-daw.schema.ts` | Add cross-field DAW diagnostics. |
| `export function resolveDawTrack(input: Track, song: Song): Pick<ResolvedTrack, "notes" \| "automation">` | `song-daw.schema.ts` | Resolve optional music-track DAW fields. |
| `export function resolveAudioTracks(input: Song): ResolvedAudioTrack[] \| undefined` | `song-daw.schema.ts` | Resolve optional audio tracks and clips. |

### Public data types and value

| Export | Exact declaration | Meaning |
|---|---|---|
| `Song` | `export interface Song` | Accepted song v1 source shape, with optional defaults. |
| `Track` | `export interface Track` | Drums or notes track, instrument, pattern, controls. |
| `Section` | `export interface Section` | Named bar span and optional per-track pattern overrides. |
| `ResolvedSong` | `export interface ResolvedSong` | Normalized song with required fields. |
| `ResolvedTrack` | `export interface ResolvedTrack` | Track defaults filled, including nullable pattern and duck. |
| `ResolvedNote`, `ResolvedLane`, `ResolvedPoint`, `ResolvedAudioTrack`, `ResolvedClip` | Interfaces in `song-daw.schema.ts` | Tick-based DAW fields. |
| `ResolvedSection` | `export interface ResolvedSection` | Section defaults filled, including nullable role. |
| `Placement` | `export interface Placement` | One section occurrence at an absolute start bar. |
| `TimedEvent` | `export interface TimedEvent` | One attack with position, duration, atom, and sound value. |
| `Timeline` | `export interface Timeline` | Total bars, seconds per bar, duration, placements, events. |
| `SONG_JSON_SCHEMA` | `export const SONG_JSON_SCHEMA = { ... } as const` | Published draft 2020-12 song v1 schema. |

`Song` requires `version: 1`, `bpm`, `tracks`, `sections`, and
`arrangement`. Track IDs and section IDs identify cross-references.
`Track.kind` is `"drums" | "notes"`; `Section.role` is one of intro,
verse, hook, build, breakdown, groove, outro, or bridge.

`Placement` fields are `section`, `entry`, `repeat`, `ordinal`,
`occurrence`, `startBar`, `bars`, and nullable `role`. `entry` indexes
the source arrangement entry; `repeat` indexes its repetition;
`occurrence` counts prior uses of that section across all entries.

`TimedEvent` fields are `track`, `trackIndex`, `bar`, `time`,
`duration`, `slot`, `cycleBegin`, `atom`, nullable `midi`, nullable
`sample`, `velocity`, and `order`. `Timeline` adds `bars`,
`secondsPerBar`, `durationSeconds`, `placements`, and `events`.

### Schema and validation behavior

- `SONG_JSON_SCHEMA` declares draft 2020-12 and rejects unknown keys.
- A song has 1..32 tracks, 1..64 sections, and 1..256 arrangement entries.
- Track and section IDs use lowercase letter-led names up to 32 characters.
- Section bars are integers in 1..256; entry repeats are integers in 1..64.
- BPM is 40..240; meter numerator is 2..12 and denominator is 4.
- Sample rate is 44100 or 48000; seed is an unsigned 32-bit integer.
- Swing is 0.5..0.75; master, gain, pan, gate, and send controls have
  bounded schema ranges in `song.schema.ts`.
- Duplicate track and section IDs produce path-specific issues.
- Section pattern keys must name an existing track; arrangement entries
  must name an existing section.
- A ducking source must exist and cannot name the same track.
- Track patterns, section overrides, and string velocity patterns pass
  through `parseMini` before the song is accepted.
- Note atoms are named pitches or integral MIDI numbers in 0..127.
- Drum atoms must be sample references; velocity atoms must be numbers.
- A section override may be `null`, which silences that track there.
- Invalid input throws `Music2Error("E_SCHEMA", ...)` with an `issues`
  array of `{ path, message }` records in `details`.
- Pattern parse diagnostics include source offset in their issue message
  when the parser reports one.

### Normalization defaults

- Missing title becomes `"untitled"`; genre and key become `null`.
- Meter becomes 4/4; seed becomes `1`; swing becomes `0.5`.
- Sample rate becomes `44100`; tail seconds becomes `2`.
- `loop` becomes `false`; `useCase` becomes `null` when omitted.
- Master gain becomes `0`, ceiling becomes `-1`, and target LUFS
  becomes `null`.
- A missing track pattern becomes `null`; velocity becomes `0.8`.
- Track gain and pan become `0`; gate becomes `0.9`.
- Mono defaults to true for `808` and `bass` instruments, false otherwise.
- Glide and transpose become `0`; track swing becomes false.
- Reverb and delay sends become `0`; duck becomes `null`, or gets
  `releaseMs: 180` when a duck configuration is present.
- A section role becomes `null`; missing pattern overrides become `{}`.
- An arrangement entry without repeats gets `repeats: 1`.

### File loading and arrangement

- `loadSong` reads a UTF-8 path supplied by its caller.
- Missing files throw `E_NOT_FOUND`; other read failures throw `E_INPUT`.
- Malformed JSON throws `E_INPUT` with its path in `details`.
- When the JSON error exposes a `position`, details also contain its
  offset and one-based line and column.
- Parsed JSON is always passed to `validateSong` before return.
- `arrange` traverses source arrangement entries in order.
- Each repetition creates a distinct placement; `ordinal` starts at zero.
- `startBar` advances by the referenced section's bar count.
- Reusing a section later continues its section-specific occurrence count.

### Timeline behavior

- `buildTimeline` calls `arrange`, sums placement bars, and sets
  `secondsPerBar = meter.numerator * 60 / bpm`.
- A section's own pattern key overrides a track pattern, including `null`.
- A missing or null effective pattern emits no events for that track.
- Mini-notation source strings are parsed once per distinct text within
  a timeline build and reused from a local cache.
- Each section placement restarts its pattern cycles at zero.
- Pattern queries use the song seed and a salt of `track.id@section.id`.
- Attack time is the absolute placement bar plus fractional onset,
  converted to seconds; `cycleBegin` preserves the exact fraction text.
- `slot` is the uncut pattern event duration in seconds.
- Ordinary `duration` is `slot * track.gate`; mono uses the full slot.
- A drum event has a sample name and index and a null MIDI pitch.
- A note event has MIDI pitch plus transpose and a null sample.
- Numeric velocity uses its track value. A velocity pattern is sampled
  at each onset and holds a value across its active span; uncovered
  onsets fall back to `0.8`, with sampled values clamped to 0..1.
- Swing shifts odd sixteenth-grid attacks only when the track opts in
  and song swing exceeds `0.5`.
- Events sort by time, then track index, then pattern order.
- More than 20000 events on one track throws `E_SCHEMA` with that
  track's source path in an issue record.
- The reported duration is `bars * secondsPerBar`; it does not add
  `tailSeconds` or account for event tails.

## Dependencies

| Dependency | Import path | Current use |
|---|---|---|
| Node file reader | `node:fs/promises` | Read a song JSON file. |
| Shared errors | `../shared/index.ts` | Validation, loading, and event-limit diagnostics. |
| Shared exact time | `../shared/index.ts` | Fractional cycle arithmetic in timeline. |
| Pattern boundary | `../pattern/index.ts` | Parse and validate atoms, query onsets and velocities. |
| Song schema | `./song.schema.ts` | Resolved types for loader, arrangement, timeline. |
| Arrangement | `./arrange.tool.ts` | Timeline placements. |

There are no runtime package dependencies. Tests use Node's test runner;
file-loading tests also use temporary files.

## Dependents

| Module | Import path | Current use |
|---|---|---|
| `src/index.ts` | `./song/index.ts` | Re-export song functions, schema, and public types. |
| `src/cli/commands/schema.ts` | `../../song/index.ts` | Publish or write `SONG_JSON_SCHEMA`. |
| `src/cli/commands/validate.ts` | `../../song/index.ts` | Load a song and summarize its timeline. |
| `src/cli/commands/events.ts` | `../../song/index.ts` | Load a song and list filtered events. |
| `src/song/song.test.ts` | `./song.schema.ts` | Verify schema and validation findings. |
| `src/song/load.test.ts` | `./load.tool.ts` | Verify read and JSON diagnostics. |
| `src/song/arrange.test.ts` | `./arrange.tool.ts`, `./song.schema.ts` | Verify placement indexing. |
| `src/song/timeline.test.ts` | `./timeline.tool.ts`, `./song.schema.ts` | Verify event timing and determinism. |

The loader, arrangement, and timeline use direct internal imports;
consumers in other feature folders use the public barrel.

## Sync Checklist

- [ ] Update this document when song fields, defaults, validation, or exports change.
- [ ] Keep `src/song/index.ts` and `src/index.ts` re-exports aligned.
- [ ] Check `SONG_JSON_SCHEMA` and `validateSong` for the same accepted fields.
- [ ] Update schema tests for new constraints and cross-reference rules.
- [ ] Update loader tests when file or parse diagnostics change.
- [ ] Update arrangement tests when repeat or occurrence rules change.
- [ ] Update timeline tests when timing, swing, velocity, or ordering changes.
- [ ] Review `schema`, `validate`, and `events` CLI output after public shape changes.
- [ ] Keep `devlog/str_func/AGENTS.md` index aligned with this document.
