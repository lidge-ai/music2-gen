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
