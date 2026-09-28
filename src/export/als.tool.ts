import type { ProjectIR } from "../project/index.ts";
import { Music2Error } from "../shared/index.ts";
import type { ExportPlan } from "./export.schema.ts";
import { buildAlsSkeleton, createAlsIds } from "./als/skeleton.tool.ts";
import { buildAlsTracks, type AlsContent, type AlsRendered } from "./als/tracks.tool.ts";
import { gzipAls } from "./gzip.tool.ts";
import { serializeXml } from "./xml.tool.ts";

export type { AlsContent, AlsRendered } from "./als/tracks.tool.ts";
export interface AlsOptions { content: AlsContent; bits: 16 | 24;
  kitMaps?: Readonly<Record<string, Readonly<Record<string, number>>>> }
export interface AlsData { als: string; samples: string[]; tracks: number; content: AlsContent;
  quantization: ProjectIR["quantization"]; experimental: true }
export type AlsPlan = ExportPlan<AlsData> & { warnings: string[] };
function renderError(message: string): never { throw new Music2Error("E_RENDER", message); }
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
    const bytes = 44 + first.left.length * 2 * options.bits / 8;
    if (!Number.isSafeInteger(bytes) || bytes > 0xffffffff) renderError("ALS WAV exceeds RIFF size");
  }
  const maxLocal = Math.max(project.markers.length, ...project.tracks.flatMap((track) =>
    track.type === "audio" ? [0] : [track.notes.length]));
  const ids = createAlsIds(Math.max(1000, maxLocal + 1));
  const built = buildAlsTracks(project, options.content, rendered, options.bits, ids, options.kitMaps);
  const root = buildAlsSkeleton(project, built.nodes, ids);
  const title = project.title.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80).replace(/-$/g, "") || "untitled";
  const als = `${title}.als`;
  const warnings = ["ALS_EXPERIMENTAL: generated set has not been opened in Ableton Live 12", ...built.warnings];
  if (options.content === "midi") {
    warnings.push("ALS_MIDI_NO_INSTRUMENT: editable notes have empty instruments and omit source audio, effects and ducking");
    const omitted = project.tracks.filter((track) => track.type === "audio").length;
    if (omitted) warnings.push(`ALS_AUDIO_OMITTED:${omitted}`);
  } else warnings.push("ALS_MASTER_PROCESSING_LOST: frozen playback is premaster; Live set omits music2 mastering");
  if (project.tracks.some((track) => track.duck)) warnings.push(options.content === "midi" ? "ALS_DUCKING_OMITTED" : "ALS_DUCKING_FLATTENED");
  if (project.quantization.inexact > 0) warnings.push(`QUANTIZED_PATTERN_EVENTS:${project.quantization.inexact}:${project.quantization.maxErrorTicks}`);
  const files = [...built.samples.map((sample) => ({ ...sample })), { path: als, bytes: gzipAls(serializeXml(root)) }];
  return { files, warnings: [...new Set(warnings)], data: { als, samples: built.samples.map((sample) => sample.path),
    tracks: built.regular, content: options.content, quantization: project.quantization, experimental: true } };
}
