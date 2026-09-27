import { test } from "node:test";
import assert from "node:assert/strict";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { buildTimeline, validateSong } from "../../song/index.ts";
import { renderSong } from "../../render/render.tool.ts";
import { VOICES } from "../../render/voices/registry.tool.ts";
import { trap } from "./trap.ts";

const card = trap;

test("trap card palette and lint IDs match the contract", () => {
  assert.deepEqual(card.lintRules, ["trap/1", "trap/2", "trap/3", "trap/4", "trap/5", "trap/6", "trap/7"]);
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

test("trap starter validates and every track has onsets", () => {
  const song = validateSong(card.starterSong);
  const timeline = buildTimeline(song);
  assert.equal(song.tracks.length, 5);
  assert.equal(timeline.bars, card.arrangement.reduce((sum, block) => sum + block.bars, 0));
  for (const track of song.tracks) {
    assert.ok(timeline.events.some((event) => event.track === track.id), `${track.id} has no onsets`);
  }
});

test("trap starter renders finite, non-silent audio for two bars", async () => {
  const song = validateSong(card.starterSong);
  const result = await renderSong(song, join(tmpdir(), "trap-starter.song.json"), { bars: { start: 0, end: 2 } });
  assert.equal(result.bars, 2);
  assert.ok(result.events > 0);
  assert.ok(result.audio.left.length > 0);
  for (const channel of [result.audio.left, result.audio.right]) {
    assert.ok(channel.every(Number.isFinite));
    assert.ok(channel.some((sample) => sample !== 0));
  }
});
