import { test } from "node:test";
import assert from "node:assert/strict";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { buildTimeline, validateSong } from "../../song/index.ts";
import { renderSong } from "../../render/render.tool.ts";
import { VOICES } from "../../render/voices/registry.tool.ts";
import { boomBap } from "./boom_bap.ts";

const card = boomBap;

test("boom_bap card palette and lint IDs match the contract", () => {
  assert.deepEqual(card.lintRules, ["boom_bap/1", "boom_bap/2", "boom_bap/3", "boom_bap/4", "boom_bap/5", "boom_bap/6", "boom_bap/7"]);
  assert.deepEqual(card.palette.map((entry) => entry.role), ["kick", "snare", "hats", "bass", "melody"]);
  for (const entry of card.palette) {
    const voice = VOICES[entry.instrument];
    assert.ok(voice, `unknown voice ${entry.instrument}`);
    for (const [name, value] of Object.entries(entry.params)) {
      const rule = voice.params[name];
      assert.ok(rule, `unknown ${entry.instrument} parameter ${name}`);
      assert.ok(value >= rule.min && value <= rule.max);
    }
  }
});

test("boom_bap starter validates and every track has onsets", () => {
  const song = validateSong(card.starterSong);
  const timeline = buildTimeline(song);
  assert.equal(song.tracks.length, 5);
  assert.equal(timeline.bars, card.arrangement.reduce((sum, block) => sum + block.bars, 0));
  for (const track of song.tracks) {
    assert.ok(timeline.events.some((event) => event.track === track.id), `${track.id} has no onsets`);
  }
});

test("boom_bap starter renders finite, non-silent audio for two bars", async () => {
  const song = validateSong(card.starterSong);
  const result = await renderSong(song, join(tmpdir(), "boom_bap-starter.song.json"), { bars: { start: 0, end: 2 } });
  assert.equal(result.bars, 2);
  assert.ok(result.events > 0);
  assert.ok(result.audio.left.length > 0);
  for (const channel of [result.audio.left, result.audio.right]) {
    assert.ok(channel.every(Number.isFinite));
    assert.ok(channel.some((sample) => sample !== 0));
  }
});

test("boom_bap named arrangements retain default parity and evidence", () => {
  assert.equal(card.defaultArrangement, "verse_led");
  assert.deepEqual(card.arrangement, card.arrangements.find((variant) => variant.id === card.defaultArrangement)?.blocks);
  assert.deepEqual(Object.fromEntries(card.arrangements.map((variant) => [variant.id, variant.blocks.reduce((sum, block) => sum + block.bars, 0)])), {"verse_led": 88, "hook_first": 70});
  for (const variant of card.arrangements) assert.ok(variant.basis.length > 0 && variant.basis.every((id) => /^A\.[0-7]\//.test(id)));
  const sections = new Map(card.starterSong.sections.map((section) => [section.id, section]));
  let bar = 1;
  let firstHook = 0;
  for (const entry of card.starterSong.arrangement) {
    const section = sections.get(entry.section);
    assert.ok(section, entry.section);
    if (section?.role === "hook" && firstHook === 0) firstHook = bar;
    bar += (section?.bars ?? 0) * (entry.repeats ?? 1);
  }
  assert.equal(bar - 1, 88);
  assert.equal(firstHook, 29);
});
