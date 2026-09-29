import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";
import { isRealBunBinary, resolveBun } from "../../bin/bun-binary.mjs";
import { pinnedBunVersion } from "../../src/shared/index.ts";

// These tests start the published launcher with real Node, the way npm's global shim does.
const root = resolve(import.meta.dirname, "../..");
const launcher = join(root, "bin/music2.js");

function missingNode(): string | null {
  const probe = spawnSync("node", ["-p", "typeof process.versions.bun"], { encoding: "utf8" });
  if (probe.error || probe.status !== 0) return "node is not on PATH";
  // Without Node on PATH, bun run injects its own node shim, which is Bun.
  if (probe.stdout.trim() !== "undefined") return "node on PATH is Bun, not Node";
  return null;
}
const noNode = missingNode();
const skip = noNode ?? false;

interface VersionEnvelope { ok: boolean; data: { version: string; bun: string | null; bunSource: string } }
interface FailureEnvelope { ok: boolean; error: { code: string }; meta: { music2: string | null } }

function launch(args: string[], env: Record<string, string | undefined> = {}, script = launcher) {
  const merged: Record<string, string | undefined> = { ...process.env, MUSIC2_BUN_PATH: undefined, MUSIC2_JSON: undefined, ...env };
  const clean = Object.fromEntries(Object.entries(merged).filter((entry): entry is [string, string] => entry[1] !== undefined));
  return spawnSync("node", [script, ...args], { cwd: root, encoding: "utf8", env: clean });
}

function tempDir(): string { return mkdtempSync(join(tmpdir(), "music2-launcher-")); }

test("real Node is available when the environment requires it", () => {
  if (process.env["MUSIC2_REQUIRE_NODE"] === "1") assert.equal(noNode, null, noNode ?? "");
});

test("Node launcher runs the CLI on the bundled Bun", { skip }, () => {
  const run = launch(["version", "--json"]);
  assert.equal(run.status, 0, run.stderr);
  const envelope = JSON.parse(run.stdout) as VersionEnvelope;
  assert.equal(envelope.data.bunSource, "bundled");
  assert.equal(envelope.data.bun, pinnedBunVersion());
});

test("MUSIC2_BUN_PATH overrides the bundled Bun, and an incomplete binary falls back", { skip }, () => {
  const override = JSON.parse(launch(["version", "--json"], { MUSIC2_BUN_PATH: process.execPath }).stdout) as VersionEnvelope;
  assert.equal(override.data.bunSource, "override");
  const dir = tempDir();
  try {
    const stub = join(dir, "bun");
    writeFileSync(stub, "not bun\n");
    assert.equal(isRealBunBinary(stub), false);
    const run = launch(["version", "--json"], { MUSIC2_BUN_PATH: stub });
    assert.equal(run.status, 0, run.stderr);
    assert.match(run.stderr, /MUSIC2_BUN_PATH is not a complete Bun binary/);
    assert.equal((JSON.parse(run.stdout) as VersionEnvelope).data.bunSource, "bundled");
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("launcher without the bun dependency fails with one capability envelope", { skip }, () => {
  const dir = tempDir();
  try {
    mkdirSync(join(dir, "bin"));
    for (const name of ["music2.js", "bun-binary.mjs"]) copyFileSync(join(root, "bin", name), join(dir, "bin", name));
    const copy = join(dir, "bin", "music2.js");
    assert.ok("error" in resolveBun({ env: {}, from: pathToFileURL(join(dir, "bin", "bun-binary.mjs")).href }));
    for (const [args, env] of [[["render", "x.song.json", "--json"], {}], [["render", "x.song.json"], { MUSIC2_JSON: "1" }]] as const) {
      const run = launch([...args], env, copy);
      assert.equal(run.status, 3, run.stderr);
      const lines = run.stdout.trim().split("\n");
      assert.equal(lines.length, 1);
      const envelope = JSON.parse(lines[0]!) as FailureEnvelope;
      assert.equal(envelope.ok, false);
      assert.equal(envelope.error.code, "E_CAPABILITY");
      assert.equal(envelope.meta.music2, null);
    }
    const text = launch(["render", "x.song.json"], {}, copy);
    assert.equal(text.status, 3);
    assert.match(text.stderr, /^music2: music2 needs Bun/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("launcher forwards the CLI exit code and keeps one JSON object on stdout", { skip }, () => {
  const run = launch(["render", join(root, "no-such-song.json"), "--json"]);
  assert.equal(run.status, 2);
  const lines = run.stdout.trim().split("\n");
  assert.equal(lines.length, 1);
  assert.equal((JSON.parse(lines[0]!) as FailureEnvelope).error.code, "E_NOT_FOUND");
});
