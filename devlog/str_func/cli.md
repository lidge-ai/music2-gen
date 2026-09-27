# CLI — Structure & Functions

Dispatch music2 commands and render one structured result or error per invocation.

## File Tree

```text
src/cli/
├── index.ts             # executable source entry point
├── args.ts              # command discovery and strict option parsing
├── main.ts              # invocation, command execution, output channel
├── main.test.ts         # JSON, status, help, version, source-bin checks
├── output.ts            # success and failure formatting
├── registry.ts          # command types, registry, registration
└── commands/
    ├── help.ts          # command list and topic usage
    ├── version.ts       # installed package version
    ├── schema.ts        # print or write song JSON Schema
    ├── validate.ts      # validate song and summarize timeline
    ├── events.ts        # list filtered timed song events
    ├── render.ts        # WAV, optional stems, encoding, and loudnorm
    ├── render.test.ts   # render command output and failure cases
    ├── analyze.ts       # WAV/song analysis and artifacts
    ├── analyze.test.ts  # analysis command and output cases
    ├── doctor.ts        # ffmpeg and encoder capability report
    └── doctor.test.ts   # doctor capability and required-mode cases
```

## Module Responsibility

`src/cli` owns the process-facing command boundary. It selects a command,
parses common and command-specific flags, invokes a registered handler, and
writes a human or JSON result. `main` accepts injectable streams and cwd for
testing. `output.ts` owns the success and failure envelopes; the shared module
owns error codes and their exit mapping. The registry supplies command metadata
used by both parsing and help text.

At this source snapshot the registry contains `help`, `version`, `schema`,
`validate`, `events`, `render`, `doctor`, and `analyze`.

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
| `render` | `export const render: CommandSpec` | WAV render with optional stems and encoded copies. |
| `doctor` | `export const doctor: CommandSpec` | ffmpeg capability inspection. |
| `analyze` | `export const analyze: CommandSpec` | WAV/song analysis and artifact generation. |

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
| `doctor` | `commands/doctor.ts` | No positional args; returns `DoctorData` for ffmpeg and required encoders. |
| `analyze` | `commands/analyze.ts` | One WAV or song JSON path; optional `--song` and `--out`; returns artifacts and summary. |

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

### Render, analyze, and doctor errors

| Code | Typical cause | Exit |
|---|---|---|
| `E_INPUT`, `E_SCHEMA`, `E_PARSE`, `E_NOT_FOUND` | Arguments, range, song, voice, or kit input is invalid. | 2 |
| `E_FFMPEG_MISSING`, `E_CAPABILITY` | ffmpeg or required encoder/mastering capability unavailable. | 3 |
| `E_ACCESS` | Song, kit, or output path cannot be accessed. | 4 |
| `E_RENDER` | PCM, effect, RIFF size, or peak-master failure. | 5 |
| `E_INTERNAL` | Unrecognized thrown error at the CLI boundary. | 1 |

All failures use the shared error envelope and exit mapping. Encoded-output
failures can also carry errors from `src/probe`; the CLI preserves their
typed code. JSON mode still emits exactly one object.

## Dependencies

| Dependency | Import path | Current use |
|---|---|---|
| Node argument parser | `node:util` | `parseArgs` in `args.ts`. |
| Shared errors | `../shared/index.ts` / `../../shared/index.ts` | Typed input/internal errors. |
| Shared package metadata | `../shared/index.ts` / `../../shared/index.ts` | Version data and JSON metadata. |
| Registry | `./registry.ts` / `../registry.ts` | Command lookup, specs, and help list. |
| Args parser | `./args.ts` | `main` parses and selects error mode. |
| Output formatter | `./output.ts` | `main` writes success and failure envelopes. |
| Command specs | `./commands/help.ts`, `./commands/version.ts`, `./commands/schema.ts`, `./commands/validate.ts`, `./commands/events.ts`, `./commands/render.ts`, `./commands/doctor.ts`, `./commands/analyze.ts` | Registry startup. |
| Analysis boundary | `../../analyze/analyze.tool.ts` | Analyze WAV/song input and write artifacts. |
| Song boundary | `../../song/index.ts` | Schema, loading, and timeline in command handlers. |
| Render boundary | `../../render/index.ts`, `../../render/render.schema.ts` | Render song PCM and type render response. |
| Audio I/O | `../../audio-io/index.ts` | Write master and stem WAV files. |
| Probe boundary | `../../probe/index.ts` | Discover ffmpeg, encode copies, loudnorm, and type doctor response. |
| Node filesystem/path/crypto | `node:fs/promises`, `node:path`, `node:crypto` | Stage files, resolve paths, and name temporary outputs. |

There are no runtime package dependencies. `main.test.ts` uses Node's test,
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
- [ ] Update `devlog/str_func/AGENTS.md` index when adding or moving this document.
