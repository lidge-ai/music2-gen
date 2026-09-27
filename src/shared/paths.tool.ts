import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export function music2Home(): string {
  return process.env["MUSIC2_HOME"] ?? join(homedir(), ".music2");
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
