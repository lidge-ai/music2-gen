# music2-gen: open-source landscape research

Snapshot date: **2026-09-28 (KST)**. Scope: public web pages, the GitHub REST API (read-only GETs), the npm registry, Codeberg API, and Hugging Face model API.

How to read the fields:
- **License** is the SPDX id from the repo LICENSE file or the npm `license` field. Where GitHub reports `NOASSERTION`, I read the LICENSE file and state what it says. "none" means GitHub found no license file.
- **Date** is the latest GitHub release, npm publish, or last push (`pushed`). The label says which.
- **Stars** are GitHub (or Codeberg, where noted) as of the snapshot.
- **UNVERIFIED** means I could not confirm it from a primary source during this pass.

Target recap: music2-gen is an MIT Node/TypeScript CLI. An LLM writes a pattern-language song file, and the CLI renders WAV offline with no browser. It then analyzes the audio and emits spectrogram and piano-roll PNGs. Audio-capable models such as Gemini can optionally critique the render. The constraint that matters most below is **license compatibility with an MIT npm package**.

---

## 1. Pattern/code music languages and engines

| Project | URL | License (exact) | Latest release / activity | Stars | Language | Relevance to music2-gen |
|---|---|---|---|---:|---|---|
| Strudel | https://codeberg.org/uzu/strudel (GitHub mirror archived: https://github.com/tidalcycles/strudel) | **AGPL-3.0-or-later** (npm `@strudel/core`, `@strudel/mini`, `superdough`); Codeberg LICENSE = GNU AGPL v3 | npm `@strudel/core` 1.2.6 (2026-01-17), `superdough` 1.3.0 (2026-01-18); last Codeberg commit 2026-08-19 | 1,234 (Codeberg); 3,032 (archived GitHub) | JavaScript | The best-known JS pattern language, and the closest design reference. AGPL makes it **unusable as a dependency** of an MIT CLI you want others to embed. |
| TidalCycles | https://codeberg.org/uzu/tidal (GitHub archived: https://github.com/tidalcycles/Tidal) | **GPL-3.0** | v1.10.3 (2026-07-02, Codeberg) | 280 (Codeberg); 2,846 (GitHub) | Haskell | Origin of the mini-notation and cycle model. README warns: "Ports and other projects making use of Tidal source code as a reference for e.g. algorithms and/or types are derivative works and bound by the same license." That is why a clean-room reimplementation must work from docs only. |
| Sonic Pi | https://github.com/sonic-pi-net/sonic-pi | Main source (`app/`) **MIT**. The app ships GPL-3.0 components (SuperCollider). The web version, SuperSonic, and Clockwork are **AGPL-3.0-or-later** (LICENSE.md) | v5.0.0 (2026-08-07) | 12,158 | C++/Ruby | Good reference for LLM-friendly music DSL ergonomics (`live_loop`, `sample`, `synth`). The runtime needs scsynth, so it is not embeddable. |
| SuperCollider | https://github.com/supercollider/supercollider | **GPL-3.0** | Version-3.14.1 (2025-11-24) | 6,747 | C++ | scsynth can do NRT (non-real-time) score rendering to a file. Usable as an optional external backend only (separate process). |
| Csound | https://github.com/csound/csound | **LGPL-2.1** | 7.0.0-beta.17 (2026-06-19) | 1,507 | C | Mature offline renderer (`csound -o out.wav`). A WASM build exists. LGPL is workable as a separate binary, but heavy. |
| ChucK | https://github.com/ccrma/chuck | Dual **MIT OR GPL-2.0-or-later** (README: "You can choose either license") | tag chuck-1.5.5.8; last commit 2026-07-10 | 1,045 | C++ | Strongly-timed language with `--silent` / WvOut file output. The MIT option makes it the most permissive of the "classic" engines. External binary only. |
| Glicol | https://github.com/chaosprint/glicol | **MIT** | v0.12.5 (2022-05-11); last commit 2025-01-23; npm `glicol` 0.4.0 (2023-05-20) | 3,000 | Rust (+WASM) | MIT graph-oriented live-coding language with a Rust DSP engine. Good for design ideas, but slow maintenance. |
| FoxDot | https://github.com/Qirky/FoxDot | **CC-BY-SA-4.0** (LICENSE file; GitHub shows NOASSERTION) | v0.8.12 (2021-06-03) | 1,160 | Python | Python player/pattern syntax (`p1 >> pluck([0,2,4])`). Largely dormant. |
| Renardo (FoxDot fork) | https://github.com/e-lie/renardo | **GPL-3.0** (pyproject `license = {text = "GPL-3.0"}`, README) | v1.0.0a4 (2025-05-31); pushed 2026-07-30 | 94 | Python | Maintained FoxDot successor. Reference only. |
| Faust | https://github.com/grame-cncm/faust | Compiler **LGPL-2.1-or-later** (COPYING.txt; GitHub shows NOASSERTION). Architecture files carry separate terms | 2.88.0 (2026-09-09) | 3,167 | C++ | DSP language that compiles to WASM/C++. Useful if you want to author synth voices in Faust and ship the generated code (check the architecture-file exception). |
| Tone.js | https://github.com/Tonejs/Tone.js | **MIT** | GitHub release 15.1.22 (2026-07-12); npm `tone` 15.1.22 (registry time 2025-04-27) | 14,743 | TypeScript | Mature synths, effects, and a transport. Runs in Node with the `web-audio-api` polyfill (see section 2). The most practical MIT instrument layer. |
| alda | https://github.com/alda-lang/alda | **EPL-2.0** | tag release-2.4.7; last commit 2026-08-29 | 5,945 | Go | Text music notation aimed at humans, and a clean model for "LLM writes a text score". EPL-2.0 is weak copyleft, so use it as a reference, not a dependency. (npm `alda` 0.0.1 is an unrelated MIT placeholder.) |
| abcjs | https://github.com/paulrosen/abcjs | **MIT** (LICENSE.md; GitHub shows NOASSERTION) | v6.7.1 (2026-09-21) | 2,350 | JavaScript | MIT ABC parser, renderer, and MIDI. ABC is the most LLM-proven symbolic format (ChatMusician, NotaGen). Candidate for an **ABC import path** for melodic parts. |
| LilyPond | https://github.com/lilypond/lilypond | **GPL-3.0-or-later** | v2.26.0 (2026-04-21) | 681 (GitHub mirror) | C++/Scheme | Engraving, not rendering. Optional external tool for sheet-music PNGs. |
| isobar | https://github.com/ideoforms/isobar | **MIT** | v0.2.1 (2025-08-08) | 438 | Python | MIT Python pattern library (Pseq, Pwhite, euclidean). Good design reference for a permissive pattern algebra. |
| Scribbletune | https://github.com/scribbletune/scribbletune | **MIT** | npm 5.5.5 (2026-04-05) | 3,773 | TypeScript | MIT JS pattern strings (`'x-x-[xx]'`) to MIDI. The closest permissive JS analogue to a simple drum-grid DSL. |
| tonal | https://github.com/tonaljs/tonal | **MIT** (npm `tonal`) | npm 6.4.3 (2026-01-18) | 4,242 | TypeScript | Scales, chords, Roman numerals, and key logic for validating LLM-written harmony. **Depend on it.** |

### Mini-notation parsers that are not AGPL

