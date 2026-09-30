import { lstat, readFile, readdir } from "node:fs/promises";
import { isAbsolute, join } from "node:path";
import { Music2Error, confinedRealpath, storageDir } from "../shared/index.ts";

export const USER_ID_PATTERN = /^[a-z0-9][a-z0-9-]{0,47}$/;
export interface UserZone {
  file: string; named: number | null; measured: number; offset: number; confidence: number; lokey: number; hikey: number;
}
export interface UserInstrumentManifest {
  version: 1; id: string; kind: "sfz" | "kit"; entry: string; role?: string;
  source: { folder: string }; zones?: UserZone[]; variants?: Record<string, string[]>; warnings: string[];
}
export type UserInstrumentKinds = Readonly<Record<string, "sfz" | "kit">>;
export function userInstrumentsDir(): string { return storageDir("instruments"); }

function invalid(message: string): never { throw new Music2Error("E_SCHEMA", `invalid user instrument: ${message}`); }
function object(input: unknown): input is Record<string, unknown> {
  return input !== null && typeof input === "object" && !Array.isArray(input);
}
function relativeFile(input: unknown): input is string {
  return typeof input === "string" && input.length > 0 && !isAbsolute(input) && !/[:\\\0\r\n]/.test(input)
    && input.split("/").every((part) => part !== ".." && part !== "." && part.length > 0);
}
function midi(input: unknown): input is number { return typeof input === "number" && Number.isInteger(input) && input >= 0 && input <= 127; }

/** Validate manifests at the filesystem boundary, including portable relative references. */
export function parseUserManifest(input: unknown, id: string): UserInstrumentManifest {
  if (!USER_ID_PATTERN.test(id)) invalid("bad id");
  if (!object(input) || input["version"] !== 1 || input["id"] !== id) invalid("version or id");
  const kind = input["kind"]; const entry = input["entry"];
  if ((kind !== "sfz" && kind !== "kit") || !relativeFile(entry)
    || (kind === "sfz" ? !entry.endsWith(".sfz") : entry !== "kit.json")) invalid("kind or entry");
  const source = input["source"];
  if (!object(source) || !relativeFile(source["folder"]) || source["folder"].includes("/")) invalid("source.folder must be a basename");
  if (!Array.isArray(input["warnings"]) || input["warnings"].some((value: unknown) => typeof value !== "string")) invalid("warnings");
  if (input["role"] !== undefined && typeof input["role"] !== "string") invalid("role");
  const zones = input["zones"];
  if (zones !== undefined) {
    if (!Array.isArray(zones)) invalid("zones");
    for (const zone of zones as unknown[]) {
      if (!object(zone) || !relativeFile(zone["file"]) || (zone["named"] !== null && !midi(zone["named"]))
        || !midi(zone["measured"]) || !midi(zone["lokey"]) || !midi(zone["hikey"]) || zone["lokey"] > zone["hikey"]
        || typeof zone["offset"] !== "number" || !Number.isFinite(zone["offset"])
        || typeof zone["confidence"] !== "number" || !Number.isFinite(zone["confidence"]) || zone["confidence"] < 0 || zone["confidence"] > 1) invalid("zone");
    }
  }
  const variants = input["variants"];
  if (variants !== undefined) {
    if (!object(variants)) invalid("variants");
    for (const [atom, files] of Object.entries(variants)) {
      if (!/^(bd|sd|cp|hh|oh|rim|perc|tom|cr|rd)$/.test(atom) || !Array.isArray(files) || files.length === 0
        || files.some((file: unknown) => !relativeFile(file))) invalid("variants");
    }
  }
  // All members of the external shape have now been checked above.
  return input as unknown as UserInstrumentManifest;
}

export async function readUserManifest(id: string): Promise<{ root: string; entryPath: string; manifest: UserInstrumentManifest }> {
  if (!USER_ID_PATTERN.test(id)) invalid("bad id");
  const directory = join(userInstrumentsDir(), id);
  try { await lstat(directory); }
  catch (cause) {
    if ((cause as NodeJS.ErrnoException).code === "ENOENT") throw new Music2Error("E_CAPABILITY", `user instrument ${id} is not imported`);
    throw new Music2Error("E_ACCESS", "cannot access user instrument", { cause });
  }
  const root = await confinedRealpath(userInstrumentsDir(), id);
  try { await lstat(join(root, "instrument.json")); }
  catch (cause) {
    if ((cause as NodeJS.ErrnoException).code === "ENOENT") throw new Music2Error("E_CAPABILITY", `user instrument ${id} is not imported`);
    throw new Music2Error("E_ACCESS", "cannot access user instrument manifest", { cause });
  }
  const manifestPath = await confinedRealpath(root, "instrument.json");
  let input: unknown;
  try { input = JSON.parse(await readFile(manifestPath, "utf8")) as unknown; }
  catch (cause) {
    if (cause instanceof SyntaxError) throw new Music2Error("E_SCHEMA", "invalid user instrument JSON", { cause });
    throw new Music2Error("E_ACCESS", "cannot read user instrument manifest", { cause });
  }
  const manifest = parseUserManifest(input, id);
  const entryPath = await confinedRealpath(root, manifest.entry);
  return { root, entryPath, manifest };
}

export async function listUserInstruments(): Promise<UserInstrumentManifest[]> {
  let entries;
  try { entries = await readdir(userInstrumentsDir(), { withFileTypes: true }); }
  catch (cause) {
    if ((cause as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw new Music2Error("E_ACCESS", "cannot list user instruments", { cause });
  }
  const result: UserInstrumentManifest[] = [];
  for (const entry of entries.sort((a, b) => a.name < b.name ? -1 : a.name > b.name ? 1 : 0)) {
    if (entry.name.startsWith(".") || (!entry.isDirectory() && !entry.isSymbolicLink())) continue;
    // readUserManifest performs the same confinement checks for symlinks as direct reads.
    result.push((await readUserManifest(entry.name)).manifest);
  }
  return result;
}
