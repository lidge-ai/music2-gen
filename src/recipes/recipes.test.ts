import { test } from "node:test";
import assert from "node:assert/strict";
import { Music2Error } from "../shared/index.ts";
import { buildTimeline, validateSong } from "../song/index.ts";
import { lintSong } from "./lint.tool.ts";
import { RECIPE_IDS } from "./recipe.schema.ts";
import { getRecipe, listRecipes } from "./recipes.tool.ts";

test("seven sorted cards have valid, renderable starter songs and declared rules", () => {
  const cards = listRecipes();
  assert.deepEqual(cards.map((card) => card.id), [...RECIPE_IDS]);
  for (const card of cards) {
    assert.equal(card.version, 1);
    assert.ok(card.bpm.min <= card.bpm.default && card.bpm.default <= card.bpm.max);
    assert.ok(card.swing.min <= card.swing.default && card.swing.default <= card.swing.max);
    assert.ok(card.sources.length > 0 && card.sources.every((source) => source.startsWith("https://")));
    assert.equal(new Set(card.arrangements.map((variant) => variant.id)).size, card.arrangements.length);
    assert.deepEqual(card.arrangement, card.arrangements.find((variant) => variant.id === card.defaultArrangement)?.blocks);
    for (const variant of card.arrangements) {
      assert.ok(variant.basis.length > 0 && variant.basis.every((basis) => basis.trim().length > 0));
      assert.ok(variant.blocks.length > 0 && variant.blocks.every((block) => Number.isSafeInteger(block.bars) && block.bars > 0));
    }
    assert.deepEqual(card.lintRules, Array.from({ length: card.lintRules.length }, (_, i) => `${card.id}/${i + 1}`));
    const timeline = buildTimeline(validateSong(card.starterSong));
    assert.ok(timeline.events.length > 0, card.id);
    const report = lintSong(card.starterSong);
    assert.equal(report.errors, 0, `${card.id}: ${JSON.stringify(report.results)}`);
  }
});

test("list and get return isolated deep clones", () => {
  const listed = listRecipes();
  listed[0]!.title = "changed";
  listed[0]!.starterSong.tracks[0]!.pattern = "~";
  listed[0]!.sources.push("changed");
  const direct = getRecipe("boom_bap");
  direct.palette[0]!.instrument = "changed";
  direct.arrangements[0]!.blocks[0]!.bars = 999;
  direct.arrangements[0]!.basis.push("changed");
  const fresh = getRecipe("boom_bap");
  assert.equal(fresh.title, "Boom Bap");
  assert.notEqual(fresh.starterSong.tracks[0]!.pattern, "~");
  assert.equal(fresh.sources.includes("changed"), false);
  assert.equal(fresh.palette[0]!.instrument, "drums");
  assert.notEqual(fresh.arrangements[0]!.blocks[0]!.bars, 999);
  assert.equal(fresh.arrangements[0]!.basis.includes("changed"), false);
});

test("recipe palettes and starter tracks avoid saw-based configurations", () => {
  const alwaysSaw = new Set(["strings", "brass", "choir", "supersaw", "pad"]);
  for (const card of listRecipes()) {
    const entries = [...card.palette, ...card.starterSong.tracks];
    for (const entry of entries) {
      assert.equal(alwaysSaw.has(entry.instrument), false, `${card.id}: ${entry.instrument}`);
      if (entry.instrument === "bass" || entry.instrument === "lead")
        assert.notEqual(entry.params?.["wave"] ?? (entry.instrument === "bass" ? 0 : 1), 0,
          `${card.id}: ${entry.instrument} uses saw`);
    }
  }
});

test("unknown recipe has input-class not-found error", () => {
  assert.throws(() => getRecipe("unknown"),
    (error: unknown) => error instanceof Music2Error && error.code === "E_NOT_FOUND" && error.exit === 2);
});
