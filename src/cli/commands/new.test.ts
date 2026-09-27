import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Music2Error } from "../../shared/index.ts";
import { validateSong } from "../../song/index.ts";
import type { CommandContext } from "../registry.ts";
import { newCommand } from "./new.ts";

function ctx(cwd: string, values: Record<string, unknown>, args: string[] = []): CommandContext {
  return { args, values, json: false, cwd, stderr: process.stderr };
}

test("new returns valid song and human JSON", async () => {
  const result = await newCommand.run(ctx(process.cwd(), { genre: "drill_uk", key: "D minor", seed: "7" }));
  const song = result.data["song"];
  assert.equal(validateSong(song).key, "D minor");
  assert.deepEqual(JSON.parse(result.text ?? ""), song);
});

test("-o writes two-space JSON with newline and refuses overwrite", async () => {
  const dir = await mkdtemp(join(tmpdir(), "music2-new-"));
  try {
    const context = ctx(dir, { genre: "drill_uk", out: "song.json" });
    const result = await newCommand.run(context);
    const path = join(dir, "song.json");
    assert.equal(result.data["written"], path);
    assert.equal(result.text, path);
    const contents = await readFile(path, "utf8");
    assert.ok(contents.endsWith("\n"));
    assert.match(contents, /^\{\n  "version": 1,/);
    validateSong(JSON.parse(contents) as unknown);
    await assert.rejects(newCommand.run(context),
      (error: unknown) => error instanceof Music2Error && error.code === "E_ACCESS" && error.exit === 4);
    assert.equal(await readFile(path, "utf8"), contents);
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test("new rejects invalid flags and extra arguments", async () => {
  for (const [values, args] of [
    [{}, []], [{ genre: "unknown" }, []], [{ genre: "drill_uk", bpm: "140.5" }, []],
    [{ genre: "drill_uk", seed: "-1" }, []], [{ genre: "drill_uk" }, ["extra"]],
  ] as const) {
    await assert.rejects(newCommand.run(ctx(process.cwd(), values, [...args])),
      (error: unknown) => error instanceof Music2Error && error.exit === 2);
  }
});
