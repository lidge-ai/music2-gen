import assert from "node:assert/strict";
import test from "node:test";
import { createStereo } from "../audio-io/index.ts";
import { validateSong } from "../song/index.ts";
import { processTrackPlugins } from "./plugin.tool.ts";

test("plugin boundary copies mono source and checks the returned shape", async () => {
  const track = validateSong({ version: 1, bpm: 120,
    tracks: [{ id: "lead", kind: "notes", instrument: "lead", pattern: "c4", plugins: [{ id: "softclip" }] }],
    sections: [{ id: "one", bars: 1 }], arrangement: [{ section: "one" }] }).tracks[0]!;
  const source = Float32Array.of(.4, -.4);
  const context = { bpm: 120, seed: 1, startSeconds: 0 };
  const processed = await processTrackPlugins(track, source, { warnings: [], async process(id, plugins, input) {
    assert.equal(id, "lead"); assert.equal(plugins[0]?.id, "softclip");
    assert.deepEqual([...input.left], [...source]);
    input.left[0] = .2; input.right[0] = .2;
    return input;
  } }, context, 48000);
  assert.ok(Math.abs(source[0]! - .4) < 1e-7);
  assert.ok(Math.abs((processed as ReturnType<typeof createStereo>).left[0]! - .2) < 1e-7);
  await assert.rejects(processTrackPlugins(track, source, { warnings: [], async process() {
    return createStereo(44100, 2);
  } }, context, 48000), { code: "E_RENDER" });
});
