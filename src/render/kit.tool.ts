import { readFile, realpath } from "node:fs/promises";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { readWav, resampleLinear } from "../audio-io/index.ts";
import { Music2Error } from "../shared/index.ts";
import type { KitManifest, LoadedKit, VoiceContext } from "./render.schema.ts";

function schemaError(kitPath: string, message: string, sampleName?: string): Music2Error {
  return new Music2Error("E_SCHEMA", `kit ${kitPath}: ${message}`, { details: { kitPath, sampleName } });
}

function accessError(kitPath: string, message: string, sampleName?: string, cause?: unknown): Music2Error {
  return new Music2Error("E_ACCESS", `kit ${kitPath}: ${message}`, { details: { kitPath, sampleName }, cause });
}

function confined(root: string, candidate: string): boolean {
  const offset = relative(root, candidate);
  return offset !== ".." && !offset.startsWith(`..${process.platform === "win32" ? "\\" : "/"}`) && !isAbsolute(offset);
}

/** Longest allowed start trim for a late-attack sample. */
const MAX_START_MS = 10000;
/** Short fade before a notes-track stop so a cut sample does not end in a step. */
export const KIT_RELEASE_MS = 5;

function parseManifest(input: unknown, kitPath: string): KitManifest {
  if (input === null || typeof input !== "object" || Array.isArray(input)) throw schemaError(kitPath, "manifest must be an object");
  const manifest = input as Record<string, unknown>;
  const allowed = new Set(["version", "samples", "gainDb", "rootMidi", "midi", "startMs"]);
  for (const key of Object.keys(manifest)) if (!allowed.has(key)) throw schemaError(kitPath, `unknown field ${key}`);
  if (manifest["version"] !== 1) throw schemaError(kitPath, "version must be 1");
  const samples = manifest["samples"];
  if (samples === null || typeof samples !== "object" || Array.isArray(samples) || Object.keys(samples).length === 0) {
    throw schemaError(kitPath, "samples must be a nonempty object");
  }
  for (const [name, variants] of Object.entries(samples)) {
    if (name.trim().length === 0 || !Array.isArray(variants) || variants.length === 0 ||
        variants.some((path: unknown) => typeof path !== "string" || path.trim().length === 0)) {
      throw schemaError(kitPath, `invalid variants for ${name}`, name);
    }
  }
  const midi = manifest["midi"];
  if (midi !== undefined) {
    if (midi === null || typeof midi !== "object" || Array.isArray(midi))
      throw new Music2Error("E_SCHEMA", `kit ${kitPath}: $.midi must be an object`,
        { details: { kitPath, path: "$.midi", issues: [{ path: "$.midi", message: "must be an object" }] } });
    const used = new Set<number>();
    for (const [name, value] of Object.entries(midi)) {
      if (!Object.hasOwn(samples, name) || !Number.isInteger(value) || (value as number) < 0 ||
          (value as number) > 127 || used.has(value as number))
        throw new Music2Error("E_SCHEMA", `kit ${kitPath}: invalid $.midi.${name}`, { details: {
          kitPath, sampleName: name, path: `$.midi.${name}`,
          issues: [{ path: `$.midi.${name}`, message: "unknown sample, invalid note, or duplicate assignment" }],
        } });
      used.add(value as number);
    }
  }
  const startMs = manifest["startMs"];
  if (startMs !== undefined) {
    if (startMs === null || typeof startMs !== "object" || Array.isArray(startMs)) throw schemaError(kitPath, "startMs must be an object");
    for (const [name, value] of Object.entries(startMs)) {
      if (!Object.hasOwn(samples, name) || typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > MAX_START_MS)
        throw schemaError(kitPath, `invalid startMs.${name}: unknown sample or value outside [0,${MAX_START_MS}]`, name);
    }
  }
  const gainDb = manifest["gainDb"];
  if (gainDb !== undefined && (typeof gainDb !== "number" || !Number.isFinite(gainDb) || gainDb < -60 || gainDb > 12)) {
    throw schemaError(kitPath, "gainDb must be finite in [-60,12]");
  }
  const rootMidi = manifest["rootMidi"];
  if (rootMidi !== undefined && (typeof rootMidi !== "number" || !Number.isFinite(rootMidi) || rootMidi < 0 || rootMidi > 127)) {
    throw schemaError(kitPath, "rootMidi must be finite in [0,127]");
  }
  return input as KitManifest;
}

