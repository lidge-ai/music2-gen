# 030 — Stem bundle with bus returns and manifest (wp4)

**Summary.** Add `music2 export stems` as an aligned, additive WAV bundle: one post-insert/post-fader track file per rendered track, separate reverb/delay returns, a mastered file by default, optional pre-master file, and a deterministic manifest. Capture bus returns and the pre-master buffer behind new render options; on loop exports fold each component's tail exactly as the master currently folds its tail. The floating-point sum of track stems and returns must match the buffer entering master inserts within the tolerance in §4. The old `render --stems` files and bytes remain identical. Binding authority is `evidence/main-decisions.md` D1–D5, D10–D11; implementation baseline is `evidence/architect-proposal.md` F11–F16, F19, F25–F27; stem-practice facts are V only where cited to `evidence/aside-notes/R1_midi_automation_stems.md` §5. All uncited new product contracts below are **I** choices.

**Depends on:** wp1 decisions and wp2's legacy digest capture (D10), `ResolvedSong`/`Timeline` and optional ProjectIR marker projection; wp3's existing `export midi` dispatcher, which this phase extends with `stems`; current `src/render/mixer.tool.ts:64-99,248-365` and WAV writer `src/audio-io/wav.tool.ts:96-133`.

**Consumed by:** wp7 ALS and wp8 DAWproject frozen audio, wp10 docs/examples, and any DAW that imports the equally sized WAVs at a common origin (V: `evidence/aside-notes/R1_midi_automation_stems.md` §5.2, §5.4). Export consumers must read the manifest's `barOrigin` for a cropped bundle.

## Scope

**IN:** gated `RenderOptions.returns` capture; gated pre-master capture; additive loop folding; `src/export` stem plan and manifest schema; `export stems` CLI, safe multi-file write, 16/24-bit stereo PCM, returns, optional master/pre-master, section markers, float summation proof, legacy digest gate. **OUT:** changing `render --stems` naming/overwrite/dither/truncation, wet-per-track duplicate stems, 32-bit float WAV, resampling, mastering on component stems, MP3/OGG, plugin-host processing, and ALS/DAWproject packaging. R1 §6.3's 32f, wet-stem, 48 kHz default, and adaptive tail are suggestions; D5/F19 plus existing song sample rate/tail contract govern this unit (I).

## File map

All `MODIFY` evidence below was checked against the current source, which already includes SFX/tapestop work. Each NEW `*.tool.ts` has its colocated test immediately after it. Target new modules near 350 lines, never over 400; keep `mixer.tool.ts` near its current 366 lines by moving a helper verbatim if necessary (`AGENTS.md:14`; `evidence/architect-proposal.md` F26). Do not use a source-level migration of the old mixer as a substitute for the D10 proof.

