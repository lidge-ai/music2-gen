# Balance — Structure & Functions

## File Tree

```text
src/balance/
├── balance.schema.ts  # public contracts and target parser
├── measure.tool.ts    # frame-weighted stereo gate and peak
├── measure.test.ts    # gate, bounds, silence and partial blocks
├── plan.tool.ts       # target validation, precedence and gain planning
├── balance.tool.ts    # windows, render measurement, two-stage apply and staged replacement
├── balance.test.ts    # measurement, target semantics, windows and safe apply contracts
└── index.ts           # feature boundary
```

## Module Responsibility

Measure instrument and audio-track stems over a song window, expose main/layer taps only for
layered instrument tracks, and match instrument track/layer targets. Layers are planned and
applied in memory before re-measuring to plan track edits. Preview follows the same planning
path as apply. Applying validates and re-measures the result before staging and renaming the
original JSON; unchanged songs retain their bytes and mtime. Audio tracks remain read-only.

## Key Function Signatures

| Export | Purpose |
| --- | --- |
| `parseTarget(text: string): BalanceTarget` | Parse track=dB / track.layer=dB; main is read-only. |
| `gatedLevel(audio: StereoBuffer, startFrame = 0, endFrame = audio.left.length)` | 50 ms stereo mean-square gate at −60 dBFS, weighted active RMS/ratio, whole-window peak. |
| `resolveWindow(song: ResolvedSong, timeline: Timeline, opts): BalanceWindow` | Whole arrangement, 0-based half-open bars, or 1-based section occurrence; loop songs are measured unwrapped (`BALANCE_LOOP_UNWRAPPED`). |
| `measureSong(song, songPath, window): Promise<{rows: BalanceRow[]; warnings: string[]}>` | One renderSong call per measurement; excludes tail and preserves render warnings. |
| `planChanges(song, rows, targets, options)` | Absolute/reference track targets and own-main layer targets; step and gain clamps; skip silent/automated gains. |
| `applyChanges(rawJson: string, changes: BalanceChange[]): string` | Change only selected gains and format JSON with two-space indentation and newline. |
| `balanceSong(path: string, options: BalanceOptions): Promise<BalanceReport>` | Measure, layer plan, re-measure, track plan, optional apply/after. |

Public types: `BalanceTarget`, `BalanceWindow`, `BalanceRow`, `BalanceChange`, `BalanceReport`,
`BalanceOptions`. Rows use track order, then main, then layer order; `deltaDb` is the actual
clamped adjustment and changes retain original gains. Reference tracks cannot be track targets;
silent references error. A silent main skips layer targets. Gain lanes skip only track edits.
Later duplicate targets win. `maxStep` is finite and nonnegative; zero never adjusts.

## Dependencies

`render` (validated stems/taps), `song` (validation/timeline), `audio-io` (StereoBuffer),
`shared` (Music2Error), and node filesystem/path/crypto APIs for destination-local staging.

## Dependents

`src/cli/commands/balance.ts`, the public `src/index.ts` API, colocated tests, and the
sample-library E2E flow. CLI documentation and the mixing reference describe the same semantics.

## Sync Checklist

- [x] Feature and root exports include public functions and types.
- [x] CLI registration, repeated targets and JSON/human output are documented.
- [x] Tests cover gate weighting, nonzero windows, two-stage targets, no-write cases and E_INPUT.
- [x] Atomic apply validates/re-measures before replacement and retains render warnings.
- [x] Structure index and sample-library E2E include balance.

## Verification

wp4 checks: `bun run typecheck` and `bun run lint` exit 0. With a temporary `MUSIC2_HOME`,
`bun test src/balance/measure.test.ts src/balance/balance.test.ts src/cli/commands/balance.test.ts tests/e2e/library-flow.test.ts --timeout 60000`
passes 26 tests with zero failures, including imported user-layer track and layer gain edits.
