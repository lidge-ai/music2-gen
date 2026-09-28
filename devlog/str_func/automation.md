# Automation — Structure & Functions

Automation is a pure, arrangement-absolute tick-lane runtime. `src/song/song-daw.schema.ts` owns `ResolvedLane`, target parsing, validation, and beat-to-tick resolution. This feature imports the resolved type only; it does not import MIDI or the renderer. Mixer, insert, voice, and MIDI integration are owned by their feature folders.

## File Tree

```text
src/automation/
├── curve.tool.ts    # raw valueAt/renderCurve and causal 5 ms smoothCurve
├── curve.test.ts    # segment, step, frame-grid, and smoother oracles
├── lanes.tool.ts    # optional-lane first-match lookup
├── lanes.test.ts
├── cc.tool.ts       # gain/pan 7-bit CC laws and tick-lane codec
├── cc.test.ts
└── index.ts         # runtime functions and automation-owned types
```

## Runtime API

| Export | Signature and role |
| --- | --- |
| `valueAt` | `(lane: ResolvedLane, tick: number): number`; left-point outgoing linear/hold shape, with last-point-wins at a duplicate tick. |
| `renderCurve` | `(lane, {frames, sampleRate, bpm, startTick}): Float32Array`; one raw value per absolute audio frame. |
| `smoothCurve` | `(raw, {sampleRate, initialValue}): Float32Array`; causal 5 ms control smoothing. Partial renders need state from frame zero. |
| `findLane` | `(lanes: readonly ResolvedLane[] \| undefined, target: string): ResolvedLane \| undefined`. |
| `gainDbToCc7` / `cc7ToGainDb` | Gain dB and channel-volume conversion; inverse clamps imported CC7 0–3 to −60 dB. |
| `panToCc10` / `cc10ToPan` | Pan and MIDI CC10 conversion; inverse clamps imported CC10 0 to −1. |
| `laneToCcEvents` | `(lane, endTick): CcEvent[]`; tick-zero state, 120-tick ramp grid, exact point ticks, and unchanged-value suppression. |
| `ccEventsToLane` | `(target, events): {staticValue} \| {lane}`; stable tick ordering, same-tick last-value-wins, and hold points. |
| `ccImportClampWarning` / `gainCcClippedWarning` / `midiAutomationOmittedWarning` | Exact warning strings for import clamp, positive gain saturation, and an omitted target. |

`CcEvent` and the curve option types belong to this feature. `ResolvedLane` remains exported only from `src/song/index.ts` to avoid a second public type owner. The CC codec rejects invalid 7-bit values with `E_INPUT`; unsupported Song automation targets stay in ProjectIR and are omitted by the MIDI projection with a target-specific warning.

## Sync Checklist

- Keep Song range validation and the CC inverse floors aligned: gain −60..12 dB, pan −1..1.
- Preserve raw tick lanes for ALS/DAWproject; only audio DSP uses the smoother.
- When wiring MIDI, emit one `MIDI_CC_CLAMPED:<trackId>.<controller>@<tick>=<value>` for each affected retained event, including a sole tick-zero value; emit `gainCcClipped:<trackId>` when source gain exceeds 0 dB. Other targets retain their named `MIDI_AUTOMATION_OMITTED` warning.
- Keep the 120-tick writer grid, point-tick endpoints, and equal-tick last-value-wins behavior in sync with `devlog/_plan/260928_music2_daw_bridge/050_automation.md` §4.
