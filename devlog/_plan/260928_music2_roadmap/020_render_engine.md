# 020 — wp3 Offline render engine

wp3 turns the wp2 `Timeline` into deterministic stereo PCM, WAV files, optional stems, and ffmpeg encoded copies. It ships eight built-in synth voices and user-owned WAV kits, with track effects, sidechain ducking, and a true-peak-checked master. The 16-bar drill fixture is the audible integration target; wp4 adds shared LUFS measurement and targeting without making render depend on analyze.

Depends on: 003 D1/D5-D7/D13, 010 Song/ResolvedSong/Track/TimedEvent/Timeline and CLI contract, 004 note/sample syntax, 005 true-peak guidance, 006 `drill_uk` palette; `/tmp/music2-poc/render.mjs` is a sound sketch, not source to copy.
Consumed by: 030 analyze and LUFS integration, 040 critic's WAV input, 050 examples/docs/CI/dogfood. No runtime packages or AGPL code; the sibling vid2-gen is a convention reference only.

## Scope and boundary decision

IN: PCM buffers; WAV read/write and linear resampling; voices, kits, effects, mix/master; optional ffmpeg discovery, MP3/Ogg and two-pass loudnorm; `render`/`doctor`; fixture and focused tests. OUT: bundled sample packs, streaming playback, arbitrary plugins, AI critic, DSP analysis and LUFS calculation.

`src/audio-io` owns reusable PCM and, in wp4, `loudness.tool.ts`; render/probe/analyze import it, and audio-io imports only shared. Rejected: wp3 importing `src/analyze/loudness.tool.ts`, which would make wp4's analyzer and renderer depend on each other's feature boundary. In wp3, `master.targetLufs` remains schema-valid; `RenderOptions.mastering` selects the path: `"peak"` (default) returns E_CAPABILITY (exit 3) when `targetLufs` is set, `"loudnorm"` (set by the CLI when `--loudnorm` is given) skips that check, renders with peak targeting and leaves loudness to ffmpeg two-pass loudnorm afterwards. wp4 adds `"lufs"` as the default when `targetLufs` is set. In 030, add `src/audio-io/loudness.tool.ts`, have analyze consume it, and MODIFY `src/render/mixer.tool.ts` to use measured LUFS for static gain before the same limiter; no cycle. `--loudnorm` is an explicit ffmpeg alternative in wp3, with `targetLufs` or -14 LUFS as its target.

The public dependency graph is `cli -> render/probe -> audio-io/song -> pattern/shared`; probe imports audio-io for WAV metadata only and never render internals. `src/index.ts` exports user-facing render/audio-io/probe functions; each feature `index.ts` is its public barrel, not an internal import shortcut. All errors use 010's `Music2Error` and EXIT mapping.

## New types and constants

```ts
// src/audio-io/buffer.schema.ts
export interface StereoBuffer { sampleRate: number; left: Float32Array; right: Float32Array; sourceChannels: 1 | 2 }   // readWav sets 1 for mono files (right is a copy of left); createStereo and render set 2
export interface WavInfo { sampleRate: number; channels: 1 | 2; frames: number; bitsPerSample: 16 | 24 | 32; format: "pcm" | "float" }
export interface WavWriteOptions { bits: 16 | 24; seed: number }
```

```ts
// src/render/render.schema.ts
export interface RenderOptions { bars?: { start: number; end: number }; stems?: boolean; mastering?: "peak" | "loudnorm" }   // wp4 widens to "peak" | "loudnorm" | "lufs"
export interface RenderStem { trackId: string; audio: StereoBuffer }
export interface RenderResult { audio: StereoBuffer; stems: RenderStem[]; bars: number; durationSeconds: number; peakDbfs: number; truePeakDbtp: number; ceilingDb: number; events: number }
export interface VoiceEvent { midi: number | null; sample: { name: string; index: number } | null; velocity: number; startFrame: number; gateFrames: number; stopFrame: number; eventIndex: number; seed: number }
export interface VoiceContext { sampleRate: number; frames: number; track: ResolvedTrack; events: VoiceEvent[] }
export interface ParamSpec { default: number; min: number; max: number; integer?: boolean }
export interface VoiceSpec { id: string; kind: "drums" | "notes"; monoDefault: boolean; params: Readonly<Record<string, ParamSpec>>; render(ctx: VoiceContext, params: Readonly<Record<string, number>>): Float32Array }
export interface KitManifest { version: 1; samples: Record<string, string[]>; gainDb?: number; rootMidi?: number }
export interface LoadedKit { manifest: KitManifest; samples: Readonly<Record<string, Float32Array[]>>; sampleRate: number }
```

`Track`, `ResolvedTrack`, `TimedEvent`, `Song`, `ResolvedSong`, `Timeline`, and `Music2Error` are imported from 010; do not redeclare or widen them. `VoiceSpec.render` returns mono samples for a single track; the mixer owns stereo pan. `VoiceEvent.stopFrame` is exclusive. `KitManifest.samples` keys are drum names; paths are relative to kit.json and nonempty arrays. `rootMidi` defaults 60 and is only used if a kit is selected by a note track; a drum kit ignores pitch.