| Project | URL | License | Date | Stars | Notes |
|---|---|---|---|---:|---|
| tidal.pegjs | https://github.com/gibber-cc/tidal.pegjs | **MIT** (package.json; no LICENSE file in repo) | npm 0.0.6 (2020-06-03); pushed 2022-01-17 | 51 | PEG.js grammar for Tidal mini-notation producing annotated JS structures. Listed on the Tidal site's "Friends and relations" page. Stale, but the smallest permissive reference. Get the author to add a LICENSE file before copying code. |
| krill (Mdashdotdashn) | https://github.com/Mdashdotdashn/krill | **ISC** (package.json; no LICENSE file) | pushed 2026-08-16 | 42 | JS live-coding environment inspired by Tidal, with a `grammar.txt`. (npm `krill` is an unrelated Joyent package.) |
| cycles (Rust) | https://github.com/mitchmindtree/cycles | **GPL-3.0** (repo); crates.io says "non-standard" | 0.2.4 (2025-03-10) | 35 | Has a `mini` module. **Not permissive.** |
| Vortex | https://codeberg.org/uzu/vortex | **GPL-3.0** | updated 2025-12-26 | 21 (Codeberg) | Python Tidal port. Not permissive. |
| Tranquility / Modal | https://github.com/XiNNiW/tranquility / https://github.com/neo451/modal | **GPL-3.0** / **GPL-3.0** | 2023-12-25 / 2026-05-10 | 34 / 39 | Lua ports. Not permissive. |
| Kabelsalat | https://github.com/felixroos/kabelsalat (moved to Codeberg) | **AGPL-3.0-or-later** (npm `@kabelsalat/core` 0.4.0) | 2026-01-15 | 64 | Audio-graph live coding by a Strudel author. Not permissive. |

