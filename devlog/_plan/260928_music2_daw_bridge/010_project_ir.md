# 010 — ProjectIR tick timeline and backward-compatible song extensions (wp2)

**Summary.** [I] Add a 960-PPQ ProjectIR projection over the existing resolved song and timeline, plus optional Song v1 note lists, audio-track clips, automation lanes and `sfz:` references. Only note lists enter rendering in wp2; audio, SFZ and automation playback belong to 040/050. Add `music2 export ir` now as the inspection surface, and pin pre-change example digests before any implementation edit. Legacy songs must retain identical resolved JSON, event JSON, PCM, WAV, validate and lint bytes under the same Node major/platform (D1, D3, D10; `evidence/main-decisions.md:5,7,14`).

**Depends on:** wp1 decisions and the pre-change HEAD `8d85e25`; baseline capture must precede source edits. Current float timing and event shape are at `src/song/timeline.tool.ts:8-15,45-77`; current resolution at `src/song/song.schema.ts:346-369`.

**Consumed by:** wp3 MIDI import/export, wp4 stems, wp5 sampler/audio, wp6 automation, wp7 ALS, wp8 DAWproject and wp9 plugin bridge. This doc advances `export ir` from architect F29's provisional wp3 placement to wp2 as explicitly delegated; other export subverbs remain later (D3; `evidence/architect-proposal.md` §F14, §F29).

## Scope

**IN:** shared tick conversion; Song v1 optional JSON/typed fields and cross-field checks; list-note timeline and render gates; pure ProjectIR builder; `export ir` CLI; schema regeneration and structural superset assertion; pre-change digest recorder/manifest/assertion; pattern-reader lint and use-case handling; the named `devlog/str_func` documents. **OUT:** SMF, stem bundle, clip/SFZ decoding, audio-track mixing, automation DSP, plugin execution, ALS/DAWproject writing, replacement of the legacy float-second pattern renderer. Those later consumers may read ProjectIR, but render must not import it (D1–D3; `evidence/architect-proposal.md` §F2, §F11–F14).

`V` marks a fact verified at the current HEAD; `I` marks a binding implementation choice. Paths below are repository-relative. No research claim about an external file format is needed in this unit.

## File map

