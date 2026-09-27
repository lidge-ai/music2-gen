# 002 — Audio critic probe through opencodex

**Answer first.** Of the 39 models the local opencodex proxy exposes, exactly one route can hear audio today:
`google-antigravity/gemini-3.8-flash` through the **Responses API** with an `input_file` content part carrying a
`data:audio/mpeg;base64,...` (or `audio/wav`) URL. It heard a 6-second clip of the PoC drill loop and answered in
the requested JSON. Its numbers are not trustworthy (BPM 145 from mp3, 124 from wav, true value 140; genre
"Balinese gamelan" then "calypso"), but its **timbre judgement was consistent** across both runs: the FM bell lead
sounds like a metallophone/steelpan, which is a fair criticism for a drill lead. So music2 treats an audio model as
an advisory critic of sound and feel, and takes every number (LUFS, BPM, key, balance) from its own DSP.

Every other route rejects audio explicitly instead of silently dropping it, which lets music2 report a clean
capability error.

## Method

Date 2026-09-28, local proxy `ocx` on `http://127.0.0.1:10100` (defaultProvider xai). Inputs: 6 s mono 16 kHz
excerpt of the PoC render (evidence/poc-render.mjs, 140 BPM, C minor) as mp3 64 kbps and wav; control: 6 s 1 kHz
click track at 90 BPM (mp3). Prompt asked for `{"heard_audio", "bpm_estimate", "instruments", "genre_guess"}` and to
answer `heard_audio:false` when audio is not accessible. Script: evidence/probe-audio.mjs
(`node probe-audio.mjs <model> chat|responses|file <mp3|wav>`, `CLIP=<path>` overrides the input).

## Results

| Model route | Wire | Result |
|---|---|---|
| google-antigravity/gemini-3.8-flash | chat.completions `input_audio` | 400 `OpenCodex cannot translate audio input on this route` |
| cursor/gemini-3.8-flash | chat.completions `input_audio` | 400, same message |
| gpt-6-sol | chat.completions `input_audio` | 400, same message |
| google-antigravity/gemini-3.8-flash | responses `input_audio` part | 400 responses schema parse error (part type not accepted) |
| google-antigravity/gemini-3.8-flash | responses `input_file` mp3 | **200**, heard_audio true, bpm 145, "metallophone, kettle gongs, gong, cymbals, drum", genre Balinese gamelan, 8.6 s |
| google-antigravity/gemini-3.8-flash | responses `input_file` wav | **200**, heard_audio true, bpm 124, "steelpan, shaker, percussion, drum kit", genre calypso, 6.5 s |
| google-antigravity/gemini-3.8-flash | responses `input_file` mp3, 90 BPM click control | 200, heard_audio **false** |
| cursor/gemini-3.8-flash | responses `input_file` mp3 | response status failed, `unsupported_input_modality` ("document input") |
| gpt-6-sol | responses `input_file` mp3, non-stream | 400 `Stream must be set to true` (not an audio verdict) |

`GET /v1/models` lists no model with an audio input modality (34 × `text+image`, 5 unspecified), so the catalogue
cannot be used to discover audio capability; music2 must probe or be told.

## Consequences for the design

- **Transport.** `music2 critique` posts to `<base>/v1/responses` with `input_text` + `input_file`
  (`file_data: data:audio/mpeg;base64,...`, filename with extension). Base URL and model are flags/env
  (`MUSIC2_CRITIC_BASE_URL`, `MUSIC2_CRITIC_MODEL`); default model `google-antigravity/gemini-3.8-flash`,
  default base `http://127.0.0.1:10100`. Non-stream first; on a `Stream must be set to true` style 400, retry with
  `stream:true` and assemble `response.output_text.delta` events.
- **Encoding.** Send mp3 (smaller; the only format tested on both runs) when ffmpeg exists, else wav. Clip to a
  bounded excerpt (default 30 s, flag) to keep payloads small.
- **Error contract.** Map 400 messages containing `cannot translate audio`/`unsupported_input_modality` and
  response `status:"failed"` to exit code for "capability unavailable" with the route in the message; network
  failure to "provider unreachable". Never fabricate a critique.
- **Trust.** Critic JSON is advisory: prompt for timbre, groove, mix and genre-fit comments plus a
  `heard_audio` flag; music2 discards the critic's numeric BPM/key and prints DSP values next to it. A
  `heard_audio:false` answer is surfaced as a failed critique, not an empty pass.
- **Text+image-only models.** Because most agent models (all sol/luna/grok routes here) cannot hear, the primary
  feedback channel is `music2 analyze`: metrics JSON + spectrogram PNG + piano-roll PNG. The PoC spectrogram
  (evidence/poc-spectrogram.png) already shows 808 glides, hat rolls and the bell partials clearly enough for a
  vision model to reason about arrangement density and frequency balance.

## Limits of this evidence

n = 2 audio runs plus 1 control; one clip; one provider route. The consistency of timbre judgements is a
hypothesis worth re-checking in wp5 (the critic tests will re-run the probe with at least 3 clips).

