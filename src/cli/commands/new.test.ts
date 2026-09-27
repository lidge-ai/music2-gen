import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Music2Error } from "../../shared/index.ts";
import { validateSong } from "../../song/index.ts";
import type { CommandContext } from "../registry.ts";
import { newCommand } from "./new.ts";
import { main } from "../main.ts";

function ctx(cwd: string, values: Record<string, unknown>, args: string[] = []): CommandContext {
  return { args, values, json: false, cwd, stderr: process.stderr };
}

test("new returns valid song and human JSON", async () => {
  const result = await newCommand.run(ctx(process.cwd(), { genre: "drill_uk", key: "D minor", seed: "7" }));
  const song = result.data["song"];
  assert.equal(validateSong(song).key, "D minor");
  assert.deepEqual(JSON.parse(result.text ?? ""), song);
});

test("-o writes two-space JSON with newline and refuses overwrite", async () => {
  const dir = await mkdtemp(join(tmpdir(), "music2-new-"));
  try {
    const context = ctx(dir, { genre: "drill_uk", out: "song.json" });
    const result = await newCommand.run(context);
    const path = join(dir, "song.json");
    assert.equal(result.data["written"], path);
    assert.equal(result.text, path);
    const contents = await readFile(path, "utf8");
    assert.ok(contents.endsWith("\n"));
    assert.match(contents, /^\{\n  "version": 1,/);
    validateSong(JSON.parse(contents) as unknown);
    await assert.rejects(newCommand.run(context),
      (error: unknown) => error instanceof Music2Error && error.code === "E_ACCESS" && error.exit === 4);
    assert.equal(await readFile(path, "utf8"), contents);
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test("new rejects invalid flags and extra arguments", async () => {
  for (const [values, args] of [
    [{}, []], [{ genre: "unknown" }, []], [{ genre: "drill_uk", bpm: "140.5" }, []],
    [{ genre: "drill_uk", seed: "-1" }, []], [{ genre: "drill_uk" }, ["extra"]],
  ] as const) {
    await assert.rejects(newCommand.run(ctx(process.cwd(), values, [...args])),
      (error: unknown) => error instanceof Music2Error && error.exit === 2);
  }
});

test("new resolves preset, variant, and exact duration with one JSON object", async () => {
  const result = await newCommand.run(ctx(process.cwd(), { genre: "drill_uk", use: "short_30", seed: "1" }));
  assert.equal(result.data["arrangement"], "default");
  assert.equal(result.data["durationSeconds"], 30);
  const song = result.data["song"] as ReturnType<typeof validateSong>;
  assert.equal(song.bpm, 144);
  assert.equal(song.useCase, "short_30");
  assert.equal(song.arrangement[0]?.section, "hook");
  const lines: string[] = [];
  const exit = await main(["new", "--genre", "drill_uk", "--use", "short_30", "--json"],
    { stdout: { write: (value: string) => { lines.push(value); return true; } } as NodeJS.WriteStream });
  assert.equal(exit, 0);
  assert.equal(lines.length, 1);
  const payload = JSON.parse(lines[0]!) as { data: { durationSeconds: number } };
  assert.equal(payload.data.durationSeconds, 30);
  const failures: string[] = [];
  const badExit = await main(["new", "--genre", "drill_uk", "--use", "short_30", "--bpm", "140", "--json"],
    { stdout: { write: (value: string) => { failures.push(value); return true; } } as NodeJS.WriteStream });
  assert.equal(badExit, 2);
  assert.equal(failures.length, 1);
  const failure = JSON.parse(failures[0]!) as { ok: boolean; error: { code: string } };
  assert.equal(failure.ok, false);
  assert.equal(failure.error.code, "E_INPUT");
});

test("new rejects unknown variants, presets and exact-duration conflicts", async () => {
  for (const values of [
    { genre: "trap", arrangement: "missing" },
    { genre: "trap", use: "missing" },
    { genre: "trap", seconds: "30" },
    { genre: "drill_uk", use: "short_30", bpm: "140" },
    { genre: "drill_uk", use: "short_30", seconds: "29" },
  ]) await assert.rejects(newCommand.run(ctx(process.cwd(), values)),
    (error: unknown) => error instanceof Music2Error && error.exit === 2);
  const explicit = await newCommand.run(ctx(process.cwd(), {
    genre: "drill_uk", use: "short_30", arrangement: "short_single", bpm: "144", key: "D minor",
  }));
  assert.equal(explicit.data["arrangement"], "short_single");
  const song = explicit.data["song"] as ReturnType<typeof validateSong>;
  assert.equal(song.key, "D minor");
  assert.equal(song.tracks.find((track) => track.id === "bass")?.pattern?.split(" ")[0], "d2");
});
