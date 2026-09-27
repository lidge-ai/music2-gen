# Critic — Structure & Functions

Pair a model's audible review of a bounded excerpt with local DSP measurements.

## File Tree

```text
src/critic/
├── index.ts          # public critique function and report type exports
├── critic.tool.ts    # excerpt preparation, Responses call, shape checks
└── critic.test.ts    # provider, capability, format, timeout, and report cases
```

## Module Responsibility

`src/critic` accepts a local WAV or song JSON path. For a song, it loads and
renders the song; for WAV, it reads PCM. It slices the first requested seconds,
analyzes that same PCM locally, writes a temporary audio excerpt, and sends the
audio to a Responses-compatible model. The returned report keeps the audible
review separate from the measured DSP result.

The critic asks for observations about timbre, groove, mix, arrangement, and
genre fit. Its prompt forbids measured BPM, key, LUFS, peak, and similar numbers
from model prose. Those numbers come from `analyzeAudio`. A model that declares
`heard_audio: false` cannot produce a successful critique.

This feature does not write lasting artifacts. The temporary excerpt directory
is removed in a `finally` block after either success or failure. The CLI owns
argument parsing, human formatting, and the one-object JSON envelope.

## Key Function Signatures

The public barrel re-exports the implementation's function and three types.

| Exported signature | Source | Purpose |
|---|---|---|
| `export async function critique(inputPath: string, options: CritiqueOptions = {}): Promise<CritiqueReport>` | `critic.tool.ts` | Build excerpt, analyze it, request and validate audible review. |
| `export interface CriticReview` | `critic.tool.ts` | Strict structured model review. |
| `export interface CritiqueOptions` | `critic.tool.ts` | Provider, excerpt, key, and timeout overrides. |
| `export interface CritiqueReport` | `critic.tool.ts` | Review, DSP, audio provenance, and model. |

### Public types

`CritiqueOptions` contains optional `model`, `baseUrl`, `excerpt`, `apiKey`,
and `timeoutMs`. The CLI exposes the first three; direct callers may supply
the API key and timeout. Environment variables can fill model, base URL, and
API key when their matching option is absent.

| `CriticReview` field | Type | Meaning |
|---|---|---|
| `heard_audio` | `boolean` | Model's explicit audio-access claim. |
| `overall` | `string` | General audible assessment. |
| `timbre` | `string[]` | Sound-color observations. |
| `groove` | `string[]` | Rhythmic feel observations. |
| `mix` | `string[]` | Audible balance observations. |
| `arrangement` | `string[]` | Structure observations. |
| `genre_fit` | `{ score: 1 \| 2 \| 3 \| 4 \| 5; notes: string }` | Genre judgment. |
| `top_fixes` | `string[]` | Suggested improvements. |

| `CritiqueReport` field | Type | Provenance |
|---|---|---|
| `review` | `CriticReview` | Responses model, validated by `reviewFrom`. |
| `dsp` | `AnalysisJson` | Local `analyzeAudio` of the sliced PCM. |
| `audio.format` | `"mp3" \| "wav"` | Format actually sent. |
| `audio.excerptSeconds` | `number` | Analyzed excerpt duration. |
| `audio.source` | `string` | Supplied input path. |
| `model` | `string` | Selected model ID. |

### Input and excerpt path

1. Accept only case-insensitive `.wav` and `.json` extensions.
2. Validate `excerpt` as finite seconds in `1..120`; default is 30.
3. Validate `timeoutMs` as finite in `1..Number.MAX_SAFE_INTEGER`;
   default is 120,000 ms.
4. Resolve the selected model, key, and base URL from option, environment,
   or implementation defaults, in that order.
5. Load and render a JSON song, or read the WAV PCM directly.
6. Keep at most `floor(excerpt × sampleRate)` frames from the start.
7. Reject an empty excerpt with `E_INPUT`.
8. Run `analyzeAudio` on that exact PCM slice before encoding the attachment.
9. Write a 16-bit temporary WAV with the song seed, or seed 1 for WAV input.
10. Use ffmpeg MP3 at 64 kbps when discovered with `libmp3lame`;
    otherwise attach the WAV.
11. Base64-encode the selected file as a `data:audio/...` URL in an
    `input_file` part, using `excerpt.mp3` or `excerpt.wav` as filename.
12. Remove the temporary directory after the provider result or any error.

