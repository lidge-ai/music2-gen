import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { SONG_JSON_SCHEMA } from "../../song/index.ts";
import { Music2Error } from "../../shared/index.ts";
import type { CommandSpec } from "../registry.ts";

export const schema: CommandSpec = {
  name: "schema", summary: "Print or write the song v1 JSON Schema",
  usage: "music2 schema [--out file] [--json]",
  options: { out: { type: "string", description: "Write JSON Schema to a file" } },
  async run({ args, values, cwd }) {
    if (args.length) throw new Music2Error("E_INPUT", "schema takes no positional arguments");
    const out = values["out"];
    if (typeof out !== "string") return { command: "schema", data: { schema: SONG_JSON_SCHEMA } };
    const path = resolve(cwd, out);
    try { await writeFile(path, `${JSON.stringify(SONG_JSON_SCHEMA, null, 2)}\n`); }
    catch (error) { throw new Music2Error("E_INPUT", `cannot write schema: ${path}`, { details: { path }, cause: error }); }
    return { command: "schema", data: { written: path }, artifacts: [path] };
  },
};