```ts
// src/render/voices/*.tool.ts params; all values are finite numbers, units in names
export interface DrumsParams { tone: number; decayMs: number; noise: number }
export interface EightOhEightParams { drive: number; decayMs: number; attackMs: number }
export interface BassParams { wave: number; cutoffHz: number; resonance: number; releaseMs: number }
export interface BellParams { ratio: number; index: number; decayMs: number }
export interface KeysParams { ratio: number; index: number; attackMs: number; releaseMs: number }
export interface PluckParams { damping: number; decayMs: number; brightness: number }
export interface PadParams { detuneCents: number; cutoffHz: number; attackMs: number; releaseMs: number }
export interface LeadParams { wave: number; vibratoHz: number; vibratoCents: number; releaseMs: number }
```

```ts
// src/probe/ffmpeg.schema.ts
export interface FfmpegInfo { path: string; version: string; encoders: { libmp3lame: boolean; libvorbis: boolean } }
export interface DoctorData { ffmpeg: FfmpegInfo | null; required: boolean; ready: boolean } // ready = executable plus both encoders
export interface EncodeOptions { format: "mp3" | "ogg"; bitrateKbps?: number }
export interface LoudnormOptions { targetLufs: number; ceilingDb: number }
```

Parameter registry (inclusive bounds; no implicit clipping):

| Voice | params: default [min,max] | Signal algorithm |
|---|---|---|
| `drums` | tone .5 [0,1], decayMs 180 [20,1000], noise .5 [0,1] | `bd`: falling 160->48 Hz sine; `sd`/`cp`: short 190 Hz body plus high-passed noise (cp has 3 delayed bursts); `hh`/`oh`: high-passed noise with 35/300 ms release; `rim`: click plus 800 Hz resonator; `perc`: 400 Hz resonator; `tom`: falling 210->90 Hz sine. Variants `name:index` wrap across four fixed parameter sets per name; noise seed varies with index. |
| `808` | drive 2.2 [1,8], decayMs 1100 [100,5000], attackMs 3 [0,50] | phase-continuous sine, exponential portamento from prior note frequency over `track.glide` ms, tanh drive, exponential decay, 8 ms final release; mono default. |
| `bass` | wave 0 [0,1] integer (0 saw, 1 square), cutoffHz 600 [40,8000], resonance .15 [0,.9], releaseMs 80 [5,1000] | mono oscillator, stable one-pole lowpass (`1-exp(-2*pi*cutoff/sampleRate)`), resonance as bounded pre-filter feedback, glide from track; no note overlap. |
| `bell` | ratio 3.5 [1,12], index 2.2 [0,10], decayMs 450 [50,5000] | 2-operator FM; modulator index decays exponentially, carrier envelope decays; poly. |
| `keys` | ratio 2 [1,8], index 1.4 [0,8], attackMs 8 [0,200], releaseMs 220 [20,2000] | 2-operator FM with velocity-scaled index, short attack, poly sustain through gate then exponential release. |
| `pluck` | damping .992 [.8,.9999], decayMs 900 [50,5000], brightness .7 [0,1] | seeded white-noise excitation into a fractional-delay Karplus-Strong line, two-point average feedback, one excitation per event; poly. |
| `pad` | detuneCents 11 [0,50], cutoffHz 1800 [80,12000], attackMs 400 [10,5000], releaseMs 700 [20,5000] | three saws at -detune/0/+detune, averaged, lowpass, slow attack and gate-following release; poly. |
| `lead` | wave 1 [0,1] integer (0 saw, 1 square), vibratoHz 5 [0,12], vibratoCents 12 [0,100], releaseMs 120 [5,2000] | oscillator with sinusoidal cents vibrato after 80 ms onset, 5 ms attack, gate-following release; poly unless `track.mono`. |

All voices multiply amplitude by event velocity and render only within the allocated buffer. A note pitch uses `440*2**((midi-69)/12)`; reject nonfinite or out-of-range MIDI after transpose as E_SCHEMA at the originating track. Bass/808 are mono even if `mono:false` (E_SCHEMA at `tracks[i].mono`); other note voices may request mono, using the same scheduler. `drums` only accepts sample atoms and note voices only MIDI events.

## File map

