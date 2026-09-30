import { randomUUID } from "node:crypto";
import { chmod, readFile, realpath, rename, stat, unlink, writeFile } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import { renderSong } from "../render/index.ts";
import { Music2Error } from "../shared/index.ts";
import { buildTimeline, validateSong } from "../song/index.ts";
import type { ResolvedSong, Song, Timeline } from "../song/index.ts";
import type { BalanceChange, BalanceOptions, BalanceReport, BalanceRow, BalanceWindow } from "./balance.schema.ts";
import { gatedLevel } from "./measure.tool.ts";
import { planChanges, validateTargets } from "./plan.tool.ts";
export { planChanges } from "./plan.tool.ts";

export function resolveWindow(song: ResolvedSong, timeline: Timeline,
  opts: Pick<BalanceOptions, "section" | "occurrence" | "bars">): BalanceWindow {
  if (song.loop) throw new Music2Error("E_INPUT", "balance does not support loop songs");
  if (opts.bars !== undefined && opts.section !== undefined)
    throw new Music2Error("E_INPUT", "--bars and --section cannot be combined");
  if (opts.occurrence !== undefined && opts.section === undefined)
    throw new Music2Error("E_INPUT", "--occurrence requires --section");
  if (opts.section !== undefined) {
    const occurrence = opts.occurrence ?? 1;
    if (!Number.isSafeInteger(occurrence) || occurrence < 1)
      throw new Music2Error("E_INPUT", "occurrence must be a positive integer");
    const placement = timeline.placements.filter((item) => item.section === opts.section)[occurrence - 1];
    if (!placement) throw new Music2Error("E_INPUT", `unknown section or occurrence: ${opts.section} (${occurrence})`);
    return { startBar: placement.startBar, endBar: placement.startBar + placement.bars,
      section: opts.section, occurrence };
  }
  if (opts.bars !== undefined) {
    const match = /^(0|[1-9]\d*):(0|[1-9]\d*)$/.exec(opts.bars);
    const startBar = Number(match?.[1]), endBar = Number(match?.[2]);
    if (!match || !Number.isSafeInteger(startBar) || !Number.isSafeInteger(endBar) ||
      startBar >= endBar || endBar > timeline.bars)
      throw new Music2Error("E_INPUT", `bars must be a nonempty range within 0:${timeline.bars}`);
    return { startBar, endBar };
  }
  return { startBar: 0, endBar: timeline.bars };
}

export async function measureSong(song: ResolvedSong, songPath: string, window: BalanceWindow):
  Promise<{ rows: BalanceRow[]; warnings: string[] }> {
  if (song.loop) throw new Music2Error("E_INPUT", "balance does not support loop songs");
  const timeline = buildTimeline(song);
  const bodyFrames = Math.ceil((window.endBar - window.startBar) * timeline.secondsPerBar * song.sampleRate);
  const taps = new Map<string, BalanceRow>();
  const result = await renderSong(song, songPath, {
    bars: { start: window.startBar, end: window.endBar }, stems: true,
    layerTaps(tap) {
      const id = `${tap.trackId}.${tap.source === "main" ? "main" : tap.layerId}`;
      taps.set(id, { id, kind: tap.source, track: tap.trackId,
        ...(tap.layerId === undefined ? {} : { layer: tap.layerId }), ...gatedLevel(tap.audio, 0, bodyFrames) });
    },
  });
  const rows: BalanceRow[] = [];
  for (const track of [...song.tracks, ...(song.audioTracks ?? [])]) {
    const stem = result.stems.find((stem) => stem.trackId === track.id)!;
    rows.push({ id: track.id, kind: "track", track: track.id, ...gatedLevel(stem.audio, 0, bodyFrames) });
    const main = taps.get(`${track.id}.main`);
    if (main) rows.push(main);
    if ("layers" in track) for (const layer of track.layers ?? []) {
      const row = taps.get(`${track.id}.${layer.id}`);
      if (row) rows.push(row);
    }
  }
  return { rows, warnings: [...result.warnings ?? []] };
}

