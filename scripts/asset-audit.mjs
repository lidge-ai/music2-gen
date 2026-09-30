#!/usr/bin/env bun
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { open, readFile, realpath } from "node:fs/promises";
import { delimiter, isAbsolute, join, resolve } from "node:path";
import { promisify } from "node:util";

const exec = promisify(execFile);
const AUDIO_EXTENSION = /\.(wav|aif|aiff|aifc|caf|flac|mp3|ogg|m4a)$/i;
const cwd = process.cwd();
const MAX_OUTPUT = 256 * 1024 * 1024;

function audioHeader(bytes) {
  const magic = bytes.toString("ascii", 0, 4);
  if (bytes.length >= 12 && magic === "RIFF" && bytes.toString("ascii", 8, 12) === "WAVE") return true;
  if (bytes.length >= 12 && magic === "FORM" && /^(AIFF|AIFC)$/.test(bytes.toString("ascii", 8, 12))) return true;
  return ["caff", "fLaC", "OggS"].includes(magic) || bytes.toString("ascii", 0, 3) === "ID3";
}
async function git(args, binary = false) {
  const { stdout } = await exec("git", args, { cwd, encoding: binary ? "buffer" : "utf8", maxBuffer: MAX_OUTPUT });
  return stdout;
}
function parseArgs(args) {
  const options = { tree: false, pack: false, range: undefined, allowlist: join(import.meta.dirname, "asset-allowlist.json") };
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--tree") options.tree = true;
    else if (arg === "--pack") options.pack = true;
    else if (arg === "--range" || arg === "--allowlist") {
      const value = args[++i];
      if (!value || value.startsWith("--")) throw new Error(`${arg} requires a value`);
      options[arg.slice(2)] = value;
    } else throw new Error(`unknown option: ${arg}`);
  }
  if (!options.tree && !options.pack && !options.range) options.tree = true;
  return options;
}
async function allowlist(path) {
  const data = JSON.parse(await readFile(resolve(cwd, path), "utf8"));
  if (data.version !== 1 || !Array.isArray(data.assets)) throw new Error("allowlist requires version:1 and assets:[{path,sha256}]");
  const approved = new Map();
  for (const item of data.assets) {
    if (typeof item.path !== "string" || isAbsolute(item.path) || item.path.split("/").includes("..") ||
        typeof item.sha256 !== "string" || !/^[a-f0-9]{64}$/.test(item.sha256) || approved.has(item.path))
      throw new Error("invalid or duplicate allowlist entry");
    approved.set(item.path, item.sha256);
  }
  return approved;
}
async function npmFiles() {
  // Run npm's JS entry point on Windows: execFile cannot execute npm.cmd without a shell.
  let program = "npm", prefix = [];
  if (process.platform === "win32") {
    const candidates = [process.env.npm_execpath,
      ...(process.env.PATH ?? "").split(delimiter).map((dir) => join(dir, "node_modules/npm/bin/npm-cli.js"))];
    let cli;
    for (const candidate of candidates) if (candidate?.endsWith(".js")) {
      try { cli = await realpath(candidate); break; } catch { /* try the next PATH entry */ }
    }
    if (!cli) throw new Error("cannot locate npm-cli.js for package audit");
    program = process.execPath; prefix = [cli];
  }
  const { stdout } = await exec(program, [...prefix, "pack", "--dry-run", "--json", "--ignore-scripts"],
    { cwd, encoding: "utf8", maxBuffer: MAX_OUTPUT });
  const packs = JSON.parse(stdout);
  if (!Array.isArray(packs) || !packs.length || !packs.every((pack) => Array.isArray(pack.files)))
    throw new Error("invalid npm pack file list");
  return packs.flatMap((pack) => pack.files.map((file) => file.path));
}
async function fileAudio(path) {
  const handle = await open(resolve(cwd, path), "r");
  try {
    const header = Buffer.alloc(12);
    const { bytesRead } = await handle.read(header, 0, 12, 0);
    return AUDIO_EXTENSION.test(path) || audioHeader(header.subarray(0, bytesRead));
  } finally { await handle.close(); }
}
async function fileHash(path) {
  const digest = createHash("sha256");
  for await (const chunk of createReadStream(resolve(cwd, path))) digest.update(chunk);
  return digest.digest("hex");
}
function check(path, hash, approved, findings, location) {
  if (approved.get(path) !== hash) findings.push(`${location}: ${JSON.stringify(path)}: ${approved.has(path) ? "hash mismatch" : "unapproved audio"}`);
}
async function auditFiles(paths, approved, findings, location) {
  let audio = 0;
  for (const path of [...new Set(paths)].sort()) {
    // No minimum-size shortcut: even a 12-byte renamed audio header is evidence.
    if (await fileAudio(path)) { audio++; check(path, await fileHash(path), approved, findings, location); }
  }
  return audio;
}
function diffBlobs(output) {
  const tokens = output.split("\0"), blobs = [];
  for (let i = 0; i < tokens.length && tokens[i];) {
    const header = tokens[i++];
    const match = /^:\d+ \d+ [a-f0-9]+ ([a-f0-9]+) ([AMR])\d*$/.exec(header);
    if (!match) throw new Error("unexpected git diff-tree record");
    let path = tokens[i++];
    if (match[2] === "R") path = tokens[i++];
    blobs.push({ path, oid: match[1] });
  }
  return blobs;
}
function treeBlobs(output) {
  return output.split("\0").filter(Boolean).flatMap((record) => {
    const tab = record.indexOf("\t");
    const [mode, type, oid] = record.slice(0, tab).split(" ");
    return type === "blob" && mode ? [{ path: record.slice(tab + 1), oid }] : [];
  });
}
async function rangeAudio(range, approved, findings) {
  const refs = range.split("..");
  if (refs.length !== 2 || refs.some((ref) => !ref || ref.startsWith("."))) throw new Error("--range requires base..head");
  const base = (await git(["rev-parse", "--verify", "--end-of-options", `${refs[0]}^{commit}`])).trim();
  const head = (await git(["rev-parse", "--verify", "--end-of-options", `${refs[1]}^{commit}`])).trim();
  const lines = (await git(["rev-list", "--parents", `${base}..${head}`])).trim().split("\n").filter(Boolean);
  const seen = new Set();
  let audio = 0;
  for (const line of lines) {
    const [commit, ...parents] = line.split(" ");
    const groups = parents.length ? await Promise.all(parents.map(async (parent) => diffBlobs(await git([
      "diff-tree", "-r", "--no-commit-id", "--diff-filter=AMR", "--raw", "-z", "--no-abbrev", parent, commit,
    ])))) : [treeBlobs(await git(["ls-tree", "-r", "-z", commit]))];
    for (const blob of groups.flat()) {
      const key = `${blob.path}\0${blob.oid}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const bytes = await git(["cat-file", "blob", blob.oid], true);
      if (!AUDIO_EXTENSION.test(blob.path) && !audioHeader(bytes.subarray(0, 12))) continue;
      audio++;
      check(blob.path, createHash("sha256").update(bytes).digest("hex"), approved, findings, `range ${commit}`);
    }
  }
  return audio;
}
async function main() {
  const options = parseArgs(process.argv.slice(2));
  const approved = await allowlist(options.allowlist), findings = [], counts = [];
  if (options.tree) counts.push(`tree-audio=${await auditFiles((await git(["ls-files", "-z"])).split("\0").filter(Boolean), approved, findings, "tree")}`);
  if (options.pack) counts.push(`pack-audio=${await auditFiles(await npmFiles(), approved, findings, "pack")}`);
  if (options.range) counts.push(`range-audio=${await rangeAudio(options.range, approved, findings)}`);
  for (const finding of findings) console.error(finding);
  console.log(`asset-audit: ${counts.join(" ")} findings=${findings.length}`);
  process.exitCode = findings.length ? 1 : 0;
}
try { await main(); }
catch (error) { console.error(`asset-audit: ${error instanceof Error ? error.message : String(error)}`); process.exitCode = 2; }