| Path | Op | Exact content |
| --- | --- | --- |
| `src/shared/ticks.tool.ts` | NEW | [I] `PPQ`, five conversion functions in §1; nonnegative round-half-up, safe-integer and finite guards, rational exactness. No clocks or RNG. |
| `src/shared/paths.tool.ts` | NO CHANGE | wp5 owns `confinedRealpath` (`040_sampler.md` file map); wp2 uses its own CLI identity helper and does not claim this source file. |
| `src/shared/ticks.test.ts` | NEW | Adjacent vectors for 1/3, 1/5, 1/7 bars, half ticks, invalid/overflow arguments and round trips. |
| `src/shared/index.ts` | MODIFY | [V] Currently exports rational and PRNG only (`src/shared/index.ts:1-5`); re-export tick values/functions without changing existing exports. |
| `src/song/song-daw.schema.ts` | NEW | [I] DAW field rules, sole `ResolvedPoint`/`ResolvedLane` owner, `parseTarget`, `resolveLanes`, TypeScript input/resolved types, `validateDawFields`, `resolveDawTrack`, `resolveAudioTracks`; keep structural rules and cross checks together, target ≤350 lines. |
| `src/song/song-daw.test.ts` | NEW | Raw schema and resolved-field tests: XOR, bounds, exact `$` issue paths, absent-in/absent-out, clip overlap, target validation. |
| `src/song/song.schema.ts` | MODIFY | [V] Current `Track`/`ResolvedTrack` and `Song`/`ResolvedSong` omit DAW fields (`:11-53`); `trackProperties` and `songProperties` reject unknown keys (`:78-127`); validation and resolution are at `:292-369`. Import/spread optional rules, call cross-check before `:344` throw, conditionally spread resolved DAW fields. Retain `version:1`, old property order/defaults, and legacy resolver branch byte-for-byte. Keep near 400 lines; split helper code into `song-daw.schema.ts`. |
| `src/song/song.test.ts` | MODIFY | [V] Existing song validator tests cover only current fields (`src/song/song.schema.ts:292-369`); add schema-superset and legacy resolved shape assertions without changing old oracles. |
| `src/song/timeline-notes.tool.ts` | NEW | [I] `appendListEvents` converts resolved tick notes to ordinary `TimedEvent` objects; stable input-index tie break; share per-track 20k limit. |
| `src/song/timeline-notes.test.ts` | NEW | Adjacent list-note timing, pitch/sample, transpose, sorting, bar boundary, cap and absolute `cycleBegin` vectors. |
| `src/song/timeline.tool.ts` | MODIFY | [V] Pattern events are pushed with float seconds, then sorted (`:45-77`). Call `appendListEvents` only if some `track.notes !== undefined`, after placement loop and before existing sort; leave old loop, sort comparator and return shape unchanged. |
| `src/song/timeline.test.ts` | MODIFY | [V] Current events derive only from patterns (`src/song/timeline.tool.ts:45-75`); assert list and mixed-track events, legacy event JSON identity and `--bars` start behavior. |
| `src/song/index.ts` | MODIFY | [V] Current public boundary lists Song/Timeline exports (`:1-7`); export `ResolvedLane`/`ResolvedPoint` and `ResolvedInsert` plus other DAW types once here, while retaining all existing names; automation does not re-export them. |
| `src/project/project.schema.ts` | NEW | [I] Exact `ProjectIR`, track/note/clip/sample/marker/bus types in §3; no runtime dependency on render, CLI or filesystem. |
| `src/project/build.tool.ts` | NEW | [I] Pure `buildProject(song,timeline)` plus internal pattern quantization/marker/sample helpers; ≤350 lines, split by responsibility only if needed. No file reads, timestamps or random draws. |
| `src/project/build.test.ts` | NEW | Adjacent mixed song, quantization, occurrence, mono clipping, de-duplication, deterministic serialization and 10k-event budget assertions. |
| `src/project/index.ts` | NEW | [I] Export `buildProject` and public IR types. |
| `src/index.ts` | MODIFY | [V] Current library API exposes Song and render, no project boundary (`:6-11`); append `buildProject` and IR types without renaming old exports. Export `ResolvedLane` only through the Song boundary. |
| `src/render/render.tool.ts` | MODIFY | [V] Current sample/MIDI validation reports `.pattern` paths for all timeline events (`:29-62`). On list tracks, validate note events against `.notes[k].sample`/`.pitch`; gate nonempty `audioTracks`/`automation` and `sfz:` playback with `E_CAPABILITY` until 040/050. Old event loop and `mixTracks` call stay identical when fields absent. |
| `src/render/render.test.ts` | MODIFY | [V] Existing render entry tests exercise current voices (`src/render/render.tool.ts:46-63`); add list-note audible result, exact error path, unsupported-new-playback gate and old digest assertion. |
| `src/render/mixer.tool.ts` | NO CHANGE | [V] `selectEvents` already consumes all `Timeline.events` and seeds by per-track event index (`:24-61`); list notes need no new mix branch. Leave float arithmetic, summation and dither order intact. |
| `src/render/fx/fx.schema.ts` | MODIFY | [V] Song already imports declarative insert specs (`src/song/song.schema.ts:4-5`); define §2's single `AUTOMATABLE_INSERT_PARAMS` validation contract here, with no processor change in wp2. wp6 consumes the same constant. |
| `src/render/render.schema.ts`, `src/render/voices/registry.tool.ts` | MODIFY | [V] Voice specs are currently track-static (`render.schema.ts:7-10`) and parameter checks inspect only `track.params` (`registry.tool.ts:66-98`); add optional `VoiceSpec.automatable?: readonly string[]` and `validateDawVoiceLanes(song)` for semantic `param.*` names/ranges on built-in voices. Keep `sfz:` outside voice lookup until wp5. |
| `src/render/voices/pad.tool.ts`, `src/render/voices/bass.tool.ts` | MODIFY | [V] Both already declare numeric `cutoffHz` specs (`pad.tool.ts:8-10`; `bass.tool.ts:86-89`); opt in `cutoffHz` for note-onset-held automation metadata only. Keep render functions unchanged until wp6. |
| `src/render/voices/registry.test.ts` | MODIFY | Validate rejected `param.*` on non-opted-in voices and precise parameter/track errors; retain existing kit/voice behavior. |
| `src/recipes/lint-geometry.tool.ts` | MODIFY | [V] `effective()` treats null pattern as inactive (`:157-159`); for list-track activity use Timeline events in the placement, and keep the old pattern branch unchanged. |
| `src/recipes/lint-geometry.test.ts`, `src/recipes/lint.test.ts` | MODIFY | [V] Existing geometry/lint assertions cover pattern tracks; add list-track activity and event/pitch/rhythm findings while preserving legacy result IDs/order. |
| `src/recipes/lint-rules-phrase.tool.ts`, `src/recipes/lint.tool.ts`, `src/recipes/lint-generic.tool.ts`, `src/recipes/lint-rules.tool.ts` | NO CHANGE | [V] Phrase mute logic uses section overrides, which list tracks forbid (`lint-rules-phrase.tool.ts:17-29`); `lintSong` and generic/rule checks already read Timeline events (`lint.tool.ts:102-116`; `lint-generic.tool.ts:55-64`; `lint-rules.tool.ts:24-39`). Audit their outputs, not their source. |
| `src/recipes/new.tool.ts` | NO CHANGE | [V] Recipe generation starts from static starter cards and pattern transposition (`:126-157`); it does not accept an imported list song. Record this audited non-reader edge. |
| `src/usecases/usecase.tool.ts` | MODIFY | [V] `applyUseCase` clones and rewrites arrangement/tempo (`:95-115`); reject `track.notes !== undefined` or nonempty `audioTracks` with `E_INPUT` before cloning/rearranging, using the message in §5. |
| `src/usecases/usecase.test.ts` | MODIFY | Assert both new guards and unchanged pattern-song transformations. |
| `src/cli/commands/export.ts` | NEW | [I] Create the export dispatcher and implement only `export ir` now: load, run `validateDawVoiceLanes`, build/serialize IR, optional `-o`, `--force`, `--json`; reject other subverbs as `E_INPUT` until their phases. wp3 and wp4 modify this file for `midi` and `stems`. |
| `src/cli/commands/export.test.ts` | NEW | stdout/file JSON, deterministic key order, no-replace/force/collision, unknown subverb and one-envelope exit cases. |
| `src/cli/files.ts` | NEW | [I] Own §4's exact `StagedFile[]` contract: `assertDistinct(inputs,outputs)`, `stage(final): StagedFile`, `commitNoReplace(staged[])`, `commitReplace(staged[])`, destination-local temps and cleanup. wp3/wp4 reuse these helpers; no change to WAV encoder or render flags. |
| `src/cli/files.test.ts` | NEW | Realpath/symlink identity, late `EEXIST`, no-replace rollback, force replacement and temp cleanup. |
| `src/cli/commands/render.ts`, `src/cli/commands/sfx.ts` | MODIFY | [V] Render currently checks identity and stages then renames (`render.ts:41-51,90-118`); SFX links staged outputs and rolls back on second failure (`sfx.ts:38-45,91-116`). Move those mechanics verbatim to `cli/files.ts`, call the shared helpers, and preserve each command's current replace/no-replace policy and artifact bytes. |
| `src/cli/registry.ts` | MODIFY | [V] Flat command map ends at `:55`; register `export` with one positional subverb, preserving all old registrations and `--json` formatting. |
| `src/cli/args.ts`, `src/cli/output.ts` | NO CHANGE | [V] Strict scalar parsing and one JSON result/error envelope already exist (`args.ts:7-24,30-51`; `output.ts:4-33`). |
| `schema/song.v1.json` | MODIFY | [V] Generated from `SONG_JSON_SCHEMA` via `npm run schema:json` (`package.json` scripts); add only optional `notes`, `automation`, `audioTracks` properties and descriptions of code-only XOR/cross checks; keep old subtrees, required list, title and version. |
| `scripts/record-daw-legacy.mjs` | NEW | [I] Recorder invoked against explicit unmodified source checkout/ref; lexically sorted `examples/*.song.json`, pinned Node/platform, hashes of render WAV, every `--stems` WAV, and canonical `validate/events/lint --json` stdout with only `meta.music2` normalized. Reject dirty source, skipped/failed commands or incomplete manifest. |
| `tests/fixtures/daw-legacy/darwin-node24.json`, `tests/fixtures/daw-legacy/linux-node24.json` | NEW | [I] Checked-in canonical fixture shape `{sourceSha,nodeMajor,platform,examples:{"<relative song>":{render:<sha256>,stems:{"<name>":<sha256>},validate:{exit,sha256},events:{exit,sha256},lint:{exit,sha256}}}}`. Capture darwin before wp2, Linux from pristine same SHA in CI before the wp2 branch is tested; never synthesize missing hashes from modified code. |
| `tests/fixtures/daw-legacy/song.v1.pre.json` | NEW | [I] Exact pre-wp2 `schema/song.v1.json` snapshot for recursive old-subtree equality test. |
| `tests/e2e/daw-legacy.test.ts` | NEW | [I] Replay examples against pinned fixture for matching Node 24/platform; separate structural/schema tests run everywhere; a platform mismatch is an explicit skip, never a pass. |
| `tests/e2e/legacy-render.test.ts` | NO CHANGE | [V] Existing darwin/Node 24 WAV/stem pins remain authoritative (`:10-40`). |
| `eslint.config.js` | MODIFY | [V] Current typed ESLint rules have no deterministic-source restriction (`:1-19`); add scoped `no-restricted-properties`/`no-restricted-globals` for `src/project/**` (later extend to midi/sampler/automation/export) covering `Math.random`, `Date`, `performance.now`, `crypto.randomUUID`. |
| `devlog/str_func/project.md` | NEW | Feature tree, IR signatures, quantization and dependency direction, consumers and sync checklist. |
| `devlog/str_func/song.md`, `devlog/str_func/shared.md`, `devlog/str_func/render.md`, `devlog/str_func/cli.md` | MODIFY | [V] Current file trees/signatures describe pre-DAW Song, shared, render and CLI (`song.md:1-24`; `shared.md:1-24`; `render.md:1-35`; `cli.md:1-45`). Add only wp2 contracts and explicit deferred rendering gates. |
| `devlog/str_func/AGENTS.md` | MODIFY | [V] Feature index lacks `project` (`:7-21`); add its document row in wp2 when `src/project` appears. |

