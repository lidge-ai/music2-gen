import { statSync } from "node:fs";
import { delimiter, resolve } from "node:path";

/** Environment roots replace the platform defaults. Explicit CLI roots are handled by the caller. */
export function defaultSampleRoots(): string[] {
  const configured = process.env["MUSIC2_SAMPLE_ROOTS"];
  const roots = configured !== undefined ? configured.split(delimiter).filter(Boolean) : process.platform === "darwin" ? [
    "/Library/Application Support/Logic/Alchemy Samples",
    "/Library/Application Support/Logic/Ultrabeat Samples",
    "/Library/Application Support/Logic/Samples",
    "/Library/Application Support/GarageBand/Instrument Library/Sampler/Sampler Files",
  ] : [];
  return [...new Set(roots.map((root) => resolve(root)))].filter((root) => {
    try { return statSync(root).isDirectory(); } catch { return false; }
  }).sort();
}