| Path | Op | Exact content |
| --- | --- | --- |
| `src/render/render.schema.ts` | MODIFY | Current `RenderOptions` only has bars/stems/mastering and `RenderResult` has audio/stems but no returns or pre-master (`src/render/render.schema.ts:4-6`). Add `returns?: boolean`, `premaster?: boolean`, and optional results in §1; omit keys when options are false. |
| `src/render/mixer.tool.ts` | MODIFY | Current dry writes each float to master and optional stem (`src/render/mixer.tool.ts:64-99`); wet reverb/delay are added to master then discarded (`:338-347`); loop folds master but truncates stems (`:349-358`); master insert/mastering mutate output (`:359-365`). Capture each actual wet buffer before addition only with `options.returns`; fold component tails only with `options.returns`; copy pre-master only with `options.premaster` before master inserts. Preserve old no-return branch's arithmetic, assignments, and stem truncation. |
| `src/render/mixer.test.ts` | MODIFY | Existing digest and mixer checks already cover legacy PCM/WAV (`src/render/mixer.test.ts:25-37`). Add isolated dry/wet, loop, absent-option and pre-master assertions; do not rewrite old expected digests. |
| `src/render/render.tool.ts` | NO CHANGE | Keep the existing `renderSong(song, songPath, options)` pass-through after validation (`src/render/render.tool.ts:46-63`); options reach mixer without a new dependency. |
| `src/export/export.schema.ts` | NEW | Sole generic `ExportPlan<D>` and file-descriptor union owner; wp7/wp8 reuse it. |
| `src/export/manifest.schema.ts` | NEW | Types and pure `serializeStemsManifest`/`validateStemsManifest` for exact §3 shape/order, relative paths, sample/frame invariants and no machine metadata. No filesystem access. |
| `src/export/stems.tool.ts` | NEW | Pure `planStems(song, timeline, result, options): ExportPlan<StemsData>`: match stems by `trackId`, order and name artifacts, make manifest and seed specs; never write files or import CLI. Call render once in CLI, not in this module. |
| `src/export/stems.test.ts` | NEW | Colocated plan/manifest order, names, marker crop, null master, return absence, seed, and frame-alignment tests; test float summation in this or mixer test. |
| `src/export/index.ts` | NEW | Export only `planStems`, stem plan types, and manifest serializer/validator as the feature boundary; keep future ALS/DAWproject exports additive (`evidence/architect-proposal.md` F12–F13). |
| `src/cli/commands/export.ts` | MODIFY (created in wp2) | Add `stems` to wp2's positional `export ir` dispatcher after wp3 adds `midi`; do not register a separate top-level `stems`. Parse §2 flags, call `loadSong`, `buildTimeline`, `renderSong` once, `planStems`, and stage/commit the plan. Preserve existing subverbs (D3; `src/cli/registry.ts:48-55` is a pre-wp2 anchor). |
| `src/cli/commands/export.test.ts` | MODIFY (created in wp2) | Add end-to-end stems cases for directory policy, exact JSON envelope, 16/24-bit WAV headers and lengths, master parity, `--bars`, and failures; retain IR/MIDI cases. |
| `src/cli/files.ts` | MODIFY (created in wp2) | Reuse wp2's `assertDistinct(inputs,outputs)`, `stage(final): StagedFile`, `commitNoReplace(staged: StagedFile[])` and `commitReplace(staged: StagedFile[])` for every planned output; extend only for directory transaction needs, preserving rollback of invocation-owned files and cleanup. |
| `src/cli/files.test.ts` | MODIFY (created in wp2) | Add multi-file stems staging, late failure, rollback and `--force` preservation cases to wp2's helper tests. |
| `src/cli/registry.ts` | MODIFY | Extend the already registered `export` command's usage/flags for `stems`; wp2 owns its registration (`src/cli/registry.ts:1-14,48-55` is a pre-wp2 anchor). |
| `src/cli/args.ts` | NO CHANGE | Existing parser rejects repeated scalar flags and reports unknown flags as `E_INPUT` (`src/cli/args.ts:13-30,33-51`). |
| `src/cli/commands/render.ts` | NO CHANGE | Current `render --stems` defaults to 16-bit, emits `<id>.wav`, uses track-id WAV seeds and replacement `rename` (`src/cli/commands/render.ts:21-24,78-80,86-89,99-118`). Do not route it through `planStems` or alter its loop truncation. |
| `src/audio-io/wav.tool.ts` | NO CHANGE | Reuse existing stereo PCM writer: 16-bit seeded TPDF dither, 24-bit no dither, RIFF guard (`src/audio-io/wav.tool.ts:83-112,118-133`). Do not change its quantizer to satisfy bundle arithmetic. |
| `devlog/str_func/export.md` | NEW | Feature tree, shared `ExportPlan<D>` signature, stem planner/manifest, dependencies and sync checklist. |
| `devlog/str_func/AGENTS.md` | MODIFY | Add the `export` feature row in wp4, the phase that creates `src/export`. |
| `tests/e2e/daw-legacy.test.ts` | NO CHANGE | wp2 owns the pre-change baseline from F27; wp4 runs it and investigates any changed digest, especially `render --stems`. |

## 1. Render capture and exact additive boundary

I signatures, with `StereoBuffer` from `src/audio-io/buffer.schema.ts:1-6`:

