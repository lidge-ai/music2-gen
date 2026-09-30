import { stat } from "node:fs/promises";
import { resolve } from "node:path";
import { defaultSampleRoots, findCandidates, importFolder, readLibraryIndex, scanLibrary, verifyInstrument, writeLibraryIndex } from "../../library/index.ts";
import type { CandidateFolder, ImportOptions } from "../../library/index.ts";
import { noteToMidi } from "../../pattern/index.ts";
import { listUserInstruments, USER_ID_PATTERN } from "../../sampler/index.ts";
import { Music2Error } from "../../shared/index.ts";
import type { CommandSpec } from "../registry.ts";

const allowed: Record<string, string[]> = {
  scan: ["root"], find: ["root", "kind", "limit"],
  import: ["id", "as", "filter", "octave", "attack", "release", "force"],
  verify: ["notes"], list: ["kind", "limit"],
};
function input(message: string): Music2Error { return new Music2Error("E_INPUT", message); }
function table(headers: string[], rows: (string | number)[][]): string {
  const cells = [headers, ...rows].map((row) => row.map((cell) => String(cell).replace(/[\r\n\t]/g, " ")));
  const widths = headers.map((_, i) => Math.max(...cells.map((row) => row[i]?.length ?? 0)));
  return cells.map((row) => row.map((cell, i) => i === row.length - 1 ? cell : cell.padEnd(widths[i]!)).join("  ")).join("\n");
}
function candidateTable(candidates: CandidateFolder[]): string {
  return table(["KIND", "NAME", "FILES", "PATH"], candidates.map((item) => [item.kind, item.name, item.files, item.path]));
}
function kind(value: unknown): "instrument" | "kit" | undefined {
  if (value === undefined) return undefined;
  if (value !== "instrument" && value !== "kit") throw input("--kind must be instrument or kit");
  return value;
}
function limit(value: unknown): number | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "string" || !/^[1-9]\d*$/.test(value) || !Number.isSafeInteger(Number(value)))
    throw input("--limit must be a positive integer");
  return Number(value);
}
function seconds(value: unknown, flag: string): number | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "string" || value.trim() === "" || !Number.isFinite(Number(value)) || Number(value) < 0)
    throw input(`--${flag} must be finite nonnegative seconds`);
  return Number(value);
}
function octave(value: unknown): "auto" | "none" | number | undefined {
  if (value === undefined || value === "auto" || value === "none") return value;
  if (typeof value !== "string" || !/^-?\d+$/.test(value) || !Number.isSafeInteger(Number(value)))
    throw input("--octave must be auto, none or an integer");
  return Number(value);
}
function notes(value: unknown): number[] | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "string") throw input("--notes requires comma-separated note names or MIDI numbers");
  return value.split(",").map((part) => {
    const token = part.trim();
    try {
      if (token === "") throw input("empty note");
      const midi = /^\d+$/.test(token) ? Number(token) : noteToMidi(token);
      if (!Number.isInteger(midi) || midi < 0 || midi > 127) throw input("MIDI note outside 0..127");
      return midi;
    } catch { throw input(`invalid --notes entry: ${token}`); }
  });
}
function roots(value: unknown, cwd: string): string[] {
  if (value === undefined) return defaultSampleRoots();
  if (!Array.isArray(value) || value.length === 0 || !value.every((item): item is string => typeof item === "string" && item.trim() !== ""))
    throw input("--root requires a directory");
  return [...new Set(value.map((item) => resolve(cwd, item)))];
}
async function importOptions(values: Record<string, unknown>, folder: string): Promise<ImportOptions> {
  const id = values["id"];
  if (typeof id !== "string" || !USER_ID_PATTERN.test(id)) throw input("--id must be 1..48 lowercase letters, digits or hyphens, starting with a letter or digit");
  const as = kind(values["as"]);
  const shift = octave(values["octave"]);
  const attackSeconds = seconds(values["attack"], "attack"), releaseSeconds = seconds(values["release"], "release");
  const filter = values["filter"];
  if (filter !== undefined && (typeof filter !== "string" || filter.trim() === "")) throw input("--filter requires text");
  try { if (!(await stat(folder)).isDirectory()) throw input("import requires a sample folder"); }
  catch (cause) {
    if (cause instanceof Music2Error) throw cause;
    if ((cause as NodeJS.ErrnoException).code === "ENOENT" || (cause as NodeJS.ErrnoException).code === "ENOTDIR")
      throw input("import requires an existing sample folder");
    throw new Music2Error("E_ACCESS", "cannot access sample folder", { cause });
  }
  return { id, ...(as === undefined ? {} : { as }), ...(shift === undefined ? {} : { octave: shift }),
    ...(attackSeconds === undefined ? {} : { attackSeconds }), ...(releaseSeconds === undefined ? {} : { releaseSeconds }),
    ...(filter === undefined ? {} : { filter }), force: values["force"] === true };
}

