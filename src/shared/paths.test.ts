import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { mkdtemp, mkdir, realpath, symlink, writeFile, rm } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { music2Home, packageRoot, packageVersion, storageDir, confinedRealpath } from "./paths.tool.ts";

test("package root and version", () => {
  const pj = JSON.parse(readFileSync(join(packageRoot(), "package.json"), "utf8")) as { version: string; name: string };
  assert.equal(pj.name, "music2-gen");
  assert.equal(packageVersion(), pj.version);
});

test("confinedRealpath rejects lexical and symlink escapes", async () => {
  const base = await mkdtemp(join(tmpdir(), "music2-path-"));
  try {
    const root = join(base, "bank");
    const sibling = join(base, "bank-copy");
    await mkdir(root); await mkdir(sibling);
    await writeFile(join(root, "in.wav"), "in");
    await writeFile(join(sibling, "out.wav"), "out");
    await symlink(join(sibling, "out.wav"), join(root, "link.wav"));
    assert.equal(await confinedRealpath(root, "in.wav"), await realpath(join(root, "in.wav")));
    for (const candidate of ["../bank-copy/out.wav", join(sibling, "out.wav"), "link.wav", "missing.wav"]) {
      await assert.rejects(confinedRealpath(root, candidate), { code: "E_ACCESS", exit: 4 });
    }
  } finally { await rm(base, { recursive: true, force: true }); }
});

test("MUSIC2_HOME overrides the home directory", () => {
  const prev = process.env["MUSIC2_HOME"];
  process.env["MUSIC2_HOME"] = "/tmp/music2-home-test";
  assert.equal(music2Home(), "/tmp/music2-home-test");
  assert.equal(storageDir("renders"), join("/tmp/music2-home-test", "renders"));
  process.env["MUSIC2_HOME"] = "";
  assert.equal(music2Home(), join(homedir(), ".music2"), "an empty MUSIC2_HOME falls back to ~/.music2");
  if (prev === undefined) delete process.env["MUSIC2_HOME"]; else process.env["MUSIC2_HOME"] = prev;
});