## 1. Tick primitives and identity boundary

The meter denominator is fixed at 4 in the current schema (`src/song/song.schema.ts:13,99-100`, V). One beat is a quarter note. [I] Expose exactly:

```ts
export const PPQ = 960;
export function barTicks(numerator: number): number;
export function beatsToTicks(beats: number): number;
export function ticksToSeconds(ticks: number, bpm: number): number;
export function secondsToTicks(seconds: number, bpm: number): number;
export function fractionToTicks(bars: Fraction, numerator: number): { ticks: number; exact: boolean };
```

[I] Inputs are finite and nonnegative where they represent positions or lengths; numerator is safe integer 2..12, bpm is finite positive, and every produced tick is a nonnegative safe integer. On programmer misuse/overflow throw `E_INTERNAL`; raw song bounds remain `E_SCHEMA`. `barTicks(n)=n*960`; `beatsToTicks(b)=floor(b*960+0.5)`; `ticksToSeconds(t,bpm)=t*60/(bpm*960)`; `secondsToTicks(s,bpm)=floor(s*bpm*960/60+0.5)`. `fractionToTicks(f,n)` uses integer numerator/denominator arithmetic (BigInt for multiplication) to round `f*n*960` half-up, and `exact` means its rational remainder is zero, not that a floating approximation is close. Pattern render continues using its existing float seconds; ProjectIR alone quantizes it. A 1/7 bar in 4/4 is `3840/7=548.571…` ticks, so it becomes 549, `exact:false` (D1; `evidence/architect-proposal.md` §F1–F2).

## 2. Song v1 JSON, validation and resolution

[I] Add the following accepted shapes without raising `version` or changing the required top-level keys:

```json
{"version":1,"bpm":120,"tracks":[
  {"id":"lead","kind":"notes","instrument":"piano","notes":[{"start":0,"length":1.5,"pitch":"e4","velocity":0.9},{"start":2,"length":0.5,"pitch":64}]},
  {"id":"kit","kind":"drums","instrument":"drums","notes":[{"start":0,"length":0.25,"sample":"bd:1"}]}
],"audioTracks":[{"id":"vox","clips":[{"file":"audio/vox.wav","start":16,"length":32,"offset":0.25,"stretch":{"mode":"tempo","sourceBpm":92}}]}],
"sections":[{"id":"a","bars":16}],"arrangement":[{"section":"a"}]}
```

`Track.notes?: NoteInput[]` is exclusive with `pattern`, even an empty string; require exactly one source for a list track, while existing pattern tracks may still omit `pattern` for silence. A note has `start` beats ≥0, `length` beats ≥0.001, `velocity` 0..1 (default numeric track velocity else 0.8), and exactly one `pitch` or `sample` according to kind. `pitch` is integer 0..127 or a string parsed by existing `noteToMidi`; `sample` uses existing `parseSampleRef`; ≤20,000 notes. Resolve `startTick=beatsToTicks(start)` first and require `startTick < bodyTicks=timeline.bars*meter.numerator*PPQ`; reject at `$.tracks[i].notes[k].start` with `E_SCHEMA` and the existing `starts after song end (<beats> beats)` message when this fails. `length` may ring past body as ordinary notes do. Resolve length with `beatsToTicks`, then `max(1,ticks)`; apply transpose to MIDI, reject resulting pitch outside 0..127. List notes ignore `gate` and `swing`, and string velocity is forbidden. Stable sort by `(tick, pitch or sample key, input index)`; for same-pitch ties preserve input order. Existing schema rules are insufficient for these conditional checks (`src/song/song.schema.ts:137-154,155-193`, V; `evidence/architect-proposal.md` §F5, §F9).

