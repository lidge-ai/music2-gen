# Overview evaluation

Native overview core pass 4/4; threshold >=3; complete: true; pass: true.
Model: gpt-6-sol; prompt SHA-256: 885890ebad22c40d072e27de1aed3ccca24f4be9a5af5e6f5ad2d8a16ad64446.

| Case | Image | Side | r | Order | Boundaries | All | Loudest | Hook | Four-way | c-3 | Error | Answer |
| --- | --- | ---: | ---: | --- | ---: | --- | --- | --- | --- | --- | --- | --- |
| drill-140 | overview | 1600 | 1 | true | 1 | true | true | true | true | true |  | [JSON](overview-eval/answers/drill-140.overview.1600.r1.json) |
| drill-140 | overview | 1280 | 1 | true | 1 | true | true | true | true | true |  | [JSON](overview-eval/answers/drill-140.overview.1280.r1.json) |
| drill-140 | overview | 1024 | 1 | true | 1 | true | true | true | true | true |  | [JSON](overview-eval/answers/drill-140.overview.1024.r1.json) |
| drill-140 | spectrogram | 1600 | 1 | false | 0 | false | false | false | false | false | invalid_schema | [JSON](overview-eval/answers/drill-140.spectrogram.1600.r1.json) |
| drill-140 | spectrogram | 1280 | 1 | false | 0 | false | false | false | false | false | invalid_schema | [JSON](overview-eval/answers/drill-140.spectrogram.1280.r1.json) |
| drill-140 | spectrogram | 1024 | 1 | false | 0 | false | false | false | false | false | invalid_schema | [JSON](overview-eval/answers/drill-140.spectrogram.1024.r1.json) |
| trap-150 | overview | 1600 | 1 | true | 1 | true | true | true | true | true |  | [JSON](overview-eval/answers/trap-150.overview.1600.r1.json) |
| trap-150 | overview | 1280 | 1 | true | 1 | true | true | true | true | true |  | [JSON](overview-eval/answers/trap-150.overview.1280.r1.json) |
| trap-150 | overview | 1024 | 1 | true | 1 | true | true | true | true | true |  | [JSON](overview-eval/answers/trap-150.overview.1024.r1.json) |
| trap-150 | spectrogram | 1600 | 1 | false | 0 | false | false | false | false | false | invalid_schema | [JSON](overview-eval/answers/trap-150.spectrogram.1600.r1.json) |
| trap-150 | spectrogram | 1280 | 1 | false | 0 | false | false | false | false | false | invalid_schema | [JSON](overview-eval/answers/trap-150.spectrogram.1280.r1.json) |
| trap-150 | spectrogram | 1024 | 1 | false | 0 | false | false | false | false | false | invalid_schema | [JSON](overview-eval/answers/trap-150.spectrogram.1024.r1.json) |
| boom-bap-90 | overview | 1600 | 1 | true | 1 | true | true | true | true | true |  | [JSON](overview-eval/answers/boom-bap-90.overview.1600.r1.json) |
| boom-bap-90 | overview | 1280 | 1 | true | 1 | true | true | true | true | true |  | [JSON](overview-eval/answers/boom-bap-90.overview.1280.r1.json) |
| boom-bap-90 | overview | 1024 | 1 | true | 1 | true | true | true | true | true |  | [JSON](overview-eval/answers/boom-bap-90.overview.1024.r1.json) |
| boom-bap-90 | spectrogram | 1600 | 1 | false | 0 | false | false | false | false | false |  | [JSON](overview-eval/answers/boom-bap-90.spectrogram.1600.r1.json) |
| boom-bap-90 | spectrogram | 1280 | 1 | false | 0 | false | false | false | false | false | invalid_schema | [JSON](overview-eval/answers/boom-bap-90.spectrogram.1280.r1.json) |
| boom-bap-90 | spectrogram | 1024 | 1 | false | 0 | false | false | false | false | false | invalid_schema | [JSON](overview-eval/answers/boom-bap-90.spectrogram.1024.r1.json) |
| house-124 | overview | 1600 | 1 | true | 1 | true | true | true | true | true |  | [JSON](overview-eval/answers/house-124.overview.1600.r1.json) |
| house-124 | overview | 1280 | 1 | true | 1 | true | true | true | true | true |  | [JSON](overview-eval/answers/house-124.overview.1280.r1.json) |
| house-124 | overview | 1024 | 1 | true | 1 | true | true | true | true | true |  | [JSON](overview-eval/answers/house-124.overview.1024.r1.json) |
| house-124 | spectrogram | 1600 | 1 | false | 0 | false | false | false | false | false | invalid_schema | [JSON](overview-eval/answers/house-124.spectrogram.1600.r1.json) |
| house-124 | spectrogram | 1280 | 1 | false | 0 | false | false | false | false | false | invalid_schema | [JSON](overview-eval/answers/house-124.spectrogram.1280.r1.json) |
| house-124 | spectrogram | 1024 | 1 | false | 0 | false | false | false | false | false | invalid_schema | [JSON](overview-eval/answers/house-124.spectrogram.1024.r1.json) |

## Conditions

- overview-1600: 4/4 four-way correct
- overview-1280: 4/4 four-way correct
- overview-1024: 4/4 four-way correct
- spectrogram-1600: 0/4 four-way correct
- spectrogram-1280: 0/4 four-way correct
- spectrogram-1024: 0/4 four-way correct

## Exclusions


Prepare: `node scripts/eval-overview.mjs prepare --evidence-dir <evidence-dir> --work-dir <external-task-work-dir>`.
Score: `node scripts/eval-overview.mjs score --evidence-dir <evidence-dir>`.
Keep WAV/PNG files in the external work directory. Generated SHA: see each ground-truth JSON.
