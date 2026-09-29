import { existsSync, readFileSync } from "node:fs";
import { realpath } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { Music2Error } from "./errors.tool.ts";

/** Root of music2's user storage: `MUSIC2_HOME` when set and nonempty, otherwise `~/.music2`. Not created here. */
export function music2Home(): string {
  const configured = process.env["MUSIC2_HOME"];
  return configured ? configured : join(homedir(), ".music2");
}

export type StorageKind = "renders" | "analysis" | "sfx" | "projects";

/** Default directory for one kind of output inside the music2 home. Callers create it when they write. */
export function storageDir(kind: StorageKind): string {
  return join(music2Home(), kind);
}

let root: string | undefined;

/** Directory containing music2-gen's package.json (works from src/ and dist/). */
export function packageRoot(): string {
  if (root) return root;
  let dir = dirname(fileURLToPath(import.meta.url));
  for (;;) {
    const pj = join(dir, "package.json");
    if (existsSync(pj)) {
      const name = (JSON.parse(readFileSync(pj, "utf8")) as { name?: string }).name;
      if (name === "music2-gen") return (root = dir);
    }
    const parent = dirname(dir);
    if (parent === dir) throw new Error("music2-gen package root not found");
    dir = parent;
  }
}

export function packageVersion(): string {
  const pj = JSON.parse(readFileSync(join(packageRoot(), "package.json"), "utf8")) as { version: string };
  return pj.version;
}

/** Bun version pinned by the package's single runtime dependency; the determinism promise is keyed to it. */
export function pinnedBunVersion(): string {
  const pj = JSON.parse(readFileSync(join(packageRoot(), "package.json"), "utf8")) as { dependencies?: Record<string, string> };
  return pj.dependencies?.["bun"] ?? "";
}

/** Resolve an existing file beneath a canonical root, including symlink targets. */
export async function confinedRealpath(rootDir: string, candidate: string): Promise<string> {
  try {
    const rootPath = await realpath(rootDir);
    const target = await realpath(isAbsolute(candidate) ? candidate : resolve(rootPath, candidate));
    const fromRoot = relative(rootPath, target);
    if (fromRoot === ".." || fromRoot.startsWith(`..${sep}`) || isAbsolute(fromRoot)) {
      throw new Music2Error("E_ACCESS", "path escapes confined root", { details: { file: candidate } });
    }
    return target;
  } catch (cause) {
    if (cause instanceof Music2Error) throw cause;
    throw new Music2Error("E_ACCESS", "cannot access confined path", { details: { file: candidate }, cause });
  }
}
