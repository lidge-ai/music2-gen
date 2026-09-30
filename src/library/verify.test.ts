import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { writeWav } from "../audio-io/index.ts";
import { importFolder } from "./import.tool.ts";
import { verifyInstrument } from "./verify.tool.ts";
test("verify renders imported SFZ notes, passes correct keycenters and fails mis-keyed audio", async () => {
  const root = await mkdtemp(join(tmpdir(), "music2-verify-")); const old = process.env["MUSIC2_HOME"]; process.env["MUSIC2_HOME"] = join(root, "home");
  try {
    const folder = join(root, "samples"); await mkdir(folder);
    const left = Float32Array.from({ length: 96000 }, (_, i) => 0.4 * Math.sin(2 * Math.PI * 261.6255653 * i / 48000));
    await writeWav(join(folder, "Tone C5.wav"), { sampleRate: 48000, left, right: left, sourceChannels: 1 }, { bits: 24, seed: 0 });
    const imported = await importFolder(folder, { id: "correct" });
    const correct = await verifyInstrument("correct"); assert.equal(correct.ok, true);
    assert.deepEqual(correct.notes.map(({ want, got, cents }) => [want, got, cents]), [[48, 48, 0], [52, 52, 0], [55, 55, 0], [60, 60, 0]]);
    const path = join(imported.dir, "correct.sfz"); const sfz = await readFile(path, "utf8");
    await writeFile(path, sfz.replace("pitch_keycenter=60", "pitch_keycenter=72"));
    const wrong = await verifyInstrument("correct", [60]); assert.equal(wrong.ok, false);
    assert.equal(wrong.notes[0]?.cents, -1200);
    await assert.rejects(verifyInstrument("correct", []), { code: "E_INPUT" });
    await assert.rejects(verifyInstrument("correct", [128]), { code: "E_INPUT" });
    await assert.rejects(verifyInstrument("missing"), { code: "E_CAPABILITY" });
  } finally { if (old === undefined) delete process.env["MUSIC2_HOME"]; else process.env["MUSIC2_HOME"] = old; await rm(root, { recursive: true, force: true }); }
});
test("verify silence returns ok false rather than throwing a pitch error", async () => {
  const root = await mkdtemp(join(tmpdir(), "music2-verify-silent-")); const old = process.env["MUSIC2_HOME"]; process.env["MUSIC2_HOME"] = root;
  try {
    const folder = join(root, "samples"); await mkdir(folder); const left = new Float32Array(48000);
    await writeWav(join(folder, "Silent C4.wav"), { sampleRate: 48000, left, right: left, sourceChannels: 1 }, { bits: 24, seed: 0 });
    await importFolder(folder, { id: "silent" }); assert.equal((await verifyInstrument("silent", [60])).ok, false);
  } finally { if (old === undefined) delete process.env["MUSIC2_HOME"]; else process.env["MUSIC2_HOME"] = old; await rm(root, { recursive: true, force: true }); }
});
