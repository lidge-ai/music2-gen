# CLI — Structure & Functions

Dispatch music2 commands and render one structured result or error per invocation.

## File Tree

```text
src/cli/
├── index.ts             # executable source entry point
├── args.ts              # command discovery and strict option parsing
├── files.ts             # path identity, destination-local staging, transactional commits
├── files.test.ts        # alias, late collision, rollback, replacement tests
├── main.ts              # invocation, command execution, output channel
├── main.test.ts         # JSON, status, help, version, source-bin checks
├── output.ts            # success and failure formatting
├── registry.ts          # command types, registry, registration
└── commands/
    ├── help.ts          # command list and topic usage
    ├── version.ts       # installed package version
    ├── schema.ts        # print or write song JSON Schema
    ├── validate.ts      # validate song, voice rules and lanes; summarize timeline
    ├── events.ts        # list filtered timed song events
    ├── render.ts        # WAV, optional stems, encoding, and loudnorm
    ├── export.ts        # ProjectIR JSON or staged format-1 MIDI export
    ├── export.test.ts   # IR and MIDI bytes, staged file and error-envelope cases
    ├── import.ts        # bounded format-0/1 MIDI to Song v1 import
    ├── import.test.ts   # MIDI note lists, collision and malformed-input cases
    ├── render.test.ts   # render command output and failure cases
    ├── analyze.ts       # WAV/song analysis and artifacts
    ├── analyze.test.ts  # analysis command and output cases
    ├── doctor.ts        # ffmpeg and encoder capability report
    ├── doctor.test.ts   # doctor capability and required-mode cases
    ├── library.ts       # scan/find/import/verify/list user samples
    ├── library.test.ts  # option, cache and pitch QA command contracts
    ├── recipes.ts       # list or inspect genre cards
    ├── recipes.test.ts  # recipe command output cases
    ├── new.ts           # construct and optionally write starter song
    ├── new.test.ts      # starter flags and write cases
    ├── lint.ts          # static findings and QA exit policy
    ├── lint.test.ts     # lint command cases
    ├── critique.ts      # audible review and local DSP command
    ├── critique.test.ts # critic command cases
    ├── skill-path.ts    # resolve and print packaged skill directory
    ├── skill-path.test.ts # skill path validation cases
    ├── sfx.ts           # standalone sound-effect WAV + sidecar generator
    └── sfx.test.ts      # determinism, sidecar order, exit codes, concurrent writers
```

## Module Responsibility

`src/cli` owns the process-facing command boundary. It selects a command,
parses common and command-specific flags, invokes a registered handler, and
writes a human or JSON result. `main` accepts injectable streams and cwd for
testing. `output.ts` owns the success and failure envelopes; the shared module
owns error codes and their exit mapping. The registry supplies command metadata
used by both parsing and help text.

At this source snapshot the registry contains `help`, `version`, `schema`,
`validate`, `events`, `render`, `doctor`, `analyze`, `recipes`, `new`, `lint`,
`critique`, `skill`, `sfx`, `export`, `import`, `slice`, `instruments`, and `library`.

## Key Function Signatures

The signatures below come from exported declarations in the current source.
`src/cli/index.ts` is an executable entry and does not re-export functions.

