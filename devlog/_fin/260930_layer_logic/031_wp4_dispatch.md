# 031 — wp4 stale check and dispatch

Previous D (wp3): layers shipped in 850d3a5..46fc2ff with pre-layer digests intact and real Logic layers rendered (Logic kick + synth sub, three-layer bass, synth pad + Logic pad). Direction unchanged: `music2 balance` per 030 with fold B5 and wp3 reflection 6 (taps only for layered tracks; loop songs rejected).

## Frozen interfaces

`src/balance/balance.schema.ts`:
```ts
export interface BalanceTarget { track: string; layer?: string; db: number }
export interface BalanceWindow { startBar: number; endBar: number; section?: string; occurrence?: number }
export interface BalanceRow { id: string; kind: "track" | "main" | "layer"; track: string; layer?: string; rmsDb: number | null; peakDb: number | null; activeRatio: number; targetDb?: number; deltaDb?: number; applied?: boolean; skipped?: string }
export interface BalanceChange { track: string; layer?: string; path: string /* $.tracks[i].gain or $.tracks[i].layers[j].gain */; before: number; after: number }
export interface BalanceReport { window: BalanceWindow; reference?: string; rows: BalanceRow[]; changes: BalanceChange[]; after?: BalanceRow[]; warnings: string[] }
export function parseTarget(text: string): BalanceTarget; // "kick=-14", "bass.growl=-6"; E_INPUT on bad syntax
```
`src/balance/measure.tool.ts`: `gatedLevel(audio: StereoBuffer, start?: number, end?: number): { rmsDb: number | null; peakDb: number | null; activeRatio: number }` — 50 ms blocks, stereo mean square ((L²+R²)/2), blocks below −60 dBFS excluded.
`src/balance/balance.tool.ts`: `resolveWindow(song: ResolvedSong, timeline: Timeline, opts: { section?: string; occurrence?: number; bars?: string }): BalanceWindow`; `measureSong(song, songPath, window): Promise<BalanceRow[]>` (one `mixTracks` call with `bars`, `stems:true`, `layerTaps`; rows sorted by track order, then main, then layers); `planChanges(song, rows, targets, { reference?, maxStep? }): { changes: BalanceChange[]; rows: BalanceRow[]; warnings: string[] }`; `applyChanges(rawJson: string, changes): string` (parse, set values, `JSON.stringify(value, null, 2) + "\n"`); `balanceSong(path, options): Promise<BalanceReport>` orchestrating measure → plan → (apply → re-measure).
Semantics: track targets absolute dBFS or relative to `--reference` track row; layer targets relative to the track's `.main` row; step clamp ±maxStep (default 12); final gain clamp −60..12; tracks with a `gain` automation lane are skipped with `skipped:"gain automation"`; layer deltas apply before the track delta, which is computed after re-measure; loop songs → E_INPUT; unknown track/layer/section → E_INPUT; a target whose row is silent → skipped "silent in window".
CLI `src/cli/commands/balance.ts`: `music2 balance <song.json> [--section ID] [--occurrence N] [--bars A:B] [--target ID=DB]... [--targets FILE] [--reference TRACK] [--max-step DB] [--apply] [--json]`; human output is a table of rows with target/delta and a change list.

## Worker

One sol worker (B1) writes `src/balance/**` (+tests), `src/cli/commands/balance.ts`+test, `src/cli/registry.ts`, `src/index.ts` (export balance types/functions if other features are exported there), `docs/cli.md` (balance section), `devlog/str_func/balance.md` (new) and the `devlog/str_func/AGENTS.md` row, `skills/music2/references/mixing.md` (short "Match levels with music2 balance" section), and extends `tests/e2e/library-flow.test.ts` with a `balance --apply` step on the layered user song.

## Reflection fixes (architect: ALIGNED with fixes)

1. **Window.** Bars are zero-based half-open (`--bars 8:16`), exactly like `render --bars`. `--bars` with `--section` → E_INPUT; `--occurrence` without `--section` → E_INPUT. `--occurrence` is 1-based over arrangement placements of that section (default 1). Measurement covers only the window body frames (`bars × secondsPerBar × rate`), excluding `tailSeconds`.
2. **Two-stage orchestration.** `balanceSong`: measure → plan layer changes → apply them in memory (to the raw JSON object) → validate + re-measure → plan track changes → (preview or apply). `deltaDb` is the actual clamped adjustment; changes are reported against the original gains. `export interface BalanceOptions { section?: string; occurrence?: number; bars?: string; targets: BalanceTarget[]; reference?: string; maxStep?: number; apply?: boolean }`.
3. **Validation and warnings.** Measurement renders through `renderSong(song, path, { bars, stems: true, layerTaps })` (render validation included); `measureSong` returns `{ rows, warnings }` and render warnings flow into `BalanceReport.warnings`.
4. **Rules.** A gain lane skips only the track gain edit (layer gains stay editable). `.main` is not a writable target (E_INPUT). `--reference` names a track row; a silent reference → E_INPUT. A silent target row → skipped "silent in window". Later duplicate targets override earlier ones (`--targets` file first, then `--target` flags in order). Audio tracks are not targetable in this unit.
5. **Measurement.** `gatedLevel(audio, startFrame = 0, endFrame = audio.left.length)`: consecutive 50 ms blocks from `startFrame`, final partial block weighted by its length; active ratio is frame-weighted; peak is the max absolute sample over the whole window.
6. **Apply.** No changes → the file is not rewritten. Otherwise the new JSON (two-space, trailing newline; the whole file is reformatted, documented in docs/cli.md) is validated with `validateSong`, re-measured for `after`, then written via a staged temp file and rename. The CLI returns one `CommandResult`; `target` is a repeated string option; numeric options must be finite.

## Audit fold (A round 1)

- **Reference is read-only.** A target naming the `--reference` track → E_INPUT. Test: reference plus two relative targets land at the requested levels relative to the reference after apply (within 0.5 dB).
- **Silent main.** A layer target whose track `.main` row has `rmsDb === null` is skipped with `skipped: "main silent in window"` and a warning; its gain and the file stay unchanged (tested).
- **maxStep.** Finite and `>= 0` at CLI and API (E_INPUT otherwise); 0 means no adjustment and no rewrite (tested alongside negative rejection).