| Path | Op | Exact content / exported signatures and test vectors |
|---|---|---|
| `src/audio-io/buffer.schema.ts` | NEW | Types above; validate buffer construction at ingress: rate integer 8000..192000, equal channel lengths, finite sample values. |
| `src/audio-io/buffer.tool.ts` | NEW | `createStereo(sampleRate: number, frames: number): StereoBuffer`; `peakLinear(audio: StereoBuffer): number`; `truePeakLinear(audio: StereoBuffer): number`; `resampleLinear(input: Float32Array, fromRate: number, toRate: number): Float32Array`. Resample output length `round(input.length*toRate/fromRate)`, source coordinate `i*fromRate/toRate`, clamp last index; 8x windowed-sinc (32 taps, Hann window) true-peak estimate shared with limiter. |
| `src/audio-io/buffer.test.ts` | NEW | 22050->44100 Hz two-sample ramp `[0,1]` -> four samples `[0,.5,1,1]`; constant signal stays constant; silent peak 0; intersample test has `truePeakLinear >= peakLinear`; mismatched channels and NaN fail E_RENDER. |
| `src/audio-io/wav.tool.ts` | NEW | `readWav(path: string): Promise<StereoBuffer>` and `writeWav(path: string, audio: StereoBuffer, options: WavWriteOptions): Promise<WavInfo>`. Scan RIFF/WAVE chunks including pad bytes; accept format 1 PCM int16/int24/int32 and format 3 float32, mono duplicated to stereo, stereo preserved, rates 8000..192000. Reject >2 channels, RF64, truncated chunks, nonfinite float as E_INPUT with file/chunk detail. Writer streams 16384-frame chunks, RIFF PCM stereo 16/24, little endian; 16-bit adds `(rng()-rng())/32768` TPDF per channel before nearest rounding/saturation, `mulberry32(seed)`; 24-bit rounds/saturates without dither. Reject >4 GiB RIFF as E_RENDER. |
| `src/audio-io/wav.test.ts` | NEW | Decode handcrafted 16/24/32-int/float mono and stereo fixtures at 22050/44100/48000; `-32768` -> -1, signed 24-bit sign extension, float .25 preserved, unknown chunk skipped; 16-bit same seed writes byte-identical, different seed changes dithered silence, 24-bit -1 -> `0x800000`; truncated and 3-channel E_INPUT. |
| `src/audio-io/index.ts` | NEW | Named exports: `StereoBuffer`, `WavInfo`, `WavWriteOptions`, `createStereo`, `peakLinear`, `truePeakLinear`, `resampleLinear`, `readWav`, `writeWav`. |
| `src/render/render.schema.ts` | NEW | Render/voice/kit types above. |
| `src/render/voices/drums.tool.ts` | NEW | `export const drumsVoice: VoiceSpec`; deterministic oscillator/noise envelopes and 4 index variants for bd/sd/cp/hh/oh/rim/perc/tom. Unknown name -> E_SCHEMA at event's track pattern path, not silent fallback. |
| `src/render/voices/drums.test.ts` | NEW | Each of 8 names has nonzero output; `bd:4` equals `bd:0` for same event seed after index normalization; `sd` decays under 1e-3 by 1 s; unknown `cowbell` E_SCHEMA. |
| `src/render/voices/eight-o-eight.tool.ts` | NEW | `export const eightOhEightVoice: VoiceSpec`; phase continuity and exponential pitch glide `f(t)=target+(from-target)*exp(-t/tau)` with tau = glideMs/1000 (0 means immediate). |
| `src/render/voices/eight-o-eight.test.ts` | NEW | C2 65.406 Hz after settled onset; second G1 onset takes first sample near previous frequency when glide=50; two overlapping note slots produce one voice; end release <1e-3 by 50 ms. |
| `src/render/voices/bass.tool.ts` | NEW | `export const bassVoice: VoiceSpec`; saw/square plus one-pole lowpass and bounded resonance feedback. |
| `src/render/voices/bass.test.ts` | NEW | wave 0 and 1 differ; 200 Hz cutoff reduces 4 kHz RMS vs 4 kHz cutoff; next onset ends prior voice. |
| `src/render/voices/bell.tool.ts` | NEW | `export const bellVoice: VoiceSpec`; FM phases incremental, decay bounded by event stop/tail. |
| `src/render/voices/bell.test.ts` | NEW | C5 fundamental 523.251 Hz with index 0; two simultaneous notes sum; 1 s amplitude < initial 100 ms RMS. |
| `src/render/voices/keys.tool.ts` | NEW | `export const keysVoice: VoiceSpec`; velocity-sensitive FM, attack/sustain/release. |
| `src/render/voices/keys.test.ts` | NEW | 0.5 velocity has lower RMS than 1; gate at 100 ms releases within configured 220 ms; chord events overlap. |
| `src/render/voices/pluck.tool.ts` | NEW | `export const pluckVoice: VoiceSpec`; `mulberry32(event.seed)` excitation; delay length `sampleRate/hz`, linear fractional interpolation. |
| `src/render/voices/pluck.test.ts` | NEW | same event seed byte-identical PCM, different seed differs, C4 dominant period about 168-169 frames at 44.1 kHz. |
| `src/render/voices/pad.tool.ts` | NEW | `export const padVoice: VoiceSpec`; three detuned saw oscillators, lowpass, slow attack and release. |
| `src/render/voices/pad.test.ts` | NEW | 400 ms attack raises 20-50 ms RMS below 300-400 ms RMS; detune=0 differs from 11 cents; release reaches near zero. |
| `src/render/voices/lead.tool.ts` | NEW | `export const leadVoice: VoiceSpec`; square/saw selection, delayed vibrato. |
| `src/render/voices/lead.test.ts` | NEW | wave values differ; vibrato=0 yields stable frequency; 5 Hz vibrato starts only after 80 ms; gate release bounded. |
| `src/render/voices/registry.tool.ts` | NEW | `VOICES: Readonly<Record<string, VoiceSpec>>`; `resolveVoice(track: ResolvedTrack, index: number): VoiceSpec | null` (null for `kit:`); `validateVoiceParams(song: ResolvedSong): void`; merge defaults, reject unknown/nonfinite/out-of-range/noninteger params as E_SCHEMA with `details.issues[{path:"tracks[i].params.x",message}]`; unknown instrument at `tracks[i].instrument`, kind mismatch at `.kind`. |
| `src/render/voices/registry.test.ts` | NEW | 8 IDs resolve; `bass.wave=.5`, `pad.cutoffHz=12001`, `808.unknown=1` each E_SCHEMA at exact param path; unknown voice and drum/note mismatch exact paths; omitted values equal defaults. |
| `src/render/kit.tool.ts` | NEW | `loadKit(songPath: string, instrument: string, sampleRate: number): Promise<LoadedKit>`; `renderKit(ctx: VoiceContext, kit: LoadedKit): Float32Array`. Resolve `kit:<path>` against song file directory; manifest paths against kit.json directory, require relative paths confined to kit directory after realpath, no symlink escape; cache decoded/resampled WAV per path/rate per render. `sample.index % variants.length` wraps; mono fold down `(L+R)/2`; apply gainDb and velocity; note track speed ratio `2**((midi-rootMidi)/12)` by linear interpolation, drum track at original pitch. Strict manifest version 1 and known keys only. |
| `src/render/kit.test.ts` | NEW | temporary kit with two WAVs: `bd:2` uses first, `bd:1` second; 22050 Hz impulse at 44.1 kHz lands at doubled frame; note +12 transposes playback 2x; malformed/escaping path E_SCHEMA/E_ACCESS; missing sample name E_SCHEMA. |
| `src/render/fx.tool.ts` | NEW | `applyReverb(send: StereoBuffer): StereoBuffer`, `applyDelay(send: StereoBuffer, bpm: number): StereoBuffer`, `duckEnvelope(frames: number, onsets: readonly number[], sampleRate: number, amount: number, releaseMs: number): Float32Array`. Reverb: four comb delays [1557,1617,1491,1422] and two allpass [225,556] at 44100, scaled/rounded by rate, comb feedback .78, allpass .5, stereo spread via +23 samples right, wet only. Delay: `round(sampleRate*60/bpm*.75)` frames (dotted eighth), feedback .35, cross-channel ping-pong, wet only. Duck: at each trigger set gain `1-amount`, exponential recovery to 1 with releaseMs default 180; duplicate onset at same frame is one trigger. |
| `src/render/fx.test.ts` | NEW | 44.1k impulse first comb return at frame 1557; 48k delay rounds to 15429 frames at 140 BPM; duck amount .5 gives .5 at onset and >.99 after 1 s, no triggers all ones; rates scale returns. |
| `src/render/mixer.tool.ts` | NEW | `mixTracks(song: ResolvedSong, timeline: Timeline, songPath: string, options: RenderOptions): Promise<RenderResult>`. Per-track mono voice -> track gain `10**(track.gain/20)` (010 `Track.gain` is dB) -> constant-power pan `cos((pan+1)*pi/4), sin(...)` times sqrt(2) for center unity -> duck multiplier -> dry sum and send input; sum wet reverb/delay; master gain -> tanh soft clip (`tanh(1.2*x)/tanh(1.2)`) -> peak gain to `ceilingDb-0.5` for nonzero mix -> 5 ms lookahead limiter with 50 ms release based on 8x windowed-sinc peak, final sample clamp at ceiling. Silence stays zero, nonfinite anywhere E_RENDER. Stems are post gain/pan/duck dry pre-master, one WAV per track; wet bus is master-only. |
| `src/render/mixer.test.ts` | NEW | center pan equal L/R; pan -1 gives R≈0; +6 dB raises pre-master RMS 1.995x; duck source onset lowers target by .5; silent song remains zero; impulse intersample peak <= ceiling+0.1 dBTP after limit; NaN injected E_RENDER. |
| `src/render/render.tool.ts` | NEW | `renderSong(song: ResolvedSong, songPath: string, options?: RenderOptions): Promise<RenderResult>` (input is already validated by `loadSong`/`validateSong`; `songPath` only anchors `kit:` paths); buildTimeline, choose 0-based half-open bar range, rebase selected events to zero, preserve simultaneous event order, allocate `ceil((selectedBars*secondsPerBar+tailSeconds)*sampleRate)` frames; enforce event count/RIFF size and mono scheduling. Event seed `fnv1a32(song.seed, track.id, eventIndex)` where eventIndex is that track's stable ordinal in the full Timeline before crop; no Date/Math.random in audio paths. |
| `src/render/render.test.ts` | NEW | 16 bars at 140 BPM -> 27.428571 s plus 2 s tail; [4,12) -> 8 bars and event times start at 0; crop equals full-event seeds for overlapping events; two renders PCM byte-identical; 3-minute six-track fixture under 20 s single thread on documented reference machine. |
| `src/render/index.ts` | NEW | Named exports `renderSong`, `RenderOptions`, `RenderResult`, `RenderStem`, `KitManifest`, `VOICES`; no exports from internal voice files. |
| `src/probe/ffmpeg.schema.ts` | NEW | Ffmpeg/doctor/encode types above. |
| `src/probe/ffmpeg.tool.ts` | NEW | `discoverFfmpeg(env?: NodeJS.ProcessEnv): Promise<FfmpegInfo | null>`; if MUSIC2_FFMPEG set, probe that executable only (never PATH fallback), otherwise split PATH and find executable `ffmpeg`/`ffmpeg.exe` without shell; spawn `-version` and `-encoders`, parse first version line and exact encoder tokens `libmp3lame`, `libvorbis`; timeout 5 s. Missing executable returns null, malformed version E_CAPABILITY. |
| `src/probe/ffmpeg.test.ts` | NEW | fake executable output parses `6.1` and both encoders; explicit nonexistent override returns null despite PATH fake; absent encoder flag false; timeout/malformed version E_CAPABILITY. |
| `src/probe/master.tool.ts` | NEW | `encodeAudio(wavPath: string, outputPath: string, ffmpeg: FfmpegInfo, options: EncodeOptions): Promise<void>`; `loudnormWav(wavPath: string, outputPath: string, ffmpeg: FfmpegInfo, options: LoudnormOptions): Promise<void>`. Spawn with argument arrays and `shell:false`; MP3 `libmp3lame` 192 kbps, Ogg `libvorbis` quality 5, `-map_metadata -1`; absent required encoder E_CAPABILITY exit 3. Loudnorm pass 1 `print_format=json` to null output, parse measured values, pass 2 `linear=true` and measured_* with target I and TP=ceilingDb; reject missing/nonfinite stats E_RENDER, nonzero process E_RENDER with bounded stderr. Encode final WAV after optional loudnorm. |
| `src/probe/master.test.ts` | NEW | fake ffmpeg logs two loudnorm calls and measured_* in second; missing libvorbis E_CAPABILITY; nonzero exit E_RENDER; no shell expansion of path containing spaces. |
| `src/probe/index.ts` | NEW | Named exports `FfmpegInfo`, `DoctorData`, `discoverFfmpeg`, `encodeAudio`, `loudnormWav`. |
| `src/cli/commands/render.ts` | NEW | `export const render: CommandSpec` (010 registry contract): parse flags, `loadSong`, call `renderSong(song, path, {bars, stems, mastering: values.loudnorm ? "loudnorm" : "peak"})`, write WAV and optional stems, optional loudnorm, encode copies, return `RenderData` below. Guard ffmpeg before writing outputs if `--mp3`, `--ogg`, or `--loudnorm`; CLI errors pass through the single JSON envelope. |
| `src/cli/commands/doctor.ts` | NEW | `export const doctor: CommandSpec`; `run` returns `DoctorData` as `data`; if MUSIC2_REQUIRE_FFMPEG=1 and discovery null, throw E_FFMPEG_MISSING exit 3; if required and either encoder absent, throw E_CAPABILITY exit 3; otherwise report missing ffmpeg as `ready:false` with exit 0. |
| `src/cli/commands/render.test.ts` | NEW | fixture `--json` yields one `ok:true` object; invalid --bits/--bars E_INPUT exit 2; forced missing ffmpeg plus --mp3 E_FFMPEG_MISSING exit 3; stems exist; two output WAV hashes match. |
| `src/cli/commands/doctor.test.ts` | NEW | missing ffmpeg without require -> `ok:true`, `ready:false`; with require -> E_FFMPEG_MISSING exit 3; required ffmpeg with missing encoder -> E_CAPABILITY exit 3; fake probe advertises each encoder accurately. |
| `src/cli/registry.ts` | MODIFY | Import `render` and `doctor` CommandSpecs and append them to the registration list. |
| `src/cli/commands/help.ts` | MODIFY | Add render/doctor rows and the flags/defaults in the command help text. |
| `src/index.ts` | MODIFY | Add named public exports `StereoBuffer`, `readWav`, `writeWav`, `renderSong`, `RenderOptions`, `RenderResult`, `discoverFfmpeg`, `FfmpegInfo` from feature barrels. |
| `scripts/test.mjs` | MODIFY | Detect `MUSIC2_REQUIRE_FFMPEG=1`; on ubuntu CI require discovery plus libmp3lame/libvorbis, fail with E_FFMPEG_MISSING if executable absent or E_CAPABILITY if an encoder is absent; otherwise print `SKIP ffmpeg integration` and skip only ffmpeg integration cases, never pure/fake probe tests. Run native encode/decode integration on ubuntu when present. |
| `examples/drill-140.song.json` | NEW | Version 1, title `Drill 140`, genre `drill_uk`, bpm 140, key `C minor`, seed 140, 4/4, 44100 Hz, tailSeconds 2, master ceilingDb -1; tracks `kick`/`snare`/`hats` instrument drums, `sub` 808, `bell` bell, `pad` pad. Intro 4 bars (hats/bell/pad, kick sparse, sub muted), hook 8 (all tracks; half-time snare step 9, syncopated kicks, hats with `[hh hh hh]` rolls, C2/Ab1/G1 sub), verse 4 (sparser bell/pad, still kick/snare/sub). Arrangement intro, hook, verse exactly once. Patterns use only 004 syntax; no sample assets. |
| `devlog/str_func/audio-io.md` | NEW | File Tree, module responsibility, signatures for buffer/WAV, dependencies shared, consumers render/analyze/critic, sync checklist. |
| `devlog/str_func/render.md` | NEW | File Tree, registry/voice/fx/mixer signatures, dependency direction, parameter table reference, sync checklist. |
| `devlog/str_func/probe.md` | NEW | File Tree, ffmpeg/master signatures, no-shell/error contract, consumers CLI/critic, sync checklist. |
| `devlog/str_func/cli.md` | MODIFY | Add render/doctor command rows, exact flags, error mapping, and handler dependencies; retain wp2 entries. |
| `devlog/str_func/AGENTS.md` | MODIFY | Add index table rows `audio-io`, `render`, `probe`; update existing `cli` row status for new commands. |