| Exported signature | Source | Purpose |
|---|---|---|
| `export function parseCommand(argv: string[], registry: Map<string, CommandSpec>): ParsedCommand` | `args.ts` | Resolve command and parse its flags. |
| `export function wantsJson(argv: string[]): boolean` | `args.ts` | Detect `--json` or `MUSIC2_JSON=1` before parsing. |
| `export function commandHint(argv: string[]): string` | `args.ts` | Infer a command label for parse failures. |
| `export async function main(argv: string[], io: CliIO = {}): Promise<number>` | `main.ts` | Execute one invocation and return exit status. |
| `export function renderSuccess(result: CommandResult, json: boolean): string` | `output.ts` | Format successful result. |
| `export function renderFailure(error: unknown, json: boolean, command = "unknown"): { text: string; exit: number }` | `output.ts` | Format failure and status. |
| `export function register(spec: CommandSpec): void` | `registry.ts` | Add a uniquely named command. |
| `export interface StagedFile { temporary: string; final: string }` | `files.ts` | One destination-local staged output. |
| `export function assertDistinct(inputs: string[], outputs: string[]): Promise<void>` | `files.ts` | Reject realpath and symlink-parent input/output aliases with `E_INPUT`. |
| `export function stage(final: string): StagedFile` | `files.ts` | Name a temporary file beside its destination; the caller writes and cleans it. |
| `export function commitNoReplace(staged: StagedFile[]): Promise<void>` | `files.ts` | Publish with `link()`, preserving existing outputs and rolling back files this call linked on failure. |
| `export function commitReplace(staged: StagedFile[]): Promise<void>` | `files.ts` | Publish with `rename()`, restoring prior destinations if a later batch rename fails. |
| `export const exportCommand: CommandSpec` | `commands/export.ts` | Dispatch `ir` and `midi`; MIDI loads confined kit maps and stages a `.mid` artifact. |
| `export const importCommand: CommandSpec` | `commands/import.ts` | Parse bounded `.mid`, reconstruct and validate Song v1, then stage a `.json` artifact. |
| `export function resolveSkillDir(root: string): string` | `commands/skill-path.ts` | Return the packaged skill directory after verifying its `SKILL.md` is a regular file. |
| `export const sfx: CommandSpec` | `commands/sfx.ts` | Parse `--preset`, optional `-o` (default first free `$MUSIC2_HOME/sfx/<preset>-<seed>[-n].wav`), `--seed`, `--seconds`, `--sample-rate`, `--params`; resolve and synthesize through `src/sfx`; commit WAV then `<basename>.sfx.json` with no-replace `link()` (existing output → `E_ACCESS`). |
| `export function sidecarJson(resolved: ResolvedSfx): string` | `commands/sfx.ts` | Stable sidecar key order: generatorVersion, preset, seed, seconds, frames, sampleRate, params. |

### Exported types and values

| Export | Exact declaration | Role |
|---|---|---|
| `ParsedCommand` | `export interface ParsedCommand` | `command`, positional `args`, `values`, `json`, `help`. |
| `CliIO` | `export interface CliIO` | Optional `stdout`, `stderr`, `cwd`. |
| `CommandOption` | `export interface CommandOption` | Option type, short flag, multiplicity, description. |
| `CommandContext` | `export interface CommandContext` | Handler arguments, values, JSON mode, cwd, stderr. |
| `CommandResult` | `export interface CommandResult` | Command name, data, optional artifacts, warnings, and human-mode `text`. |
| `CommandSpec` | `export interface CommandSpec` | Name, summary, usage, options, async `run`. |
| `commands` | `export const commands = new Map<string, CommandSpec>()` | In-process registry. |
| `help` | `export const help: CommandSpec` | Help command specification. |
| `version` | `export const version: CommandSpec` | Version command specification. |
| `schema` | `export const schema: CommandSpec` | Song v1 JSON Schema command. |
| `validate` | `export const validate: CommandSpec` | Song and timeline validation command. |
| `events` | `export const events: CommandSpec` | Timed event listing command. |
| `render` | `export const render: CommandSpec` | WAV render with optional stems and encoded copies; default WAV in `$MUSIC2_HOME/renders/`. |
| `doctor` | `export const doctor: CommandSpec` | ffmpeg capability inspection and the active storage home. |
| `analyze` | `export const analyze: CommandSpec` | WAV/song analysis and artifact generation; default folder `$MUSIC2_HOME/analysis/<name>/`. |
| `recipes` | `export const recipes: CommandSpec` | List or inspect genre cards. |
| `newCommand` | `export const newCommand: CommandSpec` | Create a starter song. |
| `lint` | `export const lint: CommandSpec` | Static song and genre checks. |
| `critiqueCommand` | `export const critiqueCommand: CommandSpec` | Audible review paired with local DSP. |
| `skillPath` | `export const skillPath: CommandSpec` | Print the packaged music2 skill directory. |

