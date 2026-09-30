import { Music2Error } from "../shared/index.ts";
export interface CandidateFolder {
  path: string; name: string; category: string[]; root: string; kind: "instrument" | "kit";
  files: number; pitched: number; drumHits: number; formats: Record<string, number>;
}
export interface LibraryIndex {
  version: 1; roots: string[]; instruments: CandidateFolder[]; kits: CandidateFolder[];
  skipped: { caf: number; exs: number; aaz: number; other: number };
}
export interface PitchEstimate { midi: number; confidence: number }
export interface ImportOptions {
  id: string; as?: "instrument" | "kit"; filter?: string; octave?: "auto" | "none" | number;
  attackSeconds?: number; releaseSeconds?: number; force?: boolean;
}
export interface ImportedFile {
  source: string; named: number | null; measured: number; offset: number; confidence: number; atom?: string; variant?: number;
}
export interface ImportReport {
  id: string; kind: "sfz" | "kit"; instrument: `user:${string}`; dir: string; files: ImportedFile[]; warnings: string[];
}
export interface VerifyReport { id: string; notes: { want: number; got: number; cents: number; ok: boolean }[]; ok: boolean }
export type { UserInstrumentManifest as InstrumentManifest, UserZone as ImportedZone } from "../sampler/user-instrument.tool.ts";

const object = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === "object" && !Array.isArray(value);
const strings = (value: unknown): value is string[] => Array.isArray(value) && value.every((item: unknown) => typeof item === "string");
const count = (value: unknown): value is number => typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
export function parseLibraryIndex(input: unknown): LibraryIndex {
  function invalid(): never { throw new Music2Error("E_SCHEMA", "invalid sample library index"); }
  if (!object(input) || input["version"] !== 1 || !strings(input["roots"]) || input["scannedAt"] !== undefined) invalid();
  const skipped = input["skipped"];
  if (!object(skipped) || !["caf", "exs", "aaz", "other"].every((key) => count(skipped[key]))) invalid();
  for (const [key, kind] of [["instruments", "instrument"], ["kits", "kit"]]) {
    const folders = input[key!];
    if (!Array.isArray(folders)) invalid();
    for (const folder of folders as unknown[]) {
      if (!object(folder) || folder["kind"] !== kind || !["path", "name", "root"].every((field) => typeof folder[field] === "string")
        || !strings(folder["category"]) || !["files", "pitched", "drumHits"].every((field) => count(folder[field]))
        || !object(folder["formats"]) || !Object.values(folder["formats"]).every(count)) invalid();
    }
  }
  return input as unknown as LibraryIndex;
}
