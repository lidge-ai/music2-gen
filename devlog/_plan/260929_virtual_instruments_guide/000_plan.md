# Virtual instruments and Logic library guide

Work class: C2 (documentation only, no source change). One work-phase, one PABCD cycle.

## Problem

The Frostline set showed that music2 can use Logic Pro / GarageBand sample content through sfz: and kit:, but the
route has several silent traps (octave-mislabelled Alchemy files, missing RIFF pad bytes, AIFF and extensible WAV
rejection) and the skill documents none of it. The next agent repeats every failure. instruments.md also has no
decision table: it lists voices but not when to pick built-in, lib:, sfz:, kit:, sfx, plugins or a DAW export.

## Diff-level plan

| File | Change | Owner |
| --- | --- | --- |
| skills/music2/references/logic-library.md | New. Locate content, verify octaves, clean WAVs, convert AIFF/CAF, build SFZ and kit.json, calibrate stems, render sequentially or sharded, list song-JSON pitfalls, licensing note | Subagent A |
| skills/music2/references/instruments.md | Add a which-instrument decision table and a short pointer to logic-library.md | Subagent B |
| skills/music2/SKILL.md | Link logic-library.md in the reference list | Subagent B |
| devlog/_plan/260929_virtual_instruments_guide/ | This plan, audit and delivery record | main |

Write scopes are disjoint. Subagents do not run git, do not write inside the repo except their own files, and put all
scratch work under a fresh directory in the system temp folder. Main owns branch, commits, push and PR.

## Rules for the text

- English, relative links, no personal absolute paths (system paths such as /Library/Application Support/Logic are fine).
- Every command shown was run here. Record what failed as a limitation.
- No Logic audio or derivative in the repo. State that Apple content is licensed for use in your own music and is not
  redistributable as a sample library; say that the reader should check the licence text on their install.
- Keep files near 400 lines or fewer.

## Verification

1. Subagents return the commands they ran with exit codes and observed output tails.
2. Main re-runs a sample of them (octave probe on one Alchemy file, SFZ render, kit render).
3. npm run typecheck, lint, test, build, audit:structure. rg for /Users/ in the diff. Link check for new relative links.

## Out of scope

Source changes such as a render --jobs option or an import command. They are worth a follow-up unit and are named in
the guide only as ideas.

