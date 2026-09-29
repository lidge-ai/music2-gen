# Audit of 000_plan

Reviewer: independent read-only subagent (Laplace). Verdict: near-pass.

## Blockers folded into the plan

| # | Finding | Fold |
| --- | --- | --- |
| 1 | tests/e2e/skill-docs.test.ts treats table rows shaped `| \`x\` | \`y\` |` as voice rows and json fences with an instrument key as voice examples | New decision table uses a plain-text first column. sfz: and kit: track examples live in logic-library.md, which the test does not scan. Test edit is out of scope. |
| 2 | A missing RIFF pad byte fails only on a non-final odd chunk, with E_INPUT "truncated chunk header"; a missing pad on the final chunk is accepted | Quote the error code, not the wording; say the fix is rewriting plain PCM |
| 3 | AIFF/CAF fail differently: sfz: disables non-.wav regions with a warning and ends in E_CAPABILITY when none remain; kit: fails with E_SCHEMA "cannot decode sample" | Per-route error table |
| 4 | Symlinks to /Library are rejected (E_ACCESS); sfz and kit samples must live inside the song, sfz and kit directories | Say copy or convert into the song tree |
| 5 | No render --jobs flag exists; --bars is rejected on loop songs; targetLufs is measured per rendered range | Sharding is described as a library-level technique, not a flag; say to omit targetLufs when sharding and to check seams; check export stems --premaster |
| 6 | SFZ decode budget is 512 MiB per render (E_CAPABILITY); kit folds stereo to mono and pitches by resampling | Add to the clean-WAV and route sections |
| 7 | music2 slice already writes kit.json; import is MIDI only; kit.json has a midi field | Mention slice and the midi field; reword out-of-scope as import of Logic patches or sample folders |
| 8 | skill-docs test fails on dangling links; devlog files are numbered | Links are added once logic-library.md exists; this file is 001_audit.md and the record is 010_delivery.md |

Parent decisions: no test edits (source and test changes stay out of scope); a follow-up may add the new reference to the docs test list.