`CommandSpec` requires `run(ctx: CommandContext): Promise<CommandResult>`.
The handlers implement `run({ args })` inline on their exported spec objects;
they have no separately exported `run` function.

### Entry and argument flow

- `index.ts` imports `main`, passes `process.argv.slice(2)`, awaits it,
  and assigns the returned code to `process.exitCode`.
- `parseCommand` first scans argv without strict options to find the first
  positional token; no positional command defaults to `help`.
- An unregistered command raises `E_INPUT`, listing current command names.
- The command token is removed before `parseOptions` handles remaining args.
- `parseOptions` uses Node `parseArgs` in strict mode with positional support.
- Before `parseArgs`, `rejectDuplicateScalars` rejects a repeated command
  option with `E_INPUT`; long `--name`/`--name=value` and single short aliases
  share the same name. Options marked `multiple` remain repeatable. Scanning
  stops at `--`; the check applies to command-specific options in `spec.options`.
- Every command gets `--json` and `--help` / `-h` in addition to spec options.
- Bad flags become `E_INPUT` with a command-specific help suggestion.
- `MUSIC2_JSON=1` forces JSON mode even without an argv flag.
- `wantsJson` makes that mode available before parse errors occur.
- `commandHint` uses the first nonflag argument or `help` on error paths.

### Dispatch and rendering

- `main` defaults streams to `process.stdout` and `process.stderr`.
- Its cwd defaults to `process.cwd()` and is passed into the handler context.
- A parsed `--help` for a non-help command returns that spec's usage/options.
- Otherwise `main` awaits the command spec's `run` method.
- Success writes one rendered string plus newline to stdout and returns `0`.
- Failure writes one rendered string plus newline to stdout in JSON mode.
- Human-readable failure writes to stderr and includes a `Fix:` line.
- An unknown thrown value becomes `E_INTERNAL` with a maintainer-report fix.
- A `Music2Error` retains its code, message, details, retryability, and fix.
- `renderFailure` uses the error's mapped exit status.
- JSON success includes `ok`, `command`, `data`, `artifacts`, `warnings`,
  and `meta.music2`; absent artifact/warning arrays become empty arrays.
- JSON failure includes `ok`, `command`, structured `error`, and
  `meta.music2`; absent fix is `null` and absent details is `{}`.
- Human version output is `music2 <version>`.
- Human help output is the usage string.
- A supplied `CommandResult.text` is returned verbatim in human mode before
  the version/help fallbacks. JSON mode ignores it and emits one JSON object.
- Other human success data is pretty-printed JSON.

### Registered commands

