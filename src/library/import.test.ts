import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, readdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { writeWav, readWav, readWavSmpl } from "../audio-io/index.ts";
import { loadSfz, renderSfz } from "../sampler/sfz-render.tool.ts";
import { readUserManifest } from "../sampler/user-instrument.tool.ts";
import { importFolder } from "./import.tool.ts";

function tone(midi: number): Float32Array {
  return Float32Array.from({ length: 48000 }, (_, i) => 0.4 * Math.sin(2 * Math.PI * 440 * 2 ** ((midi - 69) / 12) * i / 48000));
}
async function wav(path: string, midi: number, metadata = false): Promise<void> {
  const left = tone(midi); await writeWav(path, { sampleRate: 48000, left, right: left, sourceChannels: 1 }, { bits: 24, seed: 0 });
  if (metadata) {
    const bytes = await readFile(path); const smpl = Buffer.alloc(68);
    smpl.write("smpl"); smpl.writeUInt32LE(60, 4); smpl.writeUInt32LE(72, 20);
    smpl.writeUInt32LE(0x80000000, 24); smpl.writeUInt32LE(1, 36); smpl.writeUInt32LE(12000, 52); smpl.writeUInt32LE(35999, 56);
    const combined = Buffer.concat([bytes, smpl]); combined.writeUInt32LE(combined.length - 8, 4); await writeFile(path, combined);
  }
}
function aiff(midi: number): Buffer {
  const values = tone(midi); const frames = values.length; const bytes = Buffer.alloc(54 + frames * 3);
  bytes.write("FORM"); bytes.writeUInt32BE(bytes.length - 8, 4); bytes.write("AIFFCOMM", 8);
  bytes.writeUInt32BE(18, 16); bytes.writeUInt16BE(1, 20); bytes.writeUInt32BE(frames, 22); bytes.writeUInt16BE(24, 26);
  bytes.writeUInt16BE(0x400e, 28); bytes.writeUInt32BE(0xbb800000, 30); bytes.write("SSND", 38); bytes.writeUInt32BE(frames * 3 + 8, 42);
  for (let i = 0; i < frames; i++) bytes.writeIntBE(Math.round(values[i]! * 8388607), 54 + i * 3, 3);
  return bytes;
}
async function fixture(run: (root: string, folder: string) => Promise<void>): Promise<void> {
  const root = await mkdtemp(join(tmpdir(), "music2-import-")); const old = process.env["MUSIC2_HOME"];
  process.env["MUSIC2_HOME"] = join(root, "home"); const folder = join(root, "Synthetic"); await mkdir(folder);
  try { await run(root, folder); }
  finally { if (old === undefined) delete process.env["MUSIC2_HOME"]; else process.env["MUSIC2_HOME"] = old; await rm(root, { recursive: true, force: true }); }
}
function crossingHz(audio: Float32Array, start: number, end: number): number {
  const crossings: number[] = [];
  for (let i = start + 1; i < end; i++) { const a = audio[i - 1]!; const b = audio[i]!; if (a <= 0 && b > 0) crossings.push(i - 1 - a / (b - a)); }
  return (crossings.length - 1) * 48000 / (crossings.at(-1)! - crossings[0]!);
}

test("instrument imports WAV smpl and AIFF with per-file octave correction and midpoint zones", async () => fixture(async (_root, folder) => {
  await wav(join(folder, "Pad C4.wav"), 48, true); await writeFile(join(folder, "Pad E3.aiff"), aiff(64));
  const report = await importFolder(folder, { id: "pad", as: "instrument", attackSeconds: 0, releaseSeconds: 0.1 });
  assert.equal(report.instrument, "user:pad"); assert.equal(report.kind, "sfz");
  assert.deepEqual(report.files.map(({ source, named, measured, offset }) => ({ source, named, measured, offset })), [
    { source: "Pad C4.wav", named: 60, measured: 48, offset: -1 }, { source: "Pad E3.aiff", named: 52, measured: 64, offset: 1 },
  ]);
  const { manifest, root } = await readUserManifest("pad");
  assert.deepEqual(manifest.source, { folder: "Synthetic" });
  assert.deepEqual(manifest.zones?.map(({ lokey, hikey }) => [lokey, hikey]), [[0, 56], [57, 127]]);
  const sfz = await readFile(join(root, "pad.sfz"), "utf8");
  assert.match(sfz, /pitch_keycenter=48 tune=0/); assert.match(sfz, /loop_mode=loop_continuous loop_start=12000 loop_end=35999/);
  assert.match(sfz, /ampeg_attack=0 /);
  const sample = await readFile(join(root, "n48.wav")); assert.equal(sample.readUInt16LE(34), 24);
  assert.equal(readWavSmpl(sample).unityNote, null); assert.equal(readWavSmpl(sample).loop, null);
  assert.equal((await readWav(join(root, "n64.wav"))).left.length, 48000);
  const loaded = await loadSfz(join(root, "song.json"), "pad.sfz", 48000);
  const audio = renderSfz([{ midi: 48, velocity: 1, startFrame: 0, gateFrames: 24000, stopFrame: 24000, eventIndex: 0, seed: 0 }], loaded, 48000, 24000);
  const frequency = crossingHz(audio.left, 2400, 10000);
  assert.ok(Math.abs(1200 * Math.log2(frequency / (440 * 2 ** ((48 - 69) / 12)))) < 10);
  assert.ok(!JSON.stringify(manifest).includes(folder));
}));

