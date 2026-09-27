import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { measureLoudness, readWav } from "../../audio-io/index.ts";
import { Music2Error } from "../../shared/index.ts";
import type { CommandContext } from "../registry.ts";
import { render } from "./render.ts";

const drill = resolve("examples/drill-140.song.json");
function ctx(values: Record<string, unknown>, out: string): CommandContext {
  return { args: [drill], values: { out, ...values }, json: true, cwd: process.cwd(), stderr: process.stderr };
}
function hash(bytes: Buffer): string { return createHash("sha256").update(bytes).digest("hex"); }

test("CommandSpec writes deterministic WAV bytes and reports JSON-ready data", async () => {
  const dir = await mkdtemp(join(tmpdir(), "music2-render-test-"));
  try {
    const first = join(dir, "a.wav"); const second = join(dir, "b.wav");
    const a = await render.run(ctx({}, first));
    const b = await render.run(ctx({}, second));
    assert.equal(a.command, "render");
    assert.equal(a.data["bars"], 16);
    assert.equal(a.data["frames"], 1297800);
    assert.ok((a.data["peakDbfs"] as number) <= -1);
    assert.equal(hash(await readFile(first)), hash(await readFile(second)));
    assert.equal(a.data["events"], b.data["events"]);
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test("crop and six stems use 24-bit WAV", async () => {
  const dir = await mkdtemp(join(tmpdir(), "music2-stems-test-"));
  try {
    const result = await render.run(ctx({ bits: "24", bars: "4:12", stems: join(dir, "stems") }, join(dir, "hook.wav")));
    assert.equal(result.data["bars"], 8);
    const paths = result.data["stems"] as string[];
    assert.equal(paths.length, 6);
    const head = await readFile(paths[0]!);
    assert.equal(head.readUInt16LE(34), 24);
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test("invalid bits, bars, and ffmpeg absence fail before writing", async () => {
  const dir = await mkdtemp(join(tmpdir(), "music2-errors-test-"));
  const output = join(dir, "out.wav");
  const previous = process.env.MUSIC2_FFMPEG;
  try {
    for (const values of [{ bits: "32" }, { bars: "8:4" }, { bars: "0:99" }]) {
      await assert.rejects(render.run(ctx(values, output)),
        (error: unknown) => error instanceof Music2Error && error.code === "E_INPUT" && error.exit === 2);
    }
    process.env.MUSIC2_FFMPEG = join(dir, "nonexistent-ffmpeg");
    await assert.rejects(render.run(ctx({ mp3: true }, output)),
      (error: unknown) => error instanceof Music2Error && error.code === "E_FFMPEG_MISSING" && error.exit === 3);
    await assert.rejects(stat(output), { code: "ENOENT" });
    await assert.rejects(stat(join(dir, "out.mp3")), { code: "ENOENT" });
  } finally {
    if (previous === undefined) delete process.env.MUSIC2_FFMPEG; else process.env.MUSIC2_FFMPEG = previous;
    await rm(dir, { recursive: true, force: true });
  }
});


test("silent CLI result reports null peaks", async () => {
  const dir = await mkdtemp(join(tmpdir(), "music2-silent-test-"));
  try {
    const path = join(dir, "silent.song.json");
    await writeFile(path, JSON.stringify({ version: 1, bpm: 120, tailSeconds: 0,
      tracks: [{ id: "bell", kind: "notes", instrument: "bell", pattern: "~" }],
      sections: [{ id: "one", bars: 1 }], arrangement: [{ section: "one" }] }));
    const result = await render.run({ args: [path], values: { out: join(dir, "silent.wav") },
      json: true, cwd: dir, stderr: process.stderr });
    assert.equal(result.data["peakDbfs"], null);
    assert.equal(result.data["truePeakDbtp"], null);
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test("targetLufs selects native LUFS mastering without ffmpeg", async () => {
  const dir = await mkdtemp(join(tmpdir(), "music2-lufs-test-"));
  const previous = process.env.MUSIC2_FFMPEG;
  try {
    const path = join(dir, "target.song.json");
    const output = join(dir, "target.wav");
    await writeFile(path, JSON.stringify({ version: 1, bpm: 120, tailSeconds: 0,
      master: { targetLufs: -14 },
      tracks: [
        { id: "kick", kind: "drums", instrument: "drums", pattern: "bd ~ sd ~" },
        { id: "hats", kind: "drums", instrument: "drums", pattern: "hh hh hh hh" },
        { id: "bass", kind: "notes", instrument: "808", pattern: "c2 ~ c2 ~" },
      ], sections: [{ id: "one", bars: 4 }], arrangement: [{ section: "one" }] }));
    process.env.MUSIC2_FFMPEG = join(dir, "missing-ffmpeg");
    await render.run({ args: [path], values: { out: output }, json: true, cwd: dir, stderr: process.stderr });
    const loudness = measureLoudness(await readWav(output)).integratedLufs;
    assert.ok(loudness !== null && loudness > -16 && loudness < -13, String(loudness));
    await assert.rejects(render.run({ args: [path], values: { out: join(dir, "external.wav"), loudnorm: true },
      json: true, cwd: dir, stderr: process.stderr }),
    (error: unknown) => error instanceof Music2Error && error.code === "E_FFMPEG_MISSING");
  } finally {
    if (previous === undefined) delete process.env.MUSIC2_FFMPEG; else process.env.MUSIC2_FFMPEG = previous;
    await rm(dir, { recursive: true, force: true });
  }
});
