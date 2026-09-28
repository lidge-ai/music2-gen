import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { analyze } from "./analyze.ts";

test("analyze command validates positional and path flags", async () => {
  const context = { args: [] as string[], values: {} as Record<string, unknown>, cwd: process.cwd(),
    json: true, stderr: process.stderr };
  await assert.rejects(analyze.run(context), { code: "E_INPUT" });
  await assert.rejects(analyze.run({ ...context, args: ["x.wav"], values: { song: "" } }), { code: "E_INPUT" });
  await assert.rejects(analyze.run({ ...context, args: ["x.wav"], values: { out: true } }), { code: "E_INPUT" });
});

test("analyze command returns artifact paths in the CLI envelope", async () => {
  const out = await mkdtemp(join(tmpdir(), "music2-analyze-command-"));
  try {
    const result = await analyze.run({ args: ["examples/minimal.song.json"], values: { out },
      cwd: process.cwd(), json: true, stderr: process.stderr });
    assert.equal(result.command, "analyze");
    assert.ok(result.artifacts?.includes(join(out, "analysis.json")));
    assert.deepEqual(result.artifacts?.slice(2, 4), [join(out, "spectrogram.png"), join(out, "overview.png")]);
    assert.equal(result.data["overviewPng"], join(out, "overview.png"));
    assert.ok(result.artifacts?.includes(join(out, "pianoroll.png")));
    assert.equal((result.data["summary"] as { declaredBpm: number }).declaredBpm, 120);
  } finally { await rm(out, { recursive: true, force: true }); }
});

test("without --out the analysis goes to MUSIC2_HOME/analysis/<name>", async () => {
  const home = await mkdtemp(join(tmpdir(), "music2-analyze-home-"));
  const prev = process.env["MUSIC2_HOME"];
  process.env["MUSIC2_HOME"] = home;
  try {
    const result = await analyze.run({ args: ["examples/minimal.song.json"], values: {},
      cwd: process.cwd(), json: true, stderr: process.stderr });
    assert.ok(result.artifacts?.includes(join(home, "analysis", "minimal", "analysis.json")));
  } finally {
    if (prev === undefined) delete process.env["MUSIC2_HOME"]; else process.env["MUSIC2_HOME"] = prev;
    await rm(home, { recursive: true, force: true });
  }
});
