import { lstat, mkdir, mkdtemp, open, readFile, readdir, rm, rmdir, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, extname, isAbsolute, join, relative, resolve } from "node:path";
import { buildProject } from "../../project/index.ts";
import { projectToSmf, writeSmf } from "../../midi/index.ts";
import { Music2Error } from "../../shared/index.ts";
import { buildTimeline, loadSong } from "../../song/index.ts";
import { renderSong } from "../../render/index.ts";
import { createExternalProcessor, loadPluginConfig, parseHostArgv } from "../../plugin-host/index.ts";
import type { ResolvedSong } from "../../song/index.ts";
import type { ExternalProcessor } from "../../render/render.schema.ts";
import { readWav, writeWav } from "../../audio-io/index.ts";
import { loadExportInstruments, planAls, planDawproject, planStems, type DawClipRegion, type DawContent, type DawMedia } from "../../export/index.ts";
import { confinedRealpath, fnv1a32 } from "../../shared/index.ts";
import { validateDawVoiceLanes } from "../../render/voices/registry.tool.ts";
import { assertDistinct, commitNoReplace, commitReplace, stage } from "../files.ts";
import type { CommandSpec } from "../registry.ts";

function inputError(message: string): Music2Error { return new Music2Error("E_INPUT", message); }
const PLUGIN_WARNING = "external plugin audio may vary between renders";
const EDITABLE_PLUGIN_WARNING = "external plugin processing is absent from editable output; frozen audio is required to retain sound";
async function audioProcessor(song: ResolvedSong, values: Record<string, unknown>): Promise<ExternalProcessor | undefined> {
  if (!song.tracks.some((track) => track.plugins?.length)) return undefined;
  if (values["allow-plugins"] !== true) throw new Music2Error("E_CAPABILITY",
    "external plugin audio requires --allow-plugins and configure --plugin-host or MUSIC2_PLUGIN_HOST");
  const host = values["plugin-host"] === undefined ? undefined : parseHostArgv(values["plugin-host"] as string);
  return createExternalProcessor(await loadPluginConfig(), host);
}
function hasPlugins(song: ResolvedSong): boolean { return song.tracks.some((track) => track.plugins?.length); }

function stemBars(value: unknown): { start: number; end: number } | undefined {
  if (value === undefined) return undefined;
  const match = typeof value === "string" ? /^(0|[1-9]\d*):(0|[1-9]\d*)$/.exec(value) : null;
  if (!match) throw inputError("--bars requires a:b with zero-based integers");
  const start = Number(match[1]); const end = Number(match[2]);
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start >= end)
    throw inputError("--bars requires 0 <= a < b");
  return { start, end };
}

async function stemDirectory(path: string, force: boolean): Promise<void> {
  try {
    const info = await lstat(path);
    if (!info.isDirectory()) throw new Music2Error("E_ACCESS", `output is not a directory: ${path}`);
    if (!force && (await readdir(path)).length > 0)
      throw new Music2Error("E_ACCESS", `output directory is occupied: ${path}`);
  } catch (cause) {
    if (cause instanceof Music2Error) throw cause;
    if ((cause as NodeJS.ErrnoException).code !== "ENOENT")
      throw new Music2Error("E_ACCESS", `cannot access output directory: ${path}`, { cause });
  }
}

/** The leaf is checked with lstat in stemDirectory; ancestors may be symlinks such as macOS /tmp. */
async function ensureStemDirectory(path: string, created: string[]): Promise<void> {
  try {
    const info = await stat(path);
    if (!info.isDirectory()) throw new Music2Error("E_ACCESS", `output is not a directory: ${path}`);
    return;
  } catch (cause) {
    if (cause instanceof Music2Error) throw cause;
    if ((cause as NodeJS.ErrnoException).code !== "ENOENT")
      throw new Music2Error("E_ACCESS", `cannot access output directory: ${path}`, { cause });
  }
  if (dirname(path) !== path) await ensureStemDirectory(dirname(path), created);
  try { await mkdir(path); created.push(path); }
  catch (cause) {
    if ((cause as NodeJS.ErrnoException).code === "EEXIST") {
      const info = await stat(path);
      if (info.isDirectory()) return;
    }
    throw new Music2Error("E_ACCESS", `cannot create output directory: ${path}`, { cause });
  }
}

