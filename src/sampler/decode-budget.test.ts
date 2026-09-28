import assert from "node:assert/strict";
import { test } from "node:test";
import type { StereoBuffer } from "../audio-io/buffer.schema.ts";
import { createDecodeBudget } from "./decode-budget.tool.ts";

function source(frames: number): StereoBuffer {
  return { sampleRate: 48000, sourceChannels: 2,
    left: new Float32Array(frames), right: new Float32Array(frames) };
}

test("one decode budget counts distinct canonical sources once across loaders", async () => {
  const budget = createDecodeBudget(160);
  let calls = 0;
  const first = await budget.load("/source/a.wav", async () => 80, async () => { calls++; return source(10); });
  assert.equal(await budget.load("/source/a.wav", async () => 80, async () => { calls++; return source(10); }), first);
  assert.equal(calls, 1);
  await budget.load("/source/b.wav", async () => 80, async () => source(10));
  await assert.rejects(budget.load("/source/c.wav", async () => 8, async () => source(1)), { code: "E_CAPABILITY" });
});
