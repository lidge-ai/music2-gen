# 001 — Architect dispositions

| # | Architect point | Disposition |
|---|---|---|
| D1 | Keep `user:<id>`; resolve `$MUSIC2_HOME/instruments/<id>` with `confinedRealpath`; kit loader and kit MIDI metadata both confine to the song dir today | Accepted. 010 adds an explicit root to `loadKit` and the kit metadata loader, and dispatches `user:` in `loadSampleInstrument`, `song-daw.schema.ts` validation, the conditional DAW validation call in `song.schema.ts`, and `voices/registry.tool.ts` sampled checks. |
| D2 | Lint has no `info` severity | Accepted. 020 adds `info` to `LintResult` with explicit ordering error < warning < info; `--strict` keeps failing only on errors and warnings; JSON gains an `infos` count. The rule itself lands in 040. |
| D3 | Built-in drum atoms are `bd sd cp hh oh rim perc tom`; custom kits accept other names | Accepted. Kit import maps to the built-in atoms where possible and adds `cr`, `rd` as extra kit names; layer `only` filters are validated against the layer's own instrument. |
| D4 | Registry is flat; follow the `export` manual subcommand dispatch; help takes one topic | Accepted. One `library` command dispatching on `args[0]`; usage text lists subcommands; no nested help parser. |
| D5 | Balance should call `renderSong(..., {stems:true})`; layer attribution needs taps before shared track FX; automated gain replaces static gain | Accepted. 030 measures post-fader stems for tracks and pre-track-FX taps for layers; `--apply` skips tracks with a gain automation lane and reports them. |
| D6 | Track `transpose` exists (±24); compose layer transpose additively; reject drum transpose | Accepted. |
| D7 | Insert layered source before shared processing in automation, tape pre-roll and static paths; extend pre-roll detection; per-voice release limits; main param automation must not leak | Accepted. Layer source rendering lives in `src/render/layers.tool.ts`; `mixer.tool.ts` (429 lines) only calls it. |
| D8 | Section roles are `hook`/`groove`; user-instrument roles; ProjectIR must keep `user:` identity | Accepted. The 040 rule uses `hook` and `groove`. `instrument.json` may carry a `role` hint, but lint stays file-free and treats `user:` like `sfz:`/`kit:`. ProjectIR classifies `user:` as sampled with a portability warning. |
| Risk | mixer 429 and song.schema 393 lines; structure audit hard cap 500 | Split before growing: layer schema in `src/song/song-layers.schema.ts`, layer render in `src/render/layers.tool.ts`. |
