import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readWav } from "../../audio-io/index.ts";
import { exitFor, Music2Error } from "../../shared/index.ts";
import { SFX_PRESETS } from "../../sfx/index.ts";
import type { CommandContext } from "../registry.ts";
import { sfx } from "./sfx.ts";

function ctx(values: Record<string, unknown>): CommandContext {
  return { args: [], values, json: true, cwd: process.cwd(), stderr: process.stderr };
}
async function withDir(run: (dir: string) => Promise<void>): Promise<void> {
  const dir = await mkdtemp(join(tmpdir(), "music2-sfx-test-"));
  try { await run(dir); } finally { await rm(dir, { recursive: true, force: true }); }
}
async function code(run: Promise<unknown>): Promise<number> {
  try { await run; } catch (error) {
    assert.ok(error instanceof Music2Error, String(error));
    return exitFor(error.code);
  }
  return 0;
}

test("every preset writes identical WAV and sidecar bytes for identical inputs, regardless of output path", async () => {
  await withDir(async (dir) => {
    for (const preset of SFX_PRESETS) {
      const a = join(dir, `${preset}-a.wav`); const b = join(dir, `${preset}-b.wav`);
      const first = await sfx.run(ctx({ preset, seed: "41", seconds: "0.3", out: a }));
      await sfx.run(ctx({ preset, seed: "41", seconds: "0.3", out: b }));
      assert.deepEqual(await readFile(a), await readFile(b), preset);
      assert.deepEqual(await readFile(a.replace(/\.wav$/, ".sfx.json")), await readFile(b.replace(/\.wav$/, ".sfx.json")), preset);
      assert.deepEqual(first.artifacts, [a, a.replace(/\.wav$/, ".sfx.json")]);
      const decoded = await readWav(a);
      assert.equal(decoded.sampleRate, 44100);
      assert.equal(decoded.left.length, Math.round(0.3 * 44100));
      assert.equal(first.data["frames"], decoded.left.length);
    }
  });
});

test("sidecar has a stable key order and no paths", async () => {
  await withDir(async (dir) => {
    const out = join(dir, "cue.wav");
    await sfx.run(ctx({ preset: "riser", seconds: "0.05", "sample-rate": "48000", params: "sweepToHz=6000,sweepFromHz=300", out }));
    const text = await readFile(join(dir, "cue.sfx.json"), "utf8");
    const json = JSON.parse(text) as Record<string, unknown>;
    assert.deepEqual(Object.keys(json), ["generatorVersion", "preset", "seed", "seconds", "frames", "sampleRate", "params"]);
    assert.equal(json["frames"], 2400);
    assert.equal(json["seconds"], 2400 / 48000);
    assert.equal(json["seed"], 1);
    assert.ok(!text.includes(dir));
    const params = json["params"] as Record<string, number>;
    assert.equal(params["sweepFromHz"], 300);
    assert.equal(params["sweepToHz"], 6000);
  });
});

test("parameter key order does not change output bytes", async () => {
  await withDir(async (dir) => {
    const a = join(dir, "a.wav"); const b = join(dir, "b.wav");
    await sfx.run(ctx({ preset: "riser", seconds: "0.2", params: "sweepFromHz=300,sweepToHz=6000", out: a }));
    await sfx.run(ctx({ preset: "riser", seconds: "0.2", params: "sweepToHz=6000,sweepFromHz=300", out: b }));
    assert.deepEqual(await readFile(a), await readFile(b));
    assert.deepEqual(await readFile(join(dir, "a.sfx.json")), await readFile(join(dir, "b.sfx.json")));
  });
});

test("invalid input exits 2 and existing outputs exit 4 without being modified", async () => {
  await withDir(async (dir) => {
    const out = join(dir, "x.wav");
    const bad: Record<string, unknown>[] = [
      { out }, { preset: "nope", out }, { preset: "pickup" }, { preset: "pickup", out: join(dir, "x.mp3") },
      { preset: "pickup", out, seed: "-1" }, { preset: "pickup", out, seed: "4294967296" }, { preset: "pickup", out, seed: "1.5" },
      { preset: "pickup", out, seconds: "0" }, { preset: "pickup", out, seconds: "30.001" }, { preset: "pickup", out, seconds: "NaN" },
      { preset: "pickup", out, "sample-rate": "22050" }, { preset: "riser", out, params: "sweepFromHz=250,sweepFromHz=300" },
      { preset: "riser", out, params: "sweepFromHz=NaN" }, { preset: "riser", out, params: "unknown=1" },
      { preset: "riser", out, params: "sweepFromHz" }, { preset: "riser", out, params: "sweepFromHz=250,," },
    ];
    for (const values of bad) assert.equal(await code(sfx.run(ctx(values))), 2, JSON.stringify(values));
    for (const seed of ["0", "4294967295"]) {
      const path = join(dir, `seed-${seed}.wav`);
      assert.equal(await code(sfx.run(ctx({ preset: "blip", seed, out: path }))), 0);
    }
    const wav = join(dir, "taken.wav");
    await writeFile(wav, "keep");
    assert.equal(await code(sfx.run(ctx({ preset: "blip", out: wav }))), 4);
    assert.equal(await readFile(wav, "utf8"), "keep");
    const other = join(dir, "side.wav");
    await writeFile(join(dir, "side.sfx.json"), "keep");
    assert.equal(await code(sfx.run(ctx({ preset: "blip", out: other }))), 4);
    await assert.rejects(readFile(other), "no WAV is written when the sidecar exists");
  });
});

test("concurrent writers to one destination never overwrite each other", async () => {
  await withDir(async (dir) => {
    const out = join(dir, "race.wav");
    const results = await Promise.allSettled([1, 2, 3].map((seed) => sfx.run(ctx({ preset: "blip", seed: String(seed), out }))));
    const won = results.filter((result) => result.status === "fulfilled");
    assert.equal(won.length, 1);
    for (const result of results) {
      if (result.status === "rejected") assert.equal(exitFor((result.reason as Music2Error).code), 4);
    }
    const winner = (won[0] as PromiseFulfilledResult<{ data: Record<string, unknown> }>).value;
    const sidecar = JSON.parse(await readFile(join(dir, "race.sfx.json"), "utf8")) as Record<string, unknown>;
    assert.equal(sidecar["seed"], winner.data["seed"], "WAV and sidecar come from the same writer");
  });
});
