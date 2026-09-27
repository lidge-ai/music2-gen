import { test } from "node:test";
import assert from "node:assert/strict";
import { chmod, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Music2Error } from "../shared/index.ts";
import { discoverFfmpeg } from "./ffmpeg.tool.ts";

async function fake(body: string): Promise<{ dir: string; path: string }> {
  const dir = await mkdtemp(join(tmpdir(), "music2-ffmpeg-"));
  const path = join(dir, "ffmpeg");
  await writeFile(path, `#!${process.execPath}\n${body}\n`);
  await chmod(path, 0o755);
  return { dir, path };
}

test("discovers exact PATH encoder tokens and version", { skip: process.platform === "win32" && "fake executable requires POSIX shebang" }, async () => {
  const { dir } = await fake(`
if (process.argv[2] === "-version") console.log("ffmpeg version 6.1 test");
else console.log(" V..... libmp3lame MP3\\n A..... libvorbis Vorbis\\n A..... libvorbis_extra other");`);
  try {
    const info = await discoverFfmpeg({ PATH: dir });
    assert.equal(info?.version, "6.1");
    assert.deepEqual(info?.encoders, { libmp3lame: true, libvorbis: true });
    assert.equal(await discoverFfmpeg({ PATH: dir, MUSIC2_FFMPEG: join(dir, "missing") }), null);
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test("missing encoder stays false", { skip: process.platform === "win32" && "fake executable requires POSIX shebang" }, async () => {
  const { dir, path } = await fake(`
if (process.argv[2] === "-version") console.log("ffmpeg version 6.1 test");
else console.log(" A..... libmp3lame MP3\\n A..... libvorbis_extra other");`);
  try { assert.deepEqual((await discoverFfmpeg({ MUSIC2_FFMPEG: path }))?.encoders,
    { libmp3lame: true, libvorbis: false }); }
  finally { await rm(dir, { recursive: true, force: true }); }
});

test("malformed version and timed-out probe are capability errors", { skip: process.platform === "win32" && "fake executable requires POSIX shebang" }, async () => {
  for (const body of ["console.log('wrong version')", "setTimeout(() => {}, 6000)"]) {
    const { dir, path } = await fake(body);
    try { await assert.rejects(discoverFfmpeg({ MUSIC2_FFMPEG: path }),
      (error: unknown) => error instanceof Music2Error && error.code === "E_CAPABILITY" && error.exit === 3); }
    finally { await rm(dir, { recursive: true, force: true }); }
  }
});
