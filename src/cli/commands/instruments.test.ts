import { createStereo, writeWav } from "../../audio-io/index.ts";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { main } from "../main.ts";
import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import type { CommandContext } from "../registry.ts";
import { instruments } from "./instruments.ts";

let testHome: string;
let previousHome: string | undefined;
beforeEach(async () => {
  previousHome = process.env["MUSIC2_HOME"];
  testHome = await mkdtemp(join(tmpdir(), "music2-instruments-"));
  process.env["MUSIC2_HOME"] = testHome;
});
afterEach(async () => {
  if (previousHome === undefined) delete process.env["MUSIC2_HOME"]; else process.env["MUSIC2_HOME"] = previousHome;
  await rm(testHome, { recursive: true, force: true });
});

const context = (args: string[] = []): CommandContext =>
  ({ args, values: {}, json: true, cwd: process.cwd(), stderr: process.stderr });

test("instruments lists synth sources and sampled licenses", async () => {
  const result = await instruments.run(context());
  const voices = result.data["voices"] as { id: string; source: string; emulates: string | null; params: Record<string, unknown> }[];
  const library = result.data["library"] as { id: string; family: string; license: { spdx: string } }[];
  assert.equal(voices.find((voice) => voice.id === "strings")?.source, "saw");
  for (const family of ["strings", "brass", "choir"])
    assert.equal(voices.find((voice) => voice.id === family)?.emulates, family);
  assert.equal(voices.find((voice) => voice.id === "supersaw")?.emulates, null);
  assert.ok(voices.every((voice) => Object.hasOwn(voice, "emulates")));
  assert.match(result.text ?? "", /strings\s+notes\s+saw\s+emulates:strings/);
  assert.match(result.text ?? "", /lib:brass-staccato\s+focal\s+brass/);
  assert.ok(voices.every((voice) => voice.source.length > 0));
  assert.equal(voices.find((voice) => voice.id === "bass")?.params["wave"] !== undefined, true);
  assert.equal(library.find((item) => item.id === "grand-piano")?.license.spdx, "CC-BY-3.0");
  assert.equal(library.find((item) => item.id === "brass-staccato")?.family, "brass");
  await assert.rejects(instruments.run(context(["extra"])));
});


test("instruments includes sorted imported identities, zone counts and roles in JSON and text", async () => {
  for (const [id, kind, role] of [["z-kit", "kit", undefined], ["a-sfz", "sfz", "focal"]] as const) {
    const root = join(testHome, "instruments", id);
    await mkdir(root, { recursive: true });
    const audio = createStereo(44100, 128);
    for (let i = 0; i < audio.left.length; i++) audio.left[i] = audio.right[i] = .2 * Math.sin(2 * Math.PI * 440 * i / 44100);
    await writeWav(join(root, "tone.wav"), audio, { bits: 24, seed: 1 });
    await writeFile(join(root, kind === "kit" ? "kit.json" : "tone.sfz"), kind === "kit" ?
      JSON.stringify({ version: 1, samples: { bd: ["tone.wav"] } }) : "<region> sample=tone.wav key=69\n");
    await writeFile(join(root, "instrument.json"), JSON.stringify({ version: 1, id, kind,
      entry: kind === "kit" ? "kit.json" : "tone.sfz", role, source: { folder: "synthetic" }, warnings: [],
      ...(kind === "sfz" ? { zones: [{ file: "tone.wav", named: 69, measured: 69, offset: 0, confidence: 1, lokey: 0, hikey: 127 }] } : {}) }));
  }
  const direct = await instruments.run(context());
  assert.deepEqual(direct.data["user"], [
    { id: "a-sfz", instrument: "user:a-sfz", kind: "sfz", zones: 1, role: "focal" },
    { id: "z-kit", instrument: "user:z-kit", kind: "kit", zones: 0, role: null }]);
  assert.match(direct.text ?? "", /USER INSTRUMENTS/);
  assert.match(direct.text ?? "", /user:a-sfz\s+sfz\s+zones:1 role:focal/);
  let stdout = "";
  const exit = await main(["instruments", "--json"], { cwd: testHome,
    stdout: { write(chunk: string) { stdout += chunk; return true; } } as NodeJS.WritableStream });
  assert.equal(exit, 0);
  assert.equal(stdout.trim().split("\n").length, 1);
  assert.deepEqual((JSON.parse(stdout) as { data: { user: unknown } }).data.user, direct.data["user"]);
});