/** Read mapping metadata only; never decode samples for MIDI interchange. */
export async function loadKitMidiMap(songPath: string, instrument: string): Promise<{ names: string[]; explicit: Record<string, number> }> {
  if (!instrument.startsWith("kit:") || instrument.length === 4) throw schemaError(instrument, "expected kit:<path>");
  const ref = instrument.slice(4);
  if (isAbsolute(ref) || /^[A-Za-z]:[\\/]/.test(ref) || ref.startsWith("\\") ||
      ref.split(/[\\/]/).includes("..") || ref.includes("\0"))
    throw accessError(ref, "kit path escapes song directory");
  const root = await realpath(dirname(songPath)).catch((cause: unknown) => { throw accessError(songPath, "cannot access song directory", undefined, cause); });
  const path = resolve(root, ref.endsWith("kit.json") ? ref : join(ref, "kit.json"));
  if (!confined(root, path)) throw accessError(path, "kit path escapes song directory");
  let canonical: string;
  try { canonical = await realpath(path); }
  catch (cause) { throw accessError(path, "cannot access kit.json", undefined, cause); }
  if (!confined(root, canonical)) throw accessError(path, "kit.json escapes song directory");
  let raw: string;
  try { raw = await readFile(canonical, "utf8"); }
  catch (cause) { throw accessError(path, "cannot read kit.json", undefined, cause); }
  let parsed: unknown;
  try { parsed = JSON.parse(raw) as unknown; }
  catch (cause) { throw new Music2Error("E_SCHEMA", `kit ${path}: invalid JSON`, { details: { kitPath: path }, cause }); }
  const manifest = parseManifest(parsed, path);
  return { names: Object.keys(manifest.samples), explicit: manifest.midi ?? {} };
}

/** Kit data and its decode cache belong to one load/render invocation. */
export async function loadKit(songPath: string, instrument: string, sampleRate: number): Promise<LoadedKit> {
  if (!instrument.startsWith("kit:") || instrument.length === 4) throw schemaError(instrument, "expected kit:<path>");
  const kitRef = instrument.slice(4);
  const kitPath = resolve(dirname(songPath), kitRef.endsWith("kit.json") ? kitRef : join(kitRef, "kit.json"));
  let kitRoot: string;
  let raw: string;
  try {
    kitRoot = await realpath(dirname(kitPath));
    const canonicalManifest = await realpath(kitPath);
    if (!confined(kitRoot, canonicalManifest)) throw accessError(kitPath, "kit.json escapes kit directory");
    raw = await readFile(canonicalManifest, "utf8");
  } catch (cause) {
    if (cause instanceof Music2Error) throw cause;
    throw accessError(kitPath, "cannot read kit.json", undefined, cause);
  }
  let parsed: unknown;
  try { parsed = JSON.parse(raw) as unknown; }
  catch (cause) { throw new Music2Error("E_SCHEMA", `kit ${kitPath}: invalid JSON`, { details: { kitPath }, cause }); }
  const manifest = parseManifest(parsed, kitPath);
  const decoded = new Map<string, Float32Array>();
  const samples: Record<string, Float32Array[]> = Object.create(null) as Record<string, Float32Array[]>;
  for (const [name, variants] of Object.entries(manifest.samples)) {
    const loaded: Float32Array[] = [];
    for (const source of variants) {
      if (isAbsolute(source)) throw accessError(kitPath, `sample ${name} must have a relative path`, name);
      const candidate = resolve(kitRoot, source);
      if (!confined(kitRoot, candidate)) throw accessError(kitPath, `sample ${name} escapes kit directory`, name);
      let canonical: string;
      try { canonical = await realpath(candidate); }
      catch (cause) { throw accessError(kitPath, `cannot access sample ${name}`, name, cause); }
      if (!confined(kitRoot, canonical)) throw accessError(kitPath, `sample ${name} escapes kit directory`, name);
      const cacheKey = `${canonical}\0${sampleRate}`;
      let mono = decoded.get(cacheKey);
      if (!mono) {
        let audio;
        try { audio = await readWav(canonical); }
        catch (cause) {
          if (cause instanceof Music2Error && cause.code === "E_ACCESS") throw accessError(kitPath, `cannot read sample ${name}`, name, cause);
          throw new Music2Error("E_SCHEMA", `kit ${kitPath}: cannot decode sample ${name}`, { details: { kitPath, sampleName: name }, cause });
        }
        const folded = new Float32Array(audio.left.length);
        for (let i = 0; i < folded.length; i++) folded[i] = ((audio.left[i] ?? 0) + (audio.right[i] ?? 0)) * 0.5;
        mono = audio.sampleRate === sampleRate ? folded : resampleLinear(folded, audio.sampleRate, sampleRate);
        decoded.set(cacheKey, mono);
      }
      // The decode cache keeps the untrimmed file; each sample name applies its own start trim.
      const trim = Math.round((manifest.startMs?.[name] ?? 0) * sampleRate / 1000);
      if (trim >= mono.length) throw schemaError(kitPath, `startMs.${name} is past the end of ${source}`, name);
      loaded.push(trim > 0 ? mono.subarray(trim) : mono);
    }
    samples[name] = loaded;
  }
  return { manifest, samples, sampleRate };
}