```ts
export interface RenderOptions {
  bars?: { start: number; end: number }; stems?: boolean;
  returns?: boolean; premaster?: boolean;
  mastering?: "peak" | "loudnorm" | "lufs";
}
export interface RenderResult {
  audio: StereoBuffer; stems: RenderStem[];
  returns?: { reverb: StereoBuffer | null; delay: StereoBuffer | null };
  premaster?: StereoBuffer;
  // existing bars/duration/peak/events/loop fields remain unchanged
}
export async function renderSong(song: ResolvedSong, songPath: string,
  options?: RenderOptions): Promise<RenderResult>;
```

I: `export stems` calls `{ stems:true, returns:true, premaster: values.premaster === true }`; tests may call `renderSong` directly with `premaster:true` even when the CLI fixture does not request `premaster.wav`. A return is `null` if no source track has a positive static send and no automation lane reaches a positive value; wp6 extends this predicate for both instrument and audio tracks, using the same logic in bus rendering and return capture; bus config alone does not create a file. This follows current wet-branch conditions (`src/render/mixer.tool.ts:338-346`). `returns` is absent, not `{reverb:null,delay:null}`, when the option is false. `premaster` is absent when not requested. Neither optional field is serialized by the legacy `render` command (`src/cli/commands/render.ts:125-135`).

I signal order: voice/clip → track inserts → gain/pan/duck → track stem and send feeds; each send feed enters its existing reverb/delay processor; wet output is copied or retained as the return stem at the same point that it is added to `audio`. `premaster` snapshots the fully summed, loop-processed `audio` immediately before `song.master.fx`, `masterAudio` gain/loudness, saturation and limiter (`src/render/mixer.tool.ts:338-365`). Track inserts stay in the track stem; master inserts never enter stems/returns. V: Live's individual export can include post-fader tracks, returns, and Main, with same length (`evidence/aside-notes/R1_midi_automation_stems.md` §5.2); V: FL master FX appear only on Master split track (`evidence/aside-notes/R1_midi_automation_stems.md` §5.1). This signal choice is I under D5, not a promise of identical DAW internals.

I loop treatment: compute `bodyFrames = ceil(bars*secondsPerBar*Fs)` and `renderFrames = ceil((bars*secondsPerBar+tailSeconds)*Fs)` exactly as current mixer does (`src/render/mixer.tool.ts:257-259`). For each captured track stem and non-null return, before subarray truncation run `for (i=bodyFrames; i<renderFrames; i++) component[(i-bodyFrames)%bodyFrames] += component[i]` in ascending `i`, each channel separately. The existing master `audio` fold runs unchanged. Return capture must refer to the wet result before that fold, never to the send accumulator. Do not fold when `returns` is false: current `render --stems` must still truncate components (`:349-358`). A silent/no-send bus remains `null`, with no zero-valued return file. `bodyFrames` must be positive for modulo; schema's positive arrangement bars ensure this (`src/song/song.schema.ts:90-121`).

I: post-fold additive proof uses the actual pre-master `audio` after the existing mix/fold, not the final `result.audio`: nonlinear `Math.tanh`, normalization and limiting make the latter non-additive (`src/render/mixer.tool.ts:201-245`). Master audio need not equal the decoded sum of PCM files; independent 16-bit dithers and 16/24-bit quantization change that comparison (`src/audio-io/wav.tool.ts:96-112`). Preserve track/return float values for proof before WAV encoding; an optional `premaster.wav` is a print of the captured pre-master buffer, not a sum of encoded WAVs.

## 2. CLI, paths, frames, and failures

I invocation: `music2 export stems <song.json> -o <dir> [--bits 16|24] [--premaster] [--no-master] [--bars a:b] [--force] [--json]`. Exactly one song positional and an output directory are required (D3, F14); unknown sub-verb or flag is `E_INPUT` exit 2. Default `bits=24` is an I delivery choice, supported by the existing writer; song `sampleRate` (44100 or 48000, default 44100) is authoritative and there is no export resampling flag (`src/song/song.schema.ts:102-105,348-351`). V: matched sample rate/bit depth and aligned start/end are stem delivery practices (`evidence/aside-notes/R1_midi_automation_stems.md` §5.4). D5 permits an optional master, so default `master.wav` is present and `--no-master` writes no master; this narrows F19's unconditional master. `--premaster` may be combined with `--no-master`.

