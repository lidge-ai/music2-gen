import { test } from "node:test";
import assert from "node:assert/strict";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { Fraction } from "../../shared/index.ts";
import { onsets, parseMini } from "../../pattern/index.ts";
import { buildTimeline, validateSong } from "../../song/index.ts";
import { renderSong } from "../../render/render.tool.ts";
import { VOICES } from "../../render/voices/registry.tool.ts";
import { drillUk } from "./drill_uk.ts";

const card = drillUk;

test("drill_uk card palette and lint IDs match the contract", () => {
  assert.deepEqual(card.lintRules, ["drill_uk/1", "drill_uk/2", "drill_uk/3", "drill_uk/4", "drill_uk/5", "drill_uk/6", "drill_uk/7"]);
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

test("drill_uk starter validates and every track has onsets", () => {
  const song = validateSong(card.starterSong);
  const timeline = buildTimeline(song);
  assert.equal(song.tracks.length, 5);
  assert.equal(timeline.bars, card.arrangement.reduce((sum, block) => sum + block.bars, 0));
  for (const track of song.tracks) {
    assert.ok(timeline.events.some((event) => event.track === track.id), `${track.id} has no onsets`);
  }
});

test("drill_uk starter renders finite, non-silent audio for two bars", async () => {
  const song = validateSong(card.starterSong);
  const result = await renderSong(song, join(tmpdir(), "drill_uk-starter.song.json"), { bars: { start: 0, end: 2 } });
  assert.equal(result.bars, 2);
  assert.ok(result.events > 0);
  assert.ok(result.audio.left.length > 0);
  for (const channel of [result.audio.left, result.audio.right]) {
    assert.ok(channel.every(Number.isFinite));
    assert.ok(channel.some((sample) => sample !== 0));
  }
});

test("drill_uk named arrangements retain default parity and evidence", () => {
  assert.equal(card.defaultArrangement, "default");
  assert.deepEqual(card.arrangement, card.arrangements.find((variant) => variant.id === card.defaultArrangement)?.blocks);
  assert.deepEqual(Object.fromEntries(card.arrangements.map((variant) => [variant.id, variant.blocks.reduce((sum, block) => sum + block.bars, 0)])), {"default": 64, "short_single": 40, "posse": 112});
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
  assert.equal(bar - 1, 64);
  assert.equal(firstHook, 5);
});

test("UK drill alternates snare bars and accents straight tresillo hats", () => {
  assert.equal(card.bpm.max, 146);
  assert.equal(card.swing.default, 0.5);
  const snare = parseMini(card.starterSong.tracks.find((track) => track.id === "snare")!.pattern!);
  const hats = parseMini(card.starterSong.tracks.find((track) => track.id === "hats")!.pattern!);
  const steps = (bar: number, pattern: ReturnType<typeof parseMini>) =>
    onsets(pattern, Fraction.of(bar), Fraction.of(bar + 1), { seed: 7, salt: "test" })
      .map((hap) => Math.floor((hap.whole.begin.valueOf() - bar) * 16) + 1);
  assert.deepEqual(steps(0, snare), [9]);
  assert.deepEqual(steps(1, snare), [13]);
  assert.deepEqual([...new Set(steps(0, hats))], [1, 4, 7, 9, 12, 15]);
  assert.equal(steps(0, hats).filter((step) => step === 15).length, 2);
  assert.deepEqual(steps(0, snare), steps(0, snare));
});
