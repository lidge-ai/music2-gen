import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { main } from "../main.ts";
import type { ProjectIR } from "../../project/index.ts";

interface Envelope {
  command: string; artifacts: string[];
  data: { ir: ProjectIR; quantization: ProjectIR["quantization"] };
  error: { code: string };
}
function envelope(text: string): Envelope { return JSON.parse(text) as Envelope; }

const source = { version: 1, bpm: 120,
  tracks: [{ id: "lead", kind: "notes", instrument: "piano", notes: [{ start: 0, length: 1, pitch: 60 }] }],
  sections: [{ id: "hook", bars: 1 }], arrangement: [{ section: "hook" }] };

async function invoke(argv: string[], cwd: string): Promise<{ exit: number; stdout: string; stderr: string }> {
  let stdout = ""; let stderr = "";
  const exit = await main(argv, { cwd,
    stdout: { write(chunk: string) { stdout += chunk; return true; } } as NodeJS.WritableStream,
    stderr: { write(chunk: string) { stderr += chunk; return true; } } as NodeJS.WritableStream });
  return { exit, stdout, stderr };
}

test("export ir prints one JSON envelope or formatted human IR", async () => {
  const dir = await mkdtemp(join(tmpdir(), "music2-ir-cli-"));
  try {
    await writeFile(join(dir, "song.json"), JSON.stringify(source));
    const json = await invoke(["export", "ir", "song.json", "--json"], dir);
    assert.equal(json.exit, 0);
    assert.equal(json.stderr, "");
    const result = envelope(json.stdout);
    assert.equal(result.command, "export");
    assert.deepEqual(result.artifacts, []);
    assert.equal(result.data.ir.ppq, 960);
    assert.deepEqual(Object.keys(result.data.ir).slice(0, 4), ["version", "ppq", "title", "seed"]);
    const human = await invoke(["export", "ir", "song.json"], dir);
    assert.equal(human.exit, 0);
    assert.equal((JSON.parse(human.stdout) as ProjectIR).ppq, 960);
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test("staged output is newline terminated, no-replace and --force replaces", async () => {
  const dir = await mkdtemp(join(tmpdir(), "music2-ir-file-"));
  try {
    await writeFile(join(dir, "song.json"), JSON.stringify(source));
    const args = ["export", "ir", "song.json", "-o", "ir.json", "--json"];
    const first = await invoke(args, dir);
    assert.equal(first.exit, 0);
    const body = await readFile(join(dir, "ir.json"), "utf8");
    assert.ok(body.endsWith("\n"));
    assert.equal(body, JSON.stringify(JSON.parse(body) as unknown, null, 2) + "\n");
    const result = envelope(first.stdout);
    assert.deepEqual(result.artifacts, [join(dir, "ir.json")]);
    assert.deepEqual(result.data.quantization, { events: 0, inexact: 0, maxErrorTicks: 0 });
    const second = await invoke(args, dir);
    assert.equal(second.exit, 4);
    assert.equal(envelope(second.stdout).error.code, "E_ACCESS");
    assert.equal(await readFile(join(dir, "ir.json"), "utf8"), body);
    const replaced = await invoke([...args, "--force"], dir);
    assert.equal(replaced.exit, 0);
    assert.equal(await readFile(join(dir, "ir.json"), "utf8"), body);
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test("aliases, reserved subverbs and malformed flags produce one input error", async () => {
  const dir = await mkdtemp(join(tmpdir(), "music2-ir-errors-"));
  try {
    await writeFile(join(dir, "song.json"), JSON.stringify(source));
    for (const argv of [
      ["export", "ir", "song.json", "-o", "song.json", "--json"],
      ["export", "midi", "song.json", "--json"],
      ["export", "--json"],
      ["export", "ir", "song.json", "--bogus", "--json"],
      ["export", "ir", "song.json", "-o", "out.wav", "--json"],
    ]) {
      const result = await invoke(argv, dir);
      assert.equal(result.exit, 2, argv.join(" "));
      assert.equal(result.stderr, "");
      assert.equal(envelope(result.stdout).error.code, "E_INPUT");
      assert.equal(result.stdout.trim().split("\n").length, 1);
    }
    await symlink("song.json", join(dir, "alias.json"));
    const alias = await invoke(["export", "ir", "song.json", "-o", "alias.json", "--force", "--json"], dir);
    assert.equal(alias.exit, 2);
    assert.equal(envelope(alias.stdout).error.code, "E_INPUT");
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test("song schema failure retains its error code and single envelope", async () => {
  const dir = await mkdtemp(join(tmpdir(), "music2-ir-schema-"));
  try {
    await writeFile(join(dir, "bad.json"), JSON.stringify({ ...source, tracks: [] }));
    const result = await invoke(["export", "ir", "bad.json", "--json"], dir);
    assert.equal(result.exit, 2);
    assert.equal(envelope(result.stdout).error.code, "E_SCHEMA");
    assert.equal(result.stdout.trim().split("\n").length, 1);
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test("export midi writes type-1 bytes with a placement marker and deterministic output", async () => {
  const dir = await mkdtemp(join(tmpdir(), "music2-midi-export-"));
  try {
    await writeFile(join(dir, "song.json"), JSON.stringify(source));
    const args = ["export", "midi", "song.json", "-o", "one.mid", "--json"];
    const result = await invoke(args, dir);
    assert.equal(result.exit, 0);
    const response = JSON.parse(result.stdout) as { artifacts: string[]; data: { format: number; ppq: number; tracks: number; notes: number; channels: Record<string, number> } };
    assert.equal(result.stdout.trim().split("\n").length, 1);
    assert.deepEqual(response.artifacts, [join(dir, "one.mid")]);
    assert.deepEqual([response.data.format, response.data.ppq, response.data.tracks, response.data.notes], [1, 960, 2, 1]);
    assert.deepEqual(response.data.channels, { lead: 1 });
    const body = await readFile(join(dir, "one.mid"));
    assert.equal(body.subarray(0, 14).toString("hex"), "4d546864000000060001000203c0");
    assert.ok(body.includes(Buffer.from("00ff0604686f6f6b", "hex"))); // FF 06 hook, hand-derived
    assert.equal((await invoke(args, dir)).exit, 4);
    assert.equal((await invoke([...args, "--force"], dir)).exit, 0);
    assert.deepEqual(await readFile(join(dir, "one.mid")), body);
    assert.equal((await invoke(["export", "midi", "song.json", "-o", "two.mid", "--json"], dir)).exit, 0);
    assert.deepEqual(await readFile(join(dir, "two.mid")), body);
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test("export midi rejects source/output identity and escaped kit manifest", async () => {
  const dir = await mkdtemp(join(tmpdir(), "music2-midi-kit-"));
  try {
    await writeFile(join(dir, "song.json"), JSON.stringify(source));
    const alias = await invoke(["export", "midi", "song.json", "-o", "song.json", "--json"], dir);
    assert.equal(alias.exit, 2);
    const kitSong = { ...source, tracks: [{ id: "kit", kind: "drums", instrument: "kit:assets/kit",
      notes: [{ start: 0, length: 1, sample: "kick" }] }] };
    await writeFile(join(dir, "kit-song.json"), JSON.stringify(kitSong));
    const outside = await mkdtemp(join(tmpdir(), "music2-midi-outside-"));
    try {
      await writeFile(join(outside, "kit.json"), JSON.stringify({ version: 1, samples: { kick: ["kick.wav"] } }));
      const { mkdir } = await import("node:fs/promises");
      await mkdir(join(dir, "assets", "kit"), { recursive: true });
      await symlink(join(outside, "kit.json"), join(dir, "assets", "kit", "kit.json"));
      const rejected = await invoke(["export", "midi", "kit-song.json", "-o", "kit.mid", "--json"], dir);
      assert.equal(rejected.exit, 4);
      assert.equal((JSON.parse(rejected.stdout) as { error: { code: string } }).error.code, "E_ACCESS");
      await assert.rejects(readFile(join(dir, "kit.mid")), { code: "ENOENT" });
    } finally { await rm(outside, { recursive: true, force: true }); }
  } finally { await rm(dir, { recursive: true, force: true }); }
});
