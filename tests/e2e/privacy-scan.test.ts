import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import type { TestContext } from "node:test";

const script = resolve(import.meta.dirname, "../../scripts/privacy-scan.mjs");

function fixture(t: TestContext): string {
  const dir = mkdtempSync(join(tmpdir(), "music2-privacy-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  return dir;
}

function scan(dir: string, ...args: string[]) {
  return spawnSync(process.execPath, [script, "--path", dir, ...args], { encoding: "utf8" });
}

test("ordinary text, placeholders and binary data pass", (t) => {
  const dir = fixture(t);
  writeFileSync(join(dir, "code.ts"), "const path = '/Users/<user>/work';\nconst other = '/home/runner/work';\n");
  writeFileSync(join(dir, ".env.example"), "MUSIC2_CRITIC_API_KEY=\n");
  writeFileSync(join(dir, "image.png"), Buffer.from([137, 80, 78, 71, 0, 255, 123]));
  const result = scan(dir);
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.match(result.stdout, /binary-skipped=1 findings=0/);
});

for (const [category, payload] of [
  ["github-token", `ghp_${"A".repeat(24)}`],
  ["api-key", `MUSIC2_CRITIC_API_KEY=${"z".repeat(24)}`],
  ["api-key", `API_KEY="${"abc.defghijk"}"`],
  ["api-key", `sk-${"q".repeat(24)}`],
  ["private-key", "-----BEGIN " + "PRIVATE KEY-----"],
  ["personal-path", "/Users/" + "alice/private/"],
  ["personal-path", "C:\\Users\\" + "alice\\private\\"],
] as const) {
  test(`${category} is reported without its value`, (t) => {
    const dir = fixture(t);
    writeFileSync(join(dir, "sample.txt"), payload);
    const result = scan(dir);
    assert.equal(result.status, 1, result.stdout + result.stderr);
    assert.match(result.stdout, new RegExp(`sample\\.txt:1: ${category}`));
    assert.ok(!result.stdout.includes(payload));
    assert.ok(!result.stderr.includes(payload));
  });
}

test("repeatable deny values are redacted", (t) => {
  const dir = fixture(t);
  writeFileSync(join(dir, "sample.txt"), "internal-customer-code\n");
  const result = scan(dir, "--deny", "unused-code", "--deny", "internal-customer-code");
  assert.equal(result.status, 1);
  assert.match(result.stdout, /denied-literal/);
  assert.ok(!result.stdout.includes("internal-customer-code"));
});

test("unknown option exits 2", (t) => {
  const result = scan(fixture(t), "--unknown");
  assert.equal(result.status, 2);
});
