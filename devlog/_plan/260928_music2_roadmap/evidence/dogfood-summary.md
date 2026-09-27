# Dogfood: blind text-only composition (wp6, 2026-09-28)

**Result.** A text-only sol subagent that could read only `skills/music2/**` turned the prompt "Make a 90 BPM boom bap beat in D minor
with a dusty keys loop" into examples/dogfood/boom-bap-dogfood.song.json ("Dust on the Needles": 22 bars, 90 BPM, D minor, seed 901;
tracks kick, snare, hats, bass, keys, rim; sections intro 2, verse 4, hook 4, break 2, outro 2; arrangement
intro-verse-hook-break-verse-hook-outro). Final `lint --strict`: 0 errors, 0 warnings. Final analyze: declared 90 / estimated 89.92 BPM,
declared D minor / estimated F major at confidence 0.34 (advisory; event pitches and lint agree with D minor), -14.90 LUFS, -1.77 dBTP
true-peak estimate, 0 clipped samples, no warnings. It exported WAV + MP3 after `doctor`. Only 1 of its 6 track patterns (the straight
eighth hat line) matches examples/boom-bap-90.song.json, so the song is not a copy.

**Setup.** Model route: gpt-6-sol subagent (text in/out; no audio, no image input). Supplied files: skills/music2/SKILL.md and
references/*.md only; the packet forbade reading src/, examples/, devlog/, docs/, README.md and tests/. CLI invoked as
`node src/cli/index.ts`. Scratch outputs in /tmp only; one repository write (the song file).

**Process (43 commands; all exit 0 except two strict lint runs that exited 6).** Read SKILL.md, then prompts, genres, mini-notation,
instruments and mixing; `recipes`, `recipes boom_bap`; `new --genre boom_bap --bpm 90 --key 'D minor' --seed 901` as a starter; then the
validate, events, lint, render, analyze loop four times. Revisions: (1) a keys chord written with a top-level comma sustained for the
whole bar, found in `events` and fixed by bracketing the chord; (2) the static generic/clipping_risk warning, fixed by moving the keys
onset off the kick and lowering gains; (3) analyze's LOW_END_DOMINANCE, fixed by reducing kick and bass weight. MP3 export succeeded.

**Skill gap found and fixed.** references/mini-notation.md did not explain comma precedence at the top level; a sentence and example
were added (`d4,f4 a4` holds d4 for the bar; use `[d4,f4,a4]` for a one-step chord).

**Independent check by main.** tests/e2e/examples.test.ts now includes the dogfood song (validate, strict lint clean, render, analyze
with finite metrics and valid PNGs).