I bundle paths, all relative POSIX paths in manifest, are `tracks/<id>.wav` in `song.tracks` order followed by `song.audioTracks` order when wp5 adds them, `returns/reverb.wav`, `returns/delay.wav` only if active, `master.wav` unless `--no-master`, `premaster.wav` only on `--premaster`, and `stems.json` last. Track IDs already match `^[a-z][a-z0-9_-]{0,31}$` (`src/song/song.schema.ts:55`); reject duplicate IDs across future audio tracks in their schema (F6). Match `RenderStem.trackId` to each ID exactly once, not array index (F11); missing/duplicate/unexpected IDs are `E_RENDER` exit 5. `src/export/stems.tool.ts` returns `ExportPlan<StemsData>` file descriptors `{path,wav,bits,seed}` or `{path,bytes}` and never absolute paths (F12). Master seed is `fnv1a32(song.seed,"master","wav")`, track seed `fnv1a32(song.seed,id,"wav")` to match legacy writer (`src/cli/commands/render.ts:101,112-114`), return seed `fnv1a32(song.seed,"return",id,"wav")`; premaster seed `fnv1a32(song.seed,"premaster","wav")` (I). With the same song/options, `master.wav` bytes must match `music2 render` at the same bits/bars/mastering mode and Node major/platform; `--loudnorm` is outside this command.

I frame alignment: all WAVs are stereo, have the exact same `sampleRate` and `frames`, and sample 0 is bar 1 beat 1 for a full-song export. `frames = ceil((B*meter.numerator*60/bpm + tailSeconds)*Fs)` for nonloop; loop frames are `ceil(B*meter.numerator*60/bpm*Fs)` (current mixer formula, `src/render/mixer.tool.ts:257-259,349-355`). No per-stem silence trimming or automatic tail measurement. V: DAW stem files with identical lengths align easily (`evidence/aside-notes/R1_midi_automation_stems.md` §5.2); tail behaviors vary by DAW (`evidence/aside-notes/R1_midi_automation_stems.md` §5.1). The track's leading silence remains in its WAV.

I `--bars a:b` uses the existing zero-based, half-open grammar (`src/cli/commands/render.ts:26-35`) with `0 <= a < b <= timeline.bars`; the exported crop's sample 0 represents source bar `a+1`, recorded as `barOrigin`. Its body is `b-a` bars plus `tailSeconds`, so every file still aligns at its own sample 0. Markers before `a` or at/after `b` are omitted; included marker bar/seconds are **relative to the bundle origin**, while `sourceBar` preserves the song's 1-based bar number (§3). The master parity check uses `music2 render --bars a:b`; tapestop pre-roll stays the renderer's responsibility (`src/render/mixer.tool.ts:264-309`). A loop song with any `--bars` is `E_INPUT` exit 2, as now (`:250-251`, `src/cli/commands/render.ts:74-75`). Empty/out-of-range ranges fail `E_INPUT` before writing. This is an I extension of F14's stems flags to make the requested `--bars` relationship explicit.

I output policy: `-o` may name an absent or empty directory; an occupied directory fails `E_ACCESS` exit 4 unless `--force`. Under `--force`, replace only files in this plan, leaving unrelated files intact (F15). Reject song/input/output identity and output path aliasing with `E_INPUT` exit 2 before rendering; use realpath identity for existing paths (`src/cli/commands/render.ts:41-51`). Stage every file beside its final destination. Default commit uses no-replace `link()`; on partial failure, unlink only files created by this invocation. For `--force`, first move each pre-existing target to a same-directory private backup, then rename staged files into place; on any later failure restore backups in reverse order and remove only newly installed files. Delete backups only after every commit succeeds, and remove temps in `finally`. Manifest commits last so it never advertises an incomplete bundle. This strengthens F15's stated rollback intent while preserving pre-existing user files (`src/cli/commands/sfx.ts:99-116`). Write failure is `E_ACCESS` exit 4; invalid RIFF size/nonfinite sample is `E_RENDER` exit 5 (`src/audio-io/wav.tool.ts:102-133`). In `--json` mode return exactly one envelope (`src/cli/output.ts:4-12,19-33`): `data:{dir,manifest,files,frames,sampleRate}` in that order, `artifacts` in plan order, `warnings:[]` unless a real loss/limitation is detected. `manifest` is the absolute path to `stems.json` only in CLI output, never inside the manifest.

