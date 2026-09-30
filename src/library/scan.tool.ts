import { readFile, readdir, mkdir, writeFile, realpath } from "node:fs/promises";
import { basename, extname, join, relative, sep } from "node:path";
import { Music2Error, storageDir } from "../shared/index.ts";
import { parseLibraryIndex } from "./library.schema.ts";
import type { CandidateFolder, LibraryIndex } from "./library.schema.ts";
import { AUDIO_EXTENSION, drumAtom, namedMidi } from "./names.tool.ts";

const MAX_DEPTH = 6; const MAX_FILES = 20000;
export async function scanLibrary(roots: string[]): Promise<LibraryIndex> {
  if (roots.length === 0) throw new Music2Error("E_CAPABILITY", "no sample library roots are available");
  const canonical: string[] = [];
  for (const root of roots) {
    try { canonical.push(await realpath(root)); }
    catch (cause) { throw new Music2Error("E_ACCESS", "cannot access sample library root", { cause }); }
  }
  const index: LibraryIndex = { version: 1, roots: [...new Set(canonical)].sort(), instruments: [], kits: [], skipped: { caf: 0, exs: 0, aaz: 0, other: 0 } };
  let visited = 0;
  async function walk(path: string, root: string, depth: number): Promise<void> {
    if (visited >= MAX_FILES) return;
    let entries;
    try { entries = await readdir(path, { withFileTypes: true }); }
    catch (cause) { throw new Music2Error("E_ACCESS", "cannot scan sample folder", { cause }); }
    entries.sort((a, b) => a.name < b.name ? -1 : a.name > b.name ? 1 : 0);
    const names: string[] = []; const formats: Record<string, number> = {};
    for (const entry of entries) {
      if (visited >= MAX_FILES) break;
      if (!entry.isFile()) continue;
      visited++;
      const format = extname(entry.name).slice(1).toLowerCase();
      if (AUDIO_EXTENSION.test(entry.name)) { names.push(entry.name); formats[format] = (formats[format] ?? 0) + 1; }
      else if (format === "caf" || format === "exs" || format === "aaz") index.skipped[format]++;
      else index.skipped.other++;
    }
    const pitched = names.filter((name) => namedMidi(name) !== null).length;
    const drumHits = names.filter((name) => drumAtom(name) !== null).length;
    const candidate = (kind: CandidateFolder["kind"]): CandidateFolder => ({ path, root, name: basename(path),
      category: relative(root, path).split(sep).filter(Boolean), kind, files: names.length, pitched, drumHits, formats });
    if (pitched >= 3) index.instruments.push(candidate("instrument"));
    if (drumHits >= 3) index.kits.push(candidate("kit"));
    if (depth < MAX_DEPTH) for (const entry of entries) if (entry.isDirectory()) await walk(join(path, entry.name), root, depth + 1);
  }
  for (const root of index.roots) await walk(root, root, 0);
  const compare = (a: CandidateFolder, b: CandidateFolder): number => a.path < b.path ? -1 : a.path > b.path ? 1 : 0;
  index.instruments.sort(compare); index.kits.sort(compare);
  return index;
}
export async function writeLibraryIndex(index: LibraryIndex): Promise<string> {
  const dir = storageDir("library"); const path = join(dir, "index.json");
  try { await mkdir(dir, { recursive: true }); await writeFile(path, JSON.stringify(parseLibraryIndex(index), null, 2) + "\n"); }
  catch (cause) { if (cause instanceof Music2Error) throw cause; throw new Music2Error("E_ACCESS", "cannot write sample library index", { cause }); }
  return path;
}
export async function readLibraryIndex(): Promise<LibraryIndex | null> {
  let raw: string;
  try { raw = await readFile(join(storageDir("library"), "index.json"), "utf8"); }
  catch (cause) { if ((cause as NodeJS.ErrnoException).code === "ENOENT") return null; throw new Music2Error("E_ACCESS", "cannot read sample library index", { cause }); }
  try { return parseLibraryIndex(JSON.parse(raw) as unknown); }
  catch (cause) { if (cause instanceof Music2Error) throw cause; throw new Music2Error("E_SCHEMA", "invalid sample library index JSON", { cause }); }
}
