import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import type { TestContext } from "node:test";
import { createStereo, writeWav } from "../../audio-io/index.ts";
import { main } from "../main.ts";

interface Envelope {
  ok: boolean; command: string; artifacts: string[];
  data: { index: { roots: string[] }; candidates: { path: string; kind: string }[];
    instruments: { id: string }[]; id: string; notes: { want: number }[] };
  error: { code: string; details: { report: { ok: boolean; notes: { want: number; ok: boolean }[] } } };
}
async function home(t: TestContext): Promise<string> {
  const dir = await realpath(await mkdtemp(join(tmpdir(), "music2-library-cli-")));
  const previous = process.env["MUSIC2_HOME"], roots = process.env["MUSIC2_SAMPLE_ROOTS"], json = process.env["MUSIC2_JSON"];
  process.env["MUSIC2_HOME"] = dir; process.env["MUSIC2_SAMPLE_ROOTS"] = join(dir, "absent"); delete process.env["MUSIC2_JSON"];
  t.after(async () => {
    for (const [key, value] of [["MUSIC2_HOME", previous], ["MUSIC2_SAMPLE_ROOTS", roots], ["MUSIC2_JSON", json]])
      if (value === undefined) delete process.env[key!]; else process.env[key!] = value;
    await rm(dir, { recursive: true, force: true });
  });
  return dir;
}
async function invoke(dir: string, args: string[], json = true) {
  let stdout = "", stderr = "";
  const exit = await main(["library", ...args, ...(json ? ["--json"] : [])], { cwd: dir,
    stdout: { write(chunk: string) { stdout += chunk; return true; } } as NodeJS.WritableStream,
    stderr: { write(chunk: string) { stderr += chunk; return true; } } as NodeJS.WritableStream });
  if (json) { assert.equal(stdout.trim().split("\n").length, 1); assert.equal(stderr, ""); }
  return { exit, stdout, stderr };
}
function envelope(stdout: string): Envelope { return JSON.parse(stdout) as Envelope; }

test("malformed library verbs and options return one E_INPUT object", async (t) => {
  const dir = await home(t);
  for (const args of [[], ["unknown"], ["scan", "extra"], ["list", "extra"], ["find"], ["import"], ["verify"],
    ["find", "kick", "--kind", "drums"], ["find", "kick", "--limit", "0"], ["find", "kick", "--limit", "1.5"],
    ["import", "missing", "--id", "../bad"], ["import", "missing", "--id", "valid", "--as", "sfz"],
    ["import", "missing", "--id", "valid", "--octave", "1.5"], ["import", "missing", "--id", "valid", "--attack", "-1"],
    ["import", "missing", "--id", "valid", "--release", "NaN"], ["import", "missing", "--id", "valid"],
    ["verify", "valid", "--notes", "128"], ["verify", "valid", "--notes", "C4,"], ["verify", "valid", "--notes", "C"],
    ["verify", "../escape"], ["scan", "--force"], ["list", "--unknown"], ["list", "--limit", "1", "--limit", "2"]]) {
    const result = await invoke(dir, args);
    assert.equal(result.exit, 2, args.join(" "));
    assert.equal(envelope(result.stdout).error.code, "E_INPUT", args.join(" "));
  }
});

test("no available roots returns E_CAPABILITY exit 3 in scan and uncached find", async (t) => {
  const dir = await home(t);
  for (const args of [["scan"], ["find", "kick"]]) {
    const result = await invoke(dir, args);
    assert.equal(result.exit, 3); assert.equal(envelope(result.stdout).error.code, "E_CAPABILITY");
  }
});

test("repeated roots replace defaults, cache the index and find can rescan explicit roots", async (t) => {
  const dir = await home(t), rootA = join(dir, "a"), rootB = join(dir, "b");
  await mkdir(rootA); await mkdir(rootB);
  const scanned = await invoke(dir, ["scan", "--root", "a", "--root", "b"]);
  assert.equal(scanned.exit, 0);
  assert.deepEqual(envelope(scanned.stdout).data.index.roots, [rootA, rootB]);
  assert.equal(envelope(scanned.stdout).artifacts.length, 1);
  assert.ok(await readFile(join(dir, "library", "index.json"), "utf8"));
  assert.equal((await invoke(dir, ["find", "kick", "--kind", "kit", "--limit", "1"])).exit, 0);
  const refreshed = await invoke(dir, ["find", "kick", "--root", "b"]);
  assert.equal(refreshed.exit, 0);
  const index = JSON.parse(await readFile(join(dir, "library", "index.json"), "utf8")) as { roots: string[] };
  assert.deepEqual(index.roots, [rootB]);
  const listed = await invoke(dir, ["list"]);
  assert.equal(listed.exit, 0); assert.deepEqual(envelope(listed.stdout).data.instruments, []);
  const human = await invoke(dir, ["list"], false);
  assert.equal(human.exit, 0); assert.match(human.stdout, /INSTRUMENT\s+KIND\s+ZONES\s+ROLE/);
});

test("find without a cache scans configured roots first", async (t) => {
  const dir = await home(t), root = join(dir, "samples"); await mkdir(root);
  process.env["MUSIC2_SAMPLE_ROOTS"] = root;
  const found = await invoke(dir, ["find", "piano"]);
  assert.equal(found.exit, 0); assert.equal(envelope(found.stdout).artifacts.length, 1);
});

async function instrument(dir: string, id: string, sounding: number): Promise<void> {
  const root = join(dir, "instruments", id); await mkdir(root, { recursive: true });
  const pcm = createStereo(44100, 44100);
  const frequency = 440 * 2 ** ((sounding - 69) / 12);
  for (let i = 0; i < pcm.left.length; i++) {
    const phase = 2 * Math.PI * frequency * i / pcm.sampleRate;
    pcm.left[i] = pcm.right[i] = .2 * (Math.sin(phase) + .5 * Math.sin(2 * phase) + .25 * Math.sin(3 * phase) + .125 * Math.sin(4 * phase));
  }
  await writeWav(join(root, "sample.wav"), pcm, { bits: 24, seed: 1 });
  await writeFile(join(root, `${id}.sfz`), "<region> sample=sample.wav pitch_keycenter=60 lokey=0 hikey=127 ampeg_release=0.02\n");
  await writeFile(join(root, "instrument.json"), JSON.stringify({ version: 1, id, kind: "sfz", entry: `${id}.sfz`, source: { folder: "synthetic" }, warnings: [] }));
}

test("verify accepts note names and MIDI; a pitch miss exits 6 and preserves the report", async (t) => {
  const dir = await home(t); await instrument(dir, "correct", 60); await instrument(dir, "wrong", 48);
  const passed = await invoke(dir, ["verify", "correct", "--notes", "C4,61,Eb4"]);
  assert.equal(passed.exit, 0, passed.stdout);
  assert.deepEqual(envelope(passed.stdout).data.notes.map((note) => note.want), [60, 61, 63]);
  const failed = await invoke(dir, ["verify", "wrong", "--notes", "60"]);
  assert.equal(failed.exit, 6, failed.stdout);
  const error = envelope(failed.stdout).error;
  assert.equal(error.code, "E_QA"); assert.equal(error.details.report.ok, false);
  assert.equal(error.details.report.notes[0]?.want, 60); assert.equal(error.details.report.notes[0]?.ok, false);
  const list = await invoke(dir, ["list", "--kind", "instrument", "--limit", "1"]);
  assert.equal(list.exit, 0); assert.deepEqual(envelope(list.stdout).data.instruments.map((item) => item.id), ["correct"]);
});
