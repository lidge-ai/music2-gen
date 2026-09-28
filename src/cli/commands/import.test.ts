import assert from "node:assert/strict";
import test from "node:test";
import { mkdir, mkdtemp, readFile, readdir, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { main } from "../main.ts";
import { writeSmf } from "../../midi/index.ts";

const hex = `4D 54 68 64 00 00 00 06 00 00 00 01 00 60
4D 54 72 6B 00 00 00 11
00 90 3C 64 60 3C 00 00 40 64 60 40 00 00 FF 2F 00`;
const fixture = Uint8Array.from(hex.trim().split(/\s+/).map((x) => parseInt(x, 16)));
async function invoke(argv: string[], cwd: string): Promise<{ exit: number; stdout: string; stderr: string }> {
  let stdout = ""; let stderr = "";
  const exit = await main(argv, { cwd,
    stdout: { write(chunk: string) { stdout += chunk; return true; } } as NodeJS.WritableStream,
    stderr: { write(chunk: string) { stderr += chunk; return true; } } as NodeJS.WritableStream });
  return { exit, stdout, stderr };
}
async function withFixture(run: (dir: string) => Promise<void>): Promise<void> {
  const dir = await mkdtemp(join(tmpdir(), "music2-midi-import-"));
  try { await writeFile(join(dir, "input.mid"), fixture); await run(dir); }
  finally { await rm(dir, { recursive: true, force: true }); }
}

test("tiny format-0 fixture imports note lists and one JSON envelope", async () => {
  await withFixture(async (dir) => {
    const result = await invoke(["import", "midi", "input.mid", "-o", "song.json", "--json"], dir);
    assert.equal(result.exit, 0);
    assert.equal(result.stderr, "");
    assert.equal(result.stdout.trim().split("\n").length, 1);
    const output = JSON.parse(result.stdout) as { command: string; artifacts: string[]; data: { notes: number; bars: number } };
    assert.equal(output.command, "import");
    assert.deepEqual(output.artifacts, [join(dir, "song.json")]);
    assert.equal(output.data.notes, 2);
    assert.equal(output.data.bars, 1);
    const body = await readFile(join(dir, "song.json"), "utf8");
    assert.ok(body.endsWith("\n"));
    const song = JSON.parse(body) as { tracks: { notes: { start: number; length: number; pitch: number }[] }[] };
    assert.deepEqual(song.tracks[0]!.notes.map((n) => [n.start, n.length, n.pitch]), [[0, 1, 60], [1, 1, 64]]);
  });
});

test("no-replace, force and source alias preserve the input", async () => {
  await withFixture(async (dir) => {
    const args = ["import", "midi", "input.mid", "-o", "song.json", "--json"];
    await writeFile(join(dir, "song.json"), "old");
    const collision = await invoke(args, dir);
    assert.equal(collision.exit, 4);
    assert.equal((JSON.parse(collision.stdout) as { error: { code: string } }).error.code, "E_ACCESS");
    assert.equal(await readFile(join(dir, "song.json"), "utf8"), "old");
    assert.equal((await invoke([...args, "--force"], dir)).exit, 0);
    assert.deepEqual(await readFile(join(dir, "input.mid")), Buffer.from(fixture));
    const alias = await invoke(["import", "midi", "input.mid", "-o", "input.mid", "--force", "--json"], dir);
    assert.equal(alias.exit, 2);
  });
});

test("malformed bytes, missing output and bad suffix leave no artifact", async () => {
  await withFixture(async (dir) => {
    await writeFile(join(dir, "broken.mid"), fixture.subarray(0, 23));
    const malformed = await invoke(["import", "midi", "broken.mid", "-o", "out.json", "--json"], dir);
    assert.equal(malformed.exit, 2);
    assert.equal((JSON.parse(malformed.stdout) as { error: { code: string } }).error.code, "E_PARSE");
    for (const args of [["import", "midi", "input.mid", "--json"],
      ["import", "midi", "input.mid", "-o", "out.wav", "--json"]]) {
      const result = await invoke(args, dir);
      assert.equal(result.exit, 2);
      assert.equal((JSON.parse(result.stdout) as { error: { code: string } }).error.code, "E_INPUT");
    }
    assert.deepEqual((await readdir(dir)).sort(), ["broken.mid", "input.mid"]);
  });
});

test("import rejects kit manifest symlink escaping the output Song directory", async () => {
  await withFixture(async (dir) => {
    const outside = await mkdtemp(join(tmpdir(), "music2-import-outside-"));
    try {
      const identity = Uint8Array.from(Buffer.from("music2:kit:assets/kit", "ascii"));
      const midi = writeSmf({ format: 1, ppq: 960, warnings: [], tracks: [
        { sourceIndex: 0, endTick: 3840, events: [] },
        { sourceIndex: 1, endTick: 3840, events: [
          { tick: 0, kind: "meta", type: 1, data: identity },
          { tick: 0, kind: "noteOn", channel: 9, key: 36, velocity: 100 },
          { tick: 960, kind: "noteOff", channel: 9, key: 36, velocity: 64 },
        ] },
      ] });
      await writeFile(join(dir, "kit.mid"), midi);
      await mkdir(join(dir, "assets", "kit"), { recursive: true });
      await writeFile(join(outside, "kit.json"), JSON.stringify({ version: 1, samples: { bd: ["bd.wav"] } }));
      await symlink(join(outside, "kit.json"), join(dir, "assets", "kit", "kit.json"));
      const result = await invoke(["import", "midi", "kit.mid", "-o", "out.json", "--json"], dir);
      assert.equal(result.exit, 4);
      assert.equal((JSON.parse(result.stdout) as { error: { code: string } }).error.code, "E_ACCESS");
      await assert.rejects(readFile(join(dir, "out.json")), { code: "ENOENT" });
    } finally { await rm(outside, { recursive: true, force: true }); }
  });
});

test("strict tempo change returns capability and leaves no output", async () => {
  await withFixture(async (dir) => {
    const changing = writeSmf({ format: 1, ppq: 960, warnings: [], tracks: [
      { sourceIndex: 0, endTick: 3840, events: [
        { tick: 0, kind: "meta", type: 0x51, data: Uint8Array.of(7, 0xa1, 0x20) },
        { tick: 960, kind: "meta", type: 0x51, data: Uint8Array.of(6, 0x8a, 0x1b) },
      ] },
    ] });
    await writeFile(join(dir, "change.mid"), changing);
    const result = await invoke(["import", "midi", "change.mid", "-o", "out.json", "--strict", "--json"], dir);
    assert.equal(result.exit, 3);
    assert.equal((JSON.parse(result.stdout) as { error: { code: string } }).error.code, "E_CAPABILITY");
    await assert.rejects(readFile(join(dir, "out.json")), { code: "ENOENT" });
  });
});
