import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { audit } from "./structure-audit.mjs";

function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), "music2-structure-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  for (const dir of ["src/shared", "devlog/_plan", "devlog/_fin", "devlog/str_func"]) {
    mkdirSync(join(root, dir), { recursive: true });
  }
  for (const file of ["AGENTS.md", "devlog/str_func/AGENTS.md", "devlog/str_func/shared.md",
    "src/shared/index.ts", "src/shared/example.tool.ts", "src/shared/example.test.ts"]) {
    writeFileSync(join(root, file), "export {};\n");
  }
  return root;
}

test("clean feature tree passes", (t) => {
  assert.deepEqual(audit(fixture(t)), []);
});

test("missing colocated test names the rule", (t) => {
  const root = fixture(t);
  rmSync(join(root, "src/shared/example.test.ts"));
  assert.ok(audit(root).some((failure) => failure.startsWith("colocated-test:")));
});

test("missing feature index names the rule", (t) => {
  const root = fixture(t);
  rmSync(join(root, "src/shared/index.ts"));
  assert.ok(audit(root).some((failure) => failure.startsWith("feature-index:")));
});

test("501-line source names the rule", (t) => {
  const root = fixture(t);
  writeFileSync(join(root, "src/shared/long.ts"), "x\n".repeat(501));
  assert.ok(audit(root).some((failure) => failure.startsWith("src-file-lines:")));
});

test("missing str_func document names the rule", (t) => {
  const root = fixture(t);
  rmSync(join(root, "devlog/str_func/shared.md"));
  assert.ok(audit(root).some((failure) => failure.startsWith("str-func:")));
});
