import type { ProjectIR } from "../../project/index.ts";
import { Music2Error } from "../../shared/index.ts";
import type { ExportPlan } from "../export.schema.ts";
import { metadataXml } from "./metadata-xml.tool.ts";
import { buildProjectXml } from "./project-xml.tool.ts";
import { writeStoreZip } from "./zip.tool.ts";

export type DawContent = "midi" | "audio" | "both";
export interface DawMedia {
  path: `audio/${string}.wav`; bytes: Uint8Array; frames: number; sampleRate: number; channels: 1 | 2;
  owner: { kind: "source"; sampleIndex: number } | { kind: "stem"; trackId: string } |
    { kind: "return"; bus: "reverb" | "delay" };
}
export interface DawClipRegion { trackId: string; clipIndex: number; startSeconds: number; endSeconds: number }
export interface DawData { dawproject: string; entries: string[]; tracks: number; content: DawContent;
  quantization: ProjectIR["quantization"] }
export type DawprojectPlan = ExportPlan<DawData> & { warnings: string[] };

function invalid(message: string): never { throw new Music2Error("E_RENDER", `DAWproject ${message}`); }
/** Inspect the embedded RIFF chunks; descriptors must match the actual file, including its data size. */
function validateWav(media: DawMedia, project: ProjectIR): void {
  const bytes = Buffer.from(media.bytes.buffer, media.bytes.byteOffset, media.bytes.byteLength);
  if (bytes.length < 44 || bytes.toString("ascii", 0, 4) !== "RIFF" ||
    bytes.toString("ascii", 8, 12) !== "WAVE" || bytes.readUInt32LE(4) + 8 !== bytes.length)
    invalid(`invalid RIFF ${media.path}`);
  let fmt: { channels: number; sampleRate: number; width: number } | null = null;
  let frames: number | null = null;
  for (let at = 12; at < bytes.length;) {
    if (at + 8 > bytes.length) invalid(`truncated WAV chunk ${media.path}`);
    const name = bytes.toString("ascii", at, at + 4);
    const size = bytes.readUInt32LE(at + 4);
    const data = at + 8;
    if (data + size > bytes.length) invalid(`truncated WAV data ${media.path}`);
    if (name === "fmt " && fmt === null) {
      if (size < 16) invalid(`invalid WAV format ${media.path}`);
      const tag = bytes.readUInt16LE(data); const channels = bytes.readUInt16LE(data + 2);
      const sampleRate = bytes.readUInt32LE(data + 4); const width = bytes.readUInt16LE(data + 12);
      const bits = bytes.readUInt16LE(data + 14);
      if (!((tag === 1 && [16, 24, 32].includes(bits)) || (tag === 3 && bits === 32)) ||
        (channels !== 1 && channels !== 2) || width !== channels * bits / 8 ||
        sampleRate < 8000 || sampleRate > 192000 || bytes.readUInt32LE(data + 8) !== sampleRate * width)
        invalid(`invalid WAV format ${media.path}`);
      fmt = { channels, sampleRate, width };
    }
    if (name === "data" && frames === null) frames = size;
    at = data + size + (size & 1);
    if (at > bytes.length) invalid(`missing WAV pad byte ${media.path}`);
  }
  if (!fmt || frames === null || frames % fmt.width !== 0 ||
    media.frames !== frames / fmt.width || media.channels !== fmt.channels || media.sampleRate !== fmt.sampleRate ||
    (media.owner.kind !== "source" && media.sampleRate !== project.sampleRate))
    invalid(`WAV descriptor mismatch ${media.path}`);
}

export function planDawproject(project: ProjectIR, media: readonly DawMedia[], regions: readonly DawClipRegion[],
  options: { content: DawContent; outputName: string;
    kitMaps?: Readonly<Record<string, Readonly<Record<string, number>>>> }): DawprojectPlan {
  if (!["midi", "audio", "both"].includes(options.content) || !options.outputName.endsWith(".dawproject") ||
    options.outputName.includes("/") || options.outputName.includes("\\"))
    throw new Music2Error("E_INPUT", "invalid DAWproject content or output name");
  const paths = new Set<string>(); const owners = new Set<string>();
  for (const entry of media) {
    if (!/^audio\/[a-z0-9][a-z0-9_-]*\.wav$/.test(entry.path) || paths.has(entry.path)) invalid("invalid or duplicate media path");
    paths.add(entry.path);
    const owner = entry.owner.kind === "source" ? `source:${entry.owner.sampleIndex}` :
      entry.owner.kind === "stem" ? `stem:${entry.owner.trackId}` : `return:${entry.owner.bus}`;
    if (owners.has(owner)) invalid("duplicate media owner");
    owners.add(owner);
    validateWav(entry, project);
  }
  for (const region of regions) {
    const track = project.tracks.find((entry) => entry.id === region.trackId);
    const clip = track?.type === "audio" ? track.clips[region.clipIndex] : undefined;
    if (!clip || !Number.isFinite(region.startSeconds) || !Number.isFinite(region.endSeconds) ||
      region.startSeconds < 0 || region.endSeconds < region.startSeconds ||
      Math.abs(region.startSeconds - Math.round(clip.offsetSeconds * (media.find((entry) =>
        entry.owner.kind === "source" && entry.owner.sampleIndex === clip.sample)?.sampleRate ?? 1)) /
        (media.find((entry) => entry.owner.kind === "source" && entry.owner.sampleIndex === clip.sample)?.sampleRate ?? 1)) > 1e-6)
      invalid(`invalid source region ${region.trackId}:${region.clipIndex}`);
  }
  const needed = options.content === "midi" ? media.filter((entry) => entry.owner.kind === "source") :
    options.content === "audio" ? media.filter((entry) => entry.owner.kind !== "source") : [...media];
  if (needed.length !== media.length) invalid("media for unselected content");
  const built = buildProjectXml(project, { content: options.content, media, regions,
    ...(options.kitMaps ? { kitMaps: options.kitMaps } : {}) });
  const referenced = new Set([...Buffer.from(built.bytes).toString("utf8").matchAll(/<File path="([^"]+)"\s*\/>/g)]
    .map((match) => match[1]!));
  for (const path of referenced) if (!paths.has(path)) invalid(`missing referenced media ${path}`);
  const files = [{ path: "metadata.xml", bytes: metadataXml(project) },
    { path: "project.xml", bytes: built.bytes },
    ...media.filter((entry) => referenced.has(entry.path))
      .sort((a, b) => Buffer.compare(Buffer.from(a.path), Buffer.from(b.path))).map((entry) =>
      ({ path: entry.path, bytes: entry.bytes }))];
  const zip = writeStoreZip(files);
  const warnings = [...built.warnings, ...(project.warnings ?? [])];
  if (options.content === "midi") {
    warnings.push("MIDI_SOUND_NOT_PORTABLE: music2 instruments, effects and ducking are not embedded");
    for (const track of project.tracks) if (track.plugins?.length) warnings.push(`PLUGIN_NOT_PORTABLE:${track.id}`);
  }
  else warnings.push("MASTER_PROCESSING_NOT_PORTABLE: premaster stems omit music2 mastering");
  if (project.buses.reverb || project.buses.delay) warnings.push("EFFECT_DEVICE_NOT_PORTABLE");
  if (project.quantization.inexact) warnings.push(`QUANTIZED_PATTERN_EVENTS:${project.quantization.inexact}:${project.quantization.maxErrorTicks}`);
  return { files: [{ path: options.outputName, bytes: zip }], data: {
    dawproject: options.outputName, entries: files.map((entry) => entry.path), tracks: built.tracks,
    content: options.content, quantization: project.quantization }, warnings };
}