## 3. Manifest JSON contract

I serializer is `JSON.stringify(ordered, null, 2) + "\n"` with UTF-8, LF, no BOM; arrays keep song order, returns are reverb then delay. No date, host, absolute or temporary path, random UUID, or runtime-specific stats. Exact TypeScript signatures:

```ts
export interface StemsManifest {
  version: 1; title: string; bpm: number;
  meter: { numerator: number; denominator: 4 }; key: string | null;
  sampleRate: 44100 | 48000; bits: 16 | 24; frames: number;
  barOrigin: number; bars: number; loop: boolean;
  sectionMarkers: { name: string; section: string; role: string | null;
    bar: number; sourceBar: number; seconds: number }[];
  tracks: { id: string; file: string; type: "notes" | "drums" | "audio";
    instrument: string | null; gainDb: number; pan: number;
    sends: { reverb: number; delay: number }; inserts: ResolvedInsert[] }[];
  returns: { id: "reverb" | "delay"; file: string; legacy: boolean;
    params: ReverbBusParams | DelayBusParams | null }[];
  master: { file: "master.wav"; ceilingDb: number;
    processing: ["inserts", "saturation", "limiter"] } | null;
  premaster: "premaster.wav" | null;
}
export interface StemsData { files: string[]; frames: number; sampleRate: number }
export function serializeStemsManifest(value: StemsManifest): string;
export function validateStemsManifest(value: StemsManifest, files: readonly string[]): void;
export interface ExportPlan<D> {
  files: ({ path: string; wav: StereoBuffer; bits: 16 | 24; seed: number }
    | { path: string; bytes: Uint8Array })[];
  data: D;
  warnings: string[];
}
export function planStems(song: ResolvedSong, timeline: Timeline, result: RenderResult,
  options: { bits: 16 | 24; includeMaster: boolean; includePremaster: boolean;
    bars?: { start: number; end: number } }): ExportPlan<StemsData>;
```

I exact top-level insertion order is `version,title,bpm,meter,key,sampleRate,bits,frames,barOrigin,bars,loop,sectionMarkers,tracks,returns,master,premaster`. Nested insertion orders are as written in the interface, with `meter` `numerator,denominator`, `sends` `reverb,delay`, and `sectionMarkers` `name,section,role,bar,sourceBar,seconds`. `frames` is the D5 length-in-samples field for each channel; no redundant `lengthSamples` key. Each track's `inserts` and return `params` contain the already resolved objects in their existing order; `null` is written, never omitted. The manifest's fixed `processing` list names stages that are eligible on the master; empty insert arrays do not change its shape. A `master:null` means no master file, `premaster:null` means no pre-master file. Validate that all referenced paths exist exactly once, that every PCM buffer has equal rate/frame count, and that no referenced path escapes the bundle root.

I minimal full-song example (one 4/4 bar at 120 BPM plus 2 s tail, 48 kHz, no sends, no master file):

```json
{"version":1,"title":"demo","bpm":120,"meter":{"numerator":4,"denominator":4},
 "key":null,"sampleRate":48000,"bits":24,"frames":192000,"barOrigin":1,
 "bars":1,"loop":false,
 "sectionMarkers":[{"name":"intro","section":"intro","role":null,"bar":1,"sourceBar":1,"seconds":0}],
 "tracks":[{"id":"lead","file":"tracks/lead.wav","type":"notes","instrument":"piano",
   "gainDb":0,"pan":0,"sends":{"reverb":0,"delay":0},"inserts":[]}],
 "returns":[],"master":null,"premaster":null}
```

