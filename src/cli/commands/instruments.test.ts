import { test } from "node:test";
import assert from "node:assert/strict";
import type { CommandContext } from "../registry.ts";
import { instruments } from "./instruments.ts";

const context = (args: string[] = []): CommandContext =>
  ({ args, values: {}, json: true, cwd: process.cwd(), stderr: process.stderr });

test("instruments lists synth sources and sampled licenses", async () => {
  const result = await instruments.run(context());
  const voices = result.data["voices"] as { id: string; source: string; params: Record<string, unknown> }[];
  const library = result.data["library"] as { id: string; license: { spdx: string } }[];
  assert.equal(voices.find((voice) => voice.id === "strings")?.source, "saw");
  assert.ok(voices.every((voice) => voice.source.length > 0));
  assert.equal(voices.find((voice) => voice.id === "bass")?.params["wave"] !== undefined, true);
  assert.equal(library.find((item) => item.id === "grand-piano")?.license.spdx, "CC-BY-3.0");
  await assert.rejects(instruments.run(context(["extra"])));
});
