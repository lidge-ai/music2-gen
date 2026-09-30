import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { scanLibrary, readLibraryIndex, writeLibraryIndex } from "./scan.tool.ts";
import { createStereo, writeWav } from "../audio-io/index.ts";

async function writeSample(path: string): Promise<void> {
  if (/\.wav$/i.test(path)) { await writeWav(path, createStereo(48000, 8), { bits: 24, seed: 0 }); return; }
  const bytes = Buffer.alloc(70); bytes.write("FORM"); bytes.writeUInt32BE(62, 4); bytes.write("AIFFCOMM", 8);
  bytes.writeUInt32BE(18, 16); bytes.writeUInt16BE(1, 20); bytes.writeUInt32BE(8, 22); bytes.writeUInt16BE(16, 26);
  bytes.writeUInt16BE(0x400e, 28); bytes.writeUInt32BE(0xbb800000, 30); bytes.write("SSND", 38); bytes.writeUInt32BE(24, 42);
  await writeFile(path, bytes);
}
test("scan identifies note and drum folders, counts skipped files and roundtrips cache", async () => {
  const root = await mkdtemp(join(tmpdir(), "music2-scan-")); const old = process.env["MUSIC2_HOME"];
  process.env["MUSIC2_HOME"] = join(root, "home");
  try {
    const strings = join(root, "Strings"); const drums = join(root, "Drums"); await mkdir(strings); await mkdir(drums);
    for (const name of ["Pad C3.wav", "Pad E3.aif", "Pad G3.aiff", "skip.caf", "skip.exs", "skip.aaz", "readme.txt"]) { if (/\.(wav|aif|aiff)$/.test(name)) await writeSample(join(strings, name)); else await writeFile(join(strings, name), ""); }
    for (const name of ["Kick_1.wav", "Snare_1.wav", "Hi-Hat_Closed.wav"]) await writeSample(join(drums, name));
    await mkdir(join(root, "deep", "a", "b", "c", "d", "e", "f"), { recursive: true });
    for (const name of ["Hidden C3.wav", "Hidden E3.wav", "Hidden G3.wav"]) await writeSample(join(root, "deep", "a", "b", "c", "d", "e", "f", name));
    const index = await scanLibrary([root]);
    assert.equal(index.instruments.length, 1); assert.equal(index.kits.length, 1);
    assert.equal(index.instruments[0]?.pitched, 3); assert.deepEqual(index.instruments[0]?.category, ["Strings"]);
    assert.deepEqual(index.skipped, { caf: 1, exs: 1, aaz: 1, other: 1 });
    assert.deepEqual(index.instruments[0]?.formats, { aif: 1, aiff: 1, wav: 1 });
    assert.equal(await readLibraryIndex(), null); await writeLibraryIndex(index); assert.deepEqual(await readLibraryIndex(), index);
    const again = await scanLibrary([root]); assert.deepEqual(again.instruments, index.instruments);
  } finally { if (old === undefined) delete process.env["MUSIC2_HOME"]; else process.env["MUSIC2_HOME"] = old; await rm(root, { recursive: true, force: true }); }
});
test("missing root capability and corrupt cache schema errors", async () => {
  await assert.rejects(scanLibrary([]), { code: "E_CAPABILITY" });
  const root = await mkdtemp(join(tmpdir(), "music2-index-")); const old = process.env["MUSIC2_HOME"]; process.env["MUSIC2_HOME"] = root;
  try {
    await mkdir(join(root, "library")); await writeFile(join(root, "library", "index.json"), "{}");
    await assert.rejects(readLibraryIndex(), { code: "E_SCHEMA" });
    await writeFile(join(root, "library", "index.json"), "{"); await assert.rejects(readLibraryIndex(), { code: "E_SCHEMA" });
  } finally { if (old === undefined) delete process.env["MUSIC2_HOME"]; else process.env["MUSIC2_HOME"] = old; await rm(root, { recursive: true, force: true }); }
});