I marker projection comes from `timeline.placements` in ordinal order (`src/song/arrange.tool.ts:3-23`; `src/song/timeline.tool.ts:31-35,77`), one entry per placement. Name uses the same wp2 `ProjectIR.markers[].name` rule (or reads it after building ProjectIR): section ID for occurrence 0, then `<id> (<occurrence+1>)` (`hook (2)` for the second placement). For a placement starting at zero-based bar `p.startBar` inside `[a,b)`, `bar = p.startBar-a+1`, `sourceBar = p.startBar+1`, `seconds = (p.startBar-a)*timeline.secondsPerBar`; `role = p.role ?? null`. No marker is invented for a crop that begins inside a section. `key` is the resolved song key string or `null` (`src/song/song.schema.ts:45-52,348-350`). `legacy` on a return is true when the old built-in bus was used (`song.fx?.[id]` absent), false for the configured bus (`src/render/mixer.tool.ts:338-345`); `params` is null for legacy, resolved bus params otherwise. This is data description, not an external interchange schema.

## 4. Summation proof and byte identity

I float oracle for each frame `i` and channel `c`: let `S(i,c)` be the **Float64** sum, in manifest track order then reverb/delay order, of the stored `Float32` component samples after any loop fold. Let `A(i,c)` be the stored `Float32` pre-master snapshot taken before master inserts. Let `M(i,c)=max(1, sum(abs(component(i,c))))`. Require every operand finite, identical frames/rate, and `abs(S-A) <= 1e-6 * M` for **every** frame/channel; report maximum absolute error, maximum normalized error `abs(S-A)/M`, frame/channel of worst case, and source count. Do not use RMS or a peak-only comparison. This scales with large additive signals while providing a concrete `1e-6` bound at ordinary levels. Synthetic all-zero/one-source cases must be exactly zero error. V/I: R1 §5.4 calls additive checking a recommended practice; this exact tolerance is I and applies to float buffers, not independently dithered WAV integers.

I independent proof fixture must have at least two dry tracks, one track insert, nonzero pan/gain/duck, positive reverb and delay sends (configured and legacy variants), and a nontrivial master insert/target LUFS. Compare the captured `premaster` to stem+return sum before writing files. Also assert final `master.wav` differs from the pre-master print on that fixture, so the test cannot accidentally compare after limiting. For loop songs, inject a tail-only impulse: after folding, the energy at target index `(i-bodyFrames)%bodyFrames` appears in the originating track or return and in pre-master; legacy `render --stems` still has its old truncated tail. The proof must cover 44.1/48 kHz and 16/24-bit export metadata, but the float oracle itself is independent of bit depth.

I D10 byte gate: on the same Node major/platform, compare pre-wp2 digests for every `examples/*.song.json` legacy render, `render --stems`, validate/events/lint JSON, and unchanged schema subtrees using `tests/e2e/daw-legacy.test.ts` (F27). Keep `tests/e2e/legacy-render.test.ts:17-39` and `src/render/mixer.test.ts:25-37` pins. Assert calling `renderSong` with no new options does not add `returns`/`premaster` result keys and preserves existing PCM bytes; `render --stems` keeps `<id>.wav`, old dither seeds, truncation, and overwrite semantics (`src/cli/commands/render.ts:78-118`; `src/render/mixer.tool.ts:349-358`). A platform-skipped digest is **unproven**, not green proof. `export stems` is new and may differ by design on loop component tails; it must not mutate the old CLI path.

## Boundary vectors

These are I contract examples for implementers, not measured results.

