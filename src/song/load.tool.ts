import { readFile } from "node:fs/promises";
import { Music2Error } from "../shared/index.ts";
import { validateSong } from "./song.schema.ts";
import type { ResolvedSong } from "./song.schema.ts";

function parseLocation(source: string, error: SyntaxError): { line?: number; column?: number; offset?: number } {
  const match = /position (\d+)/.exec(error.message);
  if (!match) return {};
  const offset = Number(match[1]);
  const before = source.slice(0, offset);
  const lines = before.split(/\r\n|\r|\n/);
  return { offset, line: lines.length, column: (lines.at(-1)?.length ?? 0) + 1 };
}

export async function loadSong(path: string): Promise<ResolvedSong> {
  let source: string;
  try {
    source = await readFile(path, "utf8");
  } catch (error) {
    const code = error && typeof error === "object" && "code" in error ? error.code : undefined;
    if (code === "ENOENT") throw new Music2Error("E_NOT_FOUND", `song not found: ${path}`, { details: { path }, cause: error });
    throw new Music2Error("E_INPUT", `cannot read song: ${path}`, { details: { path }, cause: error });
  }
  let input: unknown;
  try {
    input = JSON.parse(source) as unknown;
  } catch (error) {
    const location = error instanceof SyntaxError ? parseLocation(source, error) : {};
    throw new Music2Error("E_INPUT", `invalid JSON in ${path}`, { details: { path, ...location }, cause: error });
  }
  return validateSong(input);
}