## Fixture and numerical rules

The exact `examples/drill-140.song.json` data removes arrangement guesswork. Use the six tracks below in table order; `kind` is drums for the first three and notes for the last three. Unlisted track fields use 010 defaults. `pad` gain is -12 dB and send.reverb .35; `bell` gain -8 dB and send.reverb .4; `sub` gain -3 dB, mono true, glide 50 ms; the three drum tracks use gain -4/-7/-12 dB and the snare send.reverb .12.

| Track | instrument | default pattern |
|---|---|---|
| `kick` | `drums` | `bd ~ ~ ~ ~ ~ bd ~ ~ ~ ~ ~ ~ ~ ~ ~` |
| `snare` | `drums` | `~ ~ ~ ~ ~ ~ ~ ~ sd ~ ~ ~ ~ ~ ~ ~` |
| `hats` | `drums` | `hh hh hh [hh hh hh] hh hh [hh hh hh hh] hh` |
| `sub` | `808` | `<[c2 ~ ~ ~ ~ ~ c2 ~ ~ ~ eb2 ~ ~ ~ ~ ~] [ab1 ~ ~ ~ ~ ~ ab1 ~ ~ ~ c2 ~ ~ ~ ~ ~] [g1 ~ ~ ~ ~ ~ g1 ~ ~ ~ d2 ~ ~ ~ ~ ~] [c2 ~ ~ ~ ~ ~ c2 ~ ~ ~ g1 ~ ~ ~ ~ ~]>` |
| `bell` | `bell` | `<[c5 ~ eb5 ~ g5 ~ ~ ~ ab5 ~ g5 ~ eb5 ~ ~ ~] [c5 ~ eb5 ~ g5 ~ ~ ~ bb4 ~ ~ ~ d5 ~ ~ ~]>` |
| `pad` | `pad` | `<[c3,eb3,g3] [ab2,c3,eb3] [g2,bb2,d3] [c3,eb3,g3]>` |

