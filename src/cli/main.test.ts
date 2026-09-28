import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { cpSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { packageRoot, packageVersion } from "../shared/index.ts";
import { main } from "./main.ts";

function capture() {
  let stdout = "";
  let stderr = "";
  return {
    io: {
      stdout: { write(value: string) { stdout += value; return true; } } as NodeJS.WritableStream,
      stderr: { write(value: string) { stderr += value; return true; } } as NodeJS.WritableStream,
    },
    output: () => ({ stdout, stderr }),
  };
}

void test("version --json emits one success object with package version", async () => {
  const c = capture();
  assert.equal(await main(["version", "--json"], c.io), 0);
  const { stdout, stderr } = c.output();
  assert.equal(stderr, "");
  assert.equal(stdout.trim().split("\n").length, 1);
  const body = JSON.parse(stdout) as { ok: boolean; command: string; data: { version: string }; meta: { music2: string } };
  assert.equal(body.ok, true);
  assert.equal(body.command, "version");
  assert.equal(body.data.version, packageVersion());
  assert.equal(body.meta.music2, packageVersion());
});

void test("unknown command exits 2 and emits one JSON E_INPUT object", async () => {
  const c = capture();
  assert.equal(await main(["nonesuch", "--json"], c.io), 2);
  const { stdout, stderr } = c.output();
  assert.equal(stderr, "");
  assert.equal(stdout.trim().split("\n").length, 1);
  const body = JSON.parse(stdout) as { ok: boolean; command: string; error: { code: string; details: { commands: string[] } } };
  assert.equal(body.ok, false);
  assert.equal(body.command, "nonesuch");
  assert.equal(body.error.code, "E_INPUT");
  assert.ok(body.error.details.commands.includes("version"));
  assert.ok(body.error.details.commands.includes("help"));
});

void test("bad flag exits 2", async () => {
  const c = capture();
  assert.equal(await main(["version", "--bogus", "--json"], c.io), 2);
  const body = JSON.parse(c.output().stdout) as { error: { code: string } };
  assert.equal(body.error.code, "E_INPUT");
});

void test("help lists registered commands and summaries", async () => {
  const c = capture();
  assert.equal(await main(["help", "--json"], c.io), 0);
  const body = JSON.parse(c.output().stdout) as { data: { usage: string; commands: { name: string; summary: string }[] } };
  assert.match(body.data.usage, /music2 <command>/);
  assert.ok(body.data.commands.some(({ name }) => name === "version"));
  assert.ok(body.data.commands.some(({ name }) => name === "help"));
  assert.ok(body.data.commands.every(({ summary }) => summary.length > 0));
});

void test("help topic and command --help return command usage", async () => {
  for (const argv of [["help", "version"], ["version", "--help"]]) {
    const c = capture();
    assert.equal(await main(argv, c.io), 0);
    assert.match(c.output().stdout, /music2 version \[--json\]/);
    assert.equal(c.output().stderr, "");
  }
});

void test("MUSIC2_JSON=1 forces JSON output", async () => {
  const previous = process.env["MUSIC2_JSON"];
  process.env["MUSIC2_JSON"] = "1";
  try {
    const c = capture();
    assert.equal(await main(["version"], c.io), 0);
    const body = JSON.parse(c.output().stdout) as { ok: boolean; data: { version: string } };
    assert.equal(body.ok, true);
    assert.equal(body.data.version, packageVersion());
  } finally {
    if (previous === undefined) delete process.env["MUSIC2_JSON"];
    else process.env["MUSIC2_JSON"] = previous;
  }
});

void test("human errors go to stderr with a fix", async () => {
  const c = capture();
  assert.equal(await main(["nonesuch"], c.io), 2);
  assert.equal(c.output().stdout, "");
  assert.equal(c.output().stderr, "music2: unknown command: nonesuch\nFix: run music2 help\n");
});

void test("bin runs version --json from source when dist is absent", () => {
  const fixture = mkdtempSync(join(tmpdir(), "music2-cli-source-"));
  try {
    cpSync(join(packageRoot(), "package.json"), join(fixture, "package.json"));
    cpSync(join(packageRoot(), "bin"), join(fixture, "bin"), { recursive: true });
    cpSync(join(packageRoot(), "src"), join(fixture, "src"), { recursive: true });
    const stdout = execFileSync(process.execPath, ["bin/music2.js", "version", "--json"], {
      cwd: fixture, encoding: "utf8", env: { ...process.env, MUSIC2_JSON: "0" },
    });
    const body = JSON.parse(stdout) as { ok: boolean; data: { version: string } };
    assert.equal(body.ok, true);
    assert.equal(body.data.version, packageVersion());
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
});

void test("validate reports the minimal song's bars and track counts", async () => {
  const c = capture();
  assert.equal(await main(["validate", "examples/minimal.song.json", "--json"], c.io), 0);
  const body = JSON.parse(c.output().stdout) as { ok: boolean; data: { bars: number; bpm: number; tracks: { id: string; events: number }[] } };
  assert.equal(body.ok, true);
  assert.equal(body.data.bars, 2);
  assert.equal(body.data.tracks.length, 2);
  assert.equal(body.data.bars, 2);
  assert.ok(body.data.tracks.every((track) => track.events > 0));
});

void test("validate emits all broken-song issues with exit 2", async () => {
  const { writeFileSync } = await import("node:fs");
  const dir = mkdtempSync(join(tmpdir(), "music2-cli-bad-"));
  try {
    const path = join(dir, "bad.json");
    writeFileSync(path, JSON.stringify({ version: 1, bpm: 9, foo: true, tracks: [], sections: [], arrangement: [] }));
    const c = capture();
    assert.equal(await main(["validate", path, "--json"], c.io), 2);
    const body = JSON.parse(c.output().stdout) as { error: { code: string; details: { issues: unknown[] } } };
    assert.equal(body.error.code, "E_SCHEMA");
    assert.ok(body.error.details.issues.length >= 2);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

void test("events filters by track and half-open bar range", async () => {
  const c = capture();
  assert.equal(await main(["events", "examples/minimal.song.json", "--track", "sub", "--bars", "1:2", "--json"], c.io), 0);
  const body = JSON.parse(c.output().stdout) as { data: { events: { track: string; bar: number; cycleBegin: string; atom: { raw: string }; midi: number; time: number }[] } };
  assert.ok(body.data.events.length > 0);
  assert.ok(body.data.events.every((event) => event.track === "sub" && event.bar === 1 && event.atom.raw === "c2" && event.midi === 36));
  assert.ok(body.data.events.every((event) => event.time >= 2 && event.time < 4));
});

void test("schema --out writes bytes identical to the published schema", async () => {
  const { readFileSync } = await import("node:fs");
  const dir = mkdtempSync(join(tmpdir(), "music2-schema-"));
  try {
    const c = capture();
    assert.equal(await main(["schema", "--out", "written.json", "--json"], { ...c.io, cwd: dir }), 0);
    assert.equal(readFileSync(join(dir, "written.json"), "utf8"), readFileSync(join(packageRoot(), "schema/song.v1.json"), "utf8"));
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

void test("analyze missing input and unknown option keep one JSON error object", async () => {
  const missing = capture();
  assert.equal(await main(["analyze", "/definitely-absent-music2.wav", "--json"], missing.io), 2);
  assert.equal(missing.output().stdout.trim().split("\n").length, 1);
  assert.equal((JSON.parse(missing.output().stdout) as { error: { code: string } }).error.code, "E_NOT_FOUND");
  const flag = capture();
  assert.equal(await main(["analyze", "examples/drill-140.song.json", "--unknown", "--json"], flag.io), 2);
  assert.equal((JSON.parse(flag.output().stdout) as { error: { code: string } }).error.code, "E_INPUT");
});

void test("analyze WAV uses an audio beat grid and rejects a misaligned companion song", async () => {
  const { readFileSync } = await import("node:fs");
  const { renderSong } = await import("../render/index.ts");
  const { writeWav } = await import("../audio-io/index.ts");
  const { loadSong } = await import("../song/index.ts");
  const fixture = mkdtempSync(join(tmpdir(), "music2-cli-analyze-"));
  try {
    const songPath = join(packageRoot(), "examples/drill-140.song.json");
    const song = await loadSong(songPath);
    const rendered = await renderSong(song, songPath);
    const wav = join(fixture, "drill.wav");
    await writeWav(wav, rendered.audio, { bits: 16, seed: 1 });
    const c = capture();
    assert.equal(await main(["analyze", wav, "--out", join(fixture, "report"), "--json"], c.io), 0);
    const body = JSON.parse(c.output().stdout) as { ok: boolean; data: { beatsJson: string; pianoRollPng: null; summary: { estimatedBpm: number; warnings: { code: string }[] } } };
    assert.equal(body.ok, true);
    assert.equal(body.data.pianoRollPng, null);
    assert.ok(body.data.summary.estimatedBpm >= 138 && body.data.summary.estimatedBpm <= 142);
    assert.ok(body.data.summary.warnings.some(({ code }) => code === "METER_ASSUMED"));
    const beats = JSON.parse(readFileSync(body.data.beatsJson, "utf8")) as { source: string; meter: number };
    assert.equal(beats.source, "audio"); assert.equal(beats.meter, 4);
    const companion = capture();
    assert.equal(await main(["analyze", wav, "--song", songPath, "--out", join(fixture, "with-song"), "--json"], companion.io), 0);
    const paired = JSON.parse(companion.output().stdout) as { data: { pianoRollPng: string; beatsJson: string } };
    assert.ok(paired.data.pianoRollPng.endsWith("pianoroll.png"));
    assert.equal((JSON.parse(readFileSync(paired.data.beatsJson, "utf8")) as { source: string }).source, "song");
    const mismatch = capture();
    assert.equal(await main(["analyze", wav, "--song", join(packageRoot(), "examples/minimal.song.json"), "--json"], mismatch.io), 2);
    assert.equal((JSON.parse(mismatch.output().stdout) as { error: { code: string } }).error.code, "E_INPUT");
  } finally { rmSync(fixture, { recursive: true, force: true }); }
});

test("a repeated scalar flag is rejected with E_INPUT", async () => {
  const { main } = await import("./main.ts");
  const chunks: string[] = [];
  const stdout = { write: (s: string) => { chunks.push(s); return true; } } as unknown as NodeJS.WritableStream;
  const code = await main(["schema", "--out", "a.json", "--out", "b.json", "--json"], { stdout, stderr: stdout });
  assert.equal(code, 2);
  const out = JSON.parse(chunks.join("")) as { error: { code: string; details: { flag: string } } };
  assert.equal(out.error.code, "E_INPUT");
  assert.equal(out.error.details.flag, "out");
});

async function runCli(argv: string[]): Promise<{ code: number; out: Record<string, unknown> }> {
  const { main } = await import("./main.ts");
  const chunks: string[] = [];
  const stream = { write: (s: string) => { chunks.push(s); return true; } } as unknown as NodeJS.WritableStream;
  const code = await main([...argv, "--json"], { stdout: stream, stderr: stream });
  return { code, out: JSON.parse(chunks.join("")) as Record<string, unknown> };
}

test("recipes lists seven genres in one envelope", async () => {
  const { code, out } = await runCli(["recipes"]);
  assert.equal(code, 0);
  const data = out["data"] as { recipes: { id: string }[] };
  assert.deepEqual(data.recipes.map((r) => r.id), ["boom_bap", "drill_ny", "drill_uk", "house", "lofi_hiphop", "techno", "trap"]);
});

test("new writes a transposed starter that validates", async () => {
  const dir = mkdtempSync(join(tmpdir(), "music2-new-"));
  try {
    const path = join(dir, "song.json");
    const made = await runCli(["new", "--genre", "drill_uk", "--key", "D minor", "--seed", "7", "-o", path]);
    assert.equal(made.code, 0);
    const validated = await runCli(["validate", path]);
    assert.equal(validated.code, 0);
    const again = await runCli(["new", "--genre", "drill_uk", "-o", path]);
    assert.equal(again.code, 4, "existing destination is refused");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("lint: drill example is clean under --strict, wrong genre fails with named rules", async () => {
  const clean = await runCli(["lint", "examples/drill-140.song.json", "--strict"]);
  assert.equal(clean.code, 0);
  const wrong = await runCli(["lint", "examples/wrong-genre.song.json", "--strict"]);
  assert.equal(wrong.code, 6);
  const report = ((wrong.out["error"] as { details: { report: { results: { id: string }[] } } }).details.report);
  const ids = report.results.map((r) => r.id);
  assert.ok(ids.includes("drill_uk/1") && ids.includes("drill_uk/2"), ids.join(","));
  const house = await runCli(["lint", "examples/drill-140.song.json", "--genre", "house", "--strict"]);
  assert.equal(house.code, 6);
});

test("critique maps an unreachable provider to E_PROVIDER exit 4", async () => {
  const { code, out } = await runCli(["critique", "examples/drill-140.song.json", "--base-url", "http://127.0.0.1:9", "--excerpt", "2"]);
  assert.equal(code, 4);
  assert.equal((out["error"] as { code: string }).code, "E_PROVIDER");
});

test("skill path is registered; bad subcommands exit 2", async () => {
  const bad = await runCli(["skill", "install"]);
  assert.equal(bad.code, 2);
  assert.equal((bad.out["error"] as { code: string }).code, "E_INPUT");
  const bare = await runCli(["skill"]);
  assert.equal(bare.code, 2);
});

void test("validate rejects out-of-range voice parameters before render", async () => {
  const { writeFileSync } = await import("node:fs");
  const dir = mkdtempSync(join(tmpdir(), "music2-cli-voice-"));
  try {
    const path = join(dir, "voice.json");
    writeFileSync(path, JSON.stringify({ version: 1, bpm: 140, tracks: [{ id: "ep", kind: "notes", instrument: "epiano",
      params: { releaseMs: 600 }, pattern: "c4 eb4" }], sections: [{ id: "a", bars: 1 }], arrangement: [{ section: "a" }] }));
    const c = capture();
    assert.equal(await main(["validate", path, "--json"], c.io), 2);
    const body = JSON.parse(c.output().stdout) as { error: { code: string; details: { issues: { path: string }[] } } };
    assert.equal(body.error.code, "E_SCHEMA");
    assert.deepEqual(body.error.details.issues.map((issue) => issue.path), ["tracks[0].params.releaseMs"]);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
