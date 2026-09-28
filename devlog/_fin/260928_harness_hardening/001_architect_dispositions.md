# 001 — Architect dispositions

Source: evidence/architect-proposal.md (D1–D10, checked against `8050ca5`). Main owns the plan; each row states what 010/020/030 do with the proposal.

| ID | Proposal | Disposition | Reason |
|---|---|---|---|
| D1 | Motif rules use a shared focal set, pass if any focal track has the motif | **Amended.** Focal set first; when a song has no focal-voice track, fall back to notes tracks that are not bass/808 and not bed voices (`strings`, `pad`, `choir`, or a `lib:` instrument with role `bed`). | Without the fallback, a trap song whose only melody is a `supersaw` or `lead`-less synth line would start warning; the fallback keeps today's behavior for those songs while removing the order and id dependence. |
| D2 | `transitions(g, groups)`; drill_ny/5 per hook placement, drill_uk/6 per contiguous run | Accepted | Matches both fix texts; no flag parameter. |
| D3 | √n chord weighting, slow-attack weighting, threshold 2.0 | **Amended.** Keep the weighting and 2.0 threshold; the slow-attack defaults live in a local table in recipes (`strings` 300, `pad` 400, `choir` 300 ms; `lib:` bed voices 250 ms) with a parity test that imports the render voice specs, so production recipes code does not import render. | Avoids a new recipes→render dependency; the test catches drift. |
| D4 | 16th grid (`15 / bpm`), unique slots per track, new fix text | Accepted | |
| D5 | Relabel 2:3 and 3:2 candidates; `tempoDeclaredMatch` in analyze; headline prefers the match | Accepted | `estimatedBpm` keeps its audio-only meaning; the additions are additive to analysis v1. |
| D6 | New `lint-automation.tool.ts` with gain and send jump rules at 12 dB | Accepted | Offset lane mode stays deferred (non-goal). |
| D7 | Tolerate a missing final pad byte, both RIFF-size variants | Accepted | Only the final chunk; mid-file truncation still fails. |
| D8 | `validate` calls `validateVoiceParams` and `validateDawVoiceLanes` | Accepted | E_SCHEMA already maps to exit 2. Docs that say validate leaves parameters to render are corrected. |
| D9 | Revcymbal uses the 5 ms taper; kit notes fade over the last 5 ms before `stopFrame` | Accepted | Stop timing unchanged. |
| D10 | Kit manifest `startMs` map, trim per name on the cached decode | Accepted | DAW exports that copy raw kit media are checked in wp3 P; if they copy the file, the trim is documented as render-only. |

Unresolved items carried into the phase docs: exact lib bed attack (I, heuristic 250 ms); a song with no melody-capable track keeps warning as today; a song whose only melodic tracks are beds (strings, pad, choir, organ) now warns on the motif rules, because beds no longer count as the melody.

