import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, readlinkSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative, resolve, sep } from "node:path";
import { pinnedBunVersion } from "../src/shared/index.ts";

function fail(message) { throw new Error(message); }
function run(command, args, cwd, options = {}) {
  const result = spawnSync(command, args, { cwd, encoding: "utf8", maxBuffer: 64 * 1024 * 1024, ...options });
  if (result.error) throw result.error;
  return result;
}
function git(repository, args) {
  const result = run("git", ["-C", repository, ...args], repository);
  if (result.status !== 0) fail(`git ${args[0]} failed: ${result.stderr}`);
  return result.stdout;
}
function sha(bytes) { return createHash("sha256").update(bytes).digest("hex"); }
function fileSha(path) { return sha(readFileSync(path)); }
function sortedFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    return entry.isDirectory() ? sortedFiles(path) : [path];
  }).sort();
}
function options() {
  const values = {};
  for (let i = 2; i < process.argv.length; i += 2) {
    const flag = process.argv[i];
    const value = process.argv[i + 1];
    if (!flag?.startsWith("--") || !value || !["source", "out", "repository", "ref"].includes(flag.slice(2))) {
      fail("usage: bun scripts/record-daw-legacy.mjs --source <pristine checkout/archive> --out <manifest> [--repository <git repo> --ref <commit>]");
    }
    values[flag.slice(2)] = value;
  }
  if (!values.source || !values.out) fail("--source and --out are required");
  return values;
}
function verifySource(source, repository, ref) {
  const sourceSha = git(repository, ["rev-parse", "--verify", `${ref}^{commit}`]).trim();
  if (existsSync(join(source, ".git"))) {
    if (git(source, ["rev-parse", "HEAD"]).trim() !== sourceSha) fail("source HEAD differs from requested ref");
    if (git(source, ["status", "--porcelain", "--untracked-files=all"]).trim()) fail("source checkout is dirty");
    return sourceSha;
  }
  if (source === repository) fail("source checkout has no .git metadata");
  const tree = git(repository, ["ls-tree", "-rz", sourceSha]).split("\0").filter(Boolean);
  const expected = new Set();
  for (const entry of tree) {
    const match = /^(100644|100755|120000) blob ([a-f0-9]{40})\t(.+)$/.exec(entry);
    if (!match) fail(`unsupported tree entry: ${entry}`);
    const [, mode, blob, name] = match;
    const path = join(source, name);
    if (!existsSync(path)) fail(`archive missing ${name}`);
    const actual = mode === "120000" ? Buffer.from(readlinkSync(path)) : readFileSync(path);
    const object = createHash("sha1").update(`blob ${actual.length}\0`).update(actual).digest("hex");
    if (object !== blob) fail(`archive differs from ${sourceSha}: ${name}`);
    expected.add(name);
  }
  for (const path of sortedFiles(source)) {
    const name = relative(source, path).split(sep).join("/");
    if (name === "node_modules" || name.startsWith("node_modules/")) continue;
    if (!expected.has(name)) fail(`archive has untracked file: ${name}`);
  }
  return sourceSha;
}
function canonicalJson(stdout, command, status) {
  if (stdout.trim().split("\n").length !== 1) fail(`${command} did not print one JSON envelope`);
  let body;
  try { body = JSON.parse(stdout); } catch { fail(`${command} did not print JSON`); }
  if (!body || typeof body !== "object" || typeof body.meta?.music2 !== "string") fail(`${command} has no meta.music2 string`);
  if (body.ok !== (status === 0) || body.command !== command) fail(`${command} envelope/status mismatch`);
  if (status === 6 && (command !== "lint" || body.error?.code !== "E_QA")) fail(`${command} unexpected QA exit`);
  delete body.meta.music2;
  return { exit: status, sha256: sha(JSON.stringify(body) + "\n") };
}
function cli(source, command, args, allowed = [0]) {
  const result = run(process.execPath, ["src/cli/index.ts", command, ...args, "--json"], source,
    { env: { ...process.env, MUSIC2_JSON: "0" } });
  if (!allowed.includes(result.status) || result.signal || result.stderr) {
    fail(`${command} ${args[0]} failed: exit=${result.status} signal=${result.signal} ${result.stderr} ${result.stdout}`);
  }
  return result;
}
function record(source, song, directory) {
  const master = join(directory, "master.wav");
  cli(source, "render", [song, "-o", master]);
  if (!existsSync(master)) fail(`missing render: ${song}`);
  const render = fileSha(master);
  const stemsDir = join(directory, "stems");
  cli(source, "render", [song, "-o", join(directory, "stems-master.wav"), "--stems", stemsDir]);
  const names = readdirSync(stemsDir).sort();
  const tracks = JSON.parse(readFileSync(join(source, song), "utf8")).tracks;
  const expected = tracks.map((track) => `${track.id}.wav`).sort();
  if (JSON.stringify(names) !== JSON.stringify(expected)) fail(`incomplete stems: ${song}`);
  const stems = Object.fromEntries(names.map((name) => [name, fileSha(join(stemsDir, name))]));
  const json = Object.fromEntries(["validate", "events", "lint"].map((command) => {
    const result = cli(source, command, [song], command === "lint" ? [0, 6] : [0]);
    return [command, canonicalJson(result.stdout, command, result.status)];
  }));
  return { render, stems, ...json };
}

const args = options();
const source = resolve(args.source);
const output = resolve(args.out);
const repository = resolve(args.repository ?? source);
if (process.platform !== "darwin" && process.platform !== "linux") fail(`unsupported platform: ${process.platform}`);
const pinnedBun = pinnedBunVersion();
const runtime = `bun@${pinnedBun}`;
if (process.versions.bun !== pinnedBun) fail(`Bun ${pinnedBun} required; found ${process.versions.bun ?? process.version}`);
const sourceSha = verifySource(source, repository, args.ref ?? "HEAD");
if (existsSync(output)) {
  const previous = JSON.parse(readFileSync(output, "utf8"));
  if (previous.sourceSha !== sourceSha || previous.runtime !== runtime || previous.platform !== process.platform) {
    fail("existing manifest provenance differs");
  }
}
const examples = sortedFiles(join(source, "examples"))
  .filter((path) => path.endsWith(".song.json"))
  .map((path) => relative(source, path).split(sep).join("/"));
if (examples.length === 0) fail("no source examples found");
const temporary = mkdtempSync(join(tmpdir(), "music2-daw-legacy-"));
try {
  const results = {};
  for (const [index, song] of examples.entries()) {
    const directory = join(temporary, String(index));
    // Each command writes only under its own temporary directory.
    mkdirSync(directory);
    results[song] = record(source, song, directory);
    process.stderr.write(`recorded ${index + 1}/${examples.length} ${song}\n`);
  }
  writeFileSync(output, JSON.stringify({ sourceSha, runtime, platform: process.platform, examples: results }, null, 2) + "\n");
} finally {
  rmSync(temporary, { recursive: true, force: true });
}