Section `intro` has bars 4, role intro, patterns `{kick:"bd ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~",snare:null,sub:null,hats:"hh ~ hh ~ hh ~ hh ~ hh ~ hh ~ hh ~ hh ~"}`. Section `hook` has bars 8, role hook and no overrides. Section `verse` has bars 4, role verse, patterns `{kick:"bd ~ ~ ~ ~ ~ ~ ~ ~ ~ bd ~ ~ ~ ~ ~",bell:"c5 ~ ~ ~ eb5 ~ ~ ~ g5 ~ ~ ~ ~ ~ ~ ~",pad:null}`. Arrangement is `[{section:"intro"},{section:"hook"},{section:"verse"}]`. The first hook begins at absolute bar 4; onsets from section-local alternatives restart at each placement as wp2 specifies.

- Quantize event onset `startFrame = round(time*sampleRate)`, gate `round(duration*sampleRate)`, and next mono onset by its absolute frame; event at the same frame uses Timeline order. Clamp every write to `[0, frames)`.
- Tail is `tailSeconds` after the selected bar interval. If release/reverb/delay wants more time, truncate at that boundary; never silently lengthen the WAV. Delay feedback and reverb must stop at the allocated final frame.
- A kit manifest's `gainDb` must be finite in [-60,12], `rootMidi` finite in [0,127], sample arrays nonempty, and sample names nonempty. Non-PCM16/24/32 or float32 WAV, path escape and decode errors carry kit path and sample name.
- Decode WAV int16/int24/int32 by dividing by 2^15/2^23/2^31; float32 is used directly after finite checking. Resample before playback and cache by canonical sample path plus target rate. An empty `data` chunk is valid silence; RIFF chunk padding is skipped.
- For `drums`, normalize the variant index before selecting its four timbre presets and before deriving its noise stream. With the same event seed, `bd:4` is byte-equivalent to `bd:0`.
- The limiter precomputes polyphase interpolation coefficients once per sample rate. It may skip expensive 8x evaluation on windows whose sample-domain upper bound is safely below the ceiling; windows near the ceiling must use 8x evaluation, then a second pass verifies the entire output. No sample or estimated intersample value may exceed the ceiling by more than 0.1 dB.
- Memory budget: one master stereo buffer, one reusable mono track buffer, two stereo send buses, and optional dry stems; 180 s at 44.1 kHz should not allocate one full buffer per event. Reuse delay/filter state, avoid per-sample objects, and keep all loops single-threaded. Benchmark reference: Apple M2 Pro 10-core, Node 22.18, no parallel load; report elapsed milliseconds with the test result.
- Write final outputs through sibling temporary files and rename after successful close/encoding. On failure remove only temporary files created by this invocation; do not remove a preexisting destination. Resolve and reject output collisions before rendering.

