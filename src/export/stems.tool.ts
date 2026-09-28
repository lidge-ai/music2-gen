import { fnv1a32, Music2Error } from "../shared/index.ts";
import type { RenderResult } from "../render/render.schema.ts";
import type { ResolvedSong, Timeline } from "../song/index.ts";
import type { ExportFile, ExportPlan } from "./export.schema.ts";
import { serializeStemsManifest, validateStemsManifest } from "./manifest.schema.ts";
import type { StemsData, StemsManifest } from "./manifest.schema.ts";

export interface StemsOptions { bits: 16 | 24; includeMaster: boolean; includePremaster: boolean;
  bars?: { start: number; end: number } }

function bad(message: string): never { throw new Music2Error("E_RENDER", message); }

/** Prove all captured Float32 components reconstruct the Float32 pre-master at every frame. */
function proveSum(files: ExportFile[], premaster: NonNullable<RenderResult["premaster"]>): void {
  const components = files.filter((file): file is Extract<ExportFile, { wav: unknown }> => "wav" in file &&
    file.path !== "master.wav" && file.path !== "premaster.wav").map((file) => file.wav);
  let maxAbsolute = 0; let maxNormalized = 0; let worstFrame = 0; let worstChannel = "left";
  for (const channel of ["left", "right"] as const) for (let frame = 0; frame < premaster[channel].length; frame++) {
    let sum = 0; let magnitude = 0;
    for (const component of components) {
      const sample = component[channel][frame]!;
      if (!Number.isFinite(sample)) bad(`nonfinite stem at ${channel} frame ${frame}`);
      sum += sample; magnitude += Math.abs(sample);
    }
    const expected = premaster[channel][frame]!;
    if (!Number.isFinite(expected)) bad(`nonfinite premaster at ${channel} frame ${frame}`);
    const absolute = Math.abs(sum - expected);
    const normalized = absolute / Math.max(1, magnitude);
    if (absolute > maxAbsolute) maxAbsolute = absolute;
    if (normalized > maxNormalized) { maxNormalized = normalized; worstFrame = frame; worstChannel = channel; }
  }
  if (maxNormalized > 1e-6) throw new Music2Error("E_RENDER", "stem sum exceeds pre-master tolerance", {
    details: { maxAbsolute, maxNormalized, frame: worstFrame, channel: worstChannel, sources: components.length },
  });
}

export function planStems(song: ResolvedSong, timeline: Timeline, result: RenderResult,
  options: StemsOptions): ExportPlan<StemsData> {
  const start = options.bars?.start ?? 0;
  const end = options.bars?.end ?? timeline.bars;
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || start >= end || end > timeline.bars)
    throw new Music2Error("E_INPUT", "invalid stem bar range");
  if (song.loop && options.bars) throw new Music2Error("E_INPUT", "--bars cannot render part of a loop song");
  if (options.bits !== 16 && options.bits !== 24) throw new Music2Error("E_INPUT", "--bits must be 16 or 24");
  const premaster = result.premaster;
  if (!result.returns || (options.includePremaster && !premaster))
    bad("stem export requires return capture and requested pre-master");
  const tracks = [...song.tracks, ...(song.audioTracks ?? [])];
  const byId = new Map<string, NonNullable<RenderResult["stems"]>[number]>();
  for (const stem of result.stems) {
    if (byId.has(stem.trackId)) bad(`duplicate rendered stem: ${stem.trackId}`);
    byId.set(stem.trackId, stem);
  }
  if (byId.size !== tracks.length || tracks.some((track) => !byId.has(track.id)))
    bad("rendered stems do not match song tracks");
  const files: ExportFile[] = tracks.map((track) => ({ path: `tracks/${track.id}.wav`,
    wav: byId.get(track.id)!.audio, bits: options.bits, seed: fnv1a32(song.seed, track.id, "wav") }));
  const manifestTracks: StemsManifest["tracks"] = tracks.map((track) => ({
    id: track.id, file: `tracks/${track.id}.wav`, type: "kind" in track ? track.kind : "audio",
    instrument: "instrument" in track ? track.instrument : null,
    gainDb: track.gain, pan: track.pan, sends: { reverb: track.sends.reverb, delay: track.sends.delay },
    inserts: track.fx ?? [],
    ...(track.automation?.length ? { automated: true as const } : {}),
  }));
  const manifestReturns: StemsManifest["returns"] = [];
  for (const id of ["reverb", "delay"] as const) {
    const wet = result.returns[id];
    if (!wet) continue;
    files.push({ path: `returns/${id}.wav`, wav: wet, bits: options.bits,
      seed: fnv1a32(song.seed, "return", id, "wav") });
    const params = song.fx?.[id] ?? null;
    manifestReturns.push({ id, file: `returns/${id}.wav`, legacy: params === null, params });
  }
  if (options.includeMaster) files.push({ path: "master.wav", wav: result.audio, bits: options.bits,
    seed: fnv1a32(song.seed, "master", "wav") });
  if (options.includePremaster) files.push({ path: "premaster.wav", wav: premaster!, bits: options.bits,
    seed: fnv1a32(song.seed, "premaster", "wav") });
  const markers: StemsManifest["sectionMarkers"] = timeline.placements
    .filter((placement) => placement.startBar >= start && placement.startBar < end)
    .map((placement) => ({ name: placement.occurrence === 0 ? placement.section :
      `${placement.section} (${placement.occurrence + 1})`, section: placement.section,
      role: placement.role ?? null, bar: placement.startBar - start + 1,
      sourceBar: placement.startBar + 1, seconds: (placement.startBar - start) * timeline.secondsPerBar }));
  const manifest: StemsManifest = {
    version: 1, title: song.title, bpm: song.bpm,
    meter: { numerator: song.meter.numerator, denominator: song.meter.denominator }, key: song.key,
    sampleRate: song.sampleRate, bits: options.bits, frames: result.audio.left.length,
    barOrigin: start + 1, bars: end - start, loop: song.loop, sectionMarkers: markers,
    tracks: manifestTracks, returns: manifestReturns,
    master: options.includeMaster ? { file: "master.wav", ceilingDb: song.master.ceilingDb,
      processing: ["inserts", "saturation", "limiter"] } : null,
    premaster: options.includePremaster ? "premaster.wav" : null,
  };
  files.push({ path: "stems.json", bytes: serializeStemsManifest(manifest) });
  validateStemsManifest(manifest, files);
  if (premaster) proveSum(files, premaster);
  return { files, data: { files: files.map((file) => file.path), frames: manifest.frames, sampleRate: manifest.sampleRate } };
}
