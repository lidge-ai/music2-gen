# 004 — Architecture decisions for the flow overview

**Summary.** The overview is a new analysis artifact, overview.png, built from a new `flow` measurement set. Measurement code lives in
`src/analyze/flow/`, drawing code in `src/analyze/overview/`; `analyzeAudio` orchestrates and `analyzeFile` writes the file through
the existing atomic path. analysis.json gains one additive `flow` object; analysis.md gains a `## Flow` section that prints the same
annotation strings burned into the image. Research: 002 (algorithms), 003 (layout + VLM eval), 001 (real-world practice, when the Aside
reports land), evidence/architect-proposal.md (F1–F9).

## Architect consultation record

Architect: sol subagent `01a0e469-af7d-7ea1-a407-a00a474f1206`, proposal F1–F9 (evidence/architect-proposal.md). Reflection: recorded in 000.

| ID | Proposal | Disposition |
|---|---|---|
| F1 | flow/ and overview/ folders; analyzeAudio orchestrates; no file writes below it | **Accept** |
| F2 | Extract K-weighted power scan into audio-io; factor the 10 ms flux envelope out of tempo so one pass feeds both | **Accept.** New `src/audio-io/kweight.tool.ts` (coefficients + `kWeightedPower(pcm)` returning per-sample summed channel power as Float64Array blocks of 100 ms); loudness.tool.ts consumes it with identical accumulation order (existing loudness tests must stay byte-exact). tempo.tool.ts exports `onsetEnvelopes(pcm)` (the current `envelopes`) and estimateTempo keeps its return value |
| F3 | Additive required `flow: FlowAnalysis` in AnalysisJson after `bands`; big arrays stay internal | **Accept.** JSON carries per-interval rows, 1 Hz short-term loudness curve (not 10 Hz: keeps analysis.json small; the PNG uses the full 10 Hz internal curve), section deltas, novelty peaks, repeats, annotations |
| F4 | Song bars / WAV beats (confidence ≥ 0.6 and ≥ 4 beats) / else 0.5 s frames; interval-local LUFS feature | **Accept** |
| F5 | 1600 × ~1400 canvas, fixed time columns x=136…1168, section table x=1200…1576 | **Amend:** 1600 × 1400 exactly for ≤ 20 section occurrences; height grows by 44 px per extra table row (rule F9). Panels in 010 |
| F6 | Scaled 5×7 font, measure/wrap, glyph additions, three verdict slots, shared formatter | **Accept.** Fallback glyph for unknown characters is a hollow box |
| F7 | overviewPng in AnalysisResult and AnalysisArtifacts after spectrogram; overview.png written atomically; CLI artifact order | **Accept** (additive; existing keys unchanged) |
| F8 | ≤ 15 s and ≤ 100 MB incremental for 3 min at 48 kHz; byte-identical PNG | **Accept**, measured in 010's benchmark test (opt-in MUSIC2_BENCH=1) |
| F9 | Overflow rule, crossover overlap wording, VLM eval is a gate not a claim | **Accept** |

## Module map (additions)

```
src/audio-io/kweight.tool.ts          K-weighting coefficients + 100 ms power blocks (shared by loudness and flow)
src/analyze/flow/flow.schema.ts       FlowAnalysis (JSON) + FlowRenderData (internal) types
src/analyze/flow/intervals.tool.ts    bar / beat / 0.5 s interval grid
src/analyze/flow/loudness-curve.tool.ts  momentary + short-term curves, interval and section LUFS, deltas
src/analyze/flow/bands3.tool.ts       3-band (200 / 2000 Hz) Butterworth waveform columns
src/analyze/flow/features.tool.ts     20-value interval features, onset density, centroid
src/analyze/flow/similarity.tool.ts   SSM, Foote novelty, peaks, boundary hits, repeats
src/analyze/flow/annotate.tool.ts     verdict + annotation strings (single formatter for PNG and analysis.md)
src/analyze/flow/flow.tool.ts         analyzeFlow(pcm, ctx) orchestration
src/analyze/overview/canvas.tool.ts   RGB canvas primitives (rect, line, polyline, text via font)
src/analyze/overview/panels.tool.ts   one draw function per panel
src/analyze/overview/overview.tool.ts renderOverview(analysis, flow, song?, timeline?) -> PNG Buffer
```