`audioTracks?: AudioTrackInput[]` has 0..16 elements and shares the `tracks` ID namespace. Reuse input gain −60..12 dB, pan −1..1, sends 0..1, `fx` and `duck` rules; require `clips` 1..256, and reject `kind/instrument/pattern/params/mono/gate/glide`. Clip file is a song-relative POSIX `.wav` reference: reject leading slash, drive prefix, backslash, NUL, empty or `..` segment; no filesystem read in validation. Each clip requires `start` ≥0 and `startTick=beatsToTicks(start) < bodyTicks`; reject at `$.audioTracks[i].clips[k].start` with `E_SCHEMA` and `starts after song end (<beats> beats)` when the resolved tick reaches the body end. `length` must be >0 beats and `lengthTick=beatsToTicks(length)` must be ≥1 (reject at `$.audioTracks[i].clips[k].length` with `E_SCHEMA` `length rounds to zero ticks`; vectors: `length:0.0001` → 0 ticks → error, `length:0.0006` → 1 tick → ok); `offset` ≥0 seconds defaults 0, gain −60..12 dB defaults 0, pitch −24..24 semitones defaults 0, `fadeIn`/`fadeOut` 0..10 s default 0.002. Stretch is one `mode` object: omitted/`none`, `varispeed` with ratio 0.25..4, `tempo` with sourceBpm 40..300, or `fit` with sourceSeconds >0. For tempo compute `alpha=sourceBpm/song.bpm`; for fit compute `alpha=(lengthTicks/960)*60/song.bpm/sourceSeconds` after resolving clip length. Reject either ratio outside 0.25..4 at `$.audioTracks[i].clips[k].stretch` with `E_SCHEMA` (`stretch ratio outside 0.25..4`); varispeed uses its direct ratio. Reject irrelevant/missing mode keys in code; the hand-written `oneOf` validator treats `type` specially, so do not model stretch as `oneOf` (`src/song/song.schema.ts:137-154`, V). On each lane, sort clips by start tick and reject `[start,start+length)` overlap after tick rounding. `duck.by` must name an event-bearing song track, never audio/self. Positions in the resolved object are integer ticks (`evidence/architect-proposal.md` §F6, §F9, I).

`automation?: LaneInput[]` is optional on both track kinds and audio tracks. Target regex is `^(gain|pan|send\.(reverb|delay)|fx\.(0|[1-9][0-9]?)\.[A-Za-z][A-Za-z0-9]*|param\.[A-Za-z][A-Za-z0-9]*)$`; at most 32 lanes per track and max one lane per target. Each lane has `points` 1..4096: `{at:beats>=0,value:number,curve?:"linear"|"hold"}`; default curve `linear`; points nondecreasing, at most two at one beat (a step); reject distinct `at` values that round to the same 960-PPQ tick at the later `.at` (identical `at` values are an intentional step); and `at <= body beats` (point exactly at end is allowed, with no audible body effect). `gain` value −60..12 dB, `pan` −1..1, `send.*` 0..1. `fx.i.p` requires an existing insert, a numeric `INSERT_SPECS` parameter and membership in the single `AUTOMATABLE_INSERT_PARAMS` constant owned here by `src/render/fx/fx.schema.ts`:

```ts
export const AUTOMATABLE_INSERT_PARAMS = {
  filter: ["cutoffHz"], eq: ["lowGainDb", "midGainDb", "highGainDb"],
  drive: ["amount"], tremolo: ["depth"], delay: ["mix"], width: ["amount"],
} as const;
// compressor, chorus, phaser, crush, tapestop: no automatable params in wp6.
```

`param.p` is forbidden on audio tracks and has structural validation in `song-daw.schema.ts` on music tracks, then semantic validation via `validateDawVoiceLanes` at render/IR entry: a declared numeric voice `ParamSpec` and `VoiceSpec.automatable` opt-in are required. wp2 opts in `pad.cutoffHz`, `bass.cutoffHz` and `lead.vibratoCents`, rejecting other voice parameters; `sfz:` has no built-in voice parameter lane in wp2. This split preserves the existing `song → render/fx/fx.schema.ts` declarative dependency without importing the voice registry into song. The lane replaces the static value; before first/after last point it holds endpoint value. Render evaluates it only in wp6 (`evidence/architect-proposal.md` §F7, §F13, §F21, I).

`instrument:"sfz:<relative POSIX .sfz path>"` is accepted only for `kind:"notes"`; empty/absolute/drive/backslash/NUL/`..` references are `E_SCHEMA`. It is a song reference, with no parse/read/render in wp2. Keep the existing generic instrument string schema as a superset, then add the prefix check in `validateDawFields`; a render attempt is `E_CAPABILITY` until wp5 (`evidence/architect-proposal.md` §F8, I). This is a product path contract, not a claim about SFZ syntax.

Exact issues use the current `Music2Error("E_SCHEMA", ..., {details:{issues}})` envelope (`src/song/song.schema.ts:344`, V): `$.tracks[i].notes` → `notes and pattern are exclusive`; `$.sections[j].patterns.<id>` → `track uses notes`; `$.tracks[i].velocity` → `velocity pattern requires pattern`; `$.tracks[i].swing` → `swing does not apply to notes`; `$.tracks[i].notes[k].pitch|sample` → `not allowed for <kind> track`; `$.tracks[i].notes[k].start` → `starts after song end (<beats> beats)`; `$.audioTracks[i].id` → `duplicate track id`; `$.audioTracks[i].clips[k]` → `overlaps clip <k-1>`; `$.audioTracks[i].clips[k].stretch` → `stretch ratio outside 0.25..4`; `$.<track-path>.automation` → `at most 32 lanes`; `$.<track-path>.automation[l].points[m].at` → `distinct beats round to same tick`; `$.<track-path>.automation[l].points[m].at` → `after song end`; bad target/value/insert/parameter goes on the exact `target` or `value` path. Avoid duplicate secondary issues when a field fails structural validation.

Resolved signatures in `song-daw.schema.ts` are [I]:

```ts
export interface ResolvedNote { tick: number; lengthTicks: number; pitch: number | null; sample: { name: string; index: number } | null; velocity: number; inputIndex: number }
export interface ResolvedPoint { tick: number; value: number; curve: "linear" | "hold" }
export interface ResolvedLane { target: string; points: ResolvedPoint[] }
export type AutomationTarget = { kind: "gain" | "pan" } | { kind: "send"; bus: "reverb" | "delay" } | { kind: "fx"; index: number; param: string } | { kind: "param"; param: string };
export function parseTarget(target: string): AutomationTarget;
export function resolveLanes(input: LaneInput[] | undefined, context: { path: string; bodyBeats: number; inserts: readonly ResolvedInsert[] }): ResolvedLane[] | undefined; // voice semantics checked by validateDawVoiceLanes
export type ResolvedStretch = { mode: "none" } | { mode: "varispeed"; ratio: number } | { mode: "tempo"; sourceBpm: number } | { mode: "fit"; sourceSeconds: number };
export interface ResolvedClip { tick: number; lengthTicks: number; file: string; offsetSeconds: number; gainDb: number; pitchSemitones: number; stretch: ResolvedStretch; fadeInSeconds: number; fadeOutSeconds: number }
export interface ResolvedAudioTrack { id: string; gain: number; pan: number; sends: { reverb: number; delay: number }; fx: ResolvedInsert[]; duck: { by: string; amount: number; releaseMs: number } | null; clips: ResolvedClip[]; automation?: ResolvedLane[] }
export function validateDawFields(input: unknown, issues: { path: string; message: string }[]): void;
export function resolveDawTrack(input: Track, song: Song): Pick<ResolvedTrack, "notes" | "automation">;
export function resolveAudioTracks(input: Song): ResolvedAudioTrack[] | undefined;
```

