import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

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
