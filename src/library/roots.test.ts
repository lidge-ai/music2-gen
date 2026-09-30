import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { delimiter, join } from "node:path";
import { defaultSampleRoots } from "./roots.tool.ts";
test("environment roots replace defaults, retaining only existing unique directories", async () => {
  const dir = await mkdtemp(join(tmpdir(), "music2-roots-")); const old = process.env["MUSIC2_SAMPLE_ROOTS"];
  try {
    const folder = join(dir, "samples"); const file = join(dir, "file"); await mkdir(folder); await writeFile(file, "");
    process.env["MUSIC2_SAMPLE_ROOTS"] = [folder, folder, file, join(dir, "missing")].join(delimiter);
    assert.deepEqual(defaultSampleRoots(), [folder]);
    process.env["MUSIC2_SAMPLE_ROOTS"] = ""; assert.deepEqual(defaultSampleRoots(), []);
  } finally { if (old === undefined) delete process.env["MUSIC2_SAMPLE_ROOTS"]; else process.env["MUSIC2_SAMPLE_ROOTS"] = old; await rm(dir, { recursive: true, force: true }); }
});