async function exportStems(input: string, output: string, values: Record<string, unknown>) {
  const bitsValue = values["bits"] ?? "24";
  if (bitsValue !== "16" && bitsValue !== "24") throw inputError("--bits must be 16 or 24");
  const bits = bitsValue === "16" ? 16 : 24;
  const bars = stemBars(values["bars"]);
  const force = values["force"] === true;
  await assertDistinct([input], [output]);
  await stemDirectory(output, force);
  const song = await loadSong(input);
  validateDawVoiceLanes(song);
  const timeline = buildTimeline(song);
  if (bars && (song.loop || bars.end > timeline.bars)) throw inputError("--bars is outside the song or selects a loop crop");
  const includePremaster = values["premaster"] === true;
  const external = await audioProcessor(song, values);
  const result = await renderSong(song, input, { stems: true, returns: true, premaster: includePremaster,
    ...(bars ? { bars } : {}), ...(external ? { external } : {}) });
  const plan = planStems(song, timeline, result, { bits, includeMaster: values["no-master"] !== true,
    includePremaster, ...(bars ? { bars } : {}) });
  const finals = plan.files.map((file) => join(output, file.path));
  await assertDistinct([input], finals);
  const createdDirectories: string[] = [];
  const staged = plan.files.map((file) => stage(join(output, file.path)));
  try {
    for (const dir of [output, ...new Set(finals.map(dirname))]) await ensureStemDirectory(dir, createdDirectories);
    for (let i = 0; i < plan.files.length; i++) {
      const file = plan.files[i]!; const item = staged[i]!;
      if ("wav" in file) await writeWav(item.temporary, file.wav, { bits: file.bits, seed: file.seed });
      else {
        try { await writeFile(item.temporary, file.bytes, { flag: "wx" }); }
        catch (cause) { throw new Music2Error("E_ACCESS", `cannot stage output: ${item.final}`, { cause }); }
      }
    }
    if (force) await commitReplace(staged); else await commitNoReplace(staged);
  } finally {
    for (const item of staged) await rm(item.temporary, { force: true });
    for (const dir of createdDirectories.reverse()) await rmdir(dir).catch(() => undefined);
  }
  return { command: "export", data: { dir: output, manifest: join(output, "stems.json"),
    files: plan.data.files, frames: plan.data.frames, sampleRate: plan.data.sampleRate,
    ...(result.deterministic === false ? { deterministic: false } : {}) },
  artifacts: finals, warnings: [...(result.warnings ?? [])], text: `wrote ${output}` };
}

async function exportAls(input: string, output: string, values: Record<string, unknown>) {
  const content = values["content"] ?? "both";
  if (content !== "midi" && content !== "audio" && content !== "both") throw inputError("--content must be midi, audio or both");
  const bitsValue = values["bits"] ?? "24";
  if (bitsValue !== "16" && bitsValue !== "24") throw inputError("--bits must be 16 or 24");
  const bits = bitsValue === "16" ? 16 : 24;
  const force = values["force"] === true;
  if (extname(input).toLowerCase() !== ".json") throw inputError("export als requires .json input");
  await assertDistinct([input], [output]);
  await stemDirectory(output, force);
  const song = await loadSong(input);
  validateDawVoiceLanes(song);
  const timeline = buildTimeline(song);
  const project = buildProject(song, timeline);
  const sourcePaths = [...new Set(project.samples.map((sample) => resolve(dirname(input), sample.ref)))];
  if ([input, ...sourcePaths].some((source) => {
    const within = relative(output, source);
    return within === "" || (within !== ".." && !within.startsWith("../") && !within.startsWith("..\\") && !isAbsolute(within));
  })) throw inputError("ALS output directory contains an input/source file");
  await assertDistinct([input, ...sourcePaths], [output]);
  const { kitMaps, userInstruments } = await loadExportInstruments(project, input, content !== "audio");
  const external = content === "midi" ? undefined : await audioProcessor(song, values);
  const rendered = content === "midi" ? null : await renderSong(song, input,
    { stems: true, returns: true, ...(external ? { external } : {}) });
  const plan = planAls(project, rendered ? { stems: rendered.stems,
    returns: rendered.returns ?? { reverb: null, delay: null } } : null, { content, bits, kitMaps, userInstruments });
  const finals = plan.files.map((file) => join(output, file.path));
  await assertDistinct([input, ...sourcePaths], finals);
  const createdDirectories: string[] = [];
  const staged = plan.files.map((file) => stage(join(output, file.path)));
  try {
    for (const dir of [output, ...new Set(finals.map(dirname))]) await ensureStemDirectory(dir, createdDirectories);
    for (let i = 0; i < plan.files.length; i++) {
      const file = plan.files[i]!; const item = staged[i]!;
      if ("wav" in file) {
        await writeWav(item.temporary, file.wav, { bits: file.bits, seed: file.seed });
        const handle = await open(item.temporary, "r");
        const header = Buffer.alloc(44);
        let size: number;
        try { size = (await handle.stat()).size; await handle.read(header, 0, 44, 0); }
        finally { await handle.close(); }
        const expected = 44 + file.wav.left.length * 2 * file.bits / 8;
        if (size !== expected || header.toString("ascii", 0, 4) !== "RIFF" ||
          header.readUInt32LE(24) !== file.wav.sampleRate || header.readUInt16LE(34) !== file.bits ||
          header.readUInt32LE(40) !== expected - 44)
          throw new Music2Error("E_RENDER", `staged ALS WAV header mismatch: ${file.path}`);
      } else {
        try { await writeFile(item.temporary, file.bytes, { flag: "wx" }); }
        catch (cause) { throw new Music2Error("E_ACCESS", `cannot stage output: ${item.final}`, { cause }); }
      }
    }
    if (force) await commitReplace(staged); else await commitNoReplace(staged);
  } finally {
    for (const item of staged) await rm(item.temporary, { force: true });
    for (const dir of createdDirectories.reverse()) await rmdir(dir).catch(() => undefined);
  }
  const als = join(output, plan.data.als);
  const samples = plan.data.samples.map((path) => join(output, path));
  return { command: "export", data: { als, samples, tracks: plan.data.tracks,
    content: plan.data.content, quantization: plan.data.quantization, experimental: true,
    ...(rendered?.deterministic === false ? { deterministic: false } : {}) },
    artifacts: [als, ...samples], warnings: [...plan.warnings,
      ...(rendered?.warnings ?? []), ...(content === "midi" && hasPlugins(song) ? [EDITABLE_PLUGIN_WARNING] : [])],
    text: `EXPERIMENTAL (Live 12 open test pending): wrote ${als}` };
}

