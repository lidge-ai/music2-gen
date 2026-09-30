# 041 — wp5 stale check and dispatch

Previous D (wp4): balance shipped in bdf07be + b351ac8 (suite 1129 pass); real Logic song measured per track, main and layer taps. Direction unchanged: 040 with folds (B1, B10, R2-3).

## Scope

G1 guidance (docs only):
- `skills/music2/SKILL.md`: add the Logic guide to the reference list; new workflow steps. After step 1 (extract request): **Source sounds** — run `music2 library scan --json`; when roots exist, `library find` the needed kick/snare/clap/hat kit and the pitched parts (pads, keys, bass, plucks, vocal textures), `library import <folder> --id <id>` (kits `--as kit`), `library verify <id>` for pitched imports, and reference `user:<id>`; when absent, use built-in voices and `lib:`; never copy Apple samples into a repository or share them. After writing the song: **Plan layers** — a role table (kick: punch/click + body or sub; snare/clap: body + crack + clap; bass: sub (sine/triangle-ish, mono, centred) + mid harmonic layer (drive or supersaw, high-passed with the `filter` insert) + optional top; lead: main + octave or unison texture + sampled double; chords/pad: synth + sampled pad or strings; hats: closed + shaker/texture), "one low owner" still applies (only the sub layer carries the fundamental), start layer gains 6–12 dB under the main. After the first render: **Balance** — `music2 balance song.json --section <peak> --reference kick --target ... --apply`, then rerender and analyze. Keep SKILL.md concise (≤ ~115 lines) and keep every existing assertion in `tests/e2e/skill-docs.test.ts` passing (read that test first).
- `skills/music2/references/logic-library.md`: carry PR #5's guide (branch `codex/virtual-instruments-guide`, commit 46b947c; read it with `git show 46b947c:skills/music2/references/logic-library.md`) but rewrite around the commands: content map table, licence section (keep it), `scan/find/import/verify` walkthrough with real-looking JSON fields, pitch caveats (Alchemy names off by octaves; import measures each file; `--octave` override; verify), kit mapping table (atom words, variants `bd:1`), route table (add `user:`), traps table updated (AIFF now imported; CAF/EXS not supported), what stays manual (CAF/Apple Loops need ffmpeg conversion first; slicing via `music2 slice`). Drop the hand-written scripts. No personal absolute paths other than the standard `/Library/...` Apple locations.
- `skills/music2/references/instruments.md`: carry PR #5's "Which instrument for what" decision table (`git show 46b947c:skills/music2/references/instruments.md`), adapted to Bun commands, plus rows for `user:<id>` and a short `layers` section; carry its closing "Logic and GarageBand libraries" pointer.
- `skills/music2/references/layering.md`: new section "Stack layers inside a role" with two JSON examples (bass stack, kick/clap stack) using valid params, the `only` filter, gain starting points, and how `generic/thin_peak_layers` (info) reads.
- `README.md`: feature bullets for library import, layers, balance.

G2 code:
- NEW `src/recipes/lint-layers.tool.ts` + test: `generic/thin_peak_layers`, severity `info`: when the song has at least one `hook` or `groove` section, each track that is audible in such a section, has no layers, and is a kick-role (drums/kit/user drums track whose events there include `bd`), backbeat-role (`sd`/`cp`), bass-role (`bass`/`808` instrument) or the first melody track (`melodyTrackIds`) yields one info at `tracks[i]` with observed "no layers in <section ids>", expected "≥1 layer", fix pointing at `layers`. Wire into `src/recipes/lint.tool.ts`. Tests: info for unlayered bass in a groove; none when layered; none without hook/groove; strict lint exit 0 with only infos.
- NEW `examples/layered-drop.song.json`: built-in voices only; layered kick (drums + drums kit variant sub filtered `only:["bd"]`), snare+clap stack, three-layer bass (with duck on kick for house/techno), lead with octave layer, pad; genre techno or house; passes `lint --strict` with zero warnings (infos allowed only if intended; ideally zero), validates, renders; add it to whatever examples list tests iterate if that list is explicit.
- `devlog/str_func/recipes.md`.

The coordinator recaptures legacy lint digests after G2 (only lint JSON may change) and runs the agent exercise at C.

## Reflection fixes (architect: ALIGNED with fixes)

1. **Examples test.** G2 owns `tests/e2e/examples.test.ts`: keep zero errors and warnings, allow infos only from `generic/thin_peak_layers` (assert nothing else), and add `layered-drop` (genre `house`) to its explicit case list.
2. **Rule definition.** Peak sections are arranged placements whose section role is `hook` or `groove`. A track is audible there when it has at least one event with velocity > 0 in those bars (use `eventsAt`). Roles: kick-role when those events include `isKick`, backbeat-role when they include `isBackbeat`, bass-role for `isBassInstrument`, and melody-role for the first id of `melodyTrackIds` that is audible in a peak. `g.full` is not required. One info per track, observed lists unique section ids in arrangement order.
3. **Skill-docs test.** G2 owns `tests/e2e/skill-docs.test.ts`: add `references/layering.md` and `references/logic-library.md` to its document list and validate their JSON examples. G1 keeps the existing assertions true: the instruments voice table must still list exactly the built-in voices, and standalone track examples stay one per voice; `user:`/layer examples go in separate tables or full-song JSON.
4. **mixing.md.** G1 owns `skills/music2/references/mixing.md` and aligns layer-gain advice with `balance` semantics (layer targets relative to the track's main source).
5. **Legacy digests.** The coordinator refreshes only existing lint digests and confirms render/stem/validate/events hashes are untouched; the new example needs no legacy entry.

## Audit fold (A round 1)

- **Loop songs.** The Balance step in SKILL.md and mixing.md applies to non-loop songs only; `music2 balance` rejects `loop: true` songs before window selection. For loop songs keep render/analyze and adjust gains by hand. Do not suggest `--bars` as a workaround.
