# Delivery record: virtual instruments and Logic library guide

Work class C2, documentation only. One work-phase, one PABCD cycle.

## What changed

- skills/music2/references/logic-library.md (new, 302 lines): locating Logic, Alchemy, Ultrabeat, EXS, Apple Loops and
  GarageBand content; a route table with the errors each route gives; octave-offset measurement and scale verification;
  WAV cleanup and AIFF/CAF conversion; SFZ and kit.json generation; stem loudness calibration; render and sharding advice
  with measured limits; a traps table; a licence note.
- skills/music2/references/instruments.md (+33 lines): a which-instrument decision section with two tables and a pointer to the new file.
- skills/music2/SKILL.md: one link in the reference list.

## Evidence

- Two leaf subagents wrote and verified the text by execution on a machine with the Logic content folders and GarageBand installed
  (the Logic Pro app itself was not installed). The reference writer ran 39 checks; the decision-table writer built one song per route.
- The parent re-ran the octave probe from the extracted snippets: Lush Bright Pad median offset -24, Huge Saw +12; cleanwav ran clean.
- npm run typecheck, lint, test (926 tests: 923 pass, 0 fail, 3 skipped), build and audit:structure exit 0.
- A test receipt for typecheck, lint, the skill-docs and privacy-scan tests and audit:structure is in the session evidence.
- No audio and no user-home path in the diff.

## Limits and decisions

- Test files were not changed, so tests/e2e/skill-docs.test.ts does not scan logic-library.md. Adding it to the documents list is a follow-up.
- bin/music2.js runs dist/, which can lag src/. The instruments writer saw dist accept a few songs at validate that src rejects. npm run build refreshes dist locally.
- Licence: only the GarageBand licence PDF could be read here. The text says content may not be used to train or test software such as sound generators. The guide states this and leaves the decision to the reader.
- Sharded stems match a full render to about -122 to -127 dB re peak only while nothing clips; the guide recommends the one-process render for delivery.
- Not implemented and named in the guide: render --jobs, and a command that imports a sample folder into SFZ or kit.json.

## Direction for later work

If sample-based songs become common, a source change (a sharding option and a sample-folder importer) would replace most of the scripts in the guide.
What did not improve: re-applying the summed premaster through the master chain did not reproduce the full master (2.5 LUFS louder); the cause is unknown.

