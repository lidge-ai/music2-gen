# Probe — Structure & Functions

Discover ffmpeg capabilities and run explicit audio encoding or two-pass loudness normalization.

## File Tree

```text
src/probe/
├── index.ts           # public discovery, processing, and type exports
├── ffmpeg.schema.ts   # ffmpeg, doctor, encode, and loudnorm types
├── ffmpeg.tool.ts     # executable lookup and capability probes
├── ffmpeg.test.ts     # PATH, override, encoder, and failure cases
├── master.tool.ts     # encode and two-pass loudnorm subprocesses
└── master.test.ts     # argument, encoder, measurement, and process cases
```

## Module Responsibility

`src/probe` locates an executable ffmpeg, reads its version and encoder list,
and runs optional mastering or delivery conversions. Discovery produces
`FfmpegInfo` or `null`; `DoctorData` is the typed payload assembled by the CLI
doctor command from discovery and environment policy. The module does not
construct PCM buffers, decode WAV files, or perform in-process DSP.

The processing helpers receive an already discovered `FfmpegInfo`. They use
argument arrays with `shell: false`, so a path containing spaces is passed as
one argument. Encoding chooses the available codec for MP3 or Ogg. Loudness
normalization measures a WAV in one ffmpeg pass and applies those measurements
in a second pass, writing a WAV output.

## Key Function Signatures

These are the exact exported function signatures in `src/probe/*.tool.ts`.
`src/probe/index.ts` re-exports all three functions and the four public types
from `ffmpeg.schema.ts`.

`ffmpeg.tool.ts` exports the discovery function:

```ts
export async function discoverFfmpeg(env: NodeJS.ProcessEnv = process.env): Promise<FfmpegInfo | null> {
```

The two processing signatures span multiple lines in the source:

```ts
export async function encodeAudio(
  wavPath: string, outputPath: string, ffmpeg: FfmpegInfo, options: EncodeOptions,
): Promise<void> {
```

`encodeAudio` is defined in `master.tool.ts` and converts the input WAV to
the requested MP3 or Ogg file.

```ts
export async function loudnormWav(
  wavPath: string, outputPath: string, ffmpeg: FfmpegInfo, options: LoudnormOptions,
): Promise<void> {
```

`loudnormWav` is defined in `master.tool.ts` and writes a normalized WAV.

### Public data types

| Export | Exact declaration | Meaning |
|---|---|---|
| `FfmpegInfo` | `export interface FfmpegInfo` | Executable `path`, `version`, and two encoder flags. |
| `DoctorData` | `export interface DoctorData { ffmpeg: FfmpegInfo \| null; required: boolean; ready: boolean }` | CLI doctor result data. |
| `EncodeOptions` | `export interface EncodeOptions { format: "mp3" \| "ogg"; bitrateKbps?: number }` | Output format and optional MP3 bitrate. |
| `LoudnormOptions` | `export interface LoudnormOptions { targetLufs: number; ceilingDb: number }` | Integrated loudness and true-peak targets. |

`FfmpegInfo.encoders` has exact boolean keys `libmp3lame` and `libvorbis`.
The path is the executable that discovery checked; processing uses that path.

### Discovery behavior

- If `MUSIC2_FFMPEG` is present in the supplied environment, discovery checks
  that path only; an invalid override returns `null` without PATH fallback.
- Otherwise it searches nonempty PATH entries in order for `ffmpeg` or, on
  Windows, `ffmpeg.exe`, checking executable access before probing.
- A missing executable returns `null`.
- The executable is called separately with `-version` and `-encoders`.
- Each probe has a five-second timeout, a 1 MiB output limit, UTF-8 decoding,
  and `shell: false`.
- The first version line must begin `ffmpeg version ` followed by a token.
- Encoder parsing reads exact names from six-character capability rows.
- `libmp3lame_extra` does not count as `libmp3lame`; the same rule applies to
  `libvorbis`.
- Probe execution failures, timeout, and malformed version raise
  `E_CAPABILITY`; failure details include the executable path and probe arg
  when a subprocess fails.

### Encoding behavior

- `encodeAudio` selects `libmp3lame` for `mp3` and `libvorbis` for `ogg`.
- If the selected `FfmpegInfo.encoders` flag is false, it raises
  `E_CAPABILITY` before starting ffmpeg.
- MP3 uses `-b:a` with `bitrateKbps` or a default of 192 kbps.
- Ogg uses Vorbis quality 5 through `-q:a 5`.
- The command overwrites the output, strips metadata, specifies the encoder,
  and sets the explicit output format.
- `run` captures stderr with an 8 MiB subprocess output limit.
- A nonzero process or execution failure raises `E_RENDER` with at most the
  final 2000 stderr characters in error details.

### Loudnorm behavior

- `loudnormWav` rejects nonfinite `targetLufs` or `ceilingDb` with `E_INPUT`.
- The first ffmpeg pass runs `loudnorm` with `I`, `TP`, `LRA=11`, and
  `print_format=json`, directing audio output to the null muxer.
- It parses the last flat JSON object found in stderr for measurements.
- Required fields are `input_i`, `input_tp`, `input_lra`, `input_thresh`,
  and `target_offset`; each must convert to a finite number.
- Missing or invalid measurements raise `E_RENDER`.
- The second pass supplies those measured values, `linear=true`, the original
  targets, and `print_format=json` to `loudnorm`.
- It strips metadata and requests WAV output.
- Both passes use the same argument-array subprocess helper; process failures
  become `E_RENDER` with bounded stderr detail.

## Dependencies

| Dependency | Import path | Used by |
|---|---|---|
| Shared error | `../shared/index.ts` | Capability, input, and render failures. |
| Node process API | `node:child_process`, `node:util` | Run ffmpeg without a shell. |
| Node file/path APIs | `node:fs`, `node:fs/promises`, `node:path` | Check executable access and search PATH. |
| Probe schema | `./ffmpeg.schema.ts` | Discovery and processing types. |

There are no runtime package dependencies. ffmpeg is an optional external
executable; tests use fake executables and the Node test runner.

## Dependents

| Module | Import path | Current use |
|---|---|---|
| `src/cli/commands/doctor.ts` | `../../probe/index.ts` | Discover ffmpeg and type doctor data. |
| `src/probe/ffmpeg.test.ts` | `./ffmpeg.tool.ts` | Verify discovery and failure handling. |
| `src/probe/master.test.ts` | `./master.tool.ts`, `./ffmpeg.schema.ts` | Verify processing arguments and errors. |

At this source snapshot, doctor is the only external consumer of the probe
barrel. `encodeAudio` and `loudnormWav` are exported for later render or CLI
integration but have no external source imports yet.

## Sync Checklist

- [ ] Update this document for ffmpeg lookup, codecs, loudnorm, or error changes.
- [ ] Keep `src/probe/index.ts` aligned with implementation and schema exports.
- [ ] Update `devlog/str_func/AGENTS.md` index when adding this document.
- [ ] Update `ffmpeg.test.ts` for override, PATH, and parser changes.
- [ ] Update `master.test.ts` for process args, measurements, and error cases.
- [ ] Check `src/cli/commands/doctor.ts` when changing `FfmpegInfo` or
  `DoctorData`.
- [ ] Compare `devlog/_plan/260928_music2_roadmap/020_render_engine.md` when
  the implementation or documented contract changes.
