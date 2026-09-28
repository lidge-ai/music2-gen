import { lstat, mkdir, readdir, rm, rmdir, writeFile } from "node:fs/promises";
import { dirname, extname, join, resolve } from "node:path";
import { buildProject } from "../../project/index.ts";
import { projectToSmf, writeSmf } from "../../midi/index.ts";
import { kitMidiMap } from "../../midi/gm.tool.ts";
import { loadKitMidiMap } from "../../render/kit.tool.ts";
import { Music2Error } from "../../shared/index.ts";
import { buildTimeline, loadSong } from "../../song/index.ts";
import { renderSong } from "../../render/index.ts";
import { writeWav } from "../../audio-io/index.ts";
import { planStems } from "../../export/index.ts";
import { validateDawVoiceLanes } from "../../render/voices/registry.tool.ts";
import { assertDistinct, commitNoReplace, commitReplace, stage } from "../files.ts";
import type { CommandSpec } from "../registry.ts";

function inputError(message: string): Music2Error { return new Music2Error("E_INPUT", message); }

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

async function ensureStemDirectory(path: string, created: string[]): Promise<void> {
  try {
    const info = await lstat(path);
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
      const info = await lstat(path);
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
  const result = await renderSong(song, input, { stems: true, returns: true, premaster: includePremaster, ...(bars ? { bars } : {}) });
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
    files: plan.data.files, frames: plan.data.frames, sampleRate: plan.data.sampleRate },
  artifacts: finals, warnings: [], text: `wrote ${output}` };
}

export const exportCommand: CommandSpec = {
  name: "export", summary: "Export a song to ProjectIR JSON, MIDI, or aligned WAV stems",
  usage: "music2 export ir <song.json> [-o ir.json] | music2 export midi <song.json> -o file.mid | music2 export stems <song.json> -o dir [--bits 16|24] [--premaster] [--no-master] [--bars a:b] [--force] [--json]",
  options: {
    out: { type: "string", short: "o", description: "Output file or stems directory" },
    force: { type: "boolean", description: "Replace planned output files" },
    bits: { type: "string", description: "Stem WAV depth: 16 or 24 (default 24)" },
    premaster: { type: "boolean", description: "Include pre-master WAV" },
    "no-master": { type: "boolean", description: "Omit mastered WAV" },
    bars: { type: "string", description: "Stem crop, zero-based half-open a:b" },
  },
  async run({ args, values, cwd }) {
    if ((args[0] !== "ir" && args[0] !== "midi" && args[0] !== "stems") || args.length !== 2 || !args[1])
      throw inputError("export requires: ir|midi|stems <song.json>");
    const midi = args[0] === "midi";
    const stems = args[0] === "stems";
    if (!stems && ["bits", "premaster", "no-master", "bars"].some((flag) => values[flag] !== undefined))
      throw inputError("stem flags require export stems");
    const input = resolve(cwd, args[1]);
    if (midi && extname(input).toLowerCase() !== ".json") throw inputError("export midi requires .json input");
    const outValue = values["out"];
    if (outValue !== undefined && (typeof outValue !== "string" || outValue.length === 0))
      throw inputError("--out requires a path");
    const output = typeof outValue === "string" ? resolve(cwd, outValue) : undefined;
    if ((midi || stems) && output === undefined) throw inputError(`export ${args[0]} requires -o`);
    if (stems && output) return exportStems(input, output, values);
    if (output !== undefined && extname(output).toLowerCase() !== (midi ? ".mid" : ".json"))
      throw inputError(`out must end in ${midi ? ".mid" : ".json"}`);
    const force = values["force"] === true;
    if (force && output === undefined) throw inputError("--force requires -o");
    if (output !== undefined) await assertDistinct([input], [output]);
    const song = await loadSong(input);
    validateDawVoiceLanes(song);
    const ir = buildProject(song, buildTimeline(song));
    if (midi && output !== undefined) {
      const kitMaps: Record<string, Record<string, number>> = {};
      const kitWarnings: string[] = [];
      for (const track of ir.tracks) if (track.type !== "audio" && track.instrument.kind === "kit") {
        const { names, explicit } = await loadKitMidiMap(input, `kit:${track.instrument.ref}`);
        const declared = new Set(names);
        for (const note of track.notes) if (note.sample && !declared.has(note.sample.name))
          throw new Music2Error("E_SCHEMA", `kit ${track.id} is missing sample ${note.sample.name}`);
        const mapping = kitMidiMap(names, explicit);
        kitMaps[track.id] = mapping.byName;
        kitWarnings.push(...mapping.warnings.map((warning) => `${warning}:${track.id}`));
      }
      const projected = projectToSmf(ir, { kitMaps });
      const bytes = writeSmf(projected.file);
      const staged = stage(output);
      try {
        try { await writeFile(staged.temporary, bytes, { flag: "wx" }); }
        catch (cause) { throw new Music2Error("E_ACCESS", `cannot write output: ${output}`, { details: { path: output }, cause }); }
        if (force) await commitReplace([staged]); else await commitNoReplace([staged]);
      } finally { await rm(staged.temporary, { force: true }); }
      return { command: "export", data: { mid: output, format: 1, ppq: 960, tracks: projected.file.tracks.length,
        notes: projected.notes, channels: projected.channels, quantization: ir.quantization, dropped: projected.dropped },
      artifacts: [output], warnings: [...kitWarnings, ...projected.warnings], text: `wrote ${output}` };
    }
    const formatted = JSON.stringify(ir, null, 2) + "\n";
    const warnings = ir.quantization.inexact > 0 ?
      [`${ir.quantization.inexact} inexact event(s); max error ${ir.quantization.maxErrorTicks} ticks`] : [];
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