/** Events sum in Timeline order into one reusable track-length mono buffer. */
export function renderKit(ctx: VoiceContext, kit: LoadedKit): Float32Array {
  const output = new Float32Array(ctx.frames);
  const gain = 10 ** ((kit.manifest.gainDb ?? 0) / 20);
  const noteName = Object.hasOwn(kit.samples, "note") ? "note" : Object.keys(kit.samples)[0];
  for (const event of ctx.events) {
    const name = ctx.track.kind === "drums" ? event.sample?.name : noteName;
    const variants = name === undefined ? undefined : kit.samples[name];
    if (!variants || variants.length === 0) throw schemaError(ctx.track.instrument, `missing sample ${name ?? "<none>"}`, name);
    const index = event.sample?.index ?? 0;
    const sample = variants[((index % variants.length) + variants.length) % variants.length];
    if (!sample) continue;
    const ratio = ctx.track.kind === "notes" ? 2 ** (((event.midi ?? (kit.manifest.rootMidi ?? 60)) - (kit.manifest.rootMidi ?? 60)) / 12) : 1;
    const limit = Math.min(ctx.frames, ctx.track.kind === "notes" ? event.stopFrame : ctx.frames);
    const amplitude = gain * event.velocity;
    const start = Math.max(0, event.startFrame);
    // Only notes tracks cut a sample at stopFrame; drum samples play to their end.
    const cut = ctx.track.kind === "notes" && limit < event.startFrame + sample.length / ratio;
    const fade = cut ? Math.min(Math.round(KIT_RELEASE_MS * ctx.sampleRate / 1000), Math.floor((limit - start) / 2)) : 0;
    for (let frame = start; frame < limit; frame++) {
      const position = (frame - event.startFrame) * ratio;
      if (position >= sample.length) break;
      const first = Math.floor(position);
      const fraction = position - first;
      const left = sample[first] ?? 0;
      const value = left + ((sample[Math.min(first + 1, sample.length - 1)] ?? left) - left) * fraction;
      const release = fade > 0 && frame >= limit - fade ? (limit - frame - 1) / fade : 1;
      output[frame] = (output[frame] ?? 0) + value * amplitude * release;
    }
  }
  return output;
}
