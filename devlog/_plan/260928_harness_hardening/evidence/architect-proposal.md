# Architect proposal (summary)

Read-only architect subagent, 2026-09-28, against `8050ca5`. Summary of the returned proposal; the decision IDs are the ones 001 disposes.

- D1 motif rules: move `FOCAL`/`focal()` from `lint-layering-harmony.tool.ts:8-13` to a shared module; replace `melodyId` (`lint-rules-phrase.tool.ts:4-6`) with a list; drill_ny/6, boom_bap/6, boom_bap/7, lofi_hiphop/4 pass if any focal track satisfies them.
- D2 `transitions()` (`lint-geometry.tool.ts:129-135`) takes bar groups; drill_ny/5 groups per hook placement, drill_uk/6 per contiguous run.
- D3 `clippingRisk` (`lint-generic.tool.ts:37-49`): per-track groups add `max(velocity)·√n·gain`; multiply by `min(1, 10 / attackMs)`; threshold 2.0; `lofi_hiphop/6` text uses the constant.
- D4 `slot()` (`lint-layering-harmony.tool.ts:50-54`) uses a 16th step; compare unique slot sets; fix text names octave distance or empty 16th steps.
- D5 tempo: label 2:3 / 3:2 related candidates in `tempo.tool.ts`; `analyzeAudio` adds `tempoDeclaredMatch` (score ≥ 0.9, within ±1.5 BPM of declared); report and overview headline prefer it.
- D6 new `lint-automation.tool.ts`: `generic/automation_gain_jump` when a gain lane point exceeds static gain by > 12 dB; `generic/automation_send_jump` when a send lane exceeds a nonzero static send by > 12 dB.
- D7 `readWav` (`wav.tool.ts:53,62-63`) tolerates a missing pad byte on the final chunk.
- D8 `validate` (`cli/commands/validate.ts:11-12`) runs `validateVoiceParams` and `validateDawVoiceLanes` like render (`render.tool.ts:52-53`).
- D9 `revcymbal` taper special case removed (`transition.tool.ts:48`); kit notes fade 5 ms before `stopFrame` (`kit.tool.ts:153-157`).
- D10 kit manifest `startMs: { name: ms }`, validated like `midi`, applied per name on the cached decode.

Unresolved list from the architect: focal membership of supersaw/organ; drill_uk grouping; D3 constants need render calibration; D5 thresholds; D6 margins; WAV RIFF-size variant; byte-exact tests; DAW export of trimmed kit media.

