import { rm, writeFile } from "node:fs/promises";
import { extname, resolve } from "node:path";
import { buildProject } from "../../project/index.ts";
import { projectToSmf, writeSmf } from "../../midi/index.ts";
import { kitMidiMap } from "../../midi/gm.tool.ts";
import { loadKitMidiMap } from "../../render/kit.tool.ts";
import { Music2Error } from "../../shared/index.ts";
import { buildTimeline, loadSong } from "../../song/index.ts";
import { validateDawVoiceLanes } from "../../render/voices/registry.tool.ts";
import { assertDistinct, commitNoReplace, commitReplace, stage } from "../files.ts";
import type { CommandSpec } from "../registry.ts";

function inputError(message: string): Music2Error { return new Music2Error("E_INPUT", message); }

export const exportCommand: CommandSpec = {
  name: "export", summary: "Export a song to ProjectIR JSON or MIDI",
  usage: "music2 export ir <song.json> [-o ir.json] | music2 export midi <song.json> -o file.mid [--force] [--json]",
  options: {
    out: { type: "string", short: "o", description: "Output ProjectIR JSON path" },
    force: { type: "boolean", description: "Replace an existing output file" },
  },
  async run({ args, values, cwd }) {
    if ((args[0] !== "ir" && args[0] !== "midi") || args.length !== 2 || !args[1])
      throw inputError("export requires: ir|midi <song.json>");
    const midi = args[0] === "midi";
    const input = resolve(cwd, args[1]);
    if (midi && extname(input).toLowerCase() !== ".json") throw inputError("export midi requires .json input");
    const outValue = values["out"];
    if (outValue !== undefined && (typeof outValue !== "string" || outValue.length === 0))
      throw inputError("--out requires a path");
    const output = typeof outValue === "string" ? resolve(cwd, outValue) : undefined;
    if (midi && output === undefined) throw inputError("export midi requires -o");
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
