# 040 — wp5: guidance, Logic guide carry, thin-layer info rule, example

## Outcome

The skill makes sourcing and stacking part of the default workflow: before composing, check `music2 library scan`; when Apple content exists, import the kit and the pitched instruments the request needs and use `user:<id>`; write a layer plan per role; after the first render use `music2 balance`. PR #5's Logic guide is carried onto dev and rewritten around the new commands.

## Diff-level contract

MOD `skills/music2/SKILL.md`: new workflow steps "Source sounds" (library scan/find/import/verify; licence note: never commit copies) and "Plan layers" (role table: kick = punch + body/sub; snare/clap = body + crack + clap; bass = sub (sine/triangle, mono, centred) + mid harmonic layer (drive/supersaw, an octave up, high-passed by voicing) + optional top; lead = main + octave/unison texture + sampled doubling; pad/chords = synth + sampled pad or strings; hats = closed + shaker/texture) with "one low owner" preserved; step "Balance" using `music2 balance`. Keep the file concise (≤ ~110 lines).
NEW/CARRY `skills/music2/references/logic-library.md` from PR #5 (commit 46b947c on `codex/virtual-instruments-guide`), updated: the hand scripts become `music2 library` commands; keep the content map, licence section, pitch caveats and route table (add `user:`).
MOD `skills/music2/references/instruments.md`: carry PR #5 decision table and add `user:<id>` and `layers`.
MOD `skills/music2/references/layering.md`: new "Stack layers inside a role" section with JSON examples and gain starting points, and how `generic/thin_peak_layers` reads.
MOD `skills/music2/references/mixing.md`: "Match levels with music2 balance".
NEW `src/recipes/lint-layers.tool.ts` (+ test): `generic/thin_peak_layers`, severity `info`: in songs with at least one `hook` or `groove` section, each audible kick-, snare/clap-, bass/808- or lead-role track with no layers yields one info (path `tracks[i]`), fix text points to `layers`. Wire into `src/recipes/lint.tool.ts`.
NEW `examples/layered-drop.song.json`: built-in voices only; layered kick, snare/clap, bass and lead; passes `lint --strict` with zero warnings and renders.
MOD `tests/e2e/skill-docs.test.ts` only if its constraints require (keep existing assertions).
MOD `README.md` feature list, `devlog/str_func/recipes.md`.

## Tests

Rule emits info for unlayered bass in a groove section, nothing when layered or when no peak section exists; strict lint on all existing examples still passes; skill-docs test passes; example renders.


## Audit fold (A round 1)

- **B1.** The thin-layer rule counts `user:` kits as drum roles and `user:` notes as melody candidates (via the lint-role changes in 010).
- **B10 agent exercise.** At C, a fresh sol subagent that receives only the installed skill (no conversation context) composes a 16-bar club loop on this Mac with MUSIC2_HOME under /tmp. Pass when its transcript shows `library scan/import/verify`, at least two tracks with `layers`, one `balance` run, and no handwritten SFZ builder or gain-calibration script. Evidence stored as `devlog/_plan/260930_layer_logic/evidence/agent-exercise.md` (paths redacted, no audio committed).
- Guidance uses the `filter` insert (highpass) for the mid layer; an octave-up voicing is not a high-pass.

## Audit fold (A round 2)

- **R2-3 agent exercise pass criteria.** The composed song must reference at least two `user:` instruments imported during that exercise; `render` must exit 0; `balance --json` must exit 0 and report every declared layer row with a non-null `rmsDb` no more than 30 dB below its `.main` row (a silent or negligible layer fails); and the transcript must show no handwritten SFZ builder, pitch checker or gain-calibration script. The redacted report and the balance JSON go into the evidence file; no audio is committed.