## Execution details and CLI

Render sequence: load/validate song -> validate voice IDs/params and kit manifests -> build full Timeline -> assign per-track event indices/seeds -> crop/rebase selected bars -> schedule mono/poly note lifetimes -> render track mono buffers -> apply gain/pan and duck keyed by the named source track's onsets -> capture dry stems and add dry/send buses -> process wet buses -> master peak target/soft clip/limiter -> write WAV -> optional loudnorm -> optional MP3/Ogg. Preserve Timeline tie order (time, trackIndex, order); within each track, simultaneous poly voices sum in that order. Mono voice takes the last event at an identical onset; the prior event ends exactly at next onset. Poly gate uses `duration` from TimedEvent; release continues within `tailSeconds`. Explicit `track.glide` applies only to mono. All state is per render call; PRNG is `mulberry32` from shared seeded by FNV-1a, never Math.random or Date in audio paths.

For `--bars a:b`, `a` and `b` are integers, zero-based, half-open, `0 <= a < b <= timeline.bars`. Crop starts at bar `a` with time zero; a mono note that began before `a` is not synthesized into the crop, and only selected onsets count. Stems use `<dir>/<track.id>.wav`, chosen bit depth, and the same dither seed derivation `fnv1a32(song.seed, track.id, "wav")`; master uses `fnv1a32(song.seed, "master", "wav")`. Default output name is `<song basename>.wav` beside the input; `--mp3`/`--ogg` replace `.wav` with their extension, and reject collision with input/stem paths as E_INPUT. All output paths are made absolute in data; no progress text on stdout with `--json`.

