# 020 — wp2: issue #2 automation lane guard and replace-semantics docs

Consumes 001 D6. Depends on wp1 only through `src/recipes/lint.tool.ts` (both append to the results list at `lint.tool.ts:114`). Stale check at wp2 P: re-read `lint.tool.ts` after wp1.

## Facts

- A lane replaces the static value while it is active (`src/render/mix-automated.tool.ts:28-31,43`); `gain` lanes accept [-60, 12] dB and send lanes [0, 1] (`src/song/song-daw.schema.ts:200-201`).
- Music tracks carry `automation?: ResolvedLane[]` (`song.schema.ts:48`); audio tracks carry the same (`song-daw.schema.ts:25-27`).
- Song-only lint rules follow `fxRules(song)` (`src/recipes/lint-fx.tool.ts`), with `$.tracks[i]...` paths.

## File change map

| Path | Op | Change |
|---|---|---|
| `src/recipes/lint-automation.tool.ts` | NEW | `automationRules(song)`, `GAIN_LANE_MARGIN_DB = 12`, `SEND_LANE_MARGIN_DB = 12` |
| `src/recipes/lint-automation.test.ts` | NEW | issue #2 lane warns; faithful lane (values near static) passes; fade-in from -60 passes; send jump warns; static send 0 skipped; audio track lane covered |
| `src/recipes/lint.tool.ts` | MODIFY | append `...automationRules(song)` next to `...fxRules(song)` |
| `src/recipes/index.ts` | MODIFY | export `automationRules` only if other features export `fxRules` (match the existing boundary; check at B) |
| `docs/song-format.md` | MODIFY | automation section: lanes are absolute and replace the static value; before/after example |
| `docs/cli.md` | MODIFY | lint rule list adds the two ids |
| `skills/music2/references/effects.md`, `daw-bridge.md`, `mixing.md` | MODIFY | one short replace-semantics note each, with the same example |
| `devlog/str_func/recipes.md` | MODIFY | new export |

## Diff

```ts
// src/recipes/lint-automation.tool.ts
import type { ResolvedSong } from "../song/index.ts";
import type { LintResult } from "./lint.tool.ts";

/** A gain or send lane replaces the static value; flag lanes that sit far above it. */
export const GAIN_LANE_MARGIN_DB = 12;
export const SEND_LANE_MARGIN_DB = 12;

export function automationRules(song: ResolvedSong): LintResult[] {
  const results: LintResult[] = [];
  song.tracks.forEach((track, trackIndex) => {
    track.automation?.forEach((lane, laneIndex) => {
      const loudest = lane.points.reduce((best, point, index) => point.value > best.value ? { value: point.value, index } : best,
        { value: -Infinity, index: -1 });
      if (loudest.index < 0) return;
      const path = `$.tracks[${trackIndex}].automation[${laneIndex}].points[${loudest.index}].value`;
      if (lane.target === "gain" && loudest.value - track.gain > GAIN_LANE_MARGIN_DB)
        results.push({ id: "generic/automation_gain_jump", severity: "warning", path, observed: loudest.value,
          expected: `<= static gain ${track.gain} + ${GAIN_LANE_MARGIN_DB} dB`,
          fix: "Gain lanes are absolute and replace the static gain; write lane values around the track's static gain (for gain -27, ride between about -35 and -24), not as offsets from 0." });
      const bus = lane.target === "send.reverb" ? "reverb" : lane.target === "send.delay" ? "delay" : null;
      const base = bus === null ? 0 : track.sends[bus];
      if (bus !== null && base > 0 && loudest.value > 0 && 20 * Math.log10(loudest.value / base) > SEND_LANE_MARGIN_DB)
        results.push({ id: "generic/automation_send_jump", severity: "warning", path, observed: loudest.value,
          expected: `<= static send ${base} + ${SEND_LANE_MARGIN_DB} dB`,
          fix: "Send lanes are absolute and replace the static send; write values near the static send level." });
    });
  });
  return results;
}
```

Check at B: `track.gain` and `track.sends` exist on resolved audio tracks as well as music tracks (the renderer mixes both); if audio tracks name them differently, branch on the track kind.

## Docs text (song-format.md automation section)

> Automation lanes are absolute. While a lane is active its value replaces the track's static `gain` or send; it is not added to it. A track with `"gain": -27` that should dip 8 dB into a build uses points like `-27 → -35 → -27`. Writing `0 → -8 → 0` plays the track 27 dB louder than its static level. `music2 lint` reports `generic/automation_gain_jump` when a gain lane rises more than 12 dB above the static gain, and `generic/automation_send_jump` for send lanes more than 12 dB above a nonzero static send.

## Tests and verifier

`npm test` (includes `src/recipes/*.test.ts`), `npm run typecheck`. CLI: issue #2 lane in a minimal song saved to `/tmp`, `node bin/music2.js lint <file> --json` shows `generic/automation_gain_jump` with observed 0 and expected `<= static gain -27 + 12 dB`; the corrected lane shows none. Recorded in evidence/wp2-repro.md.

Deferred (non-goal): `"mode": "offset"` lanes; analyze per-track bed-vs-focal loudness (issue item 4). Both are named in the issue closing comment.


## Reflection amendments (binding for B)

- R2: `automationRules` also loops `song.audioTracks ?? []` (`song.schema.ts:60`) with paths `$.audioTracks[i].automation[j].points[k].value`; `ResolvedAudioTrack` has the same `gain` and `sends` shape (`song-daw.schema.ts:26`). Implement one helper `checkTrack(track, pathPrefix)` used by both loops.
- R13: `skills/music2/references/layering.md` gets the same replace-semantics note.
- `src/recipes/index.ts` does not export `fxRules`; `automationRules` is not exported either.

Verification: hosted CI only (see 010 "Verification constraint"); local evidence is the CLI repro.