export const library: CommandSpec = {
  name: "library", summary: "Scan local sample libraries, import user instruments and verify pitch",
  usage: "music2 library <scan|find|import|verify|list> [words|folder|id] [--root dir ...] [--kind instrument|kit] [--id id] [--as instrument|kit] [--filter text] [--octave auto|none|integer] [--attack seconds] [--release seconds] [--notes C3,E3,G3,C4] [--force] [--limit N] [--json]",
  options: {
    root: { type: "string", multiple: true, description: "Sample root; repeated roots replace defaults (scan/find)" },
    kind: { type: "string", description: "Filter find/list: instrument or kit" },
    id: { type: "string", description: "Import ID: lowercase letters, digits and hyphens, 1..48 characters" },
    as: { type: "string", description: "Import as instrument or kit; inferred by default" },
    filter: { type: "string", description: "Import filename filter" },
    octave: { type: "string", description: "Pitch correction: auto (default), none, or integer octaves" },
    attack: { type: "string", description: "Instrument attack in nonnegative seconds" },
    release: { type: "string", description: "Instrument release in nonnegative seconds" },
    notes: { type: "string", description: "Verify comma-separated note names or MIDI numbers (default C3,E3,G3,C4)" },
    force: { type: "boolean", description: "Replace an existing imported ID transactionally" },
    limit: { type: "string", description: "Maximum find/list results: positive integer" },
  },
  async run({ args, values, cwd }) {
    const [verb, ...rest] = args;
    if (!verb || !Object.hasOwn(allowed, verb)) throw input("library requires scan, find, import, verify or list");
    for (const flag of Object.keys(library.options)) if (values[flag] !== undefined && !allowed[verb]!.includes(flag))
      throw input(`--${flag} is not supported by library ${verb}`);
    if ((verb === "scan" || verb === "list") && rest.length !== 0) throw input(`library ${verb} accepts no positional arguments`);
    if ((verb === "import" || verb === "verify") && rest.length !== 1) throw input(`library ${verb} requires exactly one ${verb === "import" ? "folder" : "id"}`);
    if (verb === "find" && (rest.length === 0 || rest.some((word) => word.trim() === ""))) throw input("library find requires search words");
    if (verb === "scan" || verb === "find") {
      const selectedKind = kind(values["kind"]), maximum = limit(values["limit"]);
      let index = verb === "find" && values["root"] === undefined ? await readLibraryIndex() : null;
      let cache: string | undefined;
      if (!index) { index = await scanLibrary(roots(values["root"], cwd)); cache = await writeLibraryIndex(index); }
      if (verb === "scan") return { command: "library", data: { index }, artifacts: cache ? [cache] : [],
        text: candidateTable([...index.instruments, ...index.kits]) };
      const candidates = findCandidates(index, rest, selectedKind, maximum);
      return { command: "library", data: { candidates }, artifacts: cache ? [cache] : [], text: candidateTable(candidates) };
    }
    if (verb === "import") {
      const folder = resolve(cwd, rest[0]!);
      const report = await importFolder(folder, await importOptions(values, folder));
      return { command: "library", data: { ...report }, artifacts: [report.dir], warnings: report.warnings,
        text: `${report.instrument}\n${table(["FILE", "NAMED", "MEASURED", "OFFSET", "CONFIDENCE"], report.files.map((file) =>
          [file.source, file.named ?? "—", file.measured, file.offset, file.confidence.toFixed(3)]))}` };
    }
    if (verb === "verify") {
      const id = rest[0]!;
      if (!USER_ID_PATTERN.test(id)) throw input("invalid user instrument id");
      const report = await verifyInstrument(id, notes(values["notes"]));
      if (!report.ok) throw new Music2Error("E_QA", `pitch verification failed for ${id}`, { details: { report } });
      return { command: "library", data: { ...report }, text: table(["WANT", "GOT", "CENTS", "OK"],
        report.notes.map((note) => [note.want, note.got, note.cents.toFixed(1), String(note.ok)])) };
    }
    const selectedKind = kind(values["kind"]), maximum = limit(values["limit"]);
    const instruments = (await listUserInstruments()).filter((item) => !selectedKind || item.kind === (selectedKind === "instrument" ? "sfz" : "kit")).slice(0, maximum);
    return { command: "library", data: { instruments }, text: table(["INSTRUMENT", "KIND", "ZONES", "ROLE"],
      instruments.map((item) => [`user:${item.id}`, item.kind, item.zones?.length ?? 0, item.role ?? "—"])) };
  },
};