```ts
// CLI data payloads inside 010's {ok:true,data,meta:{music2:version}} envelope
export interface RenderData { wav: string; mp3?: string; ogg?: string; stems?: string[]; bars: number; sampleRate: number; frames: number; durationSeconds: number; peakDbfs: number | null; truePeakDbtp: number | null; ceilingDb: number; events: number }
// doctor data is DoctorData above
```

| Command / flag | Default and effect | Output data / failures |
|---|---|---|
| `music2 render <song.json> [-o out.wav] [--bits 16|24] [--mp3] [--ogg] [--stems dir] [--bars a:b] [--loudnorm] [--json]` | output beside input, 16-bit, full bars, no encoded copies/stems/loudnorm | `RenderData`; E_INPUT bad flags/range/path (2), E_SCHEMA bad voice/params/kit (2), E_ACCESS unreadable kit/output (4), E_RENDER nonfinite/size/ffmpeg failed (5). |
| `--mp3`, `--ogg` | Encode from finalized WAV; may be combined | Missing ffmpeg E_FFMPEG_MISSING (3); encoder absent E_CAPABILITY (3). |
| `--loudnorm` | ffmpeg two-pass, targetLufs from song or -14, TP=ceilingDb; replaces WAV atomically before encode | Missing ffmpeg E_FFMPEG_MISSING (3); malformed stats E_RENDER (5). |
| `music2 doctor [--json]` | Inspect explicit env or PATH; `required = MUSIC2_REQUIRE_FFMPEG === "1"` | `DoctorData`; absent optional capability is ok with `ready:false`, absent required is E_FFMPEG_MISSING (3). |