test("octave none and numeric overrides, filtering, duplicate roots, force replacement", async () => fixture(async (_root, folder) => {
  await wav(join(folder, "Pad C4.wav"), 48); await wav(join(folder, "Pad C4 M.wav"), 48);
  await wav(join(folder, "Other D4.wav"), 50);
  const original = await importFolder(folder, { id: "pad", filter: "Pad", octave: "none" });
  assert.deepEqual(original.files.map(({ measured }) => measured), [60, 60]);
  assert.deepEqual((await readdir(original.dir)).filter((name) => name.endsWith(".wav")).sort(), ["n60-v1.wav", "n60.wav"]);
  await assert.rejects(importFolder(folder, { id: "pad" }), { code: "E_INPUT" });
  const replaced = await importFolder(folder, { id: "pad", filter: "Other", octave: -1, force: true });
  assert.deepEqual(replaced.files.map(({ named, measured, offset }) => [named, measured, offset]), [[62, 50, -1]]);
  assert.equal((await readUserManifest("pad")).manifest.zones?.length, 1);
  assert.deepEqual((await readdir(join(process.env["MUSIC2_HOME"]!, "instruments"))), ["pad"]);
}));

test("kit word table writes every atom and indexed variants to both manifests", async () => fixture(async (_root, folder) => {
  const names = ["Kick_1", "Kick_2", "Snare", "Clap", "Hi-Hat_Closed", "Hi-Hat_Open", "Rim", "Shaker", "Tom", "Crash", "Ride"];
  for (const name of names) await wav(join(folder, `${name}.wav`), 60);
  const report = await importFolder(folder, { id: "kit" }); assert.equal(report.kind, "kit");
  const kicks = report.files.filter((file) => file.atom === "bd").sort((a, b) => a.variant! - b.variant!);
  assert.deepEqual(kicks.map(({ source, variant }) => [source, variant]), [["Kick_1.wav", 0], ["Kick_2.wav", 1]]);
  const { root, manifest } = await readUserManifest("kit");
  const kit = JSON.parse(await readFile(join(root, "kit.json"), "utf8")) as { version: number; samples: Record<string, string[]> };
  assert.equal(kit.version, 1); assert.deepEqual(kit.samples, manifest.variants);
  assert.deepEqual(kit.samples["bd"], ["bd-0.wav", "bd-1.wav"]);
  assert.deepEqual(Object.keys(kit.samples).sort(), ["bd", "cp", "cr", "hh", "oh", "perc", "rd", "rim", "sd", "tom"]);
  for (const files of Object.values(kit.samples)) for (const file of files) assert.equal((await readFile(join(root, file))).readUInt16LE(34), 24);
}));

test("failed import removes partial staging and failed force preserves prior import", async () => fixture(async (_root, folder) => {
  await wav(join(folder, "Pad C4.wav"), 60);
  await writeFile(join(folder, "Pad G4.wav"), Buffer.from("broken"));
  await assert.rejects(importFolder(folder, { id: "broken" }), { code: "E_INPUT" });
  const base = join(process.env["MUSIC2_HOME"]!, "instruments"); assert.deepEqual(await readdir(base), []);
  await importFolder(folder, { id: "existing", filter: "C4" });
  const before = await readFile(join(base, "existing", "instrument.json"), "utf8");
  await assert.rejects(importFolder(folder, { id: "existing", force: true }), { code: "E_INPUT" });
  assert.equal(await readFile(join(base, "existing", "instrument.json"), "utf8"), before);
  assert.deepEqual(await readdir(base), ["existing"]);
  const trash = join(base, `.trash-existing-${process.pid}`); await mkdir(trash);
  await assert.rejects(importFolder(folder, { id: "existing", filter: "C4", force: true }), { code: "E_ACCESS" });
  assert.equal(await readFile(join(base, "existing", "instrument.json"), "utf8"), before);
}));

test("import rejects bad ids, folders, envelopes, octave options and empty filters", async () => fixture(async (_root, folder) => {
  await wav(join(folder, "Pad C4.wav"), 60);
  for (const id of ["../escape", "UPPER", "", "a".repeat(49)]) await assert.rejects(importFolder(folder, { id }), { code: "E_INPUT" });
  await assert.rejects(importFolder(join(folder, "missing"), { id: "pad" }), { code: "E_INPUT" });
  await assert.rejects(importFolder(folder, { id: "pad", octave: 1.5 }), { code: "E_INPUT" });
  await assert.rejects(importFolder(folder, { id: "pad", attackSeconds: -1 }), { code: "E_INPUT" });
  await assert.rejects(importFolder(folder, { id: "pad", filter: "missing" }), { code: "E_INPUT" });
}));
