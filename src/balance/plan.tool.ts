import type { ResolvedSong } from "../song/index.ts";
import { Music2Error } from "../shared/index.ts";
import type { BalanceChange, BalanceOptions, BalanceRow, BalanceTarget } from "./balance.schema.ts";

export function targetId(target: BalanceTarget): string {
  return target.layer === undefined ? target.track : `${target.track}.${target.layer}`;
}

export function validateTargets(song: ResolvedSong, targets: BalanceTarget[],
  options: Pick<BalanceOptions, "reference" | "maxStep">): BalanceTarget[] {
  const step = options.maxStep ?? 12;
  if (!Number.isFinite(step) || step < 0) throw new Music2Error("E_INPUT", "maxStep must be finite and >= 0");
  if (options.reference !== undefined && !song.tracks.some((track) => track.id === options.reference))
    throw new Music2Error("E_INPUT", `unknown reference track: ${options.reference}`);
  const unique = new Map<string, BalanceTarget>();
  for (const target of targets) {
    const track = song.tracks.find((track) => track.id === target.track);
    if (!track || !Number.isFinite(target.db) || target.layer === "main" ||
      (target.layer !== undefined && !track.layers?.some((layer) => layer.id === target.layer)))
      throw new Music2Error("E_INPUT", `invalid or unknown balance target: ${targetId(target)}`);
    if (target.layer === undefined && target.track === options.reference)
      throw new Music2Error("E_INPUT", "reference track is read-only");
    unique.set(targetId(target), target);
  }
  return [...unique.values()];
}

/** Plan using the supplied measurements; orchestration re-measures between layer and track stages. */
export function planChanges(song: ResolvedSong, inputRows: BalanceRow[], targets: BalanceTarget[],
  options: Pick<BalanceOptions, "reference" | "maxStep"> = {}):
  { changes: BalanceChange[]; rows: BalanceRow[]; warnings: string[] } {
  const selected = validateTargets(song, targets, options);
  const rows = inputRows.map((row) => ({ ...row }));
  const byId = new Map(rows.map((row) => [row.id, row]));
  const reference = options.reference === undefined ? undefined : byId.get(options.reference);
  if (options.reference !== undefined && (!reference || reference.kind !== "track" || reference.rmsDb === null))
    throw new Music2Error("E_INPUT", "reference track is silent in window or unmeasured");
  const changes: BalanceChange[] = [], warnings: string[] = [];
  for (const target of selected) {
    const row = byId.get(targetId(target));
    if (!row) throw new Music2Error("E_INPUT", `unmeasured target: ${targetId(target)}`);
    const trackIndex = song.tracks.findIndex((track) => track.id === target.track);
    const track = song.tracks[trackIndex]!;
    row.applied = false;
    if (target.layer === undefined && track.automation?.some((lane) => lane.target === "gain"))
      row.skipped = "gain automation";
    else if (row.rmsDb === null) row.skipped = "silent in window";
    const main = target.layer === undefined ? undefined : byId.get(`${target.track}.main`);
    if (target.layer !== undefined && (!main || main.rmsDb === null)) row.skipped = "main silent in window";
    if (row.skipped) { warnings.push(`${row.id}: ${row.skipped}`); continue; }
    row.targetDb = target.db + (target.layer === undefined ? reference?.rmsDb ?? 0 : main!.rmsDb!);
    const layerIndex = target.layer === undefined ? -1 : track.layers!.findIndex((layer) => layer.id === target.layer);
    const before = layerIndex < 0 ? track.gain : track.layers![layerIndex]!.gain;
    const step = options.maxStep ?? 12;
    const delta = Math.max(-step, Math.min(step, row.targetDb - row.rmsDb!));
    let after = Math.max(-60, Math.min(12, before + delta));
    // Ignore floating-point residue so an already matched song keeps its bytes and mtime.
    if (Math.abs(after - before) < 1e-6) after = before;
    row.deltaDb = after - before;
    if (after === before) continue;
    changes.push({ track: track.id, ...(target.layer === undefined ? {} : { layer: target.layer }),
      path: layerIndex < 0 ? `$.tracks[${trackIndex}].gain` : `$.tracks[${trackIndex}].layers[${layerIndex}].gain`, before, after });
  }
  return { changes, rows, warnings };
}