The voice boundary adds `export function validateDawVoiceLanes(song: ResolvedSong): void` in `src/render/voices/registry.tool.ts`; it skips tracks without a `param.*` lane and `sfz:` tracks, and raises `E_SCHEMA` with `$.tracks[i].automation[l].target` or `.points[m].value` for a bad built-in voice lane. `export ir` invokes it before `buildProject`; `renderSong` invokes it before the deferred-automation capability gate. `validateSong` remains pure song/FX structural validation and cannot silently accept an invalid `fx.*` target. [I]

Add `Track.notes?`, `Track.automation?`, `ResolvedTrack.notes?`, `ResolvedTrack.automation?`, `Song.audioTracks?`, `ResolvedSong.audioTracks?` with those types. [I] `notes`, `automation` and `audioTracks` are **absent-in/absent-out**: do not write `[]` or `null` when omitted; an explicitly empty optional array remains present if its rule permits empty. This applies to object spread, JSON output and schema. `ResolvedTrack.pattern` remains `null` for absent pattern, as currently (`src/song/song.schema.ts:356-365`, V). Future audio/automation code must gate on presence/length, not force new fields into old objects (D1, D10).

## 3. List timeline and ProjectIR

[I] `export function appendListEvents(song: ResolvedSong, events: TimedEvent[], counts: Map<string, number>): void` creates ordinary events after the placement loop. For note `n` on track index `i`: `bar=floor(n.tick/barTicks)`, `time=ticksToSeconds(n.tick,bpm)`, `duration=slot=ticksToSeconds(n.lengthTicks,bpm)`, `cycleBegin=new Fraction(n.tick,barTicks).toString()` (absolute bar position for list notes), `atom={raw:pitch spelling or sample name:index,name,index,num,offset:-1}`, `midi=n.pitch`, `sample=n.sample`, `velocity=n.velocity`, `order=n.inputIndex`. `atom.raw` for numeric pitch uses decimal MIDI spelling; `name` is that spelling; sample atom uses the normalized sample reference. Reuse the same per-track count cap; event sort stays `(time,trackIndex,order)`. The current pattern branch stores relative `cycleBegin` and float time, and is untouched (`src/song/timeline.tool.ts:58-76`, V; `evidence/architect-proposal.md` §F10, I). `events --json` spreads event fields (`src/cli/commands/events.ts:32-35`, V), so add no field to `TimedEvent`.

[I] Define the exchange shape in `project.schema.ts`:

```ts
export interface ProjectIR {
  version: 1; ppq: 960; title: string; seed: number; sampleRate: 44100 | 48000;
  tailSeconds: number; loop: boolean; lengthTicks: number;
  tempo: { tick: number; bpm: number }[];
  meter: { tick: number; numerator: number; denominator: 4 }[];
  key: { tonic: string; mode: "major" | "minor" } | null;
  markers: ProjectMarker[]; tracks: ProjectTrack[];
  buses: { reverb: ProjectBus | null; delay: ProjectBus | null };
  master: { gainDb: number; ceilingDb: number; targetLufs: number | null; inserts: ResolvedInsert[] };
  samples: ProjectSample[];
  quantization: { events: number; inexact: number; maxErrorTicks: number };
}
export interface ProjectMarker { tick: number; lengthTicks: number; name: string; section: string; role: Section["role"] | null; ordinal: number; occurrence: number }
export interface ProjectBus { kind: "reverb" | "delay"; legacy: boolean; params: ReverbBusParams | DelayBusParams | null }
export interface ProjectTrackBase { id: string; index: number; gainDb: number; pan: number; sends: { reverb: number; delay: number }; inserts: ResolvedInsert[]; duck: { by: string; amount: number; releaseMs: number } | null; automation: ResolvedLane[] }
export type ProjectInstrument = { kind: "voice"; id: string; params: Record<string, number> } | { kind: "kit"; ref: string } | { kind: "sfz"; ref: string };
export interface ProjectNoteTrack extends ProjectTrackBase { type: "notes" | "drums"; instrument: ProjectInstrument; mono: boolean; notes: ProjectNote[] }
export interface ProjectAudioTrack extends ProjectTrackBase { type: "audio"; clips: ProjectClip[] }
export type ProjectTrack = ProjectNoteTrack | ProjectAudioTrack;
export interface ProjectNote { tick: number; lengthTicks: number; pitch: number | null; sample: { name: string; index: number } | null; velocity: number; eventIndex: number; source: "pattern" | "list"; errorTicks: number }
export interface ProjectClip { tick: number; lengthTicks: number; sample: number; offsetSeconds: number; gainDb: number; pitchSemitones: number; stretch: ResolvedStretch; fadeInSeconds: number; fadeOutSeconds: number }
export interface ProjectSample { ref: string; role: "clip" | "kit" | "sfz" }
export function buildProject(song: ResolvedSong, timeline: Timeline): ProjectIR;
```

`ProjectIR` arrays always exist; `tempo` and `meter` contain exactly one tick-0 point in wp2, `key` parses the already validated `<tonic> <major|minor>` string or is null, `lengthTicks=timeline.bars*barTicks(numerator)`. Markers follow placement order: `tick=startBar*barTicks`, `lengthTicks=bars*barTicks`, `name=section` for occurrence 0 else `${section} (${occurrence+1})`; role/ordinal/occurrence copy `Placement` (`src/song/arrange.tool.ts:3-23`, V). Track order is `song.tracks` then `audioTracks`; each index is its array position. Buses preserve explicit bus params or legacy `null` params; no audio processing in builder. Sample refs are song-relative POSIX, deduplicated by `(role,ref)` and sorted by role then ref; assign clip `sample` indices after sorting. The builder is pure, accepts validated inputs and uses no filesystem existence check (`evidence/architect-proposal.md` §F3, I).

