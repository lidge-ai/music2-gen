# 001 — Open-source landscape and dependency decisions

**Answer first.** Nothing on npm gives an MIT, browser-free, agent-friendly music pipeline today. The pattern
languages that LLMs already know (Strudel/Tidal mini-notation) are AGPL or GPL, the Node Web Audio ports carry
worklet and packaging risk, and every MIR package we would want is either unvalidated (`lufs`) or AGPL
(`essentia.js`). The PoC showed that a few hundred lines of plain TypeScript cover synthesis, mixing and WAV output
in well under a second. So music2 depends on nothing at runtime and reimplements the four pieces that matter:
a clean-room mini-notation engine (004), procedural voices (020), BS.1770 loudness plus tempo/key/band analysis
(005, 030), and a PNG encoder (030).

Full report: evidence/aside-landscape-report.md (Aside exec, account u0, 2026-09-28, public web only; 326 lines,
sections 1–7 with license per project and a source list). This document records main's decisions on it.

## What the report found, and what music2 does with it

| Area | Finding (report section) | music2 decision |
|---|---|---|
| Pattern languages | Strudel, superdough, @strudel/*, kabelsalat: AGPL-3.0-or-later; Tidal GPL-3.0 and its README treats source-referencing ports as derivative works; no maintained permissive mini-notation parser (tidal.pegjs and krill are stale) (§1) | Clean-room implementation from public docs only (004). No agent on this project reads Strudel/Tidal source |
| LLM-friendly format | MuPT and ChatMusician results: models count bar-aligned steps more reliably than nested cycle algebra; ABC is the most LLM-proven notation (§3) | Recipes and the skill teach **flat 16-step bar strings** (`bd ~ ~ ~ ...`) as the default style, nesting only for rolls. `music2 events` shows the model exactly what its string produced. ABC import is deferred (not v0.1) |
| Node rendering | `web-audio-api` (MIT, pure JS) and `node-web-audio-api` (BSD-3, native, worklet leak issue #202) exist (§2) | Not used: a hand-written deterministic engine is smaller, byte-reproducible across runs and has no native build. Revisit only if users ask for Tone.js compatibility |
| Soundfonts / GM | `spessasynth_core` (Apache-2.0) + MuseScore_General SF3 (MIT) would give General MIDI instruments (§2, §5) | Deferred to a later version behind an optional download; v0.1 voices are procedural |
| Samples | Only VCSL / Virtuosity Drums (CC0) and uzu-drumkit (Unlicense) are clean; 99Sounds forbids redistribution; many "808 packs" have unknown provenance (§5) | Package ships **zero third-party audio**. Users may point a track at their own `kit.json` (020); docs list the clean kits with their licenses |
| MIR | meyda, music-tempo, web-audio-beat-detector are MIT; `lufs` unvalidated; essentia.js AGPL; aubio GPL (§4) | Own implementations validated against EBU Tech 3341/3342 vectors (005) |
| Images | pngjs + fft.js would work; no study shows vision models improve music from spectrograms alone (§2, design notes) | Own PNG encoder and FFT; always emit **analysis.md** (numbers, sections, lint warnings) beside the two PNGs so text-only models are first-class |
| Audio critics | Promising but unvalidated for iterative feedback (design notes) | Optional `music2 critique`, advisory only (002). Our probe is n = 2, so no quality claims in docs |
| Text-to-music models | Commercially clean: ACE-Step 1.5 (MIT code and weights), Magenta RT 2 (Apache/CC-BY), HeartMuLa; MusicGen, YuE, Stable Audio Open, SongGeneration are non-commercial or gated (§7) | Out of scope for v0.1. README names ACE-Step 1.5 as the path for vocals/realistic timbre and keeps music2 as the symbolic, controllable layer |
| Genre grammar | Production-guide sources, not peer reviewed (§6) | Recipes are presets + **warning-level** lint rules (006, 040) |

## Deferred ideas worth keeping

- ABC or MIDI import/export (`@tonejs/midi` is MIT) so songs can move into a DAW.
- Optional CC0 kit download with URL + SHA-256 + license manifest (`THIRD_PARTY_ASSETS.md`).
- A small published eval: does a text+image model's revision loop improve lint/analysis scores? music2's JSON
  outputs make this measurable.

