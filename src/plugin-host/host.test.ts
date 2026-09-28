import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtemp, writeFile, rm, readdir, access } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { createExternalProcessor, decodePluginWav, encodePluginWav, loadPluginConfig, runPluginHost } from "./host.tool.ts";
import type { PluginConfig } from "./contract.schema.ts";

const fixture = fileURLToPath(new URL("../../tests/fixtures/plugin-host/stub-host.mjs", import.meta.url));
const audio = { sampleRate: 48000, left: new Float32Array([0.4, -0.4]), right: new Float32Array([0.4, -0.4]), sourceChannels: 2 as const };

async function setup(mode = "normal") {
  const home = await mkdtemp(join(tmpdir(), "music2-plugin-test-"));
  const a = join(home, "a.vst3"), b = join(home, "b.vst3");
  await writeFile(a, "a"); await writeFile(b, "b");
  const config: PluginConfig = { version: 1, plugins: {
    a: { path: a, pluginName: null, timeoutMs: 1000 },
    b: { path: b, pluginName: null, timeoutMs: 1000 },
  } };
  return { home, config, argv: [process.execPath, fixture, mode], cleanup: () => rm(home, { recursive: true, force: true }) };
}

test("float32 WAV uses the canonical 58-byte header and exact samples", () => {
  const wave = encodePluginWav(audio);
  assert.equal(wave.length, 74);
  assert.equal(wave.readUInt32LE(4), 66);
  assert.equal(wave.readUInt16LE(20), 3);
  assert.equal(wave.readUInt32LE(46), 2);
  const decoded = decodePluginWav(wave, 48000, 2);
  assert.deepEqual(decoded.audio.left, audio.left);
  assert.equal(decoded.headroomExceeded, false);
  const junk = Buffer.alloc(12); junk.write("JUNK", 0); junk.writeUInt32LE(3, 4);
  const withJunk = Buffer.concat([wave.subarray(0, 50), junk, wave.subarray(50)]);
  withJunk.writeUInt32LE(withJunk.length - 8, 4);
  assert.equal(decodePluginWav(withJunk, 48000, 2).audio.left[0], audio.left[0]);
  const invalidFact = Buffer.from(wave); invalidFact.writeUInt32LE(1, 46);
  assert.throws(() => decodePluginWav(invalidFact, 48000, 2), { code: "E_RENDER" });
  const nan = Buffer.from(wave); nan.writeFloatLE(NaN, 58);
  assert.throws(() => decodePluginWav(nan, 48000, 2), { code: "E_RENDER" });
});

test("two isolated stages apply gains in declaration order", async () => {
  const state = await setup();
  try {
    const processor = createExternalProcessor(state.config, state.argv);
    const result = await processor.process("track", [{ id: "a" }, { id: "b" }], audio,
      { bpm: 120, seed: 1, startSeconds: 0 });
    assert.ok(Math.abs((result.left[0] ?? 0) - 0.05) < 1e-7);
    assert.deepEqual(result.right, result.left);
  } finally { await state.cleanup(); }
});

test("bad host responses, symlinks, crashes and timeout fail with mapped codes", async () => {
  const state = await setup();
  try {
    for (const mode of ["invalid-json", "flood", "wrong-path", "wrong-frames", "wrong-rate", "wrong-channels", "nan", "over", "symlink", "crash"]) {
      const processor = createExternalProcessor(state.config, [process.execPath, fixture, mode]);
      await assert.rejects(processor.process("track", [{ id: "a" }], audio, { bpm: 120, seed: 1, startSeconds: 0 }), { code: "E_RENDER" });
    }
    const processor = createExternalProcessor(state.config, [process.execPath, fixture, "delay"]);
    await assert.rejects(processor.process("track", [{ id: "a" }], audio, { bpm: 120, seed: 1, startSeconds: 0 }), { code: "E_TIMEOUT" });
    assert.deepEqual((await readdir(state.home)).sort(), ["a.vst3", "b.vst3"]);
  } finally { await state.cleanup(); }
});

test("timeout stays bounded when a child inherits the host pipes", async () => {
  for (const mode of ["child-delay", "orphan-pipes"]) {
    const started = Date.now();
    await assert.rejects(runPluginHost([process.execPath, fixture, mode],
      { protocol: "music2-plugin-bridge/1", op: "probe" }, 500), { code: "E_TIMEOUT" });
    assert.ok(Date.now() - started < 4000, `${mode} exceeded the post-kill wait`);
  }
});

test("finite headroom above unity is accepted with a warning", async () => {
  const state = await setup();
  try {
    const processor = createExternalProcessor(state.config, [process.execPath, fixture, "headroom"]);
    const result = await processor.process("track", [{ id: "a" }], audio, { bpm: 120, seed: 1, startSeconds: 0 });
    assert.equal(result.left[0], 1.25);
    assert.deepEqual(processor.warnings, ["PLUGIN_HEADROOM_EXCEEDED"]);
  } finally { await state.cleanup(); }
});

test("host arguments are passed literally without a shell", async () => {
  const state = await setup();
  try {
    const marker = join(state.home, "shell-marker");
    const argv = [process.execPath, fixture, "normal", `;touch ${marker}`];
    const processor = createExternalProcessor(state.config, argv);
    await processor.process("track", [{ id: "a" }], audio, { bpm: 120, seed: 1, startSeconds: 0 });
    await assert.rejects(access(marker), { code: "ENOENT" });
  } finally { await state.cleanup(); }
});

test("missing config/ID/command reports capability without spawning", async () => {
  const state = await setup();
  try {
    assert.deepEqual(await loadPluginConfig(state.home), { version: 1, plugins: {} });
    const processor = createExternalProcessor(state.config, state.argv);
    await assert.rejects(processor.process("track", [{ id: "missing" }], audio, { bpm: 120, seed: 1, startSeconds: 0 }), { code: "E_CAPABILITY" });
    const prior = process.env["MUSIC2_PLUGIN_HOST"];
    delete process.env["MUSIC2_PLUGIN_HOST"];
    try {
      const noHost = createExternalProcessor(state.config);
      await assert.rejects(noHost.process("track", [{ id: "a" }], audio, { bpm: 120, seed: 1, startSeconds: 0 }), { code: "E_CAPABILITY" });
    } finally {
      if (prior === undefined) delete process.env["MUSIC2_PLUGIN_HOST"];
      else process.env["MUSIC2_PLUGIN_HOST"] = prior;
    }
  } finally { await state.cleanup(); }
});
