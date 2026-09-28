import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Music2Error, packageRoot } from "../shared/index.ts";
import type { LibraryInstrument, LibraryManifest } from "./library.schema.ts";

let cached: LibraryManifest | undefined;
const validText = (value: unknown): value is string => typeof value === "string" && value.trim().length > 0;
const object = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === "object" && !Array.isArray(value);

function validate(input: unknown): LibraryManifest {
  if (!object(input) || input["version"] !== 1 || !Array.isArray(input["instruments"]) || !input["instruments"].length)
    throw new Music2Error("E_SCHEMA", "invalid instrument library manifest");
  const ids = new Set<string>();
  for (const item of input["instruments"]) {
    if (!object(item) || !validText(item["id"]) || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(item["id"]) ||
      ids.has(item["id"]) || !validText(item["title"]) || !validText(item["family"]) ||
      (item["role"] !== "focal" && item["role"] !== "bed") ||
      item["sfz"] !== `${item["id"]}/${item["id"]}.sfz` ||
      !Array.isArray(item["range"]) || item["range"].length !== 2 ||
      !item["range"].every((note: unknown) => Number.isInteger(note) && (note as number) >= 0 && (note as number) <= 127) ||
      item["range"][0] > item["range"][1] || !object(item["license"]) ||
      !validText(item["license"]["spdx"]) || !validText(item["license"]["attribution"]) ||
      !validText(item["license"]["source"]))
      throw new Music2Error("E_SCHEMA", "invalid instrument library entry");
    ids.add(item["id"]);
  }
  return input as unknown as LibraryManifest;
}

export function libraryManifest(): LibraryManifest {
  if (cached) return cached;
  try { return (cached = validate(JSON.parse(readFileSync(join(packageRoot(), "instruments", "index.json"), "utf8")))); }
  catch (cause) {
    if (cause instanceof Music2Error) throw cause;
    throw new Music2Error("E_SCHEMA", "cannot load instrument library manifest", { cause });
  }
}

export function libraryInstrument(id: string): LibraryInstrument {
  const instruments = libraryManifest().instruments;
  const item = instruments.find((candidate) => candidate.id === id);
  if (!item) throw new Music2Error("E_SCHEMA", `unknown library instrument ${id}; valid ids: ${instruments.map((candidate) => candidate.id).join(", ")}`);
  return item;
}