Pattern projection [I]: parse `event.cycleBegin` as exact `Fraction`; use `event.bar + (onset − floor(onset))` as bar position. Compute `base=fractionToTicks(position,numerator)`; `exactSeconds=(event.bar + Number(fractionalOnset))*secondsPerBar`; `swingSeconds=event.time-exactSeconds` (clamp numerical noise in `[-1e-9,0)` to zero, reject a larger negative); `swingTicks=secondsToTicks(swingSeconds,bpm)`; final position tick is `base.ticks+swingTicks` with a safe-integer guard. Keep the two F4 rounding steps separate, even when their sum differs from rounding the combined fractional position. `errorTicks=abs((event.time*bpm*PPQ/60)-tick)` and `quantization.inexact` increments when `!base.exact` or `errorTicks` exceeds `1e-9` ticks (the tolerance affects only the counter, never the chosen tick); `events` counts pattern notes only and `maxErrorTicks` is maximum of their errors. Length is `max(1,secondsToTicks(event.duration,bpm))`; for mono tracks, clip the length to the next onset tick if later. List notes copy resolved ticks with `errorTicks:0` and `source:"list"`. `eventIndex` increments for **every** sorted Timeline event on its track before any range filter, matching `selectEvents` (`src/render/mixer.tool.ts:24-39`, V). Do not add a source marker to `TimedEvent`: exclusivity identifies list tracks (`evidence/architect-proposal.md` §F4, I). If two distinct onsets collapse to one tick on mono, drop the zero-length earlier note and count/report it as a quantization warning; never emit `lengthTicks:0`.

Dependency direction [I] is the single table below; later phases reference it. `src/song/song-daw.schema.ts` alone defines `ResolvedLane`, parses targets and validates lane counts, point ticks and insert allowlist/ranges in wp2; `validateDawVoiceLanes` in render owns voice opt-in checks at IR/render entry. `src/automation` consumes the resolved type and never owns a second declaration.

| From | Allowed feature imports |
| --- | --- |
| `shared` | none |
| `song` | `shared`, `pattern`, declarative `render/fx/fx.schema.ts` |
| `project` | `song` (including re-exported `ResolvedInsert` type), `shared` |
| `automation` | `song` types, `shared` |
| `midi` | `project`, `shared`, `automation` (wp6 CC only) |
| `sampler` | `shared`, `audio-io`, type-only `song` for `ResolvedClip`/`ResolvedAudioTrack` |
| `render` | `song`, `shared`, `sampler`, `automation`, `audio-io` |
| `export` | `project`, `midi` mapping, `song` types, `automation` types, `render` types only, `shared`, `audio-io` |
| `plugin-host` | `audio-io`, `shared` |
| `cli` | feature public boundaries, `render` voice validation, shared file helpers |

Song never imports `automation` or the voice registry; the voice registry validates `param.*` at the IR/render boundary. Edges marked type-only use `import type`, with no runtime evaluation. No feature may import `cli`. `render` never imports `project`, `midi`, `export`, `cli` or `plugin-host`; `project` never imports `render` or accesses files. Every ProjectIR array has semantic or explicitly sorted order. Do not use `Math.random`, `Date`, `performance.now` or `crypto.randomUUID` in `src/project`; tests may time builds. Keep new files ≤350 lines as a target and ≤400 as a hard implementation split point; aim for `buildProject` ≤50 ms on 10k events and ≤1 s at 32×20k on a recorded host (`evidence/architect-proposal.md` §F13, §F25–F26).

## 4. `music2 export ir` and errors

[I] `music2 export ir <song.json> [-o ir.json] [--force] [--json]` is the only accepted export subverb in wp2. Without `-o`, human mode prints formatted IR and `--json` returns `data:{ir:ProjectIR}` with `artifacts:[]`. With `-o`, write `JSON.stringify(ir,null,2)+"\n"`, return `data:{written:<absolute output path>,quantization:ir.quantization}`, `artifacts:[path]`; warning string reports nonzero `quantization.inexact` and max error. Output file bytes contain no machine path/time. Require one input path and `.json` output; unknown/missing subverb or flags are `E_INPUT` exit 2. Use `src/cli/commands/sfx.ts:38-45,91-116` as the no-replace pattern: stage beside destination, `link` by default, `--force` stages then renames; if final already exists without force, `E_ACCESS` exit 4. Resolve input and output identity (including realpaths) before writing; collision is `E_INPUT` exit 2 (`src/cli/commands/render.ts:41-51`, V). Parse/schema errors retain `E_PARSE`/`E_SCHEMA` exit 2; unexpected builder errors are `E_INTERNAL` exit 1 (`src/shared/errors.tool.ts:3-17`, V). One `--json` envelope on both success and failure is already supplied by `src/cli/output.ts:4-33` (V). Other D3 subverbs remain reserved for their owning phases; do not silently route them to IR.

The F15 CLI helper split is [I]:

```ts
export interface StagedFile { temporary: string; final: string }
export function assertDistinct(inputs: string[], outputs: string[]): Promise<void>;
export function stage(final: string): StagedFile;
export function commitNoReplace(staged: StagedFile[]): Promise<void>;
export function commitReplace(staged: StagedFile[]): Promise<void>;
```

`assertDistinct` compares canonical realpaths for existing paths and canonical parent plus basename for new paths, rejecting any input/output or output/output alias as `E_INPUT`. `stage` names a temp in each destination directory; callers write every temp before committing and remove remaining temps in `finally`. `commitNoReplace` uses `link(temporary,final)`, maps `EEXIST`/write failures to `E_ACCESS`, and unlinks finals committed by the current invocation if a later link fails. `commitReplace` uses the current render staged-rename behavior; for multi-file force writes, back up replaced destinations in the same directory and restore them if a later rename fails, never deleting unrelated entries. `export ir` uses the helper with one staged JSON file; render keeps replace semantics, SFX keeps no-replace semantics. The CLI-only temp token may use `randomUUID`; no artifact bytes include it (`src/cli/commands/render.ts:37-39,90-123`; `src/cli/commands/sfx.ts:99-116`, V; `evidence/architect-proposal.md` §F15, I).

## 5. Lint, use cases and deferred render gates

[I] A list track is active where its Timeline events occur, including across placements; it has no effective mini-notation text. Keep event-based pitch/rhythm lint. At `src/recipes/lint-geometry.tool.ts:157-159`, branch on `track.notes !== undefined` to derive occupancy from `g.events` within placement bars; the pattern branch stays unchanged. The phrase mute reader at `src/recipes/lint-rules-phrase.tool.ts:17-29` needs no branch because section overrides on list tracks are invalid. The raw `lint.tool.ts:65-90` parse-only path continues to inspect actual pattern strings; absent `pattern` on a list track is not a parse failure. `recipes/new.tool.ts:79,149-152` is an audited generation-only reader: no imported Song parameter, so no change. Regression fixtures compare full legacy lint JSON, including result order.