/** Edit only gains; retain all other input fields rather than serializing resolved defaults. */
export function applyChanges(rawJson: string, changes: BalanceChange[]): string {
  const raw = JSON.parse(rawJson) as Song;
  const song = validateSong(raw);
  for (const change of changes) {
    const trackIndex = song.tracks.findIndex((track) => track.id === change.track);
    const track = raw.tracks[trackIndex];
    if (!track || !Number.isFinite(change.after) || change.after < -60 || change.after > 12)
      throw new Music2Error("E_INPUT", `invalid gain change: ${change.track}`);
    if (change.layer === undefined) track.gain = change.after;
    else {
      const layer = track.layers?.find((layer) => layer.id === change.layer);
      if (!layer || change.layer === "main") throw new Music2Error("E_INPUT", `unknown layer: ${change.track}.${change.layer}`);
      layer.gain = change.after;
    }
  }
  return JSON.stringify(raw, null, 2) + "\n";
}

const ACCESS_CODES = new Set(["EACCES", "EPERM"]);
export function readError(what: string, path: string, cause: unknown): Music2Error {
  const code = (cause as NodeJS.ErrnoException | undefined)?.code;
  return new Music2Error(code && ACCESS_CODES.has(code) ? "E_ACCESS" : "E_INPUT", `cannot read ${what}: ${path}`, { cause });
}
async function readSource(path: string): Promise<string> {
  try { return await readFile(path, "utf8"); }
  catch (cause) { throw readError("song", path, cause); }
}
function resolvedSource(raw: string): ResolvedSong {
  let input: unknown;
  try { input = JSON.parse(raw) as unknown; }
  catch (cause) { throw new Music2Error("E_INPUT", "invalid song JSON", { cause }); }
  return validateSong(input);
}
async function replaceSource(path: string, original: string, updated: string): Promise<void> {
  // Preserve a symlink's referent and permissions; stage beside the actual destination.
  let temporary: string | undefined;
  try {
    const final = await realpath(path);
    temporary = join(dirname(final), `.${basename(final)}.${randomUUID()}.tmp`);
    const mode = (await stat(final)).mode & 0o7777;
    await writeFile(temporary, updated, { flag: "wx", mode });
    await chmod(temporary, mode);
    if (await readFile(final, "utf8") !== original)
      throw new Music2Error("E_INPUT", "song changed while balance was running; retry");
    await rename(temporary, final);
  } catch (cause) {
    if (cause instanceof Music2Error) throw cause;
    throw new Music2Error("E_ACCESS", `cannot apply balance: ${path}`, { cause });
  } finally { if (temporary) await unlink(temporary).catch(() => undefined); }
}

/** Preview and apply share the same layer-first, then track planning path. */
export async function balanceSong(path: string, options: BalanceOptions): Promise<BalanceReport> {
  const raw = await readSource(path), song = resolvedSource(raw);
  const window = resolveWindow(song, buildTimeline(song), options);
  const targets = validateTargets(song, options.targets, options);
  const before = await measureSong(song, path, window);
  const layers = planChanges(song, before.rows, targets.filter((target) => target.layer !== undefined), options);
  let stagedRaw = layers.changes.length ? applyChanges(raw, layers.changes) : raw;
  let stagedSong = layers.changes.length ? resolvedSource(stagedRaw) : song;
  const intermediate = layers.changes.length ? await measureSong(stagedSong, path, window) : before;
  const tracks = planChanges(stagedSong, intermediate.rows, targets.filter((target) => target.layer === undefined), options);
  const changes = [...layers.changes, ...tracks.changes];
  const rows = layers.rows.map((row) => {
    if (row.kind !== "track") return row;
    const planned = tracks.rows.find((candidate) => candidate.id === row.id)!;
    return { ...planned, rmsDb: row.rmsDb, peakDb: row.peakDb, activeRatio: row.activeRatio };
  });
  for (const row of rows) if (row.applied !== undefined)
    row.applied = options.apply === true && changes.some((change) => change.track === row.track && change.layer === row.layer);
  const warnings = [...before.warnings, ...layers.warnings, ...intermediate.warnings, ...tracks.warnings];
  const report: BalanceReport = { window, ...(options.reference === undefined ? {} : { reference: options.reference }),
    rows, changes, warnings: [] };
  if (options.apply && changes.length) {
    if (tracks.changes.length) stagedRaw = applyChanges(stagedRaw, tracks.changes);
    stagedSong = resolvedSource(stagedRaw);
    const after = await measureSong(stagedSong, path, window);
    report.after = after.rows;
    warnings.push(...after.warnings);
    await replaceSource(path, raw, stagedRaw);
  }
  report.warnings = [...new Set(warnings)];
  return report;
}
