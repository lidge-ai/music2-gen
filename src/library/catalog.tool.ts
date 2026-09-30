import type { CandidateFolder, LibraryIndex } from "./library.schema.ts";

// Scan indexes contain counts rather than inventories; search current filenames
// without extending the frozen serialized index shape.
import { readdirSync } from "node:fs";

export function findCandidates(index: LibraryIndex, words: string[], kind?: "instrument" | "kit", limit?: number): CandidateFolder[] {
  const terms = words.map((word) => word.trim().toLowerCase()).filter(Boolean);
  const folders = kind === "instrument" ? index.instruments : kind === "kit" ? index.kits : [...index.instruments, ...index.kits];
  const ranked = folders.map((folder) => {
    let files: string[] = [];
    try { files = readdirSync(folder.path); } catch { /* Cached folders can disappear after a scan. */ }
    const fields = [...folder.category, folder.name, folder.path, ...files].map((field) => field.toLowerCase());
    return { folder, score: terms.every((term) => fields.some((field) => field.includes(term)))
      ? terms.reduce((score, term) => score + fields.filter((field) => field.includes(term)).length, 0) : -1 };
  }).filter(({ score }) => score >= 0).sort((a, b) => b.score - a.score || (a.folder.path < b.folder.path ? -1 : a.folder.path > b.folder.path ? 1 : 0));
  return ranked.slice(0, limit === undefined ? ranked.length : Math.max(0, Math.floor(limit))).map(({ folder }) => folder);
}