`applyUseCase` changes bars, BPM and section overrides (`src/usecases/usecase.tool.ts:95-115,130-146`, V). At entry, before cloning or any mutation, collect the present features from `song.tracks.some(t=>t.notes!==undefined)` → `note lists`, `song.audioTracks?.length` → `audioTracks`, and any nonempty `automation` on a music/audio track → `automation`. Use one guard: when that list is nonempty, throw `Music2Error("E_INPUT", "use case cannot rearrange a song with " + features.join(", "))`. The single message names exactly the offending features in that fixed order. This prevents absolute beat positions, lane timing and clip placement from silently drifting (F28, I).

At wp2, `renderSong` supports list notes through Timeline and unchanged `selectEvents`. Reject nonempty `audioTracks` and `sfz:` with `E_CAPABILITY` exit 3 before `validateVoiceParams`, which would otherwise misreport SFZ as an unknown voice. Then run `validateVoiceParams` and `validateDawVoiceLanes`; reject nonempty automation with `E_CAPABILITY` before `mixTracks`. Do not render a partial song while silently dropping a declared source. These guards are false for all legacy songs. For declared drum sample and pitch validation, use `event.order` as the list note index in `.notes[k].sample`/`.pitch` paths and old `.pattern` paths for pattern tracks (`src/render/render.tool.ts:29-62`, V). Audio, SFZ and automation render gates can be replaced by real branches only in wp5/wp6 (F11, I). No ProjectIR import enters `src/render` (F2/F13).

## 6. Baseline and byte-identity proof

[I] **Before the first wp2 source edit**, use pristine commit `8d85e25` to fill `tests/fixtures/daw-legacy/darwin-node24.json` with `scripts/record-daw-legacy.mjs`. The recorder accepts `--source <pristine checkout> --out <manifest>` and checks `git -C <source> status --porcelain` empty and `rev-parse HEAD` equal to the manifest's `sourceSha`; it runs source `src/cli/index.ts` with that checkout's Node 24. For every `examples/*.song.json` found at the pristine source SHA (record the complete sorted relative-path list as manifest keys), sorted by relative POSIX path, capture SHA-256 of default `render -o <tmp>/master.wav` bytes, every `render --stems <tmp>/stems -o <tmp>/master.wav` stem WAV by sorted basename, and exit status plus a canonical JSON stdout digest of `validate --json`, `events --json`, `lint --json`: parse the one envelope, remove only the package version at `meta.music2`, preserve all other fields and array order, then hash `JSON.stringify(envelope)+"\n"`. Assert the original envelope still has `meta.music2` as a string in a separate shape test. A lint `E_QA` exit 6 is valid baseline data if its JSON failure envelope is recorded; other nonzero statuses, missing stems, skipped examples or a modified source abort recording. The manifest adds `{exit,sha256}` per JSON command; the test checks every manifest key exists at the current checkout but does not glob new examples. Never regenerate from changed HEAD. Use a private temporary output directory so recorder paths never enter checked-in manifest. Pin Node major/platform/source SHA in manifest. A pristine Linux/Node 24 job records its own fixture at the same SHA before the wp2 code is exercised. D10 and F27 require both fixtures; a missing platform manifest is an explicit incomplete gate, not a passing skip.

`tests/e2e/daw-legacy.test.ts` iterates only sorted baseline-manifest example keys, asserts each key still names an existing example, reruns those commands and compares each digest; new post-baseline examples belong to their phase tests. Node/platform mismatch uses node:test `skip` with a visible reason; structural checks still run. An independent schema-superset assertion loads `tests/fixtures/daw-legacy/song.v1.pre.json` and current `schema/song.v1.json`, recursively compares all old nodes exactly, permitting only extra optional `properties` children; required arrays/title/version must be identical. Preserve the existing pins in `tests/e2e/legacy-render.test.ts:10-40`, `src/render/mixer.test.ts:25-37` and `src/render/render.test.ts:145-155`. Review all gates for `notes !== undefined`, `audioTracks?.length`, `automation?.length`, `sfz:` or opt-in render options; a phase that first pushes `mixer.tool.ts` past about 390 lines may move `selectEvents` byte-identically to `src/render/select.tool.ts` with its adjacent test, only in that phase and in a separate move-only commit; rerun D10 digests before and immediately after that move. Do not change float-to-Float32 store order. Same-platform/Node-major only is the current DSP byte contract (`AGENTS.md:19`; `evidence/architect-proposal.md` §F25–F27, V/I).

## Boundary vectors

These are proposed contract tests, not measured results.

