import { delimiter } from "node:path";
import { main } from "../main.ts";
import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { chmod, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { Music2Error } from "../../shared/index.ts";
import type { CommandContext } from "../registry.ts";
import { doctor } from "./doctor.ts";

let testHome: string;
let previousHome: string | undefined;
beforeEach(async () => {
  previousHome = process.env["MUSIC2_HOME"];
  testHome = await mkdtemp(join(tmpdir(), "music2-doctor-home-"));
  process.env["MUSIC2_HOME"] = testHome;
});
afterEach(async () => {
  if (previousHome === undefined) delete process.env["MUSIC2_HOME"]; else process.env["MUSIC2_HOME"] = previousHome;
  await rm(testHome, { recursive: true, force: true });
});

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


test("doctor reports available sample roots in one JSON object without scanning audio", async () => {
  const previousRoots = process.env["MUSIC2_SAMPLE_ROOTS"];
  const previousFfmpeg = process.env["MUSIC2_FFMPEG"];
  const previousRequired = process.env["MUSIC2_REQUIRE_FFMPEG"];
  try {
    const samples = join(testHome, "synthetic-samples");
    await mkdir(samples);
    process.env["MUSIC2_SAMPLE_ROOTS"] = [samples, join(testHome, "absent")].join(delimiter);
    process.env["MUSIC2_FFMPEG"] = join(testHome, "absent-ffmpeg");
    delete process.env["MUSIC2_REQUIRE_FFMPEG"];
    let stdout = "";
    const exit = await main(["doctor", "--json"], { cwd: testHome,
      stdout: { write(chunk: string) { stdout += chunk; return true; } } as NodeJS.WritableStream });
    assert.equal(exit, 0);
    assert.equal(stdout.trim().split("\n").length, 1);
    assert.deepEqual((JSON.parse(stdout) as { data: { sampleLibrary: unknown } }).data.sampleLibrary,
      { roots: [samples], available: true });
    process.env["MUSIC2_SAMPLE_ROOTS"] = join(testHome, "absent");
    assert.deepEqual((await doctor.run(ctx)).data["sampleLibrary"], { roots: [], available: false });
  } finally {
    if (previousRoots === undefined) delete process.env["MUSIC2_SAMPLE_ROOTS"]; else process.env["MUSIC2_SAMPLE_ROOTS"] = previousRoots;
    if (previousFfmpeg === undefined) delete process.env["MUSIC2_FFMPEG"]; else process.env["MUSIC2_FFMPEG"] = previousFfmpeg;
    if (previousRequired === undefined) delete process.env["MUSIC2_REQUIRE_FFMPEG"]; else process.env["MUSIC2_REQUIRE_FFMPEG"] = previousRequired;
  }
});
