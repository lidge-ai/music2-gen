import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import type { TestContext } from "node:test";

const script = resolve(import.meta.dirname, "../../scripts/asset-audit.mjs");
const wavHeader = Buffer.from("RIFF\x04\0\0\0WAVE", "binary");
function git(dir: string, ...args: string[]): string {
  return execFileSync("git", ["-c", "user.name=Asset Test", "-c", "user.email=asset-test@example.invalid",
    "-c", "commit.gpgsign=false", ...args], { cwd: dir, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] }).trim();
}
function fixture(t: TestContext): string {
  const dir = mkdtempSync(join(tmpdir(), "music2-asset-audit-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  git(dir, "init");
  writeFileSync(join(dir, "allowlist.json"), JSON.stringify({ version: 1, assets: [] }));
  writeFileSync(join(dir, "README.md"), "synthetic audit fixture\n");
  git(dir, "add", "README.md");
  git(dir, "commit", "-m", "fixture root");
  return dir;
}
function audit(dir: string, ...args: string[]) {
  return spawnSync(process.execPath, [script, "--allowlist", join(dir, "allowlist.json"), ...args],
    { cwd: dir, encoding: "utf8", env: { ...process.env, MUSIC2_HOME: join(dir, "home") }, timeout: 30_000 });
}
function approve(dir: string, path: string): void {
  const sha256 = createHash("sha256").update(readFileSync(join(dir, path))).digest("hex");
  writeFileSync(join(dir, "allowlist.json"), JSON.stringify({ version: 1, assets: [{ path, sha256 }] }));
}
function checkPass(result: ReturnType<typeof audit>): void {
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.match(result.stdout, /findings=0/);
}

test("clean tracked tree passes; no arguments defaults to tree", (t) => {
  const dir = fixture(t);
  writeFileSync(join(dir, "art.png"), Buffer.from([137, 80, 78, 71]));
  git(dir, "add", "art.png");
  checkPass(audit(dir));
});

test("unapproved WAV fails even when empty; path and exact hash are both required", (t) => {
  const dir = fixture(t);
  writeFileSync(join(dir, "tone.wav"), Buffer.alloc(0));
  git(dir, "add", "tone.wav");
  const unapproved = audit(dir, "--tree");
  assert.equal(unapproved.status, 1);
  assert.match(unapproved.stderr, /tone\.wav.*unapproved audio/);
  approve(dir, "tone.wav");
  checkPass(audit(dir, "--tree"));
  writeFileSync(join(dir, "tone.wav"), wavHeader);
  const changed = audit(dir, "--tree");
  assert.equal(changed.status, 1);
  assert.match(changed.stderr, /hash mismatch/);
});

test("renaming approved WAV without an extension is caught by its 12-byte magic", (t) => {
  const dir = fixture(t);
  writeFileSync(join(dir, "tone.wav"), wavHeader);
  git(dir, "add", "tone.wav"); git(dir, "commit", "-m", "approved synthetic wav");
  approve(dir, "tone.wav");
  git(dir, "mv", "tone.wav", "disguised");
  const result = audit(dir, "--tree");
  assert.equal(result.status, 1);
  assert.match(result.stderr, /disguised.*unapproved audio/);
});

for (const [name, bytes] of [
  ["aiff", Buffer.from("FORM\0\0\0\x04AIFF", "binary")],
  ["aifc", Buffer.from("FORM\0\0\0\x04AIFC", "binary")],
  ["caf", Buffer.from("caff")], ["flac", Buffer.from("fLaC")],
  ["ogg", Buffer.from("OggS")], ["mp3", Buffer.from("ID3")],
] as const) test(`tiny extensionless ${name} magic fails`, (t) => {
  const dir = fixture(t);
  writeFileSync(join(dir, "payload"), bytes); git(dir, "add", "payload");
  assert.equal(audit(dir, "--tree").status, 1);
});

test("range audits all merge parents and catches a merge-only asset deleted later", (t) => {
  const dir = fixture(t), base = git(dir, "rev-parse", "HEAD");
  writeFileSync(join(dir, "README.md"), "left\n"); git(dir, "add", "README.md");
  const left = git(dir, "commit-tree", git(dir, "write-tree"), "-p", base, "-m", "left");
  writeFileSync(join(dir, "README.md"), "right\n"); git(dir, "add", "README.md");
  const right = git(dir, "commit-tree", git(dir, "write-tree"), "-p", base, "-m", "right");
  writeFileSync(join(dir, "merge-only.wav"), wavHeader); git(dir, "add", "merge-only.wav");
  const merge = git(dir, "commit-tree", git(dir, "write-tree"), "-p", left, "-p", right, "-m", "resolution");
  git(dir, "rm", "-f", "merge-only.wav");
  const final = git(dir, "commit-tree", git(dir, "write-tree"), "-p", merge, "-m", "remove asset");
  checkPass(audit(dir, "--tree"));
  const result = audit(dir, "--range", `${base}..${final}`);
  assert.equal(result.status, 1, result.stdout + result.stderr);
  assert.match(result.stderr, new RegExp(`range ${merge}:.*merge-only\\.wav.*unapproved audio`));
});

test("an asset inherited from only one merge parent is audited against the other", (t) => {
  const dir = fixture(t), base = git(dir, "rev-parse", "HEAD");
  writeFileSync(join(dir, "inherited.wav"), wavHeader); git(dir, "add", "inherited.wav");
  const left = git(dir, "commit-tree", git(dir, "write-tree"), "-p", base, "-m", "asset branch");
  const merge = git(dir, "commit-tree", git(dir, "write-tree"), "-p", left, "-p", base, "-m", "inherit asset");
  const result = audit(dir, "--range", `${left}..${merge}`);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /inherited\.wav.*unapproved audio/);
});

test("range includes root-commit blobs and checks approved historical hashes", (t) => {
  const dir = fixture(t), base = git(dir, "rev-parse", "HEAD");
  writeFileSync(join(dir, "root.wav"), wavHeader); git(dir, "add", "root.wav");
  const root = git(dir, "commit-tree", git(dir, "write-tree"), "-m", "independent root");
  assert.equal(audit(dir, "--range", `${base}..${root}`).status, 1);
  approve(dir, "root.wav"); checkPass(audit(dir, "--range", `${base}..${root}`));
  writeFileSync(join(dir, "root.wav"), Buffer.from("different")); approve(dir, "root.wav");
  const result = audit(dir, "--range", `${base}..${root}`);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /hash mismatch/);
});

