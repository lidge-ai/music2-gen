import { readFile, rm, stat, writeFile } from "node:fs/promises";
import { extname, resolve } from "node:path";
import { kitMidiMap, readSmf, smfToSong } from "../../midi/index.ts";
import { loadKitMidiMap } from "../../render/kit.tool.ts";
import { Music2Error } from "../../shared/index.ts";
import { validateSong } from "../../song/index.ts";
import { assertDistinct, commitNoReplace, commitReplace, stage } from "../files.ts";
import type { CommandSpec } from "../registry.ts";

const inputError = (message: string): Music2Error => new Music2Error("E_INPUT", message);

export const importCommand: CommandSpec = {
  name: "import", summary: "Import a MIDI file as Song v1 note lists",
  usage: "music2 import midi <file.mid> -o <song.json> [--title text] [--strict] [--force] [--json]",
  options: {
    out: { type: "string", short: "o", description: "Destination Song JSON path" },
    title: { type: "string", description: "Song title" },
    strict: { type: "boolean", description: "Reject tempo or meter changes" },
    force: { type: "boolean", description: "Replace an existing output file" },
  },
  async run({ args, values, cwd }) {
    if (args[0] !== "midi" || args.length !== 2 || !args[1]) throw inputError("import requires: midi <file.mid>");
    const from = resolve(cwd, args[1]);
    const out = values["out"];
    if (typeof out !== "string" || out.length === 0) throw inputError("import midi requires -o");
    const to = resolve(cwd, out);
    if (extname(from).toLowerCase() !== ".mid" || extname(to).toLowerCase() !== ".json")
      throw inputError("import requires .mid input and .json output");
    const title = values["title"];
    if (title !== undefined && (typeof title !== "string" || !title.trim() || title.length > 120))
      throw inputError("--title must contain 1..120 characters");
    await assertDistinct([from], [to]);
    let size: number;
    try { size = (await stat(from)).size; }
    catch (cause) {
      if ((cause as NodeJS.ErrnoException).code === "ENOENT") throw new Music2Error("E_NOT_FOUND", `MIDI file not found: ${from}`, { cause });
      throw new Music2Error("E_ACCESS", `cannot read MIDI file: ${from}`, { cause });
    }
    if (size > 16 * 1024 * 1024) throw inputError("MIDI file exceeds 16 MiB");
    let bytes: Uint8Array;
    try { bytes = await readFile(from); }
    catch (cause) { throw new Music2Error("E_ACCESS", `cannot read MIDI file: ${from}`, { cause }); }
    const file = readSmf(bytes);
    const kitMaps: Record<string, Record<number, string>> = {};
    const identities = new Set<string>();
    for (const track of file.tracks) for (const event of track.events) {
      if (event.kind !== "meta" || event.type !== 1) continue;
      const identity = String.fromCharCode(...event.data);
      if (identity.startsWith("music2:kit:")) identities.add(identity.slice(7));
    }
    for (const identity of identities) {
      let mapping: Awaited<ReturnType<typeof loadKitMidiMap>>;
      try { mapping = await loadKitMidiMap(to, identity); }
      catch (cause) {
        if (cause instanceof Music2Error && cause.code === "E_ACCESS" &&
            (cause.cause as NodeJS.ErrnoException | undefined)?.code === "ENOENT") continue;
        throw cause;
      }
      const byName = kitMidiMap(mapping.names, mapping.explicit).byName;
      kitMaps[identity] = Object.fromEntries(Object.entries(byName)
        .filter(([name]) => /^[A-Za-z][A-Za-z0-9#.-]*$/.test(name))
        .map(([name, note]) => [note, name]));
    }
    const converted = smfToSong(file, { ...(typeof title === "string" ? { title } : {}),
      strict: values["strict"] === true, kitMaps });
    try { validateSong(converted.song); }
    catch (cause) { throw new Music2Error("E_INTERNAL", "MIDI import produced invalid Song v1", { cause }); }
    const content = JSON.stringify(converted.song, null, 2) + "\n";
    const staged = stage(to);
    try {
      try { await writeFile(staged.temporary, content, { flag: "wx" }); }
      catch (cause) { throw new Music2Error("E_ACCESS", `cannot write output: ${to}`, { details: { path: to }, cause }); }
      if (values["force"] === true) await commitReplace([staged]); else await commitNoReplace([staged]);
    } finally { await rm(staged.temporary, { force: true }); }
    return { command: "import", data: { written: to, bpm: converted.song.bpm, meter: converted.song.meter,
      bars: converted.bars, tracks: converted.song.tracks.length, notes: converted.notes, dropped: converted.dropped },
    artifacts: [to], warnings: converted.warnings, text: `wrote ${to}` };
  },
};