| Command | Source | Inputs and result |
|---|---|---|
| `help` | `commands/help.ts` | Optional topic; lists names, summaries, usage, options. |
| `version` | `commands/version.ts` | No positional args; returns `packageVersion()`. |
| `schema` | `commands/schema.ts` | No positional args; returns `{ schema }`, or `--out file` writes formatted schema and returns `written` plus artifact path. |
| `validate` | `commands/validate.ts` | One song path; returns title, BPM, bars, duration seconds, and per-track event counts. |
| `events` | `commands/events.ts` | One song path; optional `--bars start:end` and `--track id`; returns selected timed events. |
| `render` | `commands/render.ts` | One song path; WAV plus optional MP3, Ogg, and stems; returns `RenderData` and artifact paths. |
| `export` | `commands/export.ts` | `ir <song.json>` only; formatted IR on stdout or staged `.json` output with no-replace default and `--force` replacement. JSON mode returns one envelope. |
| `doctor` | `commands/doctor.ts` | No positional args; returns `DoctorData` for ffmpeg and required encoders. |
| `analyze` | `commands/analyze.ts` | One WAV or song JSON path; optional `--song` and `--out`; returns artifacts and summary. |
| `library` | `commands/library.ts` | Local scan/find/import/verify/list; confined imports and pitch QA. |
| `recipes` | `commands/recipes.ts` | Zero or one recipe ID; returns summaries or a full card. |
| `new` | `commands/new.ts` | Required `--genre`; optional arrangement, preset, seconds, BPM, key, seed, title, and output path. |
| `lint` | `commands/lint.ts` | One song JSON path; optional genre override and strict QA policy. |
| `critique` | `commands/critique.ts` | One WAV/song path; optional model, base URL, and excerpt seconds. |
| `skill` | `commands/skill-path.ts` | Sole positional argument `path`; returns `{ path }` and prints the directory in human mode. |
| `sfx` | `commands/sfx.ts` | No positionals; returns `{ wav, sidecar, generatorVersion, preset, seed, seconds, frames, sampleRate, params }` and both paths as artifacts. Invalid flags/params exit 2, existing outputs exit 4, synthesis failure exit 5. |
| `slice` | `commands/slice.ts` | One WAV and required `-o dir`; writes slice WAVs, `kit.json`, and a playable `slice.song.json`. `--sensitivity`, `--min-gap-ms`, `--max-slices`, `--bpm`, and `--force` control detection, snippet grid, and replacement. |

### Skill path command

`music2 skill path [--json]` has no command-specific options and accepts only
the positional argument `path`. `resolveSkillDir(packageRoot())` joins
`skills/music2` and requires a regular `SKILL.md` file there. Missing skill
content raises `E_NOT_FOUND` (exit 2); other arguments raise `E_INPUT` (exit 2).
The result is `{ command: "skill", data: { path }, text: path }`: human mode
prints the path, while JSON mode uses the standard single-object envelope.
`src/cli/registry.ts` registers `skillPath`, so help and argument parsing use
the same specification.

### Recipes and new commands

`music2 recipes [id] [--json]` lists sorted card summaries when no ID is
given. One ID returns the complete card, including palette, arrangement, mix
targets, and sources. An unknown ID raises `E_NOT_FOUND` (exit 2), and more
than one positional argument raises `E_INPUT`.

`music2 new --genre <id> [--arrangement id] [--use preset] [--seconds n] [--bpm n] [--key 'C minor'] [--seed n]
[--title text] [-o song.json] [--json]` generates a validated starter.
`--arrangement` selects a named form. `--use` selects one use-case preset;
`--seconds` is accepted only for an exact-duration preset. The preset recommends
a form before an explicit arrangement override, and an explicit BPM locks the
duration search. Result data includes arrangement, use case and duration.
`--bpm` and `--seed` use nonnegative integer argument spelling; the recipe
boundary checks the card BPM range and uint32 seed. A key override retains
the card's major/minor mode and transposes note patterns. Without `--out`,
human mode prints formatted song JSON. With `--out`, the command resolves the
path against cwd and creates a new file with exclusive `wx`; an existing or
unwritable output raises `E_ACCESS` (exit 4). The result lists the written
path as an artifact.

### Lint and critique commands

`music2 lint <song.json> [--genre id] [--strict] [--json]` reads JSON, runs
`lintSong`, and returns the report. Any lint error raises `E_QA` (exit 6);
`--strict` also treats warnings as QA failures. Non-strict warnings remain a
successful report. Human output prints one line per finding or `No lint
findings.` The display suppresses a duplicate generic out-of-key line when
it matches the UK drill key finding; the returned report retains both.

`music2 critique <audio.wav|song.json> [--model id] [--base-url url]
[--excerpt s] [--json]` requests a review of the first 1–120 seconds
(default 30). The command resolves the path against cwd and delegates audio
preparation, provider request, and local DSP to `src/critic`. Human output
prints audible review fields and a measured DSP line; JSON includes the full
report in one envelope. Input failures exit 2, capability failures 3,
provider failures 4, render failures 5, and timeouts 7.