1. At 120 BPM, 4/4, two bars, 48 kHz, tail 2 s: body = 192000 frames and nonloop files = 288000 frames; loop files = 192000 frames. All files share exactly these lengths and sample 0.
2. At 120 BPM, 3/4, three bars, 44.1 kHz, tail 0: `secondsPerBar=1.5`, `frames=198450`, and the third placement starts at source bar 3 / second 3.0.
3. `--bars 1:3` on the 3-bar case gives `barOrigin=2`, `bars=2`, `frames=132300`, and a placement at source bar 3 becomes `{bar:2,sourceBar:3,seconds:1.5}`.
4. `--bars 0:2` gives `barOrigin=1`; sample 0 is source bar 1. A track silent until bar 2 contains initial zero frames, with no trimming.
5. `--bars 1:1`, `--bars 2:1`, negative, fractional, unsafe, or end beyond song bars returns `E_INPUT` exit 2 and creates no output.
6. Any `--bars` on `loop:true` returns `E_INPUT` exit 2 before files are staged.
7. Reverb send 0 on every track yields no `returns/reverb.wav` and no reverb manifest row; `returns.reverb` is `null`. A configured reverb with zero sends still yields none.
8. With only reverb send positive, manifest returns is one `reverb` row; its file is post-bus wet, while dry stem samples remain unchanged when the send is toggled (`src/render/mixer.tool.ts:76-79,338-342`).
9. Tail-only value `0.25` at `bodyFrames+7` in a loop component appears at frame 7 after export fold; it does not appear in legacy `render --stems` frame 7 unless there was already body signal there.
10. Two stems `[0.25,0.125]` and one return `[0.0625]` at a frame sum to `0.4375`; captured pre-master is `0.4375` and error 0. A master limiter may produce a different value.
11. A stored pre-master of `0.50000024` against component sum `0.5` has error `2.4e-7 <= 1e-6`; `0.500002` fails because `2e-6 > 1e-6` when sum-absolute is ≤1.
12. One NaN in a captured return is `E_RENDER` exit 5; no WAV is committed, even if the final master sample happened to be finite.
13. `--bits 16` writes PCM tag 1, 2 channels, 16 bits and deterministic TPDF-seeded bytes; `--bits 24` writes PCM tag 1, 2 channels, 24 bits with no dither (`src/audio-io/wav.tool.ts:83-112`). `--bits 32` is `E_INPUT` exit 2.
14. Same song/options written to two different directory names yields identical WAV and `stems.json` bytes; manifest paths are relative and contain neither directory name nor timestamp.
15. `--no-master --premaster` yields `master:null`, `premaster:"premaster.wav"`, no `master.wav`; the float sum still matches the pre-master buffer.
16. An existing nonempty output directory without `--force` fails `E_ACCESS` exit 4 with all old bytes untouched; a failure during the last staged file leaves no newly committed artifact.
17. For a nonloop, the bundle's `master.wav` SHA-256 equals a same-flags legacy `render -o ... --bits 24` master on the pinned platform. On a loop, component files are folded but the master bytes still match.
18. A legacy `render --stems` loop run retains every pinned WAV digest and its truncation, independent of whether the new bundle command was invoked earlier in the same process.

## Verification handoff

This docs-only unit runs no suite. The implementation owner must record fresh commands, exit codes, sample counts, digest values, and maximum summation error. There is no DAW-bridge goalplan file in the current task directory; the criterion names below map directly to binding D5/D10 and architect F19/F27 pending parent goalplan numbering.

| Criterion | Future command / test | Required observation |
| --- | --- | --- |
| D5/F19 capture and additive bus proof | `node --test src/render/mixer.test.ts src/export/stems.test.ts` | Post-insert dry stems, separate active returns, optional pre-master; every float frame/channel meets `abs(S-A) <= 1e-6*M`; report worst frame/channel/error for normal and loop songs. |
| D5 manifest/format/alignment | `node --test src/export/stems.test.ts src/cli/commands/export.test.ts` | Exact JSON key order/relative paths/marker offsets; 16/24-bit stereo WAVs all share rate, frame count and origin; optional master and pre-master flags behave as vectors. |
| D3/F14–F16 CLI safety | `node --test src/cli/commands/export.test.ts` | One JSON object in success/failure, exit 2/4/5 cases, no-replace/force behavior and rollback, one render call, same-flags master parity. |
| D10/F27 legacy bytes | `node --test tests/e2e/daw-legacy.test.ts tests/e2e/legacy-render.test.ts src/render/mixer.test.ts src/cli/commands/render.test.ts` | All pinned legacy render, loop, `--bars`, and `render --stems` digests/JSON fields unchanged at the recorded Node major/platform; skips identified as unproven. |
| Repository gates (AGENTS.md) | `npm run typecheck`; `npm run lint`; `npm test`; `npm run build`; `npm run audit:structure` | All required checks exit 0 on the final affected source; structure audit confirms colocated tests and file budgets. |