**Finding:** no maintained, permissively licensed, feature-complete mini-notation implementation exists. The permissive options are small and stale (tidal.pegjs, krill). The spec itself is well documented in the public Tidal reference (https://tidalcycles.org/docs/reference/mini_notation): `~ [] <> , * / ! _ ? | : (k,n) {} %`. A **clean-room PEG grammar written from the documentation** (not from Strudel/Tidal source) is the defensible route.

---

## 2. Headless/offline audio rendering in Node (no browser)

### Web Audio implementations

| Package | URL | License (npm) | Latest | Stars | Language | Verdict for music2-gen |
|---|---|---|---|---:|---|---|
| **web-audio-api** (audiojs) | https://github.com/audiojs/web-audio-api | **MIT** | 1.5.6 (2026-09-06) | 949 | JavaScript | **Best pure-JS option.** README: "A pure JavaScript implementation of the Web Audio API for Node.js". It includes `OfflineAudioContext` (renders "without opening an audio device"), a worklet example (`examples/worklet.js`), and passes the WPT corpus under its Node runner. Tone.js works via `import 'web-audio-api/polyfill'` then `Tone.setContext(...)`. Worklets run synchronously on the main thread, which is fine for offline rendering. |
| **node-web-audio-api** (IRCAM) | https://github.com/ircam-ismm/node-web-audio-api | **BSD-3-Clause** | 2.2.0 (2026-08-09) | 263 | Rust via N-API (backend `orottier/web-audio-api-rs`, MIT, 386 stars) | Fast native engine. Prebuilt binaries for macOS x64/aarch64, Windows x64/arm64, and Linux x64/arm/arm64. The changelog confirms **`OfflineAudioContext`, `AudioWorkletNode`, and `audioWorklet.addModule()`**, including module imports and WASM worklets. **Caveat:** issue #202 (opened 2026-09-24, still open) reports that an `AudioWorkletProcessor` keeps being processed after `process()` returns `false`, so per-node CPU accumulates. The reporter hit it in a headless Strudel/superdough renderer. Needs a soak test for note-per-worklet graphs. |
| web-audio-engine | https://github.com/mohayonao/web-audio-engine | **MIT** (npm); repo has no LICENSE file and is archived | 0.13.4 (2018-01-09) | 247 | JavaScript | Has `OfflineAudioContext` but no AudioWorklet, and it is archived. Avoid. |
| standardized-audio-context | https://github.com/chrisguttandin/standardized-audio-context | **MIT** | npm 25.3.77 (2024-08-31); pushed 2026-09-01 | 779 | JavaScript | Browser ponyfill that Tone.js uses internally. **Not a Node renderer by itself.** It needs globals, which the `web-audio-api` polyfill supplies. |

**Does OfflineAudioContext + AudioWorklet work headless?** Yes, in both `web-audio-api` (pure JS) and `node-web-audio-api` (native), per their READMEs and changelog. Proof it works end to end with real music: **karmaterminal/strudel-music** (MIT, 4 stars, v1.2.2 2026-03-03) renders Strudel patterns to WAV offline via `node-web-audio-api` (`src/runtime/offline-render-v2.mjs`). Note that it pulls in AGPL `@strudel/*` 1.1.0 as dependencies.

### Pure-JS synths, samplers, and SoundFont players

| Package | URL | License | Latest | Stars | Relevance |
|---|---|---|---|---:|---|
| **spessasynth_core** | https://github.com/spessasus/spessasynth_core | **Apache-2.0** | 4.3.22 (2026-08-24) | 67 (SpessaSynth app: 404) | Pure TS SF2/SF3/DLS + MIDI synth with an explicit offline-render mode that works in Node. **Best SoundFont renderer for an MIT package.** |
| js-synthesizer | https://github.com/jet2jet/js-synthesizer | **BSD-3-Clause** (wrapper); embeds FluidSynth WASM (**LGPL-2.1**) | 1.13.0 (2026-04-20) | 79 | FluidSynth compiled to WASM with `render()` usable without Web Audio. Shipping the LGPL WASM inside an npm package needs LGPL compliance (replaceable module). |
| FluidSynth CLI | https://github.com/FluidSynth/fluidsynth | **LGPL-2.1** | pushed 2026-09-27 | 2,500 | `fluidsynth -ni font.sf2 song.mid -F out.wav`. Good optional external backend. |
| TiMidity++ | (SourceForge) | GPL-2.0-or-later | n/a | n/a | External fallback only. |
| @elemaudio/core + offline-renderer | https://github.com/elemaudio/elementary | **MIT** | 4.0.1 / 4.0.3 (Dec 2024) | 514 | Functional DSP graph with a purpose-built offline renderer. An alternative synth core to Web Audio. |
| @thi.ng/dsp | https://github.com/thi-ng/umbrella | **Apache-2.0** | 4.7.123 (2026-09-01) | 3,829 (monorepo) | Oscillators, envelopes, and filters as plain JS iterators. Good for procedural 808 / drum synthesis without Web Audio. |
| gibberish-dsp / genish.js | https://github.com/gibber-cc/gibberish | **MIT** (npm) | 3.4.0 (2022) / 1.0.2 (2020) | 401 | Codegen DSP. Older. |
| smplr | https://github.com/danigb/smplr | **MIT** (npm); repo has no LICENSE file | 1.0.0 (2026-06-13) | 323 | Browser sampler. No verified Node render path. Sample sources have their own licenses. |
| soundfont-player | https://github.com/danigb/soundfont-player | **MIT** | archived | 476 | Superseded by smplr. Avoid. |
| soundfont2 (parser) | npm `soundfont2` | **MIT** | 0.5.0 (2024-10-08) | n/a | Pre-1.0 SF2 parser. |

### WAV encoders

| Package | License | Latest | Notes |
|---|---|---|---|
| wavefile (https://github.com/rochars/wavefile, 253 stars) | **MIT** | 11.0.0 (2020-01-30) | Full-featured read/write, bit-depth conversion, cue/metadata chunks. |
| wav-encoder | **MIT** | 1.3.0 (2017-08-11) | Tiny Float32 to WAV encoder. |
| audiobuffer-to-wav (Experience-Monks) | **MIT** | 1.0.0 (2015-12-14) | Tiny. Old but trivially correct. |
| node-wav / wav (TooTallNate) | **MIT** / **MIT** | 2016 / 2018 | Old. |

A WAV writer is about 40 lines of code. Writing your own (RIFF header + PCM16/Float32) avoids a stale dependency.

### MIDI writers and parsers

| Package | URL | License | Latest | Stars | Notes |
|---|---|---|---|---:|---|
| midi-writer-js | https://github.com/grimmdude/MidiWriterJS | **MIT** | 3.2.1 (2026-03-01) | 607 | Composition-oriented MIDI writer. |
| @tonejs/midi | https://github.com/Tonejs/Midi | **MIT** | 2.0.28 (2022-02-04) | 1,005 | JSON-friendly read/write. Good for piano-roll data and MIDI export. |
| midi-file | npm | **MIT** | 1.2.4 (2023-03-15) | n/a | Low-level parse/write. |
| jzz | npm | **MIT** | 1.9.6 (2025-09-20) | n/a | MIDI I/O and SMF. Larger than needed. |

### Spectrogram / piano-roll PNG in Node (no browser)

| Package | License | Latest | Notes |
|---|---|---|---|
| pngjs | **MIT** (npm; GitHub NOASSERTION) | 7.0.0 (2023-02-20) | Pure-JS PNG encode. Zero native deps. **Recommended** for pixel-buffer spectrograms and piano rolls. |
| fft.js (indutny) | **MIT** (npm) | 4.0.4 (2021-01-11) | Fast radix-4 real FFT. **Recommended** for the STFT. |
| @napi-rs/canvas | **MIT** | 1.0.9 (2026-09-09) | Prebuilt Skia canvas. Use if you want text labels and axes without writing a font rasterizer. |
| sharp | **Apache-2.0** | 0.35.5 (2026-09-27) | libvips. Resize/compose. Heavier. |
| canvas (node-canvas) | **MIT** | 3.2.3 (2026-03-31) | Cairo native deps. Avoid for install friction. |
| webfft / kissfft-js / ooura / fft-js | MIT / MIT / ISC / MIT | 2017-2024 | Alternatives. |
| spectrogram / audio-spectrogram (npm) | MIT | 2019 / 2015 | Canvas/browser-oriented and stale. Avoid. |
| CLI fallbacks | ffmpeg `showspectrumpic`, `sox ... spectrogram` | n/a | Optional if installed. Do not require. |

---

## 3. LLM-driven composition agents and MCP servers

| Project | URL | License (code / weights) | Date | Stars | Representation | What worked / key finding |
|---|---|---|---|---:|---|---|
| strudel-music (karmaterminal) | https://github.com/karmaterminal/strudel-music | **MIT** code; depends on AGPL `@strudel/*` 1.1.0 | v1.2.2 (2026-03-03) | 4 | Strudel JS pattern code | OpenClaw skill: agent writes Strudel, renders offline in Node via node-web-audio-api, posts audio. Also "deconstructs" audio (Demucs + librosa) back into generative Strudel programs. Closest prior art to music2-gen, but it inherits AGPL exposure. |
| live-coding-music-mcp (formerly strudel-mcp-server) | https://github.com/williamzujkowski/live-coding-music-mcp | **AGPL-3.0** | v4.0.0 (2026-05-15); pushed 2026-09-22 | 240 | Strudel patterns, MIDI import/export | 28 MCP tools. Drives **Strudel.cc in real Chromium via Playwright**. Genre templates (techno, house, dnb, ambient, trap, jungle, jazz, experimental). Optional **Gemini-backed `ai_assist`** for feedback. Shows demand, but it is exactly the browser-dependent design music2-gen avoids. |
| strudel-mcp-bridge | https://github.com/phildougherty/strudel-mcp-bridge | none | pushed 2025-10-22 | 20 | Strudel JS | Thin WebSocket bridge into the Strudel web REPL. |
| ableton-mcp | https://github.com/ahujasid/ableton-mcp | **MIT** | pushed 2026-09-22 | 3,107 | Ableton Live object model / MIDI clips | Popular: shows LLMs are comfortable emitting structured clip/note JSON when a DAW does the rendering. |
| MusicLang | https://github.com/MusicLang/musiclang | **BSD-2-Clause** | pushed 2024-03-25 | 206 | Python music DSL (scale degrees + chord context) | A "code that makes music" DSL designed for model predictability. Relative scale-degree notation is a good idea to borrow. |
| ChatMusician | https://github.com/hf-lin/ChatMusician ; weights https://huggingface.co/m-a-p/ChatMusician | code: **none** (no LICENSE in repo); weights: **MIT** (HF card) | repo 2024-04-24; HF 2024-04-08 | 321 | **ABC notation** | LLaMA2-7B continually trained on ABC. The paper (arXiv 2402.16153) reports structured full-length pieces and better MusicTheoryBench scores than GPT-4 baselines. Evidence that **plain-text symbolic formats suit LLMs**. |
| ComposerX | https://github.com/lllindsey0615/ComposerX | none | 2024-09-30 | 37 | ABC → abc2midi/MuseScore | Training-free GPT-4 multi-agent system (melody, harmony, instrument, reviewer roles). Paper arXiv 2404.18081: multi-agent critique loops improved GPT-4 composition quality. Supports music2-gen's **render → analyze → revise** loop. |
| Muzic (Microsoft) incl. MusicAgent, CLaMP, MuseCoco | https://github.com/microsoft/muzic | **MIT** | pushed 2026-08-05 | 4,962 | MIDI/REMI tokens; text-to-attribute-to-music (MuseCoco) | MusicAgent is an LLM tool-orchestrator over music tools. MuseCoco splits text → musical attributes → symbolic music. The attribute layer is a useful idea for a genre preset schema. |
| Text2midi | https://github.com/AMAAI-Lab/Text2midi ; weights https://huggingface.co/amaai-lab/text2midi | code **MIT**; weights **Apache-2.0** (HF card) | 2025-02-28 | 183 | MIDI tokens (REMI-style) | End-to-end text → MIDI via a pretrained LLM encoder + decoder. Useful as a baseline/eval comparator. |
| SongComposer | https://github.com/pjlab-songcomposer/songcomposer | **Apache-2.0** (code) | 2025-05-30 | 248 | Tuples of lyric word + note/duration | ACL 2025 paper reports beating GPT-4 on lyric-to-melody tasks. The tuple format aligns lyrics and notes explicitly. |
| NotaGen | https://github.com/ElectricAlexis/NotaGen ; weights https://huggingface.co/ElectricAlexis/NotaGen | code **MIT**; weights **MIT** (HF card) | 2025-04-21 | 1,233 | Interleaved ABC | Pretrain → fine-tune → CLaMP-DPO (arXiv 2502.18008). Preference optimization with a symbolic critic improved musicality. |
| MuPT | arXiv 2404.06393 | code/weights UNVERIFIED | 2024 | n/a | Synchronized multi-track ABC | Finds that aligning bars across tracks matters for coherence. Relevant to multi-track song files. |
| MU-LLaMA | arXiv 2308.11276 | UNVERIFIED | 2023 | n/a | Audio (MERT encoder) → LLaMA | Music Q&A and captioning from audio. Early evidence that audio-LLMs can describe music. |

**Takeaways for music2-gen**
1. **Text-first symbolic formats work for LLMs:** ABC (ChatMusician, NotaGen, MuPT), pattern code (Strudel MCPs), and JSON clips (Ableton MCP). A compact, **bar-aligned** pattern file with explicit tracks is consistent with all of this evidence.
2. **Critique loops help.** ComposerX (multi-agent review) and NotaGen (critic-based DPO) both improved outputs. music2-gen's render → analyze → revise loop mirrors this.
3. **Gap / opportunity:** I found no controlled public study showing that text+vision LLMs iterate reliably from **spectrogram or piano-roll images**. Treat the PNG feedback as a diagnostic that still needs your own eval. Pair every image with **numeric text analysis** (BPM, key, LUFS, onset density, per-track note counts, clipping), which any text-only model can use. Gemini / Qwen2-Audio audio critique is plausible but unproven for iterative production feedback, so keep it optional.

---

## 4. Music analysis (MIR) usable from Node or as a CLI

| Tool | URL | License | Latest | Stars | Relevance |
|---|---|---|---|---:|---|
| **essentia.js** | https://github.com/MTG/essentia.js | **AGPL-3.0** (LICENSE file and npm) | npm 0.1.3 (2021-06-24); pushed 2025-12-10 | 868 | Most complete (key, BPM, beats, loudness, TF models). **AGPL means do not bundle** in an MIT CLI. At most, support it as an optional user-installed plugin behind a process boundary, after legal review. |
| **meyda** | https://github.com/meyda/meyda | **MIT** | v5.6.3 (2024-04-21) | 1,668 | Offline feature extraction: RMS, energy, spectral centroid/flatness/rolloff, MFCC, **chroma**, loudness (Bark-based, not LUFS). **Depend on it.** |
| aubio (CLI) | https://github.com/aubio/aubio | **GPL-3.0** | pushed 2026-04-10 | 3,761 | `aubio tempo/onset/pitch/notes`. Optional external CLI only. |
| web-audio-beat-detector | https://github.com/chrisguttandin/web-audio-beat-detector | **MIT** | 8.2.39 (2026-08-26) | 680 | BPM + offset from an AudioBuffer. Works on buffers from a Node Web Audio implementation. |
| music-tempo | https://github.com/killercrush/music-tempo | **MIT** | 1.0.3 (2017-06-17) | 138 | Beatroot-style tempo from a Float32Array. Old but self-contained. |
| bpm-detective | https://github.com/tornqvist/bpm-detective | **MIT** (npm/package.json; no LICENSE file in repo) | 2.0.5 (2021-07-26) | 147 | Simple peak-interval BPM. |
| beats-audio-api | https://github.com/JMPerez/beats-audio-api | **MIT** | 2023-11-22 | 402 | Demo-grade BPM detection. Reference only. |
| realtime-bpm-analyzer | npm | **Apache-2.0** | 5.0.15 (2026-06-18) | n/a | Realtime-oriented. Less suited to offline. |
| Key detection in JS | none maintained and permissive found (bare npm names `key-finder`, `ebur128` have no current registry record) | n/a | n/a | n/a | **Implement Krumhansl-Schmuckler (or Temperley / Albrecht-Shanahan profiles) over meyda chroma.** It is about 60 lines of code. Since music2-gen also has the symbolic score, you can report *intended key* (from the file) and *detected key* (from audio) side by side. |
| lufs (npm) | npm `lufs` | **MIT** | 0.5.25 (2024-10-17) | n/a | Candidate EBU R128 / BS.1770 implementation. Verify against the EBU test vectors before trusting it. |
| libebur128 | https://github.com/jiixyj/libebur128 | **MIT** | pushed 2023-06-25 | 491 | Reference C implementation (MIT). Port the K-weighting + gating logic (about 200 lines of code) to TS, or use it to validate. |
| `loudness` (npm) | npm | MIT | 0.4.2 | n/a | **Not audio analysis:** it controls OS output volume. Avoid the name confusion. |
| ffmpeg `ebur128`, `showspectrumpic`; sox | external | build-dependent (LGPL/GPL) | n/a | n/a | Optional validation tooling only. |
| basic-pitch (Spotify) | https://github.com/spotify/basic-pitch | **Apache-2.0** | pushed 2025-11-13 | 5,635 | Audio → MIDI transcription (a TF.js port exists). Optional "what notes actually sounded" check. |

Spectrogram rendering to PNG: STFT with `fft.js` (Hann window, 2048/512), then dB scale, then a colormap (viridis/magma LUT, which you write yourself), then `pngjs`. Add a log- or mel-frequency axis for musical readability. Render a **piano roll** directly from the parsed score events (no audio needed), coloured per track, with bar/beat grid lines. Both are fully offline with no native deps.

---

## 5. Royalty-free / CC0 drums, 808s, one-shots, GM soundfonts

Only items whose licenses I (or a subagent) read on a primary source are marked VERIFIED.

| Item | URL | License (exact) | Redistribute in npm? | Attribution | Size / format | Status |
|---|---|---|---|---|---|---|
| **Virtuosity Drums** (Versilian) | https://versilian-studios.com/virtuosity-drums/ | **CC0-1.0**. Page: "Virtuosity Drums is an open source (Creative Commons 0)" | Yes | None | ~1.1 GB, SFZ, ~1,000 samples | VERIFIED. Too big to bundle, so download on demand (or ship a hand-picked subset of one-shots). |
| **VCSL** (Versilian Community Sample Library) | https://versilian-studios.com/vcsl/ | **CC0-1.0**. "you can do whatever you want with these sounds (even make commercial software), no royalties, no credit, no special terms." | Yes | None | ~5 GB, SFZ+WAV | VERIFIED. Includes percussion. **Best source for a small bundled one-shot subset.** |
| **VSCO 2 Community Edition** | https://versilian-studios.com/vsco-community | **CC0-1.0** | Yes | None | ~3 GB, SFZ/WAV | VERIFIED. Orchestral. |
| **Karoryfer** free libraries | https://github.com/sfzinstruments (e.g. karoryfer.emilyguitar) | **CC0-1.0**. "All our free sample libraries are under a Creative Commons Zero license." | Yes | None | varies (~100 MB each) | VERIFIED. Check each archive's bundled file. |
| **uzu-drumkit** (TidalCycles) | https://github.com/tidalcycles/uzu-drumkit | **Unlicense** (GitHub SPDX) | Yes | None | small (electronic kit) | License VERIFIED via GitHub API. Size not measured. "A minimal, very nice sounding electronic drum kit made specifically for uzu's". **A strong bundle candidate for electronic drums**, but confirm the samples are the author's own recordings or synthesis. |
| **MuseScore_General (FluidR3Mono derivative)** | https://musescore.org/en/node/317991 | **MIT** ("Permission is hereby granted ... to use, copy, modify, merge, publish, distribute, sublicense, and/or sell ...") | Yes, with the MIT notice | Keep the notice | 35.9 MB SF3 / 208 MB SF2 | VERIFIED. **Best GM soundfont default** (download on demand, or bundle the SF3 if 36 MB is acceptable). |
| GeneralUser GS 1.471 | https://github.com/ad-si/GeneralUser/blob/master/LICENSE.txt | Bespoke: "Please feel free to use it in your software projects, and to modify the SoundFont bank or its packaging." | Allowed by text | Not required | 29.8 MB SF2 | VERIFIED text. The author also discloses **uncertain provenance** of some inherited samples. Secondary option. |
| Salamander Grand Piano | https://github.com/sfzinstruments/SalamanderGrandPiano | **CC-BY-3.0** | Yes, with attribution | Required | 394+ MB FLAC/SFZ | VERIFIED. Optional piano download. |
| tonejs-instruments | https://github.com/nbrosowsky/tonejs-instruments | code **MIT**; samples **CC-BY-3.0** ("SAMPLES RELEASED UNDER CC-BY 3.0") | Yes, with attribution | Required | ~1.7 GB repo | VERIFIED. On demand only. |
| Freesound CC0 sounds | https://freesound.org | Per sound: **CC0-1.0**, CC-BY-4.0, or CC-BY-NC | CC0 yes; CC-BY with credit; **never NC** | Per sound | varies | VERIFIED policy. Keep a manifest (URL, author, license, retrieval date) per file. |
| gleitz/midi-js-soundfonts | https://github.com/gleitz/midi-js-soundfonts | repo **MIT**, but its README says FluidR3 material is **CC-BY-3.0** and MusyngKite/FatBoy are **CC-BY-SA-3.0** | Only with those audio licenses honoured | Required | large | VERIFIED. Repo MIT does **not** relicense the audio. |
| TimGM6mb | (various mirrors) | **GPL-2.0** | Not clean for MIT | n/a | 5.7 MB SF2 | Avoid. |
| Sonatina Symphonic Orchestra | n/a | CC Sampling Plus 1.0 | Not clean | n/a | 503 MB | Avoid. |
| SampleSwap | https://sampleswap.org | Custom notice ("Feel free to give away these samples ... as long as you include this notice"), with **no copyright-clearance guarantee** | Risky | Notice | 9.4 GB | Avoid as a default. |
| 99Sounds | https://99sounds.org/license/ | Proprietary: "You do not have the right to sell or redistribute (even for free) the audio files ..." | **No** | n/a | varies | Excluded. |
| Legowelt packs, BPB freebies, Dirt-Samples, tidal-drum-machines (ritchse/geikha), Hydrogen kits, Arachno, Philharmonia | various | Per-kit, mixed, or not stated; drum-machine recordings have unclear provenance | UNVERIFIED | n/a | n/a | Do not bundle. Dirt-Samples has no top-level asset license. Hydrogen kits are licensed per kit, often GPL. |

**808 note:** "TR-808 samples" says nothing about who owns the recording. Freesound's own FAQ warns that sampled drum-machine/ROM sounds should not be uploaded. No CC0 pack was found that documents its 808 as **synthesized from scratch**. The cleanest answer is to **synthesize 808 bass, kicks, snares, claps, and hats procedurally** in music2-gen. Classic analog-model recipes (sine + pitch envelope + distortion for 808; bandpassed noise + tonal body for snare; six detuned square oscillators through a high-pass for hats) are fully yours under MIT. Offer CC0 sample kits as optional downloads.

---

## 6. Genre grammar references

Grid convention: one 4/4 bar = 16 steps. Beats fall on steps **1, 5, 9, 13**. These are generative defaults, not laws; sources are production guides, which vary.

| Genre | BPM (feel) | Drum grid rules | Hats / rolls | 808 / bass | Scales / harmony | Sources |
|---|---|---|---|---|---|---|
| **UK drill** | 140-150 written, felt half-time ~70-75 | Two-bar (32-step) loop. Snare/rim on step 9 of bar 1, second snare displaced late in bar 2 (commonly step 32 / step 16 of bar 2 rather than a regular backbeat). Sparse, syncopated kicks that answer gaps | 1/8 or 1/16 base with gaps. Short 1/32 or triplet (1/12, 1/24) bursts. **Tresillo** hat accents (3+3+2) | Monophonic 808 with portamento. Reserve ~2-3 controlled slides per 4 bars, often up a minor 3rd or 4th into the target | Natural/harmonic minor, Phrygian colour. 2-3 chord loops. Dark strings, piano, bells, choir | soundation.com/make-music/music-genres/how-to-make-drill ; beatstorapon.com/blog/how-to-make-a-drill-beat-bpm-808s-drums/ ; tracklib.com/blog/drill-beat |
| **NY drill** | 140-150, half-time | UK-derived half-time anchor (snare step 9). Two-bar relation, not a static one-bar loop | Fast, aggressive hats and short rolls | Long gliding 808s are central. Often sample-drill (chopped pop/R&B) | Minor, sample-led motifs | Beatstorapon; Tracklib (**sources group UK/NY slightly differently; treat as a style preset**) |
| **Chicago drill** | 60-75 felt (written 120-150 double-time) | Trap-derived. At the slow tempo, backbeat on 5 and 13 with sparse kick punches | Straight or lightly rolling 1/8-1/16 | Heavier, shorter 808s. Slides as accents | Sparse dark minor piano, bells, strings | melodigging.com/genre/drill-beats |
| **Trap** | 130-170 written (commonly 140), felt 65-85 | Half-time: clap/snare on step 9 (at the written tempo). Syncopated kicks locked to the 808 | 1/16 base. **Rolls: 1/32, 1/12 and 1/24 triplets**, with velocity ramps. Little or no swing | Tuned 808 is the bass line: root-led, occasional octave jumps, slides into targets | Minor, harmonic minor, Phrygian. 1-2 note motifs | blog.native-instruments.com/how-to-make-a-trap-beat |
| **Boom bap** | 80-100 (often 85-95) | Backbeat snare on 5 and 13. Kick on 1 plus syncopated answers (e.g. 7/8, 11, 15/16). Ghost notes. Two-bar phrases | Swung 1/8 or 1/16. **MPC swing ~54-62%** is common. Open-hat accents, no ratchets | Sampled or electric bass, not gliding 808 | Jazz/soul samples, minor vamps, ii-V fragments | splice.com/sounds/genres/boom-bap ; mpc-forums.com (swing) |
| **Lo-fi hip-hop** | 60-90 (typ. 70-85) | Minimal boom bap: snare 5 and 13, restrained kick, lazy timing (humanize ±10-30 ms) | Low-velocity swung 1/8-1/16, dropped notes | Soft electric/upright/sub bass | 7th/9th chords, slow changes, ii-V-I, iv-v-i. Tape, vinyl, wow/flutter, bitcrush | blog.native-instruments.com/lo-fi-hip-hop-beats/ |
| **House** | 120-130 (typ. 122-126) | Four-on-the-floor kick 1, 5, 9, 13. Clap on 5 and 13. **Open hat on offbeats 3, 7, 11, 15**. 1/16 closed-hat and shaker detail | Straight or lightly swung 1/16 | Repeating syncopated bassline, sidechained to the kick | Min7/maj7/dom7 voicings, I-vi-IV-V or 1-2 chord modal vamps. 909 kit canonical | en.wikipedia.org/wiki/House_music ; attackmagazine.com (Beat Dissected: 90s Jersey garage house; sidechain tutorial) |
| **Techno** | ~125-145 (typ. 128-135) | Four-on-the-floor 1, 5, 9, 13. Clap/snare on 5 and 13 optional. Offbeat open hat, 1/16 percussion evolving over 8-32 bars | Straight 1/16, rides, occasional 1/32 fills. Less swing than house | Rumble/sub or acid (303-style) sequence, often sidechained | Static minor/modal ostinatos, single-note roots, stabs. 909 kick/hats, saturation, filter automation | zipdj.com/blog/house-vs-techno ; ableton.com/en/blog/beats-dissected-diverse-drum-beat-tutorials-attack-magazine/ |

Datasets for grounding grammar and humanization:
- **Groove MIDI Dataset**: 1,150 MIDI files / 22k+ measures of human drumming, tempo-aligned, with velocity and microtiming. **CC-BY-4.0**. https://magenta.withgoogle.com/datasets/groove
- **Expanded Groove MIDI Dataset (E-GMD)**: 444 h, 43 kits including electronic ones. **CC-BY-4.0**. https://magenta.withgoogle.com/datasets/e-gmd
- **Lakh MIDI Dataset**: 176,581 MIDI files. Dataset release is **CC-BY-4.0**; underlying songs may be copyrighted. https://colinraffel.com/projects/lmd
- **POP909**: 909 pop songs with melody, accompaniment, beat, key, and chord annotations. https://arxiv.org/abs/2008.07142

Note: genre facts here come from production guides and blogs, not peer-reviewed rhythm studies. Encode them as **overridable presets plus lint warnings** (e.g. "drill preset: snare not on step 9"), not hard validation errors.

---

## 7. Open-source text-to-music models

| Model | Code repo | Code license | Weights license (HF card, as of 2026-09-28) | Latest | Stars | Hardware | Apple Silicon | Output |
|---|---|---|---|---|---:|---|---|---|
| **ACE-Step 1.5** | https://github.com/ace-step/ACE-Step-1.5 | **MIT** | **MIT** (`ACE-Step/Ace-Step1.5`) | pushed 2026-09-03; XL (4B DiT) 2026-04-02 | 12,914 | "<4GB VRAM" for the base; XL ≥12 GB (offload) / ≥20 GB recommended. "under 10 seconds on an RTX 3090" per song | **Yes, official**: README says "supports MPS / ROCm / Intel XPU / CPU", has `start_gradio_ui_macos.sh` with an **MLX (Apple Silicon)** backend, and a macOS portable package | Full songs with lyrics and vocals, cover/repaint/edit, LoRA |
| ACE-Step v1 | https://github.com/ace-step/ACE-Step | **Apache-2.0** | **Apache-2.0** (`ACE-Step/ACE-Step-v1-3.5B`) | pushed 2026-02-15 | 4,866 | CUDA-oriented | Official MPS: UNVERIFIED | Songs with vocals |
| MusicGen / AudioCraft (+JASCO) | https://github.com/facebookresearch/audiocraft | **MIT** | **CC-BY-NC-4.0** (`facebook/musicgen-small/medium`; JASCO also NC) | pushed 2026-03-03 | 23,651 | GPU. Medium (1.5B) ~16 GB | No official MPS path found (UNVERIFIED) | ~30 s instrumental clips. Melody/chord/drum conditioning (JASCO) |
| Stable Audio Open 1.0 / Small | https://github.com/Stability-AI/stable-audio-tools | **MIT** | **Stability AI Community License** (`other` / `stable-audio-community`), **gated** | tools pushed 2026-09-18 | 3,870 | GPU. Minimum VRAM not stated officially | Official MPS UNVERIFIED | Up to 47 s stereo 44.1 kHz; good for one-shots/loops/SFX. No vocals |
| **YuE2** (current main) | https://github.com/multimodal-art-projection/YuE | **Apache-2.0** | **CC-BY-NC-4.0 "with additional creator permission"**; commercial use by companies requires contacting the authors | release yue2-v0.1.6 (2026-09-09); pushed 2026-09-27 | 10,382 | "Linux · Python 3.12 · NVIDIA GPU with BF16 support and **24 GB VRAM**" | No (not supported officially) | 48 kHz stereo full songs with vocals. Emits editable ABC melody/chord plans |
| YuE v1 (branch `YuE-v1`) | same repo, branch YuE-v1 | Apache-2.0 | **Apache-2.0** per HF card `m-a-p/YuE-s1-7B-anneal-en-cot` (subagent reported CC-BY-NC; the HF API card says apache-2.0, so check the exact checkpoint) | HF 2025-03-12 | n/a | 24 GB+ class GPU | UNVERIFIED | Lyrics-to-song, minutes long |
| **DiffRhythm 1.2** | https://github.com/ASLP-lab/DiffRhythm | **Apache-2.0** | README: "DiffRhythm (code and DiT weights) is released under the Apache License 2.0". **But** the HF card `ASLP-lab/DiffRhythm-full` lists `license: apache-2.0` *and* `license_name: stable-audio-community`, which suggests the bundled VAE/components carry Stability terms. Review before commercial use | pushed 2025-11-27 | 2,348 | "minimum of 8G of VRAM" with `--chunked` | **Yes**: README "2025.3.11 DiffRhythm can now run on MacOS!" with macOS install steps | 95 s base / 285 s full songs with vocals |
| **SongGeneration / LeVo 2** (Tencent AI Lab) | https://github.com/tencent-ailab/SongGeneration (**returned HTTP 404 on 2026-09-28**; a mirror exists at https://github.com/levo-demo/LeVo) | Custom Tencent license (NOASSERTION): "You agree to use the SongGeneration only for academic, research and education purposes, and refrain from using it for any commercial or production purposes under any circumstances." | Same custom **non-commercial** terms cover "inference-enabling code and the weights" (weights at https://huggingface.co/lglg666/SongGeneration-v2-large, updated 2026-03-09) | v2-large 2026-03-01 | ~1.6k before removal (per search capture) | 10-28 GB GPU depending on model and prompt audio; CUDA ≥ 11.8 | No official path. Community MLX port `CharafChnioune/SongGeneration-Studio-MLX` (4 stars; UNVERIFIED) | Up to 4m30s, multilingual, vocals + accompaniment, dual-track output |
| **Magenta RealTime 2** | https://github.com/magenta/magenta-realtime | **Apache-2.0** | **CC-BY-4.0** (`google/magenta-realtime-2`) | pushed 2026-09-13 | 1,807 | Offline inference on NVIDIA or Mac | **First-class**: "Real-time streaming requires Apple Silicon". `mrt2_small` (230M) real-time on any M-series. JAX + MLX backends + C++ core | Streaming instrumental music, text/audio prompts. No lyrics |
| HeartMuLa | https://github.com/HeartMuLa/heartlib | **Apache-2.0** | **Apache-2.0** (`HeartMuLa/HeartMuLa-oss-3B`) | pushed 2026-09-26 | 3,822 | GPU (3B). Official VRAM UNVERIFIED | Community ComfyUI port only (UNVERIFIED) | Multilingual lyric + tag conditioned songs with vocals |

**Relevance:** these generate audio end to end and bypass the pattern file entirely. For music2-gen, the viable roles are optional: (a) **reference/"target" audio** for comparison, (b) **one-shot/texture generation** (Stable Audio Open for sample creation, subject to its license), or (c) a separate "render with model" backend. Only **ACE-Step 1.5 (MIT/MIT)**, **ACE-Step v1 (Apache/Apache)**, **HeartMuLa (Apache/Apache)**, and **Magenta RT 2 (Apache / CC-BY-4.0)** are clean for commercial use without negotiation. Of those, ACE-Step 1.5 and Magenta RT 2 officially run on Apple Silicon.

---

## Recommendations for music2-gen

### Depend on (MIT/BSD/Apache, maintained, Node-native)
1. **Rendering core:** `web-audio-api` (MIT, pure JS, OfflineAudioContext + AudioWorklet, no native build) as the default. Optionally, `node-web-audio-api` (BSD-3-Clause, Rust, prebuilt) as a `--engine native` fast path after a soak test against issue #202 (worklet lifecycle leak).
2. **Instruments:** your own procedural synth voices (808, kick, snare, clap, hats, bass, pads) on top of Web Audio nodes or `@thi.ng/dsp` (Apache-2.0). Optionally, `Tone.js` (MIT) via the `web-audio-api` polyfill for richer synths and effects.
3. **General MIDI / melodic instruments:** `spessasynth_core` (Apache-2.0, offline SF2/SF3 in pure JS) plus **MuseScore_General SF3 (MIT)** downloaded on demand, with SHA-256 pinning.
4. **Theory and validation:** `tonal` (MIT) for scales, chords, keys, and Roman numerals.
5. **MIDI export:** `@tonejs/midi` or `midi-writer-js` (MIT).
6. **Analysis:** `meyda` (MIT) for RMS, chroma, spectral features, and onset strength; `web-audio-beat-detector` (MIT) or `music-tempo` (MIT) for BPM.
7. **Images:** `fft.js` + `pngjs` (both MIT, pure JS) for spectrograms and piano rolls. Add `@napi-rs/canvas` (MIT, prebuilt) only if you want labelled axes and text.
8. **Optional symbolic import:** `abcjs` (MIT) to accept ABC melodies. This is the most LLM-proven notation (ChatMusician, NotaGen).

### Reimplement yourself (license or quality reasons)
1. **Mini-notation / pattern language:** write a **clean-room PEG grammar from the public Tidal docs** (the mini-notation table). Do **not** read or port Strudel (AGPL-3.0-or-later) or Tidal (GPL-3.0) source. Tidal's README explicitly treats source-referencing ports as derivative works. Also consider a simpler, bar-aligned, multi-track format (MuPT's finding) with explicit step grids (`x..x..x.`), since LLMs count steps more reliably than they nest cycle algebra.
2. **Key detection:** Krumhansl-Schmuckler over meyda chroma (about 60 lines of code). Report *intended key* (from the score) and *detected key* side by side.
3. **LUFS / EBU R128:** port BS.1770 K-weighting + gating (reference: libebur128, MIT) and validate against the EBU test set. Do not trust unvalidated npm `lufs`.
4. **WAV writer:** a trivial RIFF writer. Avoid stale deps (`wav-encoder`, 2017).
5. **Drum and 808 sounds:** procedural synthesis, so the default package ships **zero third-party audio**. Optional downloadable kits: VCSL / Virtuosity (CC0) and uzu-drumkit (Unlicense). Record the license, source URL, and hash in a manifest per kit.
6. **Genre grammars:** encode section 6 as **presets + lint rules** (e.g. `drill.snare_on_step_9`, `trap.hat_roll_subdivisions: [1/32, 1/24, 1/12]`, `house.offbeat_open_hat`) that produce text warnings the LLM can act on.

### Avoid
- **Strudel / superdough / @strudel/* / Kabelsalat / live-coding-music-mcp** as dependencies (AGPL-3.0). karmaterminal/strudel-music is MIT on its face but pulls AGPL packages, so do not copy its runtime.
- **essentia.js** bundled (AGPL-3.0). Allow at most a user-installed optional plugin, after legal review.
- **aubio, SuperCollider, LilyPond, TiMidity, Renardo, Vortex, Tranquility/Modal, cycles crate** as linked code (GPL). External-process-only, optional, never required.
- **Sample sources with unclear redistribution rights:** 99Sounds (explicitly forbids redistribution), SampleSwap, Legowelt, Dirt-Samples, tidal-drum-machines, Hydrogen kits without a per-kit check, `gleitz/midi-js-soundfonts` audio as "MIT", TimGM6mb (GPL-2.0), Sonatina (CC Sampling Plus), and any "TR-808 samples" of unknown recording provenance.
- **Non-commercial or restricted model weights** in any default path: MusicGen/JASCO (CC-BY-NC-4.0), YuE2 (CC-BY-NC-4.0 + creator permission), SongGeneration/LeVo (academic-only), Stable Audio Open (Stability Community License, gated). DiffRhythm needs a check on its `stable-audio-community` component.
- **Browser/Playwright rendering** (the live-coding-music-mcp approach). It is the dependency music2-gen exists to remove.

### Design notes from the evidence
- Always emit a **text analysis report** next to the PNGs (BPM, detected vs intended key, LUFS, true-peak/clipping, per-track density, section map, lint warnings). No study was found that proves text+vision models iterate well from spectrograms alone.
- Keep the **audio critique (Gemini etc.) optional and pluggable**. It is promising but unvalidated for iterative production feedback. This is a good place for music2-gen to publish its own small eval.
- Pin every downloaded asset by URL + SHA-256 + license string in a `THIRD_PARTY_ASSETS.md`/manifest, so the MIT package never silently carries non-MIT audio.

---

## Sources

Languages / engines
- https://codeberg.org/uzu/strudel ; https://github.com/tidalcycles/strudel ; https://www.npmjs.com/package/@strudel/core ; https://www.npmjs.com/package/superdough
- https://codeberg.org/uzu/tidal ; https://github.com/tidalcycles/Tidal (README license/derivative-work note)
- https://tidalcycles.org/docs/reference/mini_notation ; https://tidalcycles.org/docs/resource/Friends_and_relations/
- https://github.com/sonic-pi-net/sonic-pi (LICENSE.md) ; https://github.com/supercollider/supercollider ; https://github.com/csound/csound ; https://github.com/ccrma/chuck (README dual license)
- https://github.com/chaosprint/glicol ; https://github.com/Qirky/FoxDot ; https://github.com/e-lie/renardo ; https://github.com/grame-cncm/faust
- https://github.com/Tonejs/Tone.js ; https://github.com/alda-lang/alda ; https://github.com/paulrosen/abcjs ; https://github.com/lilypond/lilypond
- https://github.com/ideoforms/isobar ; https://github.com/scribbletune/scribbletune ; https://github.com/tonaljs/tonal
- https://github.com/gibber-cc/tidal.pegjs ; https://github.com/Mdashdotdashn/krill ; https://github.com/mitchmindtree/cycles ; https://codeberg.org/uzu/vortex ; https://github.com/XiNNiW/tranquility ; https://github.com/neo451/modal ; https://github.com/felixroos/kabelsalat

Rendering / audio in Node
- https://github.com/audiojs/web-audio-api ; https://www.npmjs.com/package/web-audio-api
- https://github.com/ircam-ismm/node-web-audio-api ; https://github.com/ircam-ismm/node-web-audio-api/issues/202 ; https://github.com/orottier/web-audio-api-rs
- https://github.com/mohayonao/web-audio-engine ; https://github.com/chrisguttandin/standardized-audio-context
- https://github.com/spessasus/spessasynth_core ; https://github.com/jet2jet/js-synthesizer ; https://github.com/FluidSynth/fluidsynth ; https://github.com/elemaudio/elementary ; https://github.com/thi-ng/umbrella ; https://github.com/danigb/smplr
- https://github.com/rochars/wavefile ; https://github.com/grimmdude/MidiWriterJS ; https://github.com/Tonejs/Midi
- https://www.npmjs.com/package/pngjs ; https://www.npmjs.com/package/fft.js ; https://www.npmjs.com/package/@napi-rs/canvas ; https://www.npmjs.com/package/sharp

LLM composition / MCP
- https://github.com/karmaterminal/strudel-music ; https://github.com/williamzujkowski/live-coding-music-mcp ; https://github.com/phildougherty/strudel-mcp-bridge ; https://github.com/ahujasid/ableton-mcp ; https://github.com/MusicLang/musiclang
- https://github.com/hf-lin/ChatMusician ; https://huggingface.co/m-a-p/ChatMusician ; https://arxiv.org/abs/2402.16153
- https://github.com/lllindsey0615/ComposerX ; https://arxiv.org/abs/2404.18081
- https://github.com/microsoft/muzic ; https://github.com/AMAAI-Lab/Text2midi ; https://huggingface.co/amaai-lab/text2midi
- https://github.com/pjlab-songcomposer/songcomposer ; https://aclanthology.org/2025.acl-long.352
- https://github.com/ElectricAlexis/NotaGen ; https://huggingface.co/ElectricAlexis/NotaGen ; https://arxiv.org/abs/2502.18008
- https://arxiv.org/abs/2404.06393 (MuPT) ; https://arxiv.org/abs/2308.11276 (MU-LLaMA)

MIR
- https://github.com/MTG/essentia.js ; https://github.com/meyda/meyda ; https://github.com/aubio/aubio ; https://github.com/chrisguttandin/web-audio-beat-detector ; https://github.com/killercrush/music-tempo ; https://github.com/tornqvist/bpm-detective ; https://github.com/JMPerez/beats-audio-api ; https://github.com/jiixyj/libebur128 ; https://www.npmjs.com/package/lufs ; https://github.com/spotify/basic-pitch

Samples / soundfonts
- https://versilian-studios.com/virtuosity-drums/ ; https://versilian-studios.com/vcsl/ ; https://versilian-studios.com/vsco-community
- https://github.com/sfzinstruments/karoryfer.emilyguitar ; https://github.com/sfzinstruments/SalamanderGrandPiano ; https://github.com/tidalcycles/uzu-drumkit
- https://musescore.org/en/node/317991 ; https://github.com/ad-si/GeneralUser/blob/master/LICENSE.txt ; https://github.com/nbrosowsky/tonejs-instruments ; https://github.com/gleitz/midi-js-soundfonts
- https://freesound.org/help/faq/ ; https://sampleswap.org/SAMPLESWAP/%20%20LEGAL%20LICENSE%20INFO%20READ%20ME.html ; https://99sounds.org/license/ ; http://legowelt.org/drumwizardrysamplepack

Genre grammar
- https://soundation.com/make-music/music-genres/how-to-make-drill ; https://beatstorapon.com/blog/how-to-make-a-drill-beat-bpm-808s-drums/ ; https://www.tracklib.com/blog/drill-beat ; https://www.melodigging.com/genre/drill-beats
- https://blog.native-instruments.com/how-to-make-a-trap-beat ; https://blog.native-instruments.com/lo-fi-hip-hop-beats/ ; https://splice.com/sounds/genres/boom-bap/packs ; https://www.mpc-forums.com/viewtopic.php?p=1761071
- https://en.wikipedia.org/wiki/House_music ; https://www.attackmagazine.com/technique/beat-dissected/90s-jersey-garage-house/ ; https://www.attackmagazine.com/technique/video-tutorials/ableton-sidechain-compression/ ; https://www.zipdj.com/blog/house-vs-techno ; https://www.ableton.com/en/blog/beats-dissected-diverse-drum-beat-tutorials-attack-magazine/
- https://magenta.withgoogle.com/datasets/groove ; https://magenta.withgoogle.com/datasets/e-gmd ; https://colinraffel.com/projects/lmd ; https://arxiv.org/abs/2008.07142

Text-to-music models
- https://github.com/ace-step/ACE-Step-1.5 ; https://huggingface.co/ACE-Step/Ace-Step1.5 ; https://github.com/ace-step/ACE-Step ; https://huggingface.co/ACE-Step/ACE-Step-v1-3.5B
- https://github.com/facebookresearch/audiocraft ; https://huggingface.co/facebook/musicgen-medium
- https://github.com/Stability-AI/stable-audio-tools ; https://huggingface.co/stabilityai/stable-audio-open-1.0 ; https://huggingface.co/stabilityai/stable-audio-open-small
- https://github.com/multimodal-art-projection/YuE ; https://huggingface.co/m-a-p/YuE-s1-7B-anneal-en-cot
- https://github.com/ASLP-lab/DiffRhythm ; https://huggingface.co/ASLP-lab/DiffRhythm-full
- https://github.com/tencent-ailab/SongGeneration (404 at snapshot) ; https://github.com/levo-demo/LeVo ; https://huggingface.co/spaces/tencent/SongGeneration/blob/main/LICENSE ; https://huggingface.co/lglg666/SongGeneration-v2-large ; https://github.com/vllm-project/vllm-omni/issues/3390 ; https://arxiv.org/abs/2506.07520
- https://github.com/magenta/magenta-realtime ; https://huggingface.co/google/magenta-realtime-2 ; https://github.com/HeartMuLa/heartlib ; https://huggingface.co/HeartMuLa/HeartMuLa-oss-3B

## Method notes and known gaps
- Repo metadata (license SPDX, stars, pushed date, latest release) came from `gh api repos/...` read-only GETs. npm license and dates came from `registry.npmjs.org`. Weights licenses came from the `huggingface.co/api/models/...` cardData.
- Four parallel research subagents covered sections 2/4, 3/7, 5, and 6. I re-verified their key claims against primary sources and corrected two: YuE v1 weights (the HF card says apache-2.0) and the SongGeneration repo (it exists, but returned 404 at snapshot).
- Unverified or not attempted: official MPS support for ACE-Step v1, MusicGen, and Stable Audio Open; exact SPDX for LeVo (custom text); `cfogelklou/midi-mcp` (reported by a subagent, but it returned 404 on my check, so it is omitted); uzu-drumkit sample provenance and size; `lufs` accuracy.
- Genre facts rely on production guides and blogs, not peer-reviewed studies. Treat them as presets.