wp3 peak mastering does not claim LUFS compliance. RIFF WAV identity is promised for same Node major/platform and input/seed; ffmpeg output identity is not promised across ffmpeg versions. Peak verification uses the same 8x interpolator as limiter and allows +0.1 dB numerical tolerance against `ceilingDb`; sample peak cannot exceed ceiling. Silence has `peakDbfs`/`truePeakDbtp` reported as null in CLI JSON (JSON cannot encode -Infinity); the internal `RenderResult` uses `-Infinity`.

## Acceptance

| Check | Command | What it observes |
|---|---|---|
| Static/build | `npm run typecheck`, `npm run lint`, `npm run build` | New public types, imports, and commands compile; no runtime dependency added. |
| Focused and integration | `npm run test` | Colocated voice/WAV/fx/kit/CLI tests; no NaN, silent path, sample/true peak <= ceiling+0.1 dB, conditional ffmpeg behavior. |
| Drill render | `node bin/music2.js render examples/drill-140.song.json -o /tmp/music2-drill-a.wav --json` | One success envelope, 16 bars, 44.1 kHz, 16-bit stereo, about 29.4286 s including tail, nonzero peak <= -1 dBFS, truePeak <= -0.9 dBTP. |
| Identity | `node bin/music2.js render examples/drill-140.song.json -o /tmp/music2-drill-b.wav --json` | Test compares SHA-256 of `/tmp/music2-drill-a.wav` and `/tmp/music2-drill-b.wav`; exact byte match on same host/Node major. |
| Crop and stems | `node bin/music2.js render examples/drill-140.song.json -o /tmp/music2-hook.wav --bars 4:12 --bits 24 --stems /tmp/music2-stems --json` | 8-bar crop, six 24-bit dry stems, events rebased, no NaN and bounded peak. |
| Missing encoder executable | `MUSIC2_FFMPEG=/nonexistent node bin/music2.js render examples/drill-140.song.json --mp3 --json` | E_FFMPEG_MISSING, exit 3, no output WAV/MP3. |
| Optional capability | `MUSIC2_FFMPEG=/nonexistent node bin/music2.js doctor --json` | `ok:true`, `ffmpeg:null`, `ready:false`. |
| Required capability | `MUSIC2_FFMPEG=/nonexistent MUSIC2_REQUIRE_FFMPEG=1 node bin/music2.js doctor --json` | E_FFMPEG_MISSING, exit 3. |
| Native ffmpeg CI | `MUSIC2_REQUIRE_FFMPEG=1 npm run test` | Ubuntu matrix invokes real libmp3lame/libvorbis encode checks; missing ffmpeg/encoders fails rather than silently skips. |
| 3-minute render budget | `MUSIC2_BENCH=1 npm run test` | `render.test.ts` logs single-thread elapsed time for a generated 180 s, six-track 44.1k song; <20 s on documented reference machine, separate from normal test gate. |

## Activation scenarios

- `wav.test.ts` forces 16-bit dither with silence/alternate seeds; byte identity and nonzero low-bit differences prove both deterministic and randomized branches. Handcrafted PCM16/24/32 and float32 chunks prove every read branch; truncated and 3-channel headers prove E_INPUT.
- `registry.test.ts` exercises missing defaults and each invalid-param class (unknown, range, integer, nonfinite); `details.issues.path` proves `tracks[i].params.x` placement. `drums.test.ts` covers every drum name, index wrap, and unknown sample error.
- `render.test.ts` places overlapping 808 onsets and a poly chord; one sustained mono voice versus concurrent poly voices proves scheduling. Crop test begins after a pre-crop onset to prove it is omitted and event seeds remain full-Timeline-addressed.
- `kit.test.ts` loads a lower-rate two-variant WAV kit, note-pitch playback and relative-path escape; waveform timing, variant selection, and E_ACCESS/E_SCHEMA prove those guards. No bundled sample file is needed.
- `fx.test.ts` inserts an impulse and keyed onset; exact first delayed frame and depressed/recovered duck gain prove rate scaling, dotted-eighth timing, and sidechain release. `mixer.test.ts` forces silence, NaN and intersample overshoot; E_RENDER or bounded peak proves protection.
- `ffmpeg.test.ts` uses a fake executable, an absent override, missing encoder, malformed version and timeout; parsed capabilities/null/E_CAPABILITY prove each discovery path. `master.test.ts` uses fake measured JSON and failed process to prove two-pass invocation and E_RENDER.
- `render.test.ts`/CLI tests render the 16-bar example twice and compare WAV hashes, inspect finite non-silent samples and peak, then use `MUSIC2_FFMPEG=/nonexistent` with `--mp3`; E_FFMPEG_MISSING exit 3 proves the explicit-override guard. `doctor.test.ts` toggles MUSIC2_REQUIRE_FFMPEG; only the required path fails. `MUSIC2_BENCH=1` activates the 180-second performance threshold.
