import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import type { TestContext } from "node:test";
import type { BalanceReport } from "../../balance/index.ts";
import { main } from "../main.ts";

interface Envelope { ok: boolean; command: string; data: BalanceReport; artifacts: string[]; error: { code: string } }
async function setup(t: TestContext): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "music2-balance-cli-"));
  await writeFile(join(dir, "song.json"), JSON.stringify({ version: 1, seed: 2, bpm: 120, tailSeconds: 0,
    tracks: [{ id: "kick", kind: "drums", instrument: "drums", pattern: "bd*4", gain: -6 },
      { id: "bass", kind: "notes", instrument: "bass", pattern: "c3*4", gain: -12,
        layers: [{ id: "1copy", instrument: "bass", gain: -3 }] }],
    sections: [{ id: "drop", bars: 1 }], arrangement: [{ section: "drop" }] }));
  t.after(async () => { await rm(dir, { recursive: true, force: true }); });
  return dir;
}
async function invoke(dir: string, args: string[], json = true) {
  let stdout = "", stderr = "";
  const exit = await main(["balance", ...args, ...(json ? ["--json"] : [])], { cwd: dir,
    stdout: { write(chunk: string) { stdout += chunk; return true; } } as NodeJS.WritableStream,
    stderr: { write(chunk: string) { stderr += chunk; return true; } } as NodeJS.WritableStream });
  if (json) { assert.equal(stdout.trim().split("\n").length, 1); assert.equal(stderr, ""); }
  return { exit, stdout, stderr };
}
const envelope = (stdout: string): Envelope => JSON.parse(stdout) as Envelope;

test("balance previews a single JSON report, supports repeated targets and targets-file precedence", async (t) => {
  const dir = await setup(t), source = await readFile(join(dir, "song.json"), "utf8");
  await writeFile(join(dir, "targets.json"), '{"bass":-2,"bass.1copy":-9}');
  const result = await invoke(dir, ["song.json", "--reference", "kick", "--targets", "targets.json", "--target", "bass=-3", "--target", "bass=-5"]);
  assert.equal(result.exit, 0);
  const report = envelope(result.stdout);
  assert.equal(report.command, "balance"); assert.equal(report.ok, true);
  assert.equal(report.data.rows.length, 4); assert.equal(report.data.after, undefined);
  const bass = report.data.rows.find((row) => row.id === "bass")!;
  const kick = report.data.rows.find((row) => row.id === "kick")!;
  assert.ok(Math.abs(bass.targetDb! - kick.rmsDb! + 5) < 0.01);
  assert.ok(report.data.changes.some((change) => change.layer === "1copy"));
  assert.deepEqual(report.artifacts, []);
  assert.equal(await readFile(join(dir, "song.json"), "utf8"), source);
});

test("CLI apply changes track and layer gains, reports after and one artifact", async (t) => {
  const dir = await setup(t);
  const result = await invoke(dir, ["song.json", "--target", "bass=-30", "--target", "bass.1copy=-9", "--apply"]);
  assert.equal(result.exit, 0);
  const report = envelope(result.stdout);
  assert.ok(report.data.after); assert.equal(report.data.changes.length, 2);
  assert.deepEqual(report.artifacts, [join(dir, "song.json")]);
  assert.ok((await readFile(join(dir, "song.json"), "utf8")).startsWith('{\n  "version"'));
});

test("bad arguments and identifiers yield one E_INPUT envelope with exit 2", async (t) => {
  const dir = await setup(t);
  for (const args of [[], ["song.json", "extra"], ["song.json", "--target", "unknown=-2"],
    ["song.json", "--target", "bass.no=-2"], ["song.json", "--target", "bass.main=-2"],
    ["song.json", "--target", "bass=NaN"], ["song.json", "--reference", "none"],
    ["song.json", "--reference", "kick", "--target", "kick=-2"],
    ["song.json", "--section", "no"], ["song.json", "--occurrence", "1"],
    ["song.json", "--section", "drop", "--bars", "0:1"], ["song.json", "--bars", "0:2"],
    ["song.json", "--section", "drop", "--occurrence", "2"], ["song.json", "--section", "drop", "--occurrence", "1.5"],
    ["song.json", "--occurrence", "Infinity"], ["song.json", "--max-step", "-1"],
    ["song.json", "--max-step", "NaN"], ["song.json", "--max-step", "Infinity"],
    ["song.json", "--targets", "missing.json"], ["song.json", "--unknown"]]) {
    const result = await invoke(dir, args);
    assert.equal(result.exit, 2, args.join(" ")); assert.equal(envelope(result.stdout).error.code, "E_INPUT", args.join(" "));
  }
  for (const contents of ['[]', '{"bass":"-1"}', '{"bass":null}', '{"bass":1e999}', '{invalid']) {
    await writeFile(join(dir, "targets.json"), contents);
    const result = await invoke(dir, ["song.json", "--targets", "targets.json"]);
    assert.equal(result.exit, 2); assert.equal(envelope(result.stdout).error.code, "E_INPUT");
  }
  const song = JSON.parse(await readFile(join(dir, "song.json"), "utf8")) as Record<string, unknown>;
  song["loop"] = true; await writeFile(join(dir, "song.json"), JSON.stringify(song));
  const result = await invoke(dir, ["song.json"]);
  assert.equal(result.exit, 2); assert.equal(envelope(result.stdout).error.code, "E_INPUT");
});

test("max-step zero leaves bytes and mtime; human mode prints levels and changes", async (t) => {
  const dir = await setup(t), path = join(dir, "song.json"), source = await readFile(path, "utf8"), before = await stat(path);
  const result = await invoke(dir, ["song.json", "--target", "bass=-30", "--max-step", "0", "--apply"]);
  assert.equal(result.exit, 0); assert.equal(envelope(result.stdout).data.changes.length, 0);
  assert.equal(await readFile(path, "utf8"), source); assert.equal((await stat(path)).mtimeMs, before.mtimeMs);
  const human = await invoke(dir, ["song.json", "--target", "bass=-30"], false);
  assert.equal(human.exit, 0); assert.equal(human.stderr, "");
  assert.match(human.stdout, /RMS dBFS/); assert.match(human.stdout, /Gain changes/);
  assert.match(human.stdout, /bass\.1copy/);
});
