import { test } from "node:test";
import assert from "node:assert/strict";
import { chmod, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Music2Error } from "../shared/index.ts";
import type { FfmpegInfo } from "./ffmpeg.schema.ts";
import { encodeAudio, loudnormWav } from "./master.tool.ts";

test("two-pass loudnorm passes measured stats and paths as single arguments", { skip: process.platform === "win32" && "fake executable requires POSIX shebang" }, async () => {
  const dir = await mkdtemp(join(tmpdir(), "music2-master-"));
  const path = join(dir, "fake ffmpeg");
  const log = join(dir, "calls.jsonl");
  const script = `#!${process.execPath}\nimport { appendFileSync } from 'node:fs';
appendFileSync(${JSON.stringify(log)}, JSON.stringify(process.argv.slice(2)) + '\\n');
if (process.argv.includes('-f')) console.error(JSON.stringify({input_i:'-19',input_tp:'-2',input_lra:'5',input_thresh:'-29',target_offset:'0.2'}));`;
  await writeFile(path, script);
  await chmod(path, 0o755);
  const ffmpeg: FfmpegInfo = { path, version: "6.1", encoders: { libmp3lame: true, libvorbis: true } };
  const wav = join(dir, "input space.wav");
  const out = join(dir, "output space.wav");
  try {
    await loudnormWav(wav, out, ffmpeg, { targetLufs: -14, ceilingDb: -1 });
    await encodeAudio(wav, join(dir, "encoded space.mp3"), ffmpeg, { format: "mp3" });
    const calls = (await readFile(log, "utf8")).trim().split("\n").map((line) => JSON.parse(line) as string[]);
    assert.equal(calls.length, 3);
    assert.ok(calls[0]?.includes(wav));
    assert.ok(calls[0]?.includes("-f"));
    assert.ok(calls[1]?.some((arg) => arg.includes("measured_I=-19") && arg.includes("linear=true")));
    assert.ok(calls[1]?.includes(out));
    assert.ok(calls[2]?.includes(join(dir, "encoded space.mp3")));
    assert.ok(calls[2]?.includes("-map_metadata"));
    assert.deepEqual(calls[1]?.slice(-3), ["-f", "wav", out]);
    assert.deepEqual(calls[2]?.slice(-3), ["-f", "mp3", join(dir, "encoded space.mp3")]);
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test("missing encoder is capability error", async () => {
  const ffmpeg: FfmpegInfo = { path: "unused", version: "6.1", encoders: { libmp3lame: true, libvorbis: false } };
  await assert.rejects(encodeAudio("in.wav", "out.ogg", ffmpeg, { format: "ogg" }),
    (error: unknown) => error instanceof Music2Error && error.code === "E_CAPABILITY" && error.exit === 3);
});

test("nonzero process and malformed measurements are render errors", { skip: process.platform === "win32" && "fake executable requires POSIX shebang" }, async () => {
  const dir = await mkdtemp(join(tmpdir(), "music2-master-fail-"));
  const path = join(dir, "fake ffmpeg");
  const ffmpeg: FfmpegInfo = { path, version: "6.1", encoders: { libmp3lame: true, libvorbis: true } };
  try {
    await writeFile(path, `#!${process.execPath}\nconsole.error('failed');process.exit(2);`);
    await chmod(path, 0o755);
    await assert.rejects(encodeAudio("in.wav", "out.mp3", ffmpeg, { format: "mp3" }),
      (error: unknown) => error instanceof Music2Error && error.code === "E_RENDER" && error.details?.["stderr"] === "failed\n");
    await writeFile(path, `#!${process.execPath}\nconsole.error(JSON.stringify({input_i:'-Infinity'}));`);
    await assert.rejects(loudnormWav("in.wav", "out.wav", ffmpeg, { targetLufs: -14, ceilingDb: -1 }),
      (error: unknown) => error instanceof Music2Error && error.code === "E_RENDER");
  } finally { await rm(dir, { recursive: true, force: true }); }
});