The reported `audio.format` records the actual attachment. The prompt adds a
declared genre hint only for a song that has `genre` metadata. DSP analysis
always uses PCM before the optional MP3 encode step.

### Provider request and response

The target URL is the configured HTTP(S) base URL with `/v1/responses`
appended. The base URL may not contain credentials, a query, or a fragment.
The request sends one user message containing `input_text` and `input_file`.
It sends a bearer token and JSON content type.

The first request sets `stream: false`. If the provider returns HTTP 400 with
the documented `stream must be set to true` message, the critic retries with
`stream: true`. The stream parser joins `response.output_text.delta` events.
The non-stream parser joins `output_text` parts from the Responses `output`
array. Empty output, malformed JSON, or a malformed review shape is a
provider failure.

The review parser accepts raw JSON or a single fenced `json` block. It
requires every field listed above and an integer genre-fit score from 1 to 5.
An audio route that refuses the input modality, a failed Responses payload,
or `heard_audio: false` is a capability failure. The critic does not silently
substitute text-only feedback.

### Defaults and environment

| Setting | Source order | Default |
|---|---|---|
| Model | `options.model`, `MUSIC2_CRITIC_MODEL` | `google-antigravity/gemini-3.8-flash` |
| Base URL | `options.baseUrl`, `MUSIC2_CRITIC_BASE_URL` | `http://127.0.0.1:10100` |
| API key | `options.apiKey`, `MUSIC2_CRITIC_API_KEY` | `local` |
| Excerpt | `options.excerpt` | 30 seconds |
| Timeout | `options.timeoutMs` | 120,000 ms |

The default endpoint is local. The default key is the string `local` for that
endpoint. `model` and API key must be nonempty after selection.

### Error boundaries

| Code | Trigger | CLI exit |
|---|---|---|
| `E_INPUT` | Unsupported extension, invalid excerpt/timeout/base URL, missing model/key, or empty audio. | 2 |
| `E_CAPABILITY` | Unsupported audio modality, failed audio response, or model did not hear audio. | 3 |
| `E_PROVIDER` | Unreachable provider, HTTP failure, malformed response or review. | 4 |
| `E_TIMEOUT` | Aborted request at timeout. | 7 |

Song loading, rendering, WAV reading, encoding, and analysis may also surface
their own typed errors. The CLI maps those through the shared error table.
Provider HTTP 5xx and connection failures are marked retryable; malformed
responses are not. The provider error excerpt redacts audio data URLs and
the configured API key before including at most 500 characters in an error.

## Dependencies

| Dependency | Import path | Current use |
|---|---|---|
| Song boundary | `../song/index.ts` | Load song JSON before rendering. |
| Render boundary | `../render/index.ts` | Render a song to PCM. |
| Audio I/O | `../audio-io/index.ts` | Read input WAV and write temporary WAV. |
| Analyze boundary | `../analyze/index.ts` | Compute local `AnalysisJson`. |
| Probe boundary | `../probe/index.ts` | Detect ffmpeg and encode optional MP3. |
| Shared errors | `../shared/index.ts` | Typed input, provider, capability, timeout errors. |
| Node filesystem, OS, path | `node:fs/promises`, `node:os`, `node:path` | Temporary excerpt lifecycle. |
| Global Fetch API | `fetch`, `AbortController` | Responses request and timeout. |

There are no runtime package dependencies. Tests use Node's test runner and
local response fixtures or controlled provider behavior.

## Dependents

| Module | Import path | Current use |
|---|---|---|
| `src/cli/commands/critique.ts` | `../../critic/index.ts` | Resolve input and display review plus DSP. |
| `src/critic/critic.test.ts` | `./critic.tool.ts` | Verify provider and report behavior. |

The CLI's human output presents model prose and then the DSP summary. JSON
mode returns the complete report through the shared success envelope. The
review model never supplies the values in the `dsp` field.

## Sync Checklist

- [ ] Keep this type table aligned with `CriticReview` and `CritiqueReport`.
- [ ] Recheck provider payload and stream handling when the route changes.
- [ ] Verify the local DSP and model prose remain separate in the report.
- [ ] Update defaults, environment names, and bounds if source changes.
- [ ] Check error mapping and retryability after provider changes.
- [ ] Keep `devlog/str_func/cli.md` aligned with critique flags and exits.
- [ ] Update `devlog/str_func/AGENTS.md` index when adding or moving this document.