`help` rejects extra or unknown topics with `E_INPUT`. It generates its
command list from the live registry, so newly registered specs appear there.
`version` rejects positional arguments with `E_INPUT`. Both specs expose
their usage through command metadata and return `Promise<CommandResult>`.
`schema` resolves `--out` against the invocation cwd and reports write
failures as `E_INPUT`. `validate` loads and builds the complete timeline.
`events` validates a zero-based, half-open bar range within the timeline,
rejects unknown tracks, and rounds event time, duration, and slot to six
decimal places. Each command requires exactly the positional arguments
shown in the table and reports mismatches as `E_INPUT`.

### Render command

Usage: `music2 render <song.json> [-o out.wav] [--bits 16|24] [--mp3]
[--ogg] [--stems dir] [--bars a:b] [--loudnorm] [--json]`.
The common `--help` / `-h` flag also applies.

| Flag | Meaning and validation |
|---|---|
| `-o`, `--out <path>` | Output WAV; defaults beside the input with `.song.json` or `.json` replaced by `.wav`. Must end in `.wav`. |
| `--bits 16\|24` | WAV and stem depth; defaults to 16. Other values raise `E_INPUT`. |
| `--mp3` | Encode a same-basename `.mp3` using ffmpeg `libmp3lame`. |
| `--ogg` | Encode a same-basename `.ogg` using ffmpeg `libvorbis`. |
| `--stems <dir>` | Write one dry `<track.id>.wav` per track. |
| `--bars a:b` | Zero-based half-open bar range with safe integers and `a < b`. The mixer checks song bounds. |
| `--loudnorm` | Two-pass ffmpeg loudness mastering; uses song target LUFS or `-14` and song ceiling. |

Paths resolve from the invocation cwd, except the default WAV path beside
the song. The command rejects path collisions among input, WAV, encoded
copies, and stems. It checks ffmpeg only when encoding or loudnorm needs it.
Output files are staged at temporary paths, then renamed to final names;
temporary files are removed in `finally`. The returned `artifacts` array
lists the requested final paths. Loudnorm processes the WAV before optional
MP3/Ogg encoding; stems retain dry, pre-master audio.

Without `--loudnorm`, songs with `master.targetLufs` use the renderer's
in-process `lufs` mode; songs without a target use `peak` mode. `--loudnorm`
explicitly selects ffmpeg two-pass processing.

`RenderData` is declared in `src/render/render.schema.ts` and imported
directly by the command:

| Field | Type | Meaning |
|---|---|---|
| `wav` | `string` | Absolute final WAV path. |
| `mp3`, `ogg` | optional `string` | Absolute encoded-copy paths. |
| `stems` | optional `string[]` | Absolute dry stem paths in song track order. |
| `bars`, `sampleRate`, `frames`, `events` | `number` | Render span, PCM dimensions, selected onset count. |
| `durationSeconds`, `ceilingDb` | `number` | PCM duration and configured ceiling. |
| `peakDbfs`, `truePeakDbtp` | `number \| null` | PCM peak measurements; silence maps `-Infinity` to JSON `null`. |

### Analyze command

Usage: `music2 analyze <audio.wav|song.json> [--song song.json] [--out dir] [--json]`.
The command requires one input path. `--song` is valid only with WAV input,
and the supplied song must align with that WAV's sample rate and full rendered
frame count. A song JSON input is rendered in-process before analysis.

The default output directory is `<input-stem>.analysis` beside the input;
`--out` replaces it. The command writes `analysis.json`, `analysis.md`, and
`spectrogram.png`, plus `pianoroll.png` when song metadata is available and
`beats.json` when a beat map can be built. It rejects output/input path
collisions. `data` is the `AnalysisArtifacts` object, including artifact paths
and a declared/estimated BPM, LUFS, and warning summary. In human mode, its
`text` renders the Markdown report followed by an artifact list; JSON mode
omits `text` from the single structured envelope.