async function exportDawproject(input: string, output: string, values: Record<string, unknown>) {
  const content = (values["content"] ?? "both") as DawContent;
  if (!["midi", "audio", "both"].includes(content)) throw inputError("--content must be midi, audio or both");
  if (extname(input).toLowerCase() !== ".json" || extname(output).toLowerCase() !== ".dawproject")
    throw inputError("export dawproject requires .json input and .dawproject output");
  if (["bits", "premaster", "no-master", "bars"].some((flag) => values[flag] !== undefined))
    throw inputError("stem-only flags are unsupported for export dawproject");
  const force = values["force"] === true;
  await assertDistinct([input], [output]);
  if (!force) {
    try { await lstat(output); throw new Music2Error("E_ACCESS", `output already exists: ${output}`); }
    catch (cause) { if (cause instanceof Music2Error) throw cause;
      if ((cause as NodeJS.ErrnoException).code !== "ENOENT") throw cause; }
  }
  const song = await loadSong(input);
  const external = content === "midi" ? undefined : await audioProcessor(song, values);
  validateDawVoiceLanes(song);
  const project = buildProject(song, buildTimeline(song));
  const sources = new Map<number, DawMedia>();
  if (content !== "audio") {
    const used = new Set(project.tracks.flatMap((track) => track.type === "audio" ? track.clips.map((clip) => clip.sample) : []));
    let ordinal = 0;
    for (const [sampleIndex, sample] of project.samples.entries()) if (used.has(sampleIndex)) {
      const path = await confinedRealpath(dirname(input), sample.ref);
      await assertDistinct([path], [output]);
      let wav;
      try { wav = await readWav(path); }
      catch (cause) {
        if (cause instanceof Music2Error && cause.code === "E_INPUT")
          throw new Music2Error("E_SCHEMA", `invalid source WAV: ${sample.ref}`, { cause });
        throw cause;
      }
      sources.set(sampleIndex, { path: `audio/source-${String(ordinal++).padStart(4, "0")}.wav`,
        bytes: await readFile(path), frames: wav.left.length, sampleRate: wav.sampleRate,
        channels: wav.sourceChannels, owner: { kind: "source", sampleIndex } });
    }
  }
  const { kitMaps, userInstruments } = await loadExportInstruments(project, input, content !== "audio", false);
  const regions: DawClipRegion[] = [];
  if (content !== "audio") for (const track of project.tracks) if (track.type === "audio")
    for (const [clipIndex, clip] of track.clips.entries()) {
      const media = sources.get(clip.sample);
      if (!media) throw new Music2Error("E_RENDER", `missing source WAV for ${track.id}`);
      const startSeconds = Math.round(clip.offsetSeconds * media.sampleRate) / media.sampleRate;
      const seconds = clip.lengthTicks / 960 * 60 / project.tempo[0]!.bpm;
      const speed = clip.stretch.mode === "varispeed" ? clip.stretch.ratio : 1;
      const endSeconds = clip.stretch.mode === "fit" ? startSeconds +
        Math.round(clip.stretch.sourceSeconds * media.sampleRate) / media.sampleRate :
        clip.stretch.mode === "tempo" ? media.frames / media.sampleRate :
          startSeconds + seconds * speed * 2 ** (clip.pitchSemitones / 12);
      regions.push({ trackId: track.id, clipIndex, startSeconds, endSeconds });
    }
  const media: DawMedia[] = [...sources.values()];
  let temporaryDir: string | undefined;
  let pluginRendered = false;
  try {
    if (content !== "midi") {
      const rendered = await renderSong(song, input, { stems: true, returns: true, ...(external ? { external } : {}) });
      pluginRendered = rendered.deterministic === false;
      temporaryDir = await mkdtemp(join(tmpdir(), "music2-dawproject-"));
      const all = [...rendered.stems.map((stem) => ({ owner: { kind: "stem" as const, trackId: stem.trackId },
        path: `audio/stem-${stem.trackId}.wav` as const, audio: stem.audio })),
        ...(["reverb", "delay"] as const).flatMap((bus) => rendered.returns?.[bus] ?
          [{ owner: { kind: "return" as const, bus }, path: `audio/return-${bus}.wav` as const,
            audio: rendered.returns[bus] }] : [])];
      for (const entry of all) {
        const path = join(temporaryDir, "media.wav");
        await writeWav(path, entry.audio, { bits: 24,
          seed: fnv1a32(song.seed, entry.path, "dawproject") });
        media.push({ path: entry.path, bytes: await readFile(path), frames: entry.audio.left.length,
          sampleRate: entry.audio.sampleRate, channels: 2, owner: entry.owner });
      }
    }
    const plan = planDawproject(project, media, regions,
      { content, outputName: output.split(/[\\/]/).at(-1)!, kitMaps, userInstruments });
    const staged = stage(output);
    try {
      const artifact = plan.files[0]!;
      if (!("bytes" in artifact)) throw new Music2Error("E_RENDER", "DAWproject planner returned no ZIP bytes");
      try { await writeFile(staged.temporary, artifact.bytes, { flag: "wx" }); }
      catch (cause) { throw new Music2Error("E_ACCESS", `cannot write output: ${output}`, { details: { path: output }, cause }); }
      if (force) await commitReplace([staged]); else await commitNoReplace([staged]);
    } finally { await rm(staged.temporary, { force: true }); }
    return { command: "export", data: { ...plan.data, dawproject: output,
      ...(pluginRendered ? { deterministic: false } : {}) }, artifacts: [output],
      warnings: [...plan.warnings, ...(content !== "midi" && hasPlugins(song) ? [PLUGIN_WARNING] : []),
        ...(content === "midi" && hasPlugins(song) ? [EDITABLE_PLUGIN_WARNING] : [])], text: `wrote ${output}` };
  } finally { if (temporaryDir) { await rm(join(temporaryDir, "media.wav"), { force: true }); await rmdir(temporaryDir); } }
}

