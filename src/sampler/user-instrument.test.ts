import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, symlink, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { readUserManifest, parseUserManifest, listUserInstruments, userInstrumentsDir } from "./user-instrument.tool.ts";

function manifest(id = "pad"): unknown { return { version: 1, id, kind: "sfz", entry: `${id}.sfz`, source: { folder: "Samples" }, warnings: [] }; }
test("manifest validates ids, confined entries, source basename, zones and kit shape", () => {
  assert.equal(parseUserManifest(manifest(), "pad").kind, "sfz");
  for (const entry of ["../pad.sfz", "/pad.sfz", "C:\\pad.sfz", "sub/../pad.sfz", "pad.txt", "sub\\pad.sfz"]) assert.throws(() => parseUserManifest({ ...manifest() as object, entry }, "pad"), { code: "E_SCHEMA" });
  assert.throws(() => parseUserManifest(manifest(), "../pad"), { code: "E_SCHEMA" });
  assert.throws(() => parseUserManifest({ ...manifest() as object, source: { folder: "/private/Samples" } }, "pad"), { code: "E_SCHEMA" });
  assert.throws(() => parseUserManifest({ ...manifest() as object, zones: [{}] }, "pad"), { code: "E_SCHEMA" });
  assert.throws(() => parseUserManifest({ ...manifest() as object, warnings: [1] }, "pad"), { code: "E_SCHEMA" });
  assert.equal(parseUserManifest({ ...manifest() as object, kind: "kit", entry: "kit.json", variants: { bd: ["bd.wav"] } }, "pad").kind, "kit");
  assert.throws(() => parseUserManifest({ ...manifest() as object, kind: "kit", entry: "other/kit.json" }, "pad"), { code: "E_SCHEMA" });
});
test("read missing is E_CAPABILITY, sorted list skips dot dirs, symlink escapes are E_ACCESS", async () => {
  const temp = await mkdtemp(join(tmpdir(), "music2-user-")); const old = process.env["MUSIC2_HOME"]; process.env["MUSIC2_HOME"] = join(temp, "home");
  try {
    assert.deepEqual(await listUserInstruments(), []);
    await assert.rejects(readUserManifest("missing"), { code: "E_CAPABILITY", message: "user instrument missing is not imported" });
    await assert.rejects(readUserManifest("../escape"), { code: "E_SCHEMA" });
    const empty = join(userInstrumentsDir(), "empty"); await mkdir(empty, { recursive: true });
    await assert.rejects(readUserManifest("empty"), { code: "E_CAPABILITY" });
    await rm(empty, { recursive: true });
    for (const id of ["zebra", "alpha"]) {
      const dir = join(userInstrumentsDir(), id); await mkdir(dir, { recursive: true });
      await writeFile(join(dir, "instrument.json"), JSON.stringify(manifest(id))); await writeFile(join(dir, `${id}.sfz`), "<region> sample=*sine");
    }
    await mkdir(join(userInstrumentsDir(), ".staging-broken"));
    assert.deepEqual((await listUserInstruments()).map(({ id }) => id), ["alpha", "zebra"]);
    assert.equal((await readUserManifest("alpha")).manifest.id, "alpha");
    const outside = join(temp, "outside"); await mkdir(outside); await writeFile(join(outside, "instrument.json"), JSON.stringify(manifest("escape")));
    await symlink(outside, join(userInstrumentsDir(), "escape"));
    await assert.rejects(readUserManifest("escape"), { code: "E_ACCESS" });
    await rm(join(userInstrumentsDir(), "escape"));
    const root = join(userInstrumentsDir(), "entry-escape"); await mkdir(root);
    await writeFile(join(root, "instrument.json"), JSON.stringify(manifest("entry-escape")));
    await writeFile(join(outside, "escape.sfz"), "<region> sample=*sine");
    await symlink(join(outside, "escape.sfz"), join(root, "entry-escape.sfz"));
    await assert.rejects(readUserManifest("entry-escape"), { code: "E_ACCESS" });
    await rm(root, { recursive: true }); await mkdir(root);
    await symlink(join(outside, "instrument.json"), join(root, "instrument.json"));
    await assert.rejects(readUserManifest("entry-escape"), { code: "E_ACCESS" });
  } finally { if (old === undefined) delete process.env["MUSIC2_HOME"]; else process.env["MUSIC2_HOME"] = old; await rm(temp, { recursive: true, force: true }); }
});

test("a relative MUSIC2_HOME resolves imported instruments once", async () => {
  const temp = await mkdtemp(join(tmpdir(), "music2-user-rel-")); const old = process.env["MUSIC2_HOME"];
  process.env["MUSIC2_HOME"] = relative(process.cwd(), join(temp, "home"));
  try {
    const dir = join(userInstrumentsDir(), "pad"); await mkdir(dir, { recursive: true });
    await writeFile(join(dir, "instrument.json"), JSON.stringify(manifest("pad"))); await writeFile(join(dir, "pad.sfz"), "<region> sample=*sine");
    assert.equal((await readUserManifest("pad")).manifest.id, "pad");
  } finally {
    if (old === undefined) delete process.env["MUSIC2_HOME"]; else process.env["MUSIC2_HOME"] = old;
    await rm(temp, { recursive: true, force: true });
  }
});
