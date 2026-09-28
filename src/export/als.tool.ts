import type { ProjectIR } from "../project/index.ts";
import { Music2Error } from "../shared/index.ts";
import type { ExportPlan } from "./export.schema.ts";
import { buildAlsSkeleton, createAlsIds } from "./als/skeleton.tool.ts";
import { buildAlsTracks, type AlsContent, type AlsRendered } from "./als/tracks.tool.ts";
import { gzipAls } from "./gzip.tool.ts";
import { serializeXml } from "./xml.tool.ts";
import type { XmlNode } from "./xml.tool.ts";

export type { AlsContent, AlsRendered } from "./als/tracks.tool.ts";
export interface AlsOptions { content: AlsContent; bits: 16 | 24;
  kitMaps?: Readonly<Record<string, Readonly<Record<string, number>>>> }
export interface AlsData { als: string; samples: string[]; tracks: number; content: AlsContent;
  quantization: ProjectIR["quantization"]; experimental: true }
export type AlsPlan = ExportPlan<AlsData> & { warnings: string[] };
function renderError(message: string): never { throw new Music2Error("E_RENDER", message); }
const ALS_XML_BUDGET = 128 * 1024 * 1024;
const LOCAL_ID_TAGS = new Set(["Locator", "KeyTrack", "FloatEvent", "EnumEvent", "AutomationEnvelope"]);
function laneEventCount(points: readonly { tick: number; curve: string }[]): number {
  let count = 1 + points.length; // initial sentinel and each authored point
  for (let i = 1; i < points.length; i++)
    if (points[i - 1]!.curve === "hold" && points[i]!.tick > points[i - 1]!.tick) count++;
  return count;
}
function upperBound(sorted: readonly number[], value: number): number {
  let low = 0; let high = sorted.length;
  while (low < high) {
    const middle = (low + high) >>> 1;
    if (sorted[middle]! <= value) low = middle + 1;
    else high = middle;
  }
  return low;
}
function preflightXml(project: ProjectIR): number {
  // Song caps allow 32 tracks and 20,000 events per track. Bound the intermediate XML before building it.
  const starts = project.markers.map((marker) => marker.tick).sort((a, b) => a - b);
  const ends = project.markers.map((marker) => marker.tick + marker.lengthTicks).sort((a, b) => a - b);
  const noteInstances = project.tracks.reduce((sum, track) => sum + (track.type === "audio" ? 0 :
    track.notes.reduce((total, note) => total + upperBound(starts, note.tick) - upperBound(ends, note.tick), 0)), 0);
  const eventCounts = project.tracks.flatMap((track) => track.automation.map((lane) => laneEventCount(lane.points)));
  const events = 2 + eventCounts.reduce((sum, count) => sum + count, 0);
  const textBytes = Buffer.byteLength(project.title) + project.markers.reduce((sum, marker) =>
    sum + Buffer.byteLength(marker.name) * (project.tracks.length + 1), 0) + project.tracks.reduce((sum, track) =>
    sum + Buffer.byteLength(track.id) * 8, 0);
  const estimate = 64 * 1024 + project.tracks.length * 16 * 1024 + project.markers.length * 2048 +
    noteInstances * 512 + events * 256 + textBytes * 6;
  if (!Number.isSafeInteger(estimate) || estimate > ALS_XML_BUDGET)
    throw new Music2Error("E_CAPABILITY", "ALS XML exceeds the 128 MiB generation budget");
  return Math.max(1000, project.markers.length, ...project.tracks.map((track) =>
    track.type === "audio" ? 0 : track.notes.length + 1), ...eventCounts);
}
function assertAlsIds(root: XmlNode, firstGlobal: number, next: number): void {
  const global = new Set<number>(); const targets = new Set<number>(); const references: number[] = [];
  const visit = (node: XmlNode): void => {
    const attrs = new Map(node.attrs);
    const raw = attrs.get("Id");
    if (raw !== undefined) {
      const id = Number(raw);
      if (!Number.isSafeInteger(id) || id < 0 || id >= next ||
        (LOCAL_ID_TAGS.has(node.tag) ? id >= firstGlobal : id < firstGlobal || global.has(id)))
        throw new Music2Error("E_INTERNAL", `ALS Id range or collision: ${node.tag} ${raw}`);
      if (!LOCAL_ID_TAGS.has(node.tag)) global.add(id);
      if (node.tag === "AutomationTarget") targets.add(id);
    }
    if (node.tag === "PointeeId") references.push(Number(attrs.get("Value")));
    for (const child of node.children) if (typeof child !== "string") visit(child);
  };
  visit(root);
  if (global.size !== next - firstGlobal || references.some((id) => !targets.has(id)))
    throw new Music2Error("E_INTERNAL", "ALS global Id sequence or envelope target is invalid");
}
export function planAls(project: ProjectIR, rendered: AlsRendered | null, options: AlsOptions): AlsPlan {
  if (!["midi", "audio", "both"].includes(options.content) || (options.bits !== 16 && options.bits !== 24))
    throw new Music2Error("E_INPUT", "invalid ALS content or bit depth");
  if (project.ppq !== 960 || project.tempo.length === 0 || project.meter.length === 0)
    throw new Music2Error("E_INTERNAL", "invalid ALS ProjectIR tempo or meter");
  if (project.tempo.length !== 1 || project.meter.length !== 1 || project.tempo[0]!.tick !== 0 || project.meter[0]!.tick !== 0)
    throw new Music2Error("E_CAPABILITY", "ALS tempo/meter maps after tick 0 are unsupported");
  const bpm = project.tempo[0]!.bpm; const meter = project.meter[0]!;
  if (!Number.isFinite(bpm) || bpm < 40 || bpm > 240 || meter.numerator < 2 || meter.numerator > 12 || meter.denominator !== 4)
    throw new Music2Error("E_INTERNAL", "invalid ALS tempo or meter value");
  if (options.content === "midi" ? rendered !== null : rendered === null)
    throw new Music2Error("E_INTERNAL", "ALS rendered argument does not match content");
  if (rendered) {
    const ids = project.tracks.map((track) => track.id);
    const stemIds = rendered.stems.map((stem) => stem.trackId);
    if (new Set(stemIds).size !== stemIds.length || stemIds.length !== ids.length || ids.some((id) => !stemIds.includes(id)))
      renderError("rendered ALS stems do not match ProjectIR tracks");
    const buffers = [...rendered.stems.map((stem) => stem.audio),
      ...(["reverb", "delay"] as const).flatMap((bus) => rendered.returns[bus] ? [rendered.returns[bus]] : [])];
    const first = buffers[0];
    if (!first || first.left.length === 0 || buffers.some((wav) => wav.sampleRate !== project.sampleRate ||
      wav.left.length !== first.left.length || wav.right.length !== first.left.length ||
      !wav.left.every(Number.isFinite) || !wav.right.every(Number.isFinite))) renderError("ALS PCM is missing, nonfinite or unaligned");
    const dataSize = first.left.length * 2 * options.bits / 8;
    if (!Number.isSafeInteger(dataSize) || 36 + dataSize > 0xffffffff) renderError("ALS WAV exceeds RIFF size");
  }
  const firstGlobal = preflightXml(project);
  const ids = createAlsIds(firstGlobal);
  const built = buildAlsTracks(project, options.content, rendered, options.bits, ids, options.kitMaps);
  const root = buildAlsSkeleton(project, built.nodes, ids);
  assertAlsIds(root, firstGlobal, ids.nextPointeeId);
  const xmlBytes = serializeXml(root);
  if (xmlBytes.byteLength > ALS_XML_BUDGET)
    throw new Music2Error("E_CAPABILITY", "ALS XML exceeds the 128 MiB generation budget");
  const title = project.title.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80).replace(/-$/g, "") || "untitled";
  const als = `${title}.als`;
  const warnings = ["ALS_EXPERIMENTAL: generated set has not been opened in Ableton Live 12",
    ...built.warnings, ...(project.warnings ?? [])];
  if (options.content === "midi") {
    warnings.push("ALS_MIDI_NO_INSTRUMENT: editable notes have empty instruments and omit source audio, effects and ducking");
    for (const track of project.tracks) if (track.plugins?.length) warnings.push(`PLUGIN_NOT_PORTABLE:${track.id}`);
    const omitted = project.tracks.filter((track) => track.type === "audio").length;
    if (omitted) warnings.push(`ALS_AUDIO_OMITTED:${omitted}`);
  } else warnings.push("ALS_MASTER_PROCESSING_LOST: frozen playback is premaster; Live set omits music2 mastering");
  if (project.tracks.some((track) => track.duck)) warnings.push(options.content === "midi" ? "ALS_DUCKING_OMITTED" : "ALS_DUCKING_FLATTENED");
  if (project.quantization.inexact > 0) warnings.push(`QUANTIZED_PATTERN_EVENTS:${project.quantization.inexact}:${project.quantization.maxErrorTicks}`);
  const files = [...built.samples.map((sample) => ({ ...sample })), { path: als, bytes: gzipAls(xmlBytes) }];
  return { files, warnings: [...new Set(warnings)], data: { als, samples: built.samples.map((sample) => sample.path),
    tracks: built.regular, content: options.content, quantization: project.quantization, experimental: true } };
}
