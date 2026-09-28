import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../../", import.meta.url));
const fixtureDir = join(root, "tests/fixtures/daw-legacy");
// The baseline is captured per platform/Node major from the pre-wp2 source. The darwin manifest is the structural
// reference; replay uses the manifest for the running platform, and a platform without one is skipped with a reason.
const fixture = JSON.parse(readFileSync(join(fixtureDir, "darwin-node24.json"), "utf8")) as Manifest;
const nodeMajor = Number(process.versions.node.split(".")[0]);
const hostFixturePath = join(fixtureDir, `${process.platform}-node${nodeMajor}.json`);
const hostFixture = existsSync(hostFixturePath) ? JSON.parse(readFileSync(hostFixturePath, "utf8")) as Manifest : null;

interface JsonDigest { exit: number; sha256: string }
interface ExampleDigest {
  render: string;
  stems: Record<string, string>;
  validate: JsonDigest;
  events: JsonDigest;
  lint: JsonDigest;
}
interface Manifest {
  sourceSha: string;
  nodeMajor: number;
  platform: string;
  examples: Record<string, ExampleDigest>;
}

const sha = (bytes: string | Buffer): string => createHash("sha256").update(bytes).digest("hex");
const fileSha = (path: string): string => sha(readFileSync(path));
const hexDigest = /^[a-f0-9]{64}$/;

function command(name: string, args: string[], expectedExit = 0): string {
  const result = spawnSync(process.execPath, ["src/cli/index.ts", name, ...args, "--json"], {
    cwd: root, encoding: "utf8", maxBuffer: 64 * 1024 * 1024,
    env: { ...process.env, MUSIC2_JSON: "0" },
  });
  assert.ifError(result.error);
  assert.equal(result.signal, null, `${name} terminated by ${result.signal}`);
  assert.equal(result.status, expectedExit, `${name} ${args[0]}: ${result.stderr}\n${result.stdout}`);
  assert.equal(result.stderr, "", `${name} ${args[0]} stderr`);
  return result.stdout;
}

function jsonDigest(name: "validate" | "events" | "lint", song: string, expected: JsonDigest): void {
  const stdout = command(name, [song], expected.exit);
  assert.equal(stdout.trim().split("\n").length, 1, `${name} must print exactly one envelope`);
  const envelope = JSON.parse(stdout) as {
    ok: boolean;
    command: string;
    meta: { music2?: string };
    error?: { code: string };
  };
  assert.equal(typeof envelope.meta?.music2, "string", `${name} meta.music2 shape`);
  assert.equal(envelope.command, name);
  assert.equal(envelope.ok, expected.exit === 0);
  if (expected.exit === 6) assert.equal(envelope.error?.code, "E_QA");
  delete envelope.meta.music2;
  assert.equal(sha(JSON.stringify(envelope) + "\n"), expected.sha256, `${song} ${name} JSON changed`);
}

function compareOldSubtree(oldNode: unknown, newNode: unknown, path: string, required: readonly string[] = []): void {
  if (Array.isArray(oldNode)) {
    assert.deepEqual(newNode, oldNode, `${path} array changed`);
    return;
  }
  if (oldNode === null || typeof oldNode !== "object") {
    assert.deepEqual(newNode, oldNode, `${path} changed`);
    return;
  }
  assert.ok(newNode !== null && typeof newNode === "object" && !Array.isArray(newNode), `${path} changed type`);
  const before = oldNode as Record<string, unknown>;
  const after = newNode as Record<string, unknown>;
  const originalKeys = Object.keys(before).sort();
  const currentKeys = Object.keys(after).sort();
  if (path.endsWith("/properties")) {
    for (const key of currentKeys.filter((key) => !originalKeys.includes(key))) {
      assert.ok(!required.includes(key), `${path}/${key} became required`);
    }
  } else {
    assert.deepEqual(currentKeys, originalKeys, `${path} changed keys outside optional properties`);
  }
  for (const key of originalKeys) {
    assert.ok(Object.hasOwn(after, key), `${path}/${key} removed`);
    const ownerRequired = key === "properties" && Array.isArray(before.required)
      ? before.required as string[] : [];
    compareOldSubtree(before[key], after[key], `${path}/${key}`, ownerRequired);
  }
}

test("pre-DAW schema is an exact subtree of the current Song v1 schema", () => {
  const before = JSON.parse(readFileSync(join(fixtureDir, "song.v1.pre.json"), "utf8")) as unknown;
  const current = JSON.parse(readFileSync(join(root, "schema/song.v1.json"), "utf8")) as unknown;
  compareOldSubtree(before, current, "$");
});

test("baseline manifest has complete, pinned example categories", () => {
  assert.match(fixture.sourceSha, /^[a-f0-9]{40}$/);
  assert.equal(fixture.nodeMajor, 24);
  assert.equal(fixture.platform, "darwin");
  const songs = Object.keys(fixture.examples);
  assert.ok(songs.length > 0);
  assert.deepEqual(songs, [...songs].sort(), "manifest keys must be sorted");
  for (const song of songs) {
    assert.match(song, /^examples\/(?:[^/]+\/)*[^/]+\.song\.json$/);
    assert.ok(existsSync(join(root, song)), `baseline example removed: ${song}`);
    const digest = fixture.examples[song]!;
    assert.match(digest.render, hexDigest);
    const raw = JSON.parse(readFileSync(join(root, song), "utf8")) as { tracks: { id: string }[] };
    assert.deepEqual(Object.keys(digest.stems), raw.tracks.map((track) => `${track.id}.wav`).sort(), `${song} stem coverage`);
    for (const value of Object.values(digest.stems)) assert.match(value, hexDigest);
    for (const name of ["validate", "events", "lint"] as const) {
      assert.ok(name === "lint" ? [0, 6].includes(digest[name].exit) : digest[name].exit === 0);
      assert.match(digest[name].sha256, hexDigest);
    }
  }
});

const replay = hostFixture ?? fixture;
const matchingPlatform = hostFixture !== null && process.platform === hostFixture.platform && nodeMajor === hostFixture.nodeMajor;
// cinematic-cue and pop-transition moved from synthesized strings/brass to bundled samples; their entries
// were recaptured on darwin/Node 24 with the same procedure as this replay. minimal's lint digest was recaptured
// after clipping_risk calibration (threshold 2, weighted chords and attacks; its 1.6 warning is gone), and
// cinematic-cue's master and fx stem after revcymbal gained its 5 ms end taper. All other
// entries are pre-wp2 bytes.
for (const [song, expected] of Object.entries(replay.examples)) {
  test(`legacy bytes and JSON: ${song}`, {
    skip: !matchingPlatform && `no legacy baseline captured for ${process.platform}/Node ${nodeMajor}; D10 unverified on this host`,
  }, () => {
    const directory = mkdtempSync(join(tmpdir(), "music2-daw-replay-"));
    try {
      const master = join(directory, "master.wav");
      command("render", [song, "-o", master]);
      assert.equal(fileSha(master), expected.render, `${song} master WAV changed`);
      const stemsDir = join(directory, "stems");
      command("render", [song, "-o", join(directory, "stems-master.wav"), "--stems", stemsDir]);
      assert.deepEqual(readdirSync(stemsDir).sort(), Object.keys(expected.stems), `${song} stem set changed`);
      for (const [name, digest] of Object.entries(expected.stems)) {
        assert.equal(fileSha(join(stemsDir, name)), digest, `${song} ${name} changed`);
      }
      for (const name of ["validate", "events", "lint"] as const) jsonDigest(name, song, expected[name]);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
}