1. [I] At 4/4, `barTicks(4)=3840`; at 3/4, `barTicks(3)=2880`; `beatsToTicks(1.5)=1440`; at 120 BPM `ticksToSeconds(1440)=0.75`.
2. [I] `fractionToTicks(1/3 bar,4)={ticks:1280,exact:true}`; `1/5` gives 768 exact; `1/7` gives 549 inexact.
3. [I] `beatsToTicks(0.0005208333333333332)=0` because its JS product with 960 is below 0.5; at an exact half tick `beatsToTicks(1/1920)=1`; negative/NaN/unsafe tick inputs raise `E_INTERNAL`.
4. [I] A one-bar 4/4 song at 120 BPM, list note `start:2,length:1.5,pitch:64` resolves `(tick:1920,lengthTicks:1440)`, event time 1 s and duration 0.75 s.
5. [I] In a one-bar 4/4 song (`bodyTicks=3840`), a list note with `start:3.9994,length:0.001` resolves to tick 3839 and passes; `start:3.9999` resolves to 3840 and fails `E_SCHEMA` at `$.tracks[0].notes[0].start` with `starts after song end (3.9999 beats)`, as does `start:4` with `(4 beats)`. A clip with the same starts resolves to 3839/3840 and respectively passes/fails at `$.audioTracks[0].clips[0].start` with the same error/message pattern.
6. [I] `pitch:"e4"` resolves MIDI 64; transpose +2 resolves 66; drums `sample:"bd:1"` resolves `{name:"bd",index:1}`; pitch on drums and sample on notes fail at their respective field paths.
7. [I] `notes` and `pattern` both present, even `pattern:""`, fail at `$.tracks[0].notes`; string velocity and `swing:true` each fail at their own track field.
8. [I] A section override naming a list track fails at `$.sections[0].patterns.lead`, including an override of `null`.
9. [I] At one tick before a bar boundary, a list event's `bar` is the preceding bar; exactly at 3840 ticks it is bar 1. Its `cycleBegin` is absolute `"1"`, while a pattern event in bar 1 retains relative onset spelling.
10. [I] Two list notes at the same tick sort by pitch/sample then input index; `eventIndex` follows the final per-track Timeline order, including events outside a later `--bars` crop.
11. [I] A 1/7-bar pattern onset at 120 BPM projects to nearest tick with `source:"pattern"` and nonzero `errorTicks`; its original `TimedEvent.time` and rendered WAV remain unchanged.
12. [I] Swing `0.58` shifts a sixteenth offbeat by 38.4 ticks, rounded to 38 (architect F4); `quantization.inexact>=1` and `maxErrorTicks>=0.4` for that event.
13. [I] A repeated section has markers at `0` and `bars*3840`, names `hook` and `hook (2)`, occurrences 0 and 1; marker lengths equal placement bars in ticks.
14. [I] Omitting notes/audioTracks/automation yields no such resolved keys; JSON.stringify of a pre-unit resolved song remains byte-identical. Explicit `audioTracks:[]` remains a present resolved empty array.
15. [I] Duplicate ID across `tracks` and `audioTracks` fails at `$.audioTracks[0].id`; adjacent clips `[0,960)` and `[960,1920)` pass; overlapping clips fail at the second clip path.
16. [I] `stretch:{mode:"fit"}` without `sourceSeconds` fails; `tempo` with `sourceBpm:92` at song bpm 120 passes; `tempo` with `sourceBpm:300` at bpm 40 fails `E_SCHEMA` at `.stretch` (alpha 7.5); `fit` with resolved target 2 s and `sourceSeconds:0.25` fails there (alpha 8); a `varispeed` ratio 0.24 fails at `.ratio`.
17. [I] Automation duplicate target, third point at same beat, decreasing `at`, out-of-range gain +13 and unknown `fx.0.foo` each fail `E_SCHEMA` at the precise lane/point target/value path; omitted `curve` resolves `linear`. A 33rd lane fails at `$.tracks[0].automation`; distinct beats `0` and `1/3840` both round to tick 0 and fail at the later `$.tracks[0].automation[0].points[1].at`, while two literal `at:0` points remain a legal step. These tests are owned by wp2 `song-daw.test.ts` and are not deferred to wp6.
18. [I] `sfz:../outside.sfz`, `sfz:/tmp/a.sfz`, and `kind:"drums",instrument:"sfz:a.sfz"` fail schema; `sfz:a.sfz` on notes validates but `render` raises `E_CAPABILITY` until wp5.
19. [I] `audioTracks` with a valid clip validates and exports IR, but render raises `E_CAPABILITY`; automation likewise validates and exports IR but render raises `E_CAPABILITY` until wp6.
20. [I] `export ir` without `-o` returns `{ir}` and no artifact; with `-o` writes a trailing-newline JSON file. Existing output without `--force` is `E_ACCESS` exit 4, input/output alias is `E_INPUT` exit 2, and JSON failure output is one object.
21. [I] Passing a list-note song, an audio-clip song, or a pattern song with one `gain` automation lane to `applyUseCase` raises `E_INPUT` with respectively `use case cannot rearrange a song with note lists`, `... with audioTracks`, or `... with automation` before changing the caller's object; automation on an audio track also reports `audioTracks, automation`. A song with all three reports `note lists, audioTracks, automation`. Pattern-only songs without automation retain old arrangement output.
22. [I] Each legacy example has the same default render WAV, every dry stem WAV, and canonical validate/events/lint JSON digest with only `meta.music2` normalized as the pre-change fixture on its matching platform; a skip is recorded separately from success.

## Verification handoff

This is a docs-only unit: no source was changed and no suite was run here. The implementer records actual exits, digest manifest provenance and timings; these rows are gates, not claimed results. Criteria are named by their binding D/F source because no separate goalplan file is present in the delegated read scope.

| Goalplan criterion | Future command / test | Required observation |
| --- | --- | --- |
| wp2-1 — D1/F1 tick math | `node --test src/shared/ticks.test.ts` | All exact/inexact/half-up/overflow vectors pass; no unsafe tick accepted. |
| wp2-2 — D1/F5–F10 Song/Timeline | `node --test src/song/song-daw.test.ts src/song/timeline-notes.test.ts src/song/song.test.ts src/song/timeline.test.ts` | Optional fields resolve only when supplied; exact issue paths; list events sorted/timed; old event JSON unchanged. |
| wp2-3 — D1/F3–F4 IR | `node --test src/project/build.test.ts` | Pure deterministic IR, markers, sorted samples, mono clipping and quantization counters match vectors; 10k-event case ≤50 ms on recorded host (F26). |
| wp2-4 — D1/F11/F28 integration | `node --test src/render/render.test.ts src/recipes/lint-geometry.test.ts src/recipes/lint-rules-phrase.test.ts src/recipes/lint.test.ts src/usecases/usecase.test.ts` | List notes render and lint by Timeline; unsupported declared audio/SFZ/automation fails explicitly; use cases reject absolute media; legacy outputs unchanged. |
| wp2-5 — D3/F14–F16 CLI | `node --test src/cli/files.test.ts src/cli/commands/export.test.ts src/cli/commands/render.test.ts src/cli/commands/sfx.test.ts src/cli/main.test.ts` | `export ir` stdout/file paths, no-replace/force/collision and one JSON envelope with correct exit 2/4; render and SFX artifact policies/bytes unchanged; other subverbs remain reserved. |
| wp2-6 — D10/F27 baseline | `node scripts/record-daw-legacy.mjs --source <pristine-8d85e25-checkout> --out tests/fixtures/daw-legacy/darwin-node24.json` (record before source edits); `node --test tests/e2e/daw-legacy.test.ts tests/e2e/legacy-render.test.ts src/render/mixer.test.ts` | Manifest covers every sorted example and all five output categories on pinned platform; recorded SHA/Node/platform shown; current hashes equal baseline; mismatch/skip never reported green. Repeat recorder on pristine Linux/Node 24 for its separate fixture. |
| wp2-7 — D10 schema superset | `npm run schema:json`; `node --test src/song/song-daw.test.ts tests/e2e/daw-legacy.test.ts` | Generated schema has only optional additions; recursive old-subtree comparison passes, `version:1` and required keys unchanged. |
| wp2-8 — repo gates/F25–F26 | `npm run typecheck`; `npm run lint`; `npm test`; `npm run build`; `npm run audit:structure` | Five exit-0 results on final affected source; file sizes near 400 or less, acyclic imports, and scoped deterministic-source lint clear. Run full suite only in implementing phase, never inferred from this doc. |
