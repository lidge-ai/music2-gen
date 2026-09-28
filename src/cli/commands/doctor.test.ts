import { test } from "node:test";
import assert from "node:assert/strict";
import { chmod, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { Music2Error } from "../../shared/index.ts";
import type { CommandContext } from "../registry.ts";
import { doctor } from "./doctor.ts";

const ctx: CommandContext = { args: [], values: {}, json: true, cwd: process.cwd(), stderr: process.stderr };

test("optional missing ffmpeg reports ready false; required missing throws", async () => {
  const priorPath = process.env.MUSIC2_FFMPEG;
  const priorRequired = process.env.MUSIC2_REQUIRE_FFMPEG;
  try {
    process.env.MUSIC2_FFMPEG = join(tmpdir(), "music2-nonexistent-ffmpeg");
    delete process.env.MUSIC2_REQUIRE_FFMPEG;
    const data = (await doctor.run(ctx)).data;
    assert.equal(data["ffmpeg"], null);
    assert.equal(data["ready"], false);
    assert.equal((data["plugins"] as { probed: boolean }).probed, false);
    process.env.MUSIC2_REQUIRE_FFMPEG = "1";
    await assert.rejects(doctor.run(ctx),
      (error: unknown) => error instanceof Music2Error && error.code === "E_FFMPEG_MISSING" && error.exit === 3);
  } finally {
    if (priorPath === undefined) delete process.env.MUSIC2_FFMPEG; else process.env.MUSIC2_FFMPEG = priorPath;
    if (priorRequired === undefined) delete process.env.MUSIC2_REQUIRE_FFMPEG; else process.env.MUSIC2_REQUIRE_FFMPEG = priorRequired;
  }
});

test("doctor reports config read errors and explicitly probes the stub", async () => {
  const home = await mkdtemp(join(tmpdir(), "music2-doctor-plugin-"));
  const previous = process.env["MUSIC2_HOME"];
  process.env["MUSIC2_HOME"] = home;
  try {
    await writeFile(join(home, "plugins.json"), "{");
    const invalid = (await doctor.run(ctx)).data["plugins"] as { configured: null; probed: false; error: string };
    assert.deepEqual(invalid, { configured: null, probed: false, error: "E_INPUT" });
    const host = JSON.stringify([process.execPath, resolve("tests/fixtures/plugin-host/stub-host.mjs")]);
    await writeFile(join(home, "plugins.json"), JSON.stringify({ version: 1, plugins: {} }));
    const probed = (await doctor.run({ ...ctx, values: { plugins: true, "plugin-host": host } })).data["plugins"] as
      { probed: boolean; host: { available: boolean; hostVersion: string } };
    assert.equal(probed.probed, true);
    assert.equal(probed.host.available, true);
    assert.equal(probed.host.hostVersion, "stub/1");
  } finally {
    if (previous === undefined) delete process.env["MUSIC2_HOME"]; else process.env["MUSIC2_HOME"] = previous;
    await rm(home, { recursive: true, force: true });
  }
});

test("doctor reports encoder flags and required mode rejects missing encoder", { skip: process.platform === "win32" && "fake executable requires POSIX shebang" }, async () => {
  const dir = await mkdtemp(join(tmpdir(), "music2-doctor-"));
  const path = join(dir, "ffmpeg");
  const priorPath = process.env.MUSIC2_FFMPEG;
  const priorRequired = process.env.MUSIC2_REQUIRE_FFMPEG;
  try {
    await writeFile(path, `#!${process.execPath}\nif(process.argv[2]==='-version') console.log('ffmpeg version 6.1'); else console.log(' A..... libmp3lame MP3');`);
    await chmod(path, 0o755);
    process.env.MUSIC2_FFMPEG = path;
    delete process.env.MUSIC2_REQUIRE_FFMPEG;
    const data = (await doctor.run(ctx)).data;
    assert.equal(data["ready"], false);
    assert.deepEqual((data["ffmpeg"] as { encoders: object }).encoders, { libmp3lame: true, libvorbis: false });
    process.env.MUSIC2_REQUIRE_FFMPEG = "1";
    await assert.rejects(doctor.run(ctx),
      (error: unknown) => error instanceof Music2Error && error.code === "E_CAPABILITY" && error.exit === 3);
  } finally {
    if (priorPath === undefined) delete process.env.MUSIC2_FFMPEG; else process.env.MUSIC2_FFMPEG = priorPath;
    if (priorRequired === undefined) delete process.env.MUSIC2_REQUIRE_FFMPEG; else process.env.MUSIC2_REQUIRE_FFMPEG = priorRequired;
    await rm(dir, { recursive: true, force: true });
  }
});
