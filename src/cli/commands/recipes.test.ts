import { test } from "node:test";
import assert from "node:assert/strict";
import { Music2Error } from "../../shared/index.ts";
import type { CommandContext } from "../registry.ts";
import { recipes } from "./recipes.ts";

function ctx(args: string[]): CommandContext {
  return { args, values: {}, json: false, cwd: process.cwd(), stderr: process.stderr };
}

test("recipes list returns metadata only and human table", async () => {
  const result = await recipes.run(ctx([]));
  const cards = result.data["recipes"] as Record<string, unknown>[];
  assert.equal(cards.length, 7);
  assert.equal("starterSong" in cards[0]!, false);
  assert.match(result.text ?? "", /DEFAULT KEY/);
  assert.match(result.text ?? "", /drill_uk/);
});

test("recipes id returns full card and readable detail", async () => {
  const result = await recipes.run(ctx(["drill_uk"]));
  const card = result.data["recipe"] as Record<string, unknown>;
  assert.ok("starterSong" in card);
  for (const label of ["BPM:", "Swing:", "Keys:", "Progressions:", "Grid:", "Bass:", "Palette:", "Arrangement:", "Mix:", "Sources:"]) {
    assert.ok(result.text?.includes(label), label);
  }
});

test("recipes rejects extra arguments and unknown ids", async () => {
  for (const args of [["one", "two"], ["unknown"]]) {
    await assert.rejects(recipes.run(ctx(args)), (error: unknown) => error instanceof Music2Error && error.exit === 2);
  }
});
