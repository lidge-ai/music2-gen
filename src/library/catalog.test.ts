import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { scanLibrary } from "./scan.tool.ts";
import { findCandidates } from "./catalog.tool.ts";
import { createStereo, writeWav } from "../audio-io/index.ts";
test("find is case-insensitive AND over categories and filenames, with kind and limit", async () => {
  const root = await mkdtemp(join(tmpdir(), "music2-find-"));
  try {
    const drums = join(root, "Electronic"); await mkdir(drums);
    for (const name of ["Kick_1.wav", "Snare_1.wav", "Hi-Hat.wav"]) await writeWav(join(drums, name), createStereo(48000, 8), { bits: 24, seed: 0 });
    const index = await scanLibrary([root]);
    assert.equal(findCandidates(index, ["ELECTRONIC", "kick"], "kit").length, 1);
    assert.equal(findCandidates(index, ["kick", "missing"]).length, 0);
    assert.equal(findCandidates(index, ["kick"], "instrument").length, 0);
    assert.equal(findCandidates(index, [], "kit", 0).length, 0);
  } finally { await rm(root, { recursive: true, force: true }); }
});
