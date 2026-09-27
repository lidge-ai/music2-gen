import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { Music2Error } from "../shared/index.ts";
import { loadSong } from "./load.tool.ts";

void test("missing song yields E_NOT_FOUND", async () => {
  await assert.rejects(loadSong(join(tmpdir(), "music2-no-such-song.json")),
    (error: unknown) => error instanceof Music2Error && error.code === "E_NOT_FOUND");
});

void test("malformed JSON yields E_INPUT with line and column", async () => {
  const dir = mkdtempSync(join(tmpdir(), "music2-json-"));
  try {
    const path = join(dir, "broken.json");
    writeFileSync(path, "{\n\"version\": 1,\n}");
    await assert.rejects(loadSong(path), (error: unknown) => error instanceof Music2Error && error.code === "E_INPUT"
      && error.details?.["line"] === 3 && typeof error.details["column"] === "number");
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
