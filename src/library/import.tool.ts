import { lstat, mkdir, readFile, readdir, realpath, rename, rm, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";
import { decodeAiff, readWav, readWavSmpl, writeWav } from "../audio-io/index.ts";
import type { StereoBuffer } from "../audio-io/index.ts";
import { Music2Error } from "../shared/index.ts";
import { parseUserManifest, USER_ID_PATTERN, userInstrumentsDir } from "../sampler/user-instrument.tool.ts";
import type { UserInstrumentManifest, UserZone } from "../sampler/user-instrument.tool.ts";
import type { ImportOptions, ImportReport, ImportedFile } from "./library.schema.ts";
import { AUDIO_EXTENSION, drumAtom, namedMidi } from "./names.tool.ts";
import { measureRoot } from "./pitch.tool.ts";

let stagingCounter = 0;
interface Source { source: string; audio: StereoBuffer; loop: { start: number; end: number } | null; named: number | null; warnings: string[] }
interface Imported { source: Source; report: ImportedFile; file: string }

function validate(options: ImportOptions): void {
  if (!USER_ID_PATTERN.test(options.id)) throw new Music2Error("E_INPUT", "invalid instrument id");
  if (options.as !== undefined && options.as !== "kit" && options.as !== "instrument") throw new Music2Error("E_INPUT", "invalid import kind");
  const octave = options.octave ?? "auto";
  if (octave !== "auto" && octave !== "none" && (typeof octave !== "number" || !Number.isInteger(octave) || Math.abs(octave) > 10)) throw new Music2Error("E_INPUT", "invalid octave override");
  for (const seconds of [options.attackSeconds, options.releaseSeconds]) if (seconds !== undefined && (!Number.isFinite(seconds) || seconds < 0 || seconds > 100)) throw new Music2Error("E_INPUT", "envelope seconds must be in [0,100]");
}
async function exists(path: string): Promise<boolean> {
  try { await lstat(path); return true; }
  catch (cause) { if ((cause as NodeJS.ErrnoException).code === "ENOENT") return false; throw cause; }
}
async function decode(path: string, name: string): Promise<Source> {
  const bytes = await readFile(path);
  if (/\.wav$/i.test(name)) {
    const audio = await readWav(path); const meta = readWavSmpl(bytes);
    return { source: name, audio, loop: meta.loop, named: namedMidi(name) ?? meta.unityNote, warnings: meta.warnings };
  }
  const decoded = decodeAiff(bytes); const left = decoded.channels[0]!;
  return { source: name, audio: { sampleRate: decoded.sampleRate, left, right: decoded.channels[1] ?? left,
    sourceChannels: decoded.channels.length === 1 ? 1 : 2 }, loop: decoded.loop, named: namedMidi(name) ?? decoded.baseNote, warnings: [] };
}
function validLoop(source: Source): { start: number; end: number } | null {
  const loop = source.loop;
  return loop && loop.start >= 0 && loop.start < loop.end && loop.end < source.audio.left.length ? loop : null;
}
function mono(audio: StereoBuffer): Float32Array {
  const output = new Float32Array(audio.left.length);
  for (let i = 0; i < output.length; i++) output[i] = (audio.left[i]! + audio.right[i]!) * 0.5;
  return output;
}
function zonesFor(imported: Imported[]): UserZone[] {
  const roots = [...new Set(imported.map(({ report }) => report.measured))].sort((a, b) => a - b);
  return imported.map(({ report, file }) => {
    const at = roots.indexOf(report.measured); const previous = roots[at - 1]; const next = roots[at + 1];
    return { file, named: report.named, measured: report.measured, offset: report.offset, confidence: report.confidence,
      lokey: previous === undefined ? 0 : Math.floor((previous + report.measured) / 2) + 1,
      hikey: next === undefined ? 127 : Math.floor((report.measured + next) / 2) };
  });
}
async function writeInstrument(staging: string, id: string, imported: Imported[], options: ImportOptions): Promise<UserZone[]> {
  const zones = zonesFor(imported);
  const sfz = zones.map((zone, index) => {
    const loop = validLoop(imported[index]!.source);
    return `<region> sample=${zone.file} lokey=${zone.lokey} hikey=${zone.hikey} pitch_keycenter=${zone.measured} tune=0 ampeg_attack=${options.attackSeconds ?? 0.005} ampeg_release=${options.releaseSeconds ?? 0.1}`
      + (loop ? ` loop_mode=loop_continuous loop_start=${loop.start} loop_end=${loop.end}` : " loop_mode=no_loop");
  }).join("\n") + "\n";
  await writeFile(join(staging, `${id}.sfz`), sfz);
  return zones;
}
async function build(staging: string, folder: string, names: string[], options: ImportOptions): Promise<Omit<ImportReport, "dir" | "instrument">> {
  const pitched = names.filter((name) => namedMidi(name) !== null).length;
  const drums = names.filter((name) => drumAtom(name) !== null).length;
  const kind = (options.as ?? (drums > pitched ? "kit" : "instrument")) === "kit" ? "kit" : "sfz";
  const warnings: string[] = []; const imported: Imported[] = [];
  const variants: Record<string, string[]> = Object.create(null) as Record<string, string[]>;
  const counts = new Map<number, number>();
  for (const name of names) {
    const atom = drumAtom(name);
    if (kind === "kit" && atom === null) { warnings.push(`skipped unrecognized drum: ${name}`); continue; }
    const source = await decode(join(folder, name), name);
    warnings.push(...source.warnings.map((warning) => `${name}: ${warning}`));
    const detected = measureRoot(mono(source.audio), source.audio.sampleRate, source.named, validLoop(source));
    let measured = detected.midi;
    if (kind === "sfz" && options.octave !== undefined && options.octave !== "auto") {
      if (source.named === null) throw new Music2Error("E_INPUT", `octave override needs a named note: ${name}`);
      measured = source.named + (options.octave === "none" ? 0 : 12 * options.octave);
    }
    if (!Number.isInteger(measured) || measured < 0 || measured > 127) throw new Music2Error("E_INPUT", `keycenter is outside MIDI range: ${name}`);
    const offset = source.named === null ? 0 : (measured - source.named) / 12;
    if (kind === "sfz" && detected.confidence < 0.6) warnings.push(`low pitch confidence: ${name}`);
    if (source.loop && !validLoop(source)) warnings.push(`invalid loop disabled: ${name}`);
    const variant = kind === "kit" ? (variants[atom!] ?? []).length : counts.get(measured) ?? 0;
    counts.set(measured, variant + 1);
    const file = kind === "kit" ? `${atom}-${variant}.wav` : `n${measured}${variant > 0 ? `-v${variant}` : ""}.wav`;
    if (kind === "kit") (variants[atom!] ??= []).push(file);
    await writeWav(join(staging, file), source.audio, { bits: 24, seed: 0 });
    const report: ImportedFile = { source: basename(name), named: source.named, measured, offset, confidence: detected.confidence,
      ...(kind === "kit" ? { atom: atom!, variant } : {}) };
    imported.push({ source, report, file });
  }
  if (!imported.length) throw new Music2Error("E_INPUT", "folder has no matching importable samples");
  imported.sort((a, b) => a.report.measured - b.report.measured || (a.report.source < b.report.source ? -1 : a.report.source > b.report.source ? 1 : 0));
  const zones = kind === "sfz" ? await writeInstrument(staging, options.id, imported, options) : undefined;
  if (kind === "kit") await writeFile(join(staging, "kit.json"), JSON.stringify({ version: 1, samples: variants }, null, 2) + "\n");
  const manifest: UserInstrumentManifest = { version: 1, id: options.id, kind, entry: kind === "sfz" ? `${options.id}.sfz` : "kit.json",
    source: { folder: basename(folder) }, warnings, ...(zones ? { zones } : {}), ...(kind === "kit" ? { variants } : {}) };
  await writeFile(join(staging, "instrument.json"), JSON.stringify(parseUserManifest(manifest, options.id), null, 2) + "\n");
  return { id: options.id, kind, files: imported.map(({ report }) => report), warnings };
}

/** Stage every artifact before touching an existing import, and restore it on failure. */
export async function importFolder(folder: string, options: ImportOptions): Promise<ImportReport> {
  validate(options);
  let canonical: string; let names: string[];
  try {
    canonical = await realpath(folder);
    const entries = await readdir(canonical, { withFileTypes: true });
    names = entries.filter((entry) => entry.isFile() && AUDIO_EXTENSION.test(entry.name)
      && (!options.filter || entry.name.toLowerCase().includes(options.filter.toLowerCase()))).map((entry) => entry.name).sort();
  } catch (cause) { throw new Music2Error("E_INPUT", "invalid sample folder", { cause }); }
  if (!names.length) throw new Music2Error("E_INPUT", "folder has no matching audio files");
  const base = userInstrumentsDir(); const dir = join(base, options.id);
  const staging = join(base, `.staging-${options.id}-${process.pid}-${++stagingCounter}`);
  const trash = join(base, `.trash-${options.id}-${process.pid}`);
  let movedOld = false; let installed = false; let report: Omit<ImportReport, "dir" | "instrument">;
  try {
    await mkdir(base, { recursive: true });
    if (await exists(dir) && !options.force) throw new Music2Error("E_INPUT", `instrument ${options.id} already exists; use --force`);
    await mkdir(staging);
    report = await build(staging, canonical, names, options);
    if (await exists(dir)) {
      if (!options.force) throw new Music2Error("E_INPUT", `instrument ${options.id} already exists; use --force`);
      if (await exists(trash)) throw new Music2Error("E_ACCESS", "previous replacement backup needs recovery");
      await rename(dir, trash); movedOld = true;
    }
    // Installing the staged directory is the commit point; nothing after it rolls back.
    await rename(staging, dir); installed = true;
  } catch (cause) {
    if (movedOld && !installed) await rename(trash, dir);
    if (cause instanceof Music2Error) throw cause;
    throw new Music2Error("E_ACCESS", "cannot import sample folder", { cause });
  } finally { await rm(staging, { recursive: true, force: true }); }
  const warnings = [...report.warnings];
  if (movedOld) {
    try { await rm(trash, { recursive: true, force: true }); }
    catch { warnings.push(`previous import kept at ${basename(trash)}; remove it once the new import is confirmed`); }
  }
  return { ...report, warnings, dir, instrument: `user:${options.id}` };
}
