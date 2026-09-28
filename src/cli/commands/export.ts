import { rm, writeFile } from "node:fs/promises";
import { extname, resolve } from "node:path";
import { buildProject } from "../../project/index.ts";
import { Music2Error } from "../../shared/index.ts";
import { buildTimeline, loadSong } from "../../song/index.ts";
import { validateDawVoiceLanes } from "../../render/voices/registry.tool.ts";
import { assertDistinct, commitNoReplace, commitReplace, stage } from "../files.ts";
import type { CommandSpec } from "../registry.ts";

function inputError(message: string): Music2Error { return new Music2Error("E_INPUT", message); }

export const exportCommand: CommandSpec = {
  name: "export", summary: "Export a song to ProjectIR JSON",
  usage: "music2 export ir <song.json> [-o ir.json] [--force] [--json]",
  options: {
    out: { type: "string", short: "o", description: "Output ProjectIR JSON path" },
    force: { type: "boolean", description: "Replace an existing output file" },
  },
  async run({ args, values, cwd }) {
    if (args[0] !== "ir" || args.length !== 2 || !args[1])
      throw inputError("export requires: ir <song.json>");
    const input = resolve(cwd, args[1]);
    const outValue = values["out"];
    if (outValue !== undefined && (typeof outValue !== "string" || outValue.length === 0))
      throw inputError("--out requires a path");
    const output = typeof outValue === "string" ? resolve(cwd, outValue) : undefined;
    if (output !== undefined && extname(output).toLowerCase() !== ".json")
      throw inputError("out must end in .json");
    const force = values["force"] === true;
    if (force && output === undefined) throw inputError("--force requires -o");
    if (output !== undefined) await assertDistinct([input], [output]);
    const song = await loadSong(input);
    validateDawVoiceLanes(song);
    const ir = buildProject(song, buildTimeline(song));
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
