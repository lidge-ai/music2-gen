#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { lstatSync, readFileSync, readdirSync, readlinkSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const MAX_TEXT_BYTES = 2_000_000;
const MAX_TOTAL_BYTES = 100_000_000;
const TOKEN_MIN_LENGTH = 20;
const EXIT_CLEAN = 0;
const EXIT_FINDING = 1;
const EXIT_SCAN_ERROR = 2;
const GENERIC_USERS = new Set(["<user>", "<name>", "user", "runner", "you", "me", "name", "example"]);
const UTF8_DECODER = new TextDecoder("utf-8", { fatal: true });

class ScanFailure extends Error {}

/** @typedef {{source:string,line:number,category:string}} PrivacyFinding */

function normalizePath(path) {
  return path.split(sep).join("/");
}

function isPlaceholder(value) {
  return /^(?:<[^>]+>|\$\{?\w+\}?|your[_-]?\w*|example[_-]?\w*|placeholder|changeme|dummy|test[_-]?\w*|secret-\d+)$/i.test(value);
}

/** @param {string} text @param {string} source @param {string[]} [denied] @returns {PrivacyFinding[]} */
export function scanText(text, source, denied = []) {
  /** @type {PrivacyFinding[]} */
  const findings = [];
  const lines = text.split(/\r?\n/);
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index];
    if (line === undefined) continue;
    if (source.endsWith("package-lock.json") && /^\s*"resolved"\s*:/.test(line)) continue;
    /** @type {Set<string>} */
    const categories = new Set();
    if (/\b(?:ghp_[A-Za-z0-9_]{20,}|github_pat_[A-Za-z0-9_]{20,})\b/.test(line)) {
      categories.add("github-token");
    }
    if (new RegExp(`\\bsk-[A-Za-z0-9_-]{${TOKEN_MIN_LENGTH},}\\b`).test(line)) {
      categories.add("api-key");
    }
    if (/-----BEGIN (?:[A-Z0-9 ]+ )?PRIVATE KEY-----/.test(line)) {
      categories.add("private-key");
    }
    const assignment = /["']?\b(?:[\w-]*(?:api[_-]?key|token|password|passwd|secret)[\w-]*)["']?\s*(?::|=)\s*(?:(["'`])([^"'`]+)\1|([A-Za-z0-9_+/=-]+))/gi;
    for (const match of line.matchAll(assignment)) {
      const value = match[2] ?? match[3];
      if (value && value.trim() === value && value.length >= 8 && !isPlaceholder(value)) {
        categories.add("api-key");
      }
    }
    const unixPaths = line.matchAll(/\/(?:Users|home)\/([A-Za-z0-9._-]+|<[^>]+>)\//g);
    for (const match of unixPaths) {
      const user = match[1];
      if (user && !GENERIC_USERS.has(user.toLowerCase())) categories.add("personal-path");
    }
    const windowsPaths = line.matchAll(/[A-Za-z]:\\Users\\([A-Za-z0-9._-]+|<[^>]+>)\\/gi);
    for (const match of windowsPaths) {
      const user = match[1];
      if (user && !GENERIC_USERS.has(user.toLowerCase())) categories.add("personal-path");
    }
    if (denied.some((literal) => line.includes(literal))) categories.add("denied-literal");
    for (const category of categories) findings.push({ source, line: index + 1, category });
  }
  return findings;
}

function git(root, args, maxBuffer = MAX_TOTAL_BYTES) {
  const result = spawnSync("git", args, { cwd: root, encoding: "buffer", maxBuffer });
  if (result.error || result.status !== 0) {
    throw new ScanFailure(`git ${args[0] ?? "command"} failed`);
  }
  return result.stdout;
}

function scanBuffer(buffer, source, denied, result) {
  if (buffer.length > MAX_TEXT_BYTES) throw new ScanFailure(`text size limit exceeded: ${source}`);
  result.bytes += buffer.length;
  if (result.bytes > MAX_TOTAL_BYTES) throw new ScanFailure("total scan size limit exceeded");
  if (buffer.includes(0)) {
    result.binarySkipped++;
    return;
  }
  let text;
  try {
    text = UTF8_DECODER.decode(buffer);
  } catch {
    result.binarySkipped++;
    return;
  }
  result.findings.push(...scanText(text, source, denied));
}

function scanFile(path, source, denied, result) {
  const stat = lstatSync(path);
  result.files++;
  if (stat.isSymbolicLink()) {
    scanBuffer(Buffer.from(readlinkSync(path)), source, denied, result);
  } else if (stat.isFile()) {
    if (stat.size > MAX_TEXT_BYTES) throw new ScanFailure(`text size limit exceeded: ${source}`);
    scanBuffer(readFileSync(path), source, denied, result);
  } else {
    throw new ScanFailure(`not a regular file: ${source}`);
  }
}

function scanDirectory(root, dir, denied, result) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) scanDirectory(root, path, denied, result);
    else scanFile(path, normalizePath(relative(root, path)), denied, result);
  }
}