### Doctor command

Usage: `music2 doctor [--json]`. It probes ffmpeg and returns `DoctorData`
from `src/probe/ffmpeg.schema.ts`: `{ ffmpeg: FfmpegInfo | null;
required: boolean; ready: boolean }`. `FfmpegInfo` contains executable
`path`, `version`, and `encoders.libmp3lame` / `encoders.libvorbis` booleans.
`ready` is true only when ffmpeg and both encoders are present. Without
`MUSIC2_REQUIRE_FFMPEG=1`, missing ffmpeg or encoders is reported in data
and the command succeeds. With that environment setting, missing ffmpeg
raises `E_FFMPEG_MISSING`; missing required encoders raises `E_CAPABILITY`.

### Command errors

| Code | Typical cause | Exit |
|---|---|---|
| `E_INPUT`, `E_SCHEMA`, `E_PARSE`, `E_NOT_FOUND` | Arguments, range, song, voice, or kit input is invalid. | 2 |
| `E_FFMPEG_MISSING`, `E_CAPABILITY` | ffmpeg or required encoder/mastering capability unavailable. | 3 |
| `E_ACCESS` | Song, kit, or output path cannot be accessed. | 4 |
| `E_RENDER` | PCM, effect, RIFF size, or peak-master failure. | 5 |
| `E_PROVIDER` | Critic provider request or response failure. | 4 |
| `E_QA` | Library pitch miss, lint errors, or warnings under `--strict`. | 6 |
| `E_TIMEOUT` | Critic request timeout. | 7 |
| `E_INTERNAL` | Unrecognized thrown error at the CLI boundary. | 1 |

All failures use the shared error envelope and exit mapping. Encoded-output
failures can also carry errors from `src/probe`; the CLI preserves their
typed code. JSON mode still emits exactly one object.

## npm launcher (bin/)

`bin/music2.js` is the package `bin`. It is plain Node ESM because npm and pnpm global shims start it with Node. Under Bun it imports `src/cli/index.ts` in-process. Under Node it calls `resolveBun()` from `bin/bun-binary.mjs` (a valid `MUSIC2_BUN_PATH`, else the pinned `bun` dependency's binary; a sub-1 MB placeholder triggers one run of the package's `install.js`), spawns that Bun on the CLI with `MUSIC2_BUN_SOURCE` set, forwards SIGINT/SIGTERM (and SIGHUP off Windows) and mirrors the exit code or signal. With no usable Bun it exits 3 with an `E_CAPABILITY` envelope in JSON mode (`--json` or `MUSIC2_JSON=1`). `bin/package-main.mjs` is the non-Bun library entry and throws. `tests/e2e/launcher.test.ts` and `scripts/install-smoke.mjs` (CI) cover it.

## Dependencies

| Dependency | Import path | Current use |
|---|---|---|
| Node argument parser | `node:util` | `parseArgs` in `args.ts`. |
| Shared errors | `../shared/index.ts` / `../../shared/index.ts` | Typed input/internal errors. |
| Shared package metadata | `../shared/index.ts` / `../../shared/index.ts` | Version data and JSON metadata. |
| Registry | `./registry.ts` / `../registry.ts` | Command lookup, specs, and help list. |
| Args parser | `./args.ts` | `main` parses and selects error mode. |
| Output formatter | `./output.ts` | `main` writes success and failure envelopes. |
| Command specs | `./commands/*.ts` | Registry startup and individual handlers. |
| Analysis boundary | `../../analyze/analyze.tool.ts` | Analyze WAV/song input and write artifacts. |
| Song boundary | `../../song/index.ts` | Schema, loading, and timeline in command handlers. |
| Render boundary | `../../render/index.ts`, `../../render/render.schema.ts` | Render song PCM and type render response. |
| Audio I/O | `../../audio-io/index.ts` | Write master and stem WAV files. |
| Sampler boundary | `../../sampler/index.ts` | Detect and materialize slice WAVs for `music2 slice`. |
| Probe boundary | `../../probe/index.ts` | Discover ffmpeg, encode copies, loudnorm, and type doctor response. |
| Recipes boundary | `../../recipes/index.ts`, `../../recipes/lint.tool.ts` | Card lookup, starter construction, and lint. |
| Critic boundary | `../../critic/index.ts` | Audible review and measured DSP. |
| Shared package root | `../../shared/index.ts` | Locate the installed package for `skill path`. |
| Node filesystem/path/crypto | `node:fs/promises`, `node:path`, `node:crypto` | Stage files, resolve paths, and name temporary outputs. |

