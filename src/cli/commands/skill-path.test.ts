import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { Music2Error } from "../../shared/index.ts";
import type { CommandContext } from "../registry.ts";
import { resolveSkillDir, skillPath } from "./skill-path.ts";

const context = (args: string[]): CommandContext => ({
  args, values: {}, json: true, cwd: process.cwd(), stderr: process.stderr,
});

test("skill CommandSpec accepts only path", async () => {
  assert.equal(skillPath.name, "skill");
  assert.equal(skillPath.usage, "music2 skill path [--json]");
  assert.deepEqual(skillPath.options, {});
  for (const args of [[], ["install"], ["path", "extra"]]) {
    await assert.rejects(skillPath.run(context(args)),
      (error: unknown) => error instanceof Music2Error && error.code === "E_INPUT" && error.exit === 2);
  }
});

test("skill directory requires a regular SKILL.md file", async () => {
  const root = await mkdtemp(join(tmpdir(), "music2-skill-path-"));
  const path = join(root, "skills", "music2");
  try {
    for (const missing of [root, path]) {
      assert.throws(() => resolveSkillDir(missing),
        (error: unknown) => error instanceof Music2Error && error.code === "E_NOT_FOUND" && error.exit === 2 && Boolean(error.fix));
    }
    await mkdir(path, { recursive: true });
    await mkdir(join(path, "SKILL.md"));
    assert.throws(() => resolveSkillDir(root),
      (error: unknown) => error instanceof Music2Error && error.code === "E_NOT_FOUND");
    await rm(join(path, "SKILL.md"), { recursive: true });
    await writeFile(join(path, "SKILL.md"), "# music2\n");
    assert.equal(resolveSkillDir(root), path);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