export const exportCommand: CommandSpec = {
  name: "export", summary: "Export ProjectIR, MIDI, WAV stems, Ableton Live Set, or DAWproject",
  usage: "music2 export <ir|midi|stems|als|dawproject> <song.json> [-o path] [--content midi|audio|both] [--allow-plugins] [--plugin-host JSON-argv] [--force] [--json]",
  options: {
    out: { type: "string", short: "o", description: "Output file or stems directory" },
    force: { type: "boolean", description: "Replace planned output files" },
    bits: { type: "string", description: "Stem WAV depth: 16 or 24 (default 24)" },
    premaster: { type: "boolean", description: "Include pre-master WAV" },
    "no-master": { type: "boolean", description: "Omit mastered WAV" },
    bars: { type: "string", description: "Stem crop, zero-based half-open a:b" },
    content: { type: "string", description: "DAW export content: midi, audio or both (default both)" },
    "allow-plugins": { type: "boolean", description: "Allow configured external effects in audio exports" },
    "plugin-host": { type: "string", description: "Trusted host command as a JSON argv array" },
  },
  async run({ args, values, cwd }) {
    if ((args[0] !== "ir" && args[0] !== "midi" && args[0] !== "stems" && args[0] !== "als" && args[0] !== "dawproject") || args.length !== 2 || !args[1])
      throw inputError("export requires: ir|midi|stems|als|dawproject <song.json>");
    if (values["plugin-host"] !== undefined && values["allow-plugins"] !== true)
      throw inputError("--plugin-host requires --allow-plugins");
    if (values["plugin-host"] !== undefined) parseHostArgv(values["plugin-host"] as string);
    const midi = args[0] === "midi";
    const stems = args[0] === "stems";
    const als = args[0] === "als";
    const dawproject = args[0] === "dawproject";
    if (!als && !dawproject && values["content"] !== undefined) throw inputError("--content requires export als or dawproject");
    if (als && ["premaster", "no-master", "bars"].some((flag) => values[flag] !== undefined))
      throw inputError("stem-only flags are unsupported for export als");
    if (!stems && !als && !dawproject && ["bits", "premaster", "no-master", "bars"].some((flag) => values[flag] !== undefined))
      throw inputError("stem flags require export stems");
    const input = resolve(cwd, args[1]);
    if (midi && extname(input).toLowerCase() !== ".json") throw inputError("export midi requires .json input");
    const outValue = values["out"];
    if (outValue !== undefined && (typeof outValue !== "string" || outValue.length === 0))
      throw inputError("--out requires a path");
    const output = typeof outValue === "string" ? resolve(cwd, outValue) : undefined;
    if ((midi || stems || als || dawproject) && output === undefined) throw inputError(`export ${args[0]} requires -o`);
    if (stems && output) return exportStems(input, output, values);
    if (als && output) return exportAls(input, output, values);
    if (dawproject && output) return exportDawproject(input, output, values);
    if (output !== undefined && extname(output).toLowerCase() !== (midi ? ".mid" : ".json"))
      throw inputError(`out must end in ${midi ? ".mid" : ".json"}`);
    const force = values["force"] === true;
    if (force && output === undefined) throw inputError("--force requires -o");
    if (output !== undefined) await assertDistinct([input], [output]);
    const song = await loadSong(input);
    validateDawVoiceLanes(song);
    const ir = buildProject(song, buildTimeline(song));
    if (midi && output !== undefined) {
      const { kitMaps, userInstruments, warnings: kitWarnings } = await loadExportInstruments(ir, input);
      const projected = projectToSmf(ir, { kitMaps, userInstruments });
      const bytes = writeSmf(projected.file);
      const staged = stage(output);
      try {
        try { await writeFile(staged.temporary, bytes, { flag: "wx" }); }
        catch (cause) { throw new Music2Error("E_ACCESS", `cannot write output: ${output}`, { details: { path: output }, cause }); }
        if (force) await commitReplace([staged]); else await commitNoReplace([staged]);
      } finally { await rm(staged.temporary, { force: true }); }
      return { command: "export", data: { mid: output, format: 1, ppq: 960, tracks: projected.file.tracks.length,
        notes: projected.notes, channels: projected.channels, quantization: ir.quantization, dropped: projected.dropped },
      artifacts: [output], warnings: [...kitWarnings, ...projected.warnings,
        ...(hasPlugins(song) ? [EDITABLE_PLUGIN_WARNING] : [])], text: `wrote ${output}` };
    }
    const formatted = JSON.stringify(ir, null, 2) + "\n";
    const warnings = ir.quantization.inexact > 0 ?
      [`${ir.quantization.inexact} inexact event(s); max error ${ir.quantization.maxErrorTicks} ticks`] : [];
    if (hasPlugins(song)) warnings.push(EDITABLE_PLUGIN_WARNING);
    if (output === undefined) return { command: "export", data: { ir }, artifacts: [], warnings, text: formatted.trimEnd() };
    const staged = stage(output);
    try {
      try { await writeFile(staged.temporary, formatted, { flag: "wx" }); }
      catch (cause) { throw new Music2Error("E_ACCESS", `cannot write output: ${output}`, { details: { path: output }, cause }); }
      if (force) await commitReplace([staged]); else await commitNoReplace([staged]);
    } finally {
      await rm(staged.temporary, { force: true });
    }
    return { command: "export", data: { written: output, quantization: ir.quantization },
      artifacts: [output], warnings, text: `wrote ${output}` };
  },
};
