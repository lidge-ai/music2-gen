# Audio I/O — Structure & Functions

Create and validate stereo PCM buffers, estimate peaks, resample channels, and read or write RIFF/WAVE files.

## File Tree

```text
src/audio-io/
├── index.ts           # public buffer, WAV, and type exports
├── buffer.schema.ts   # stereo PCM and WAV metadata types
├── buffer.tool.ts     # validation, peaks, buffer allocation, resampling
├── buffer.test.ts     # sample-rate, shape, peak, and resampling cases
├── wav.tool.ts        # RIFF/WAVE reader and PCM writer
└── wav.test.ts        # format, dither, malformed-file, and empty-data cases
```

## Module Responsibility

`src/audio-io` owns the reusable in-memory PCM representation and WAV file
boundary. `StereoBuffer` always has separate left and right `Float32Array`
channels. `sourceChannels` records whether the source file was mono or stereo;
mono samples are duplicated into both arrays on read. Buffer helpers validate
sample rate, shape, and finite sample values before measuring or writing audio.

The WAV reader accepts supported RIFF/WAVE PCM and floating-point data and
returns the common buffer shape. The writer emits stereo integer PCM and
returns metadata describing the output. Its seeded 16-bit dither and the peak
estimators are deterministic. This folder does not interpret song notation,
mix tracks, or invoke ffmpeg.

## Key Function Signatures

These are the exact exported signatures in `src/audio-io/*.tool.ts`.
`src/audio-io/index.ts` re-exports the seven public functions listed first and
the three types from `buffer.schema.ts`. The two validators are exported from
`buffer.tool.ts` for local use but are not re-exported by the barrel.

| Exported signature | Source | Purpose |
|---|---|---|
| `export function createStereo(sampleRate: number, frames: number): StereoBuffer` | `buffer.tool.ts` | Allocate zeroed stereo channels. |
| `export function peakLinear(audio: StereoBuffer): number` | `buffer.tool.ts` | Measure the largest absolute stored sample. |
| `export function truePeakLinear(audio: StereoBuffer): number` | `buffer.tool.ts` | Estimate both channels' intersample peak. |
| `export function truePeakLinearOf(channel: Float32Array, rate: number): number` | `buffer.tool.ts` | Estimate one channel's intersample peak. |
| `export function resampleLinear(input: Float32Array, fromRate: number, toRate: number): Float32Array` | `buffer.tool.ts` | Linearly resample one channel. |
| `export async function readWav(path: string): Promise<StereoBuffer>` | `wav.tool.ts` | Decode a supported WAV file. |
| `export async function writeWav(path: string, audio: StereoBuffer, options: WavWriteOptions): Promise<WavInfo>` | `wav.tool.ts` | Write stereo PCM WAV. |
| `export function validateStereo(audio: StereoBuffer): void` | `buffer.tool.ts` | Validate channel shape and finite samples. |

The remaining exported validator signature in `buffer.tool.ts` is:

```ts
export function validateSampleRate(sampleRate: number, code: "E_INPUT" | "E_RENDER" = "E_RENDER"): void {
```

### Public data types

| Export | Exact declaration | Meaning |
|---|---|---|
| `StereoBuffer` | `export interface StereoBuffer` | `sampleRate: number`, `left/right: Float32Array`, `sourceChannels: 1 \| 2`. |
| `WavInfo` | `export interface WavInfo` | Rate, channel count, frames, bit depth, and format. |
| `WavWriteOptions` | `export interface WavWriteOptions { bits: 16 \| 24; seed: number }` | Output depth and uint32 dither seed. |

`WavInfo.channels` is `1 | 2`, `bitsPerSample` is `16 | 24 | 32`, and
`format` is `"pcm" | "float"`. The current writer returns stereo `"pcm"`
metadata with `bitsPerSample` equal to the requested 16 or 24 bits.

### Buffer behavior

- `validateSampleRate` accepts integer rates from 8000 through 192000 Hz.
- It defaults to `E_RENDER`; callers may request `E_INPUT` for an input boundary.
- `validateStereo` checks the rate, both `Float32Array` channels, matching
  lengths, `sourceChannels` in `1 | 2`, and every sample's finiteness.
- `createStereo` requires a nonnegative safe-integer frame count and sets
  `sourceChannels` to 2; allocation and validation failures use `E_RENDER`.
- `peakLinear` measures the maximum absolute sample in both channels.
- `truePeakLinear` validates the buffer and takes the larger channel estimate.
- `truePeakLinearOf` includes stored sample peaks and estimates intersample
  peaks with an 8x, 32-tap Hann-windowed sinc filter.
