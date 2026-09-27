import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const committed = join(root, "skills/music2/references/genres.md");
const ids = ["boom_bap", "drill_ny", "drill_uk", "house", "lofi_hiphop", "techno", "trap"];
const ruleCounts = new Map<string, number>(ids.map((id) => [id, id === "lofi_hiphop" || id === "techno" ? 6 : 7]));

function run(...args: string[]) {
  return spawnSync(process.execPath, ["scripts/gen-genre-docs.mjs", ...args], { cwd: root, encoding: "utf8" });
}

test("committed genre reference matches every recipe card", () => {
  const result = run("--check");
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, "");
  assert.equal(result.stderr, "");
});

test("check detects a changed temp copy without rewriting it", (t) => {
  const directory = mkdtempSync(join(tmpdir(), "music2-genres-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const out = join(directory, "genres.md");
  const altered = `${readFileSync(committed, "utf8")}altered\n`;
  writeFileSync(out, altered);
  const result = run("--out", out, "--check");
  assert.equal(result.status, 1);
  assert.equal(result.stdout, "");
  assert.equal(result.stderr, `${out}\n`);
  assert.equal(readFileSync(out, "utf8"), altered);
});

test("generation is byte-stable and includes each documented rule once", (t) => {
  const directory = mkdtempSync(join(tmpdir(), "music2-genres-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const out = join(directory, "genres.md");
  const first = run("--out", out);
  assert.equal(first.status, 0, first.stderr);
  const bytes = readFileSync(out);
  const second = run("--out", out);
  assert.equal(second.status, 0, second.stderr);
  assert.deepEqual(readFileSync(out), bytes);
  assert.deepEqual(bytes, readFileSync(committed));

  const content = bytes.toString("utf8");
  assert.ok(content.endsWith("\n") && !content.endsWith("\n\n"));
  assert.equal(content.includes("\r"), false);
  const headings = [...content.matchAll(/^## ([a-z_]+) — /gm)].map((match) => match[1]);
  assert.deepEqual(headings, ids);
  const rules = [...content.matchAll(/^- `([a-z_]+\/\d+)`: /gm)].map((match) => match[1]);
  const expectedRules = [...ruleCounts].flatMap(([id, count]) => Array.from({ length: count }, (_, index) => `${id}/${index + 1}`));
  assert.deepEqual([...rules].sort(), expectedRules.sort());
});

test("unknown generator flag exits 2", () => {
  const result = run("--invalid");
  assert.equal(result.status, 2);
});
