# 003 — Architecture decisions

**Summary.** music2 is one TypeScript package with eight feature folders. A song is a JSON file; each track holds
mini-notation strings. `pattern` turns strings into timed events with exact rational time, `song` validates the file
and lays sections end to end into one bar timeline, `render` turns events into stereo PCM with deterministic synth
voices, `analyze` measures the result and draws two PNGs, `recipes` holds genre knowledge and lint rules, `critic`
asks an audio-capable model for advisory feedback, and `cli` exposes all of it with a single-JSON-object contract.
Decisions below are the architect's D1–D13 (evidence/architect-proposal.md) with main's dispositions.

## Architect consultation record

- Architect: sol subagent `01a0e37e-3635-72b2-a410-a984adb4532a`, proposal D1–D13 received 2026-09-28
  (verbatim in evidence/architect-proposal.md).
- Reflection: requested after 000/010–050 were written; result recorded in 000_plan.md.

| ID | Proposal (short) | Disposition |
|---|---|---|
| D1 | Folders song, pattern, render, analyze, recipes, critic, cli, shared; `name.tool.ts` + `name.test.ts` + `index.ts` boundary | **Accept, amend:** add `src/probe/` (ffmpeg discovery, doctor data) as in vid2-gen, and `src/audio-io/` (WAV read/write, PCM buffers) because render, analyze and critic all need it and none should import another's internals. Lidge Standard suffixes apply: logic files `*.tool.ts`, schema files `*.schema.ts`, colocated `*.test.ts` |
| D2 | Song v1: version, bpm, meter, key, seed, tracks, sections, arrangement, optional bars check | **Accept, amended after reflection:** the optional top-level `bars` check is withdrawn (length is derived from the arrangement and reported by `music2 validate`). One cycle = one bar. `meter.denominator` fixed to 4 in v1, numerator 2–12. Note length: `gate` per track (0–1 of the slot, default 0.9; mono 808 ignores gate and sustains until the next onset or `release`) |
| D3 | v0.1 syntax: sequence, [], <>, ~, comma, integer *, /, !; defer @, ?, |, euclid | **Amend:** also implement `@n`, euclid `(k,n,r)`, seeded `?p` and `|` (see 004 dispositions; drill/trap percussion uses them). Polymeter deferred |
| D4 | Immutable AST, rational time, `queryArc` returning whole/part/value, onset filter in scheduler | **Accept.** Limits: depth ≤ 32, denominators ≤ 2^20 (reduced fractions), ≤ 20 000 events per track per song |
| D5 | Voice render → track fx/gain/pan → dry + reverb/delay sends → sidechain duck → master → WAV; mono 808 glide; kit manifest for local WAVs | **Accept, amended after reflection:** per-track insert `fx` is withdrawn from v1 (tracks carry gain, pan, sends, duck and voice `params`; inserts are deferred). v0.1 ships synth voices only; sample playback reads user kits (`kit.json` + PCM WAV). Bundled CC0 samples are out of v0.1 (license review cost; see 001). Tail: `song.tailSeconds` default 2 |
| D6 | Deterministic ordering and per-track seeded PRNG; no Date/Math.random; chunked 16/24-bit WAV | **Accept.** Byte identity is promised for the same Node major and platform; tests assert two runs are identical, not a golden hash across platforms. PRNG: mulberry32 seeded by FNV-1a(song.seed, track.id, event index) |
| D7 | ffmpeg optional, only for --loudnorm/--mp3/--ogg; absence = E_CAPABILITY | **Accept**, using vid2's `E_FFMPEG_MISSING` (exit 3). Mastering loudness uses music2's own LUFS measurement + a static gain + true-peak limiter first; ffmpeg loudnorm is an optional second path |
| D8 | analyze: peak, clipping, bands, BS.1770 LUFS, true peak, flux-onset + autocorrelation tempo, chroma key; beats.json with bpm/meter/offsetFrames for vid2 | **Accept.** `estimatedBpm` is independent (no hint) and the drill example must land within ±2 of 140; `declaredBpm` is reported beside it when a song is given. Tempo octave resolution: prior window 70–180 BPM and an explicit half/double candidate list |
| D9 | spectrogram.png (log-frequency STFT) + pianoroll.png (from song events); no fake transcription from WAV | **Accept.** Own PNG encoder in `src/analyze/png.tool.ts` (clean implementation of the PNG spec; vid2-gen is the same author and MIT, but no code is copied to keep the packages independent) |
| D10 | critique via Responses `input_text` + `input_file` data URL; verify heard_audio; E_CAPABILITY / E_PROVIDER | **Accept** (matches 002). Stream fallback on the `Stream must be set to true` 400 |
| D11 | Commands render, analyze, new, lint, recipes, critique, doctor, schema; `--json` single object; exit 0–7 as vid2 | **Accept**, plus `version` and `help`. Error class `Music2Error` mirrors `Vid2Error` (vid2-gen src/shared/errors.ts:3) |
| D12 | Recipe cards as data; lint results `{id,severity,location,observed,expected,fix}`; new copies starterSong | **Accept.** Cards are typed TS modules under `src/recipes/cards/` (type-checked, no JSON import at runtime) |
| D13 | Build order wp2 foundations → wp3 render → wp4 analyze → wp5 recipes/lint/critic → wp6 docs/dogfood/CI | **Accept.** CI: ubuntu/macos/windows × Node 22/24; ffmpeg installed on ubuntu only, ffmpeg tests skip elsewhere with a printed SKIP unless `MUSIC2_REQUIRE_FFMPEG=1` |

Open assumptions resolved by main: meter denominator 4 only (D2); gate per track (D2); sample kits are
user-supplied PCM WAV 16/24-bit or float32, any sample rate, resampled linearly (D5); LUFS tolerance ±0.1 LU and
true peak ±0.2 dB against the BS.1770 reference vectors in 005 (D8); BPM ±2 is judged on the independent estimate (D8).

## Module map

```
src/
  shared/     errors.tool.ts (Music2Error, EXIT), rational.tool.ts (Fraction), prng.tool.ts, json.tool.ts, paths.tool.ts
  pattern/    parse.tool.ts (mini-notation → AST), query.tool.ts (AST → events), values.tool.ts (note names, sample refs)
  song/       song.schema.ts (types + validator), arrange.tool.ts (sections → bar timeline), timeline.tool.ts (events in seconds)
  audio-io/   wav.tool.ts (read/write), buffer.tool.ts (stereo float buffers, mixing helpers)
  render/     voices/*.tool.ts, kit.tool.ts, fx.tool.ts (reverb, delay, filters, duck), mixer.tool.ts, render.tool.ts
  probe/      ffmpeg.tool.ts (discovery, version, encoders), master.tool.ts (loudnorm, encode)
  analyze/    fft.tool.ts, loudness.tool.ts, tempo.tool.ts, key.tool.ts, bands.tool.ts, png.tool.ts,
              spectrogram.tool.ts, pianoroll.tool.ts, beats.tool.ts, analyze.tool.ts
  recipes/    cards/*.ts, recipes.tool.ts, lint.tool.ts, new.tool.ts
  critic/     critic.tool.ts (transport, prompt, response parsing)
  cli/        main.ts, args.ts, output.ts, registry.ts, commands/*.ts
  index.ts    public library boundary
```

Dependency direction: cli → (render, analyze, recipes, critic, probe) → (song, audio-io) → pattern → shared.
critic and probe never import render internals; analyze imports song only for piano rolls.