- Short or silent channels return their sample peak without interpolation.
- Filter coefficients are cached by sample rate within the process.
- `resampleLinear` validates both rates and all input samples.
- Its output length is `round(input.length * toRate / fromRate)`; each output
  position uses source coordinates and clamps the final source index.
- Empty input produces an empty channel; invalid or oversized output fails
  with `E_RENDER`.

### WAV read behavior

- `readWav` reads the file into memory and checks the RIFF/WAVE header.
- File-access failures use `E_ACCESS` and include the file in error details.
- It scans chunk headers, validates lengths and odd-size pad bytes, and skips
  unknown chunks. The first `fmt ` and first `data` chunks are used.
- It rejects RF64, missing chunks, truncated payloads, bad alignment, and
  partial sample frames as `E_INPUT` with file and chunk details.
- Accepted `fmt ` tags are 1 (integer PCM) and 3 (IEEE float).
- Integer PCM may be 16, 24, or 32 bits; float must be 32 bits.
- Only mono and stereo at 8000..192000 Hz are accepted.
- It checks byte rate and block alignment against rate, channels, and depth.
- Integer samples are normalized to floating-point `[-1, 1)` values.
- Float samples must be finite; nonfinite data is an `E_INPUT` error.
- Mono is copied to both output arrays while `sourceChannels` remains 1.
- An empty data chunk returns zero-length left and right arrays.

### WAV write behavior

- `writeWav` validates the whole buffer, requested bit depth, and seed.
- Only 16-bit or 24-bit stereo PCM is emitted with a 44-byte RIFF header.
- The seed must be a safe integer from 0 through `0xffffffff`.
- It checks the 4 GiB RIFF size limit before opening the output file.
- 16-bit quantization adds seeded TPDF dither from `mulberry32(seed)` before
  rounding and saturation. The same input and seed produce identical bytes.
- 24-bit quantization rounds and saturates without dither.
- Audio is written in blocks of 16384 frames, avoiding one full output buffer.
- The writer returns `WavInfo` after closing the file.
- Open and write failures become `E_ACCESS` with file detail; validation and
  RIFF-limit failures use `E_RENDER`.

## Dependencies

| Dependency | Import path | Used by |
|---|---|---|
| Shared error | `../shared/index.ts` | Buffer validation and WAV error reporting. |
| Shared seeded generator | `../shared/index.ts` | Deterministic 16-bit WAV dither. |
| Node file APIs | `node:fs/promises` | Read, open, and stream file writes. |
| Buffer schema | `./buffer.schema.ts` | Types shared by buffer and WAV helpers. |
| Buffer validators | `./buffer.tool.ts` | WAV writer's input checks. |

There are no runtime package dependencies. Tests use the Node test runner
and temporary files from Node's standard library.

## Dependents

| Module | Import path | Current use |
|---|---|---|
| `src/render/kit.tool.ts` | `../audio-io/index.ts` | Load WAV samples and resample channels. |
| `src/render/fx.tool.ts` | `../audio-io/index.ts` | Create and type stereo buffers. |
| `src/render/render.schema.ts` | `../audio-io/index.ts` | Refer to `StereoBuffer` in render types. |
| `src/render/kit.test.ts` | `../audio-io/index.ts` | Build WAV fixtures for kit tests. |
| `src/render/fx.test.ts` | `../audio-io/index.ts` | Build buffers for effect tests. |
| `src/audio-io/buffer.test.ts` | `./buffer.tool.ts` | Verify buffer, resampling, and peak behavior. |
| `src/audio-io/wav.test.ts` | `./wav.tool.ts`, `./buffer.tool.ts` | Verify WAV decoding and encoding. |

At this source snapshot, render is the only other feature folder importing
`src/audio-io/index.ts`. Planned analyze and critic consumers are not yet
implemented; check the real imports when adding them.

## Sync Checklist

- [ ] Update this document when buffer types, format support, or exports change.
- [ ] Keep `src/audio-io/index.ts` aligned with intended public functions.
- [ ] Update `devlog/str_func/AGENTS.md` index when adding this document.
- [ ] Update `buffer.test.ts` for rates, shape, peaks, and resampling changes.
- [ ] Update `wav.test.ts` for chunk parsing, dither, and error changes.
- [ ] Check render imports before changing `StereoBuffer` or WAV behavior.
- [ ] Compare `devlog/_plan/260928_music2_roadmap/020_render_engine.md` when
  the implementation or documented contract changes.