test("pack audits a temporary package including untracked content without invoking prepack", (t) => {
  const dir = fixture(t);
  mkdirSync(join(dir, "media"));
  writeFileSync(join(dir, "package.json"), JSON.stringify({ name: "synthetic-asset-fixture", version: "1.0.0",
    files: ["media"], scripts: { prepack: "this-command-must-never-run" } }));
  writeFileSync(join(dir, "media", "readme.txt"), "ordinary package content");
  checkPass(audit(dir, "--pack"));
  writeFileSync(join(dir, "media", "renamed"), wavHeader);
  const rejected = audit(dir, "--pack");
  assert.equal(rejected.status, 1, rejected.stdout + rejected.stderr);
  assert.match(rejected.stderr, /pack:.*media\/renamed.*unapproved audio/);
  approve(dir, "media/renamed"); checkPass(audit(dir, "--tree", "--pack"));
});

test("invalid flags, range and allowlist fail closed with exit 2", (t) => {
  const dir = fixture(t);
  for (const args of [["--unknown"], ["--range"], ["--range", "HEAD...HEAD"], ["--range", "missing..HEAD"]])
    assert.equal(audit(dir, ...args).status, 2, args.join(" "));
  writeFileSync(join(dir, "allowlist.json"), JSON.stringify({ version: 1, assets: [{ path: "x", sha256: "bad" }] }));
  assert.equal(audit(dir).status, 2);
});
