import assert from "node:assert/strict";
import { test } from "node:test";
import { validateSong, buildTimeline } from "../../song/index.ts";
import { renderSong, VOICES } from "../../render/index.ts";
import { house } from "./house.ts";

const expectedRoles = ["kick", "snare", "hats", "bass", "melody"];
const expectedPatterns = ["bd ~ ~ ~ bd ~ ~ ~ bd ~ ~ ~ bd ~ ~ ~", "~ ~ ~ ~ cp ~ ~ ~ ~ ~ ~ ~ cp ~ ~ ~", "~ ~ oh ~ ~ ~ oh ~ ~ ~ oh ~ ~ ~ oh ~", "a1 ~ ~ ~ ~ ~ e2 ~ a1 ~ ~ ~ ~ ~ e2 ~", "a4 ~ c5 ~ e5 ~ ~ ~ g5 ~ e5 ~ c5 ~ ~ ~"];
const expectedArrangement = [{ role: "intro", bars: 16 }, { role: "groove", bars: 16 }, { role: "hook", bars: 16 }, { role: "breakdown", bars: 8 }, { role: "groove", bars: 16 }, { role: "outro", bars: 16 }];

test("house card matches the starter contract", () => {
  const card = house;
  assert.equal(card.id, "house");
  assert.equal(card.bpm.default, 124);
  assert.equal(card.swing.default, 0.5);
  assert.equal(card.starterSong.bpm, 124);
  assert.equal(card.starterSong.swing, 0.5);
  assert.equal(card.starterSong.key, "A minor");
  assert.equal(card.starterSong.title, `${card.title} Starter`);
  assert.equal(card.starterSong.seed, 1);
  assert.equal(card.starterSong.sampleRate, 44100);
  assert.equal(card.starterSong.tailSeconds, 2);
  assert.deepEqual(card.roles, expectedRoles);
  assert.deepEqual(card.starterSong.tracks.map((track) => track.id), expectedRoles);
  assert.deepEqual(card.starterSong.tracks.map((track) => track.pattern), expectedPatterns);
  assert.deepEqual(card.arrangement, expectedArrangement);
  assert.deepEqual(card.starterSong.arrangement,
    expectedArrangement.map((block) => ({ section: block.role, repeats: 1 })));
  assert.deepEqual(card.starterSong.master, { ceilingDb: -1, targetLufs: -14 });
  for (const section of card.starterSong.sections) {
    const expectedMute = section.role === "intro" || section.role === "outro" ?
      { bass: null, melody: null } :
      section.role === "breakdown" || section.role === "build" ? { melody: null } : {};
    assert.deepEqual(section.patterns, expectedMute);
  }
  assert.deepEqual(card.lintRules,
    Array.from({ length: 7 }, (_, index) => `house/${index + 1}`));
  assert.equal(card.palette.length, 5);
  for (const entry of card.palette) {
    const voice = VOICES[entry.instrument];
    assert.ok(voice, `missing instrument ${entry.instrument}`);
    for (const [name, value] of Object.entries(entry.params)) {
      const rule = voice.params[name];
      assert.ok(rule, `missing parameter ${entry.instrument}.${name}`);
      assert.ok(value >= rule.min && value <= rule.max);
    }
    const track = card.starterSong.tracks.find((candidate) => candidate.id === entry.role);
    assert.equal(track?.instrument, entry.instrument);
    assert.deepEqual(track.params, entry.params);
  }
});

test("house starter validates and all tracks produce events", () => {
  const song = validateSong(house.starterSong);
  const timeline = buildTimeline(song);
  assert.equal(timeline.bars, 88);
  for (const role of expectedRoles) {
    assert.ok(timeline.events.some((event) => event.track === role), `${role} has no onsets`);
  }
});

test("house starter renders finite audible stereo over two bars", async () => {
  const song = validateSong(house.starterSong);
  const result = await renderSong(song, "starter.song.json", { bars: { start: 16, end: 18 }, stems: true });
  assert.equal(result.bars, 2);
  assert.ok(result.events > 0);
  assert.deepEqual(result.stems.map((stem) => stem.trackId), expectedRoles);
  for (const stem of result.stems) {
    assert.ok(stem.audio.left.some((sample) => sample !== 0), `${stem.trackId} is silent`);
  }
  assert.equal(result.audio.left.length, result.audio.right.length);
  assert.ok(result.audio.left.every(Number.isFinite));
  assert.ok(result.audio.right.every(Number.isFinite));
  assert.ok(result.audio.left.some((sample) => sample !== 0));
  assert.ok(result.audio.right.some((sample) => sample !== 0));
  assert.ok(Number.isFinite(result.peakDbfs));
});