The only runtime package dependency is the pinned `bun` runtime. `main.test.ts` uses Node's test,
assert, filesystem, process-spawn, OS-temp, and path modules.

## Dependents

| Module | Import path | Current use |
|---|---|---|
| `src/cli/index.ts` | `./main.ts` | Runs the executable entry. |
| `src/cli/main.test.ts` | `./main.ts` | Invokes command boundary with captured streams. |
| `src/cli/main.ts` | `./args.ts`, `./output.ts`, `./registry.ts` | Parse, execute, render. |
| `src/cli/args.ts` | `./registry.ts` | Looks up spec and options. |
| `src/cli/output.ts` | `./registry.ts` | Uses result type. |
| `src/cli/commands/help.ts` | `../registry.ts` | Renders registered specs. |
| `src/cli/commands/render.test.ts` | `./render.ts` | Verifies render outputs and failures. |
| `src/cli/commands/doctor.test.ts` | `./doctor.ts` | Verifies capability reporting and required mode. |
| `src/cli/commands/analyze.test.ts` | `./analyze.ts` | Verifies analysis command and artifact results. |
| `src/cli/commands/recipes.test.ts`, `new.test.ts`, `lint.test.ts`, `critique.test.ts` | Adjacent command files | Verify new command contracts. |
| `src/cli/commands/skill-path.test.ts` | `./skill-path.ts` | Verify argument validation and required skill file. |
| `src/cli/commands/sfx.ts` | `../../sfx/index.ts`, `../../audio-io/index.ts` | Standalone SFX generation and WAV writing. |
| `src/cli/commands/sfx.test.ts` | `./sfx.ts` | Verify per-preset determinism, sidecar order, exit codes and concurrent writers. |
| `skills/music2/SKILL.md` | `music2 skill path` output | Entry document in the returned skill directory. |

No other source feature currently imports `src/cli/index.ts`; it is the
process entry point. The source-bin test exercises it through `bin/music2.js`.

## Sync Checklist

- [ ] Update this document when command specs, flags, output, or errors change.
- [ ] Keep `src/cli/registry.ts` registrations and help output consistent.
- [ ] Update `src/cli/main.test.ts` for JSON shape, channel, or status changes.
- [ ] Check shared error/exit definitions before changing failure responses.
- [ ] Keep `src/cli/index.ts` and `bin/music2.js` entry behavior aligned.
- [ ] Keep `devlog/str_func/render.md` aligned with render options, data, and mastering.
- [ ] Keep `devlog/str_func/probe.md` aligned with doctor data and ffmpeg behavior.
- [ ] Update render and doctor command tests when flags or error mapping change.
- [ ] Update analyze command tests when input, artifact, or human text behavior changes.
- [ ] Keep `devlog/str_func/recipes.md` and `critic.md` aligned with their CLI commands.
- [ ] Update the four new command tests when flags, results, or exit policy change.
- [ ] Keep slice flags, kit/song bytes, one-bar section mapping and directory transaction checks aligned with `src/cli/commands/slice.test.ts`.
- [ ] Update `devlog/str_func/AGENTS.md` index when adding or moving this document.

### Experimental Ableton Live 12 export

