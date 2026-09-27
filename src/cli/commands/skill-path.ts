import { statSync } from "node:fs";
import { join } from "node:path";
import { Music2Error, packageRoot } from "../../shared/index.ts";
import type { CommandSpec } from "../registry.ts";

export function resolveSkillDir(root: string): string {
  const path = join(root, "skills", "music2");
  if (!statSync(join(path, "SKILL.md"), { throwIfNoEntry: false })?.isFile()) {
    throw new Music2Error("E_NOT_FOUND", "music2 skill is not available in this package", {
      fix: "use a source checkout or package that includes skills/music2/SKILL.md",
    });
  }
  return path;
}

export const skillPath: CommandSpec = {
  name: "skill",
  summary: "Print the installed music2 skill directory",
  usage: "music2 skill path [--json]",
  options: {},
  async run({ args }) {
    if (args.length !== 1 || args[0] !== "path") {
      throw new Music2Error("E_INPUT", "skill requires the sole positional argument path", {
        fix: "run music2 skill path",
      });
    }
    const path = resolveSkillDir(packageRoot());
    return { command: "skill", data: { path }, text: path };
  },
};
