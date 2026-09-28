import { Music2Error } from "../shared/index.ts";
import type { ResolvedInsert, ReverbBusParams, DelayBusParams } from "../render/fx/fx.schema.ts";
import type { ExportFile } from "./export.schema.ts";

export interface StemsManifest {
  version: 1; title: string; bpm: number;
  meter: { numerator: number; denominator: 4 }; key: string | null;
  sampleRate: 44100 | 48000; bits: 16 | 24; frames: number;
  barOrigin: number; bars: number; loop: boolean;
  sectionMarkers: { name: string; section: string; role: string | null;
    bar: number; sourceBar: number; seconds: number }[];
  tracks: { id: string; file: string; type: "notes" | "drums" | "audio";
    instrument: string | null; gainDb: number; pan: number;
    sends: { reverb: number; delay: number }; inserts: ResolvedInsert[]; automated?: true }[];
  returns: { id: "reverb" | "delay"; file: string; legacy: boolean;
    params: ReverbBusParams | DelayBusParams | null }[];
  master: { file: "master.wav"; ceilingDb: number;
    processing: ["inserts", "saturation", "limiter"] } | null;
  premaster: "premaster.wav" | null;
}

export interface StemsData { files: string[]; frames: number; sampleRate: number }

function invalid(message: string): never { throw new Music2Error("E_RENDER", message); }
function keys(value: object, expected: string[], name: string): void {
  if (Object.keys(value).join(",") !== expected.join(",")) invalid(`invalid ${name} key order or shape`);
}
const safePath = (path: string): boolean =>
  path.length > 0 && !path.startsWith("/") && !path.includes("\\") && !path.includes(":") &&
  path.split("/").every((part) => part !== "" && part !== "." && part !== "..");

/** Verify the manifest describes precisely the staged files and aligned PCM buffers. */
export function validateStemsManifest(manifest: StemsManifest, files: ExportFile[]): void {
  keys(manifest, ["version", "title", "bpm", "meter", "key", "sampleRate", "bits", "frames",
    "barOrigin", "bars", "loop", "sectionMarkers", "tracks", "returns", "master", "premaster"], "manifest");
  keys(manifest.meter, ["numerator", "denominator"], "meter");
  if (manifest.version !== 1 || typeof manifest.title !== "string" || !Number.isFinite(manifest.bpm) ||
    manifest.bpm <= 0 || !Number.isSafeInteger(manifest.meter.numerator) || manifest.meter.numerator < 1 ||
    manifest.meter.denominator !== 4 || (manifest.key !== null && typeof manifest.key !== "string") ||
    (manifest.sampleRate !== 44100 && manifest.sampleRate !== 48000) ||
    (manifest.bits !== 16 && manifest.bits !== 24) || typeof manifest.loop !== "boolean")
    invalid("invalid stem manifest metadata");
  if (!Number.isSafeInteger(manifest.frames) || manifest.frames <= 0 ||
    !Number.isSafeInteger(manifest.barOrigin) || manifest.barOrigin < 1 ||
    !Number.isSafeInteger(manifest.bars) || manifest.bars < 1) invalid("invalid stem frame or bar count");
  for (const marker of manifest.sectionMarkers) {
    keys(marker, ["name", "section", "role", "bar", "sourceBar", "seconds"], "marker");
    if (typeof marker.name !== "string" || typeof marker.section !== "string" ||
      (marker.role !== null && typeof marker.role !== "string")) invalid("invalid stem marker metadata");
  }
  for (const track of manifest.tracks) {
    keys(track, ["id", "file", "type", "instrument", "gainDb", "pan", "sends", "inserts",
      ...(track.automated === undefined ? [] : ["automated"])], "track");
    keys(track.sends, ["reverb", "delay"], "sends");
    if (!/^[a-z][a-z0-9_-]{0,31}$/.test(track.id) || track.file !== `tracks/${track.id}.wav` ||
      !["notes", "drums", "audio"].includes(track.type) || !Number.isFinite(track.gainDb) ||
      !Number.isFinite(track.pan) || !Number.isFinite(track.sends.reverb) ||
      !Number.isFinite(track.sends.delay) || !Array.isArray(track.inserts) ||
      (track.instrument !== null && typeof track.instrument !== "string") ||
      (track.automated !== undefined && track.automated !== true)) invalid("invalid stem track metadata");
  }
  for (const bus of manifest.returns) {
    keys(bus, ["id", "file", "legacy", "params"], "return");
    if ((bus.id !== "reverb" && bus.id !== "delay") || bus.file !== `returns/${bus.id}.wav` ||
      typeof bus.legacy !== "boolean" || (bus.legacy && bus.params !== null) ||
      (!bus.legacy && bus.params === null)) invalid("invalid stem return metadata");
  }
  if (manifest.master) {
    keys(manifest.master, ["file", "ceilingDb", "processing"], "master");
    if (manifest.master.file !== "master.wav" || !Number.isFinite(manifest.master.ceilingDb) ||
      !Array.isArray(manifest.master.processing) ||
      manifest.master.processing.join(",") !== "inserts,saturation,limiter") invalid("invalid stem master metadata");
  }
  if (manifest.premaster !== null && manifest.premaster !== "premaster.wav") invalid("invalid pre-master path");
  const referenced = [
    ...manifest.tracks.map((track) => track.file), ...manifest.returns.map((bus) => bus.file),
    ...(manifest.master ? [manifest.master.file] : []),
    ...(manifest.premaster ? [manifest.premaster] : []), "stems.json",
  ];
  const paths = files.map((file) => file.path);
  if (manifest.tracks.length === 0 || manifest.returns.length > 2 ||
    manifest.returns.some((bus, i) => i > 0 && (bus.id === manifest.returns[i - 1]?.id || bus.id === "reverb")))
    invalid("invalid stem track or return order");
  if (referenced.length !== paths.length || referenced.some((path, i) => path !== paths[i]))
    invalid("stem manifest file list does not match bundle order");
  if (new Set(paths).size !== paths.length || paths.some((path) => !safePath(path)))
    invalid("stem bundle contains duplicate or unsafe path");
  if (files.some((file, index) => index === files.length - 1 ? !("bytes" in file) : !("wav" in file)))
    invalid("stem file descriptors do not match manifest");
  const metadata = files.at(-1);
  if (!metadata || !("bytes" in metadata) ||
    Buffer.compare(Buffer.from(metadata.bytes), Buffer.from(serializeStemsManifest(manifest))) !== 0)
    invalid("stems.json bytes do not match manifest");
  for (const file of files) {
    if (!("wav" in file)) continue;
    if (file.bits !== manifest.bits || file.wav.sampleRate !== manifest.sampleRate ||
      file.wav.left.length !== manifest.frames || file.wav.right.length !== manifest.frames ||
      !file.wav.left.every(Number.isFinite) || !file.wav.right.every(Number.isFinite))
      invalid(`stem buffer is not finite and aligned: ${file.path}`);
  }
  if (manifest.sectionMarkers.some((marker) => marker.bar < 1 || marker.bar > manifest.bars ||
    marker.sourceBar !== marker.bar + manifest.barOrigin - 1 || !Number.isFinite(marker.seconds)))
    invalid("invalid stem section marker");
}

export function serializeStemsManifest(manifest: StemsManifest): Uint8Array {
  return Buffer.from(JSON.stringify(manifest, null, 2) + "\n", "utf8");
}
