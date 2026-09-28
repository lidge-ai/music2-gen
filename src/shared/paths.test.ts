import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { music2Home, packageRoot, packageVersion, storageDir } from "./paths.tool.ts";

test("package root and version", () => {
  const pj = JSON.parse(readFileSync(join(packageRoot(), "package.json"), "utf8")) as { version: string; name: string };
  assert.equal(pj.name, "music2-gen");
  assert.equal(packageVersion(), pj.version);
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
