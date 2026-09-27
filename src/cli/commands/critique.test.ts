import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { writeWav } from "../../audio-io/index.ts";
import { Music2Error } from "../../shared/index.ts";
import type { CommandContext } from "../registry.ts";
import { critiqueCommand } from "./critique.ts";

test("critique CommandSpec returns JSON-ready report and human review with DSP", async () => {
  const dir = await mkdtemp(join(tmpdir(), "music2-critique-cli-test-"));
  const wav = join(dir, "clip.wav");
  const server = createServer((_req, res) => {
    const review = { heard_audio: true, overall: "A clear pulse.", timbre: ["Bright lead."],
      groove: ["Firm kick."], mix: [], arrangement: [], genre_fit: { score: 4, notes: "Close." },
      top_fixes: ["Lower the lead."] };
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ output: [{ content: [{ type: "output_text", text: JSON.stringify(review) }] }] }));
  });
  const previous = process.env.MUSIC2_FFMPEG;
  try {
    const samples = new Float32Array(8000);
    for (let i = 0; i < samples.length; i++) samples[i] = Math.sin(2 * Math.PI * i / 40) * 0.1;
    await writeWav(wav, { sampleRate: 8000, left: samples, right: samples, sourceChannels: 2 }, { bits: 16, seed: 1 });
    process.env.MUSIC2_FFMPEG = join(dir, "missing");
    await new Promise<void>((done) => server.listen(0, "127.0.0.1", done));
    const address = server.address(); assert.ok(address && typeof address !== "string");
    const values = { "base-url": `http://127.0.0.1:${address.port}`, model: "test-model", excerpt: "1" };
    const ctx = (json: boolean): CommandContext => ({ args: [wav], values, json, cwd: dir, stderr: process.stderr });
    const human = await critiqueCommand.run(ctx(false));
    assert.equal(human.command, "critique");
    assert.match(human.text ?? "", /A clear pulse/);
    assert.match(human.text ?? "", /DSP: estimated BPM/);
    assert.equal((human.data["review"] as { heard_audio: boolean }).heard_audio, true);
    const machine = await critiqueCommand.run(ctx(true));
    assert.equal(machine.text, undefined);
    assert.equal(machine.data["model"], "test-model");
    assert.ok(machine.data["dsp"]);
  } finally {
    if (previous === undefined) delete process.env.MUSIC2_FFMPEG; else process.env.MUSIC2_FFMPEG = previous;
    server.closeAllConnections(); await new Promise<void>((done) => server.close(() => done()));
    await rm(dir, { recursive: true, force: true });
  }
});

test("critique CommandSpec rejects missing path and malformed excerpt", async () => {
  const ctx = (args: string[], values: Record<string, unknown>): CommandContext =>
    ({ args, values, json: true, cwd: process.cwd(), stderr: process.stderr });
  await assert.rejects(critiqueCommand.run(ctx([], {})),
    (error: unknown) => error instanceof Music2Error && error.code === "E_INPUT" && error.exit === 2);
  await assert.rejects(critiqueCommand.run(ctx(["clip.wav"], { excerpt: "oops" })),
    (error: unknown) => error instanceof Music2Error && error.code === "E_INPUT" && error.exit === 2);
});