function scanRepository(root, ref, denied, result) {
  const files = git(root, ["ls-files", "-z", "--cached", "--others", "--exclude-standard"])
    .toString("utf8").split("\0").filter(Boolean);
  const deleted = new Set(git(root, ["ls-files", "--deleted", "-z"])
    .toString("utf8").split("\0").filter(Boolean));
  for (const source of new Set(files)) {
    if (!deleted.has(source)) scanFile(join(root, source), normalizePath(source), denied, result);
  }

  const staged = git(root, ["diff", "--cached", "--name-only", "--diff-filter=ACMR", "-z"])
    .toString("utf8").split("\0").filter(Boolean);
  for (const source of staged) {
    const revision = `:${source}`;
    const size = Number(git(root, ["cat-file", "-s", revision], 1024).toString("utf8"));
    if (!Number.isSafeInteger(size) || size > MAX_TEXT_BYTES) throw new ScanFailure(`text size limit exceeded: index:${source}`);
    scanBuffer(git(root, ["cat-file", "blob", revision], MAX_TEXT_BYTES + 1024),
      `index:${normalizePath(source)}`, denied, result);
    result.indexed++;
  }

  const objects = git(root, ["rev-list", "--objects", ref]).toString("utf8").trim().split("\n");
  const seen = new Set();
  for (const row of objects) {
    if (!row) continue;
    const separator = row.indexOf(" ");
    const oid = separator < 0 ? row : row.slice(0, separator);
    if (seen.has(oid)) continue;
    seen.add(oid);
    const type = git(root, ["cat-file", "-t", oid], 1024).toString("utf8").trim();
    if (type !== "blob") continue;
    const source = separator < 0 ? `blob:${oid}` : normalizePath(row.slice(separator + 1));
    const size = Number(git(root, ["cat-file", "-s", oid], 1024).toString("utf8"));
    if (!Number.isSafeInteger(size) || size > MAX_TEXT_BYTES) throw new ScanFailure(`text size limit exceeded: ${source}`);
    scanBuffer(git(root, ["cat-file", "blob", oid], MAX_TEXT_BYTES + 1024), `history:${source}`, denied, result);
    result.blobs++;
  }

  const commits = git(root, ["rev-list", ref]).toString("utf8").trim().split("\n").filter(Boolean);
  for (const oid of commits) {
    scanBuffer(git(root, ["show", "-s", "--format=%B", oid], MAX_TEXT_BYTES + 1024), `commit:${oid}`, denied, result);
    result.commits++;
  }
}

/** @param {string[]} argv @returns {Promise<number>} */
export async function main(argv) {
  let fixturePath;
  let ref = "HEAD";
  /** @type {string[]} */
  const denied = [];
  for (let index = 0; index < argv.length; index++) {
    const option = argv[index];
    if (option === "--path" || option === "--ref" || option === "--deny") {
      const value = argv[++index];
      if (!value || value.startsWith("--")) {
        console.error(`missing value for ${option}`);
        return EXIT_SCAN_ERROR;
      }
      if (option === "--path") fixturePath = value;
      else if (option === "--ref") ref = value;
      else denied.push(value);
    } else {
      console.error(`unknown option: ${option}`);
      return EXIT_SCAN_ERROR;
    }
  }
  if (fixturePath && ref !== "HEAD") {
    console.error("--path and --ref cannot be combined");
    return EXIT_SCAN_ERROR;
  }
  if (ref.startsWith("-")) {
    console.error("invalid ref");
    return EXIT_SCAN_ERROR;
  }
  const result = { bytes: 0, files: 0, indexed: 0, blobs: 0, commits: 0, binarySkipped: 0, findings: [] };
  try {
    if (fixturePath) {
      const root = resolve(fixturePath);
      if (!lstatSync(root).isDirectory()) throw new ScanFailure("fixture path is not a directory");
      scanDirectory(root, root, denied, result);
    } else {
      const root = git(import.meta.dirname, ["rev-parse", "--show-toplevel"], 4096).toString("utf8").trim();
      scanRepository(root, ref, denied, result);
    }
  } catch (error) {
    console.error(`privacy scan failed: ${error instanceof ScanFailure ? error.message : "unreadable input"}`);
    return EXIT_SCAN_ERROR;
  }
  const findings = [...new Map(result.findings.map((finding) =>
    [`${finding.source}\0${finding.line}\0${finding.category}`, finding])).values()]
    .sort((a, b) => {
      const left = `${a.source}\0${a.line}\0${a.category}`;
      const right = `${b.source}\0${b.line}\0${b.category}`;
      return left < right ? -1 : left > right ? 1 : 0;
    });
  for (const finding of findings) console.log(`${finding.source}:${finding.line}: ${finding.category}`);
  console.log(`privacy scan: files=${result.files} indexed=${result.indexed} blobs=${result.blobs} commits=${result.commits} binary-skipped=${result.binarySkipped} findings=${findings.length}`);
  return findings.length ? EXIT_FINDING : EXIT_CLEAN;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = await main(process.argv.slice(2));
}