`music2 export als <song.json> -o <dir> [--content midi|audio|both] [--bits 16|24] [--force] [--json]` writes a project directory with `<title>.als` and, for audio/both, copied `Samples/Imported/*.wav` files. It is experimental until opened in Ableton Live 12. Every success JSON envelope carries `data.experimental=true` and an `ALS_EXPERIMENTAL` warning; human output begins with `EXPERIMENTAL`.

MIDI keeps editable notes but has empty Live instruments and omits source audio/effects. Audio is frozen premaster playback; both keeps muted MIDI source tracks beside active frozen audio. The command renders once for audio/both, stages WAVs before the `.als`, verifies PCM headers, and uses the existing batch commit/rollback helpers. Invalid content/bits is `E_INPUT` (exit 2); occupied output is `E_ACCESS` (exit 4); missing or invalid stems are `E_RENDER` (exit 5). Master processing is not embedded in the set.

### DAWproject export

`music2 export dawproject <song.json> -o <file.dawproject> [--content midi|audio|both] [--force] [--json]` defaults to `both`. The command builds ProjectIR, confines referenced original WAVs to the song directory, renders dry stems and returns once for audio/both, prepares 24-bit WAV bytes, and stages one ZIP through the shared no-replace/force commit helpers. `--bits` and stem-only flags are unsupported. The success envelope has one absolute artifact and `DawData` with archive entry names, track count, content and quantization; warnings describe lossy mappings. XML is checked against the pinned DAWproject 1.0 schemas in hosted tests. XML validity is separate from a human DAW import, which remains unverified.

`render` and audio-producing `export stems|als|dawproject` accept `--allow-plugins` and a trusted `--plugin-host '<JSON argv>'` override. A plugin-bearing audio request without opt-in exits 3 before staging; `--plugin-host` without opt-in exits 2. The host argv can also come from `MUSIC2_PLUGIN_HOST` or user plugin config. MIDI/IR and MIDI-only DAW exports never run a plugin host and warn that frozen audio is needed to retain plugin sound. Successful plugin audio reports a nondeterminism warning. `doctor --json` includes `data.plugins` without probing; `doctor --plugins` probes the selected host. A malformed ordinary doctor plugin config appears as `plugins.error` without failing the ffmpeg report.

## Built-in sampled instruments and voice policy

`commands/instruments.ts` registers `music2 instruments [--json]`. It lists every synth voice with parameter schema and oscillator source, plus manifest-backed sampled instruments, roles, ranges and licenses.

## Local sample library

`commands/library.ts` exports `library: CommandSpec`, registered alongside `instruments`. It manually dispatches scan/find/import/verify/list, validates per-verb flags and positionals, resolves folder/root paths against cwd, and invokes library/sampler boundaries. Scan returns data.index plus the cache artifact; find returns data.candidates and scans defaults when no cache exists. Repeated --root replaces defaults; find with explicit roots refreshes the cache. Import returns its report directly in data; list returns sorted manifests in data.instruments. Human output is a compact table. Verification returns its report or raises E_QA with details.report when ok:false; bad input exits 2 and no roots exits 3.

`commands/instruments.ts` adds data.user summaries (id, instrument, kind, zones, role). `commands/doctor.ts` adds data.sampleLibrary {roots,available}. Export resolves every user ID through loadExportInstruments before MIDI/ALS/DAW planning, retaining ProjectIR's filesystem-free identity. `library.test.ts` checks flags, repeated roots, cache fallback, notes and exit-6 details; tests/e2e/library-flow.test.ts creates synthetic AIFF/WAV-with-smpl and drum files, imports both kinds and renders user instruments.

The checks job runs bun run audit:assets after privacy scan. scripts/asset-audit.mjs checks tracked tree, dry-run package files without lifecycle scripts, and optionally every commit against every parent in a base..head range. Every audio extension or first-12-byte magic match requires the exact path/SHA-256 allowlist entry, including merge-only audio later deleted. Asset tests use temporary Git repositories/packages.
