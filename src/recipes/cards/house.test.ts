import assert from "node:assert/strict";
import { test } from "node:test";
import { validateSong, buildTimeline } from "../../song/index.ts";
import { renderSong, VOICES } from "../../render/index.ts";
import { house } from "./house.ts";

const expectedRoles = ["kick", "snare", "hats", "bass", "melody"];
const expectedPatterns = ["bd ~ ~ ~ bd ~ ~ ~ bd ~ ~ ~ bd ~ ~ ~", "~ ~ ~ ~ cp ~ ~ ~ ~ ~ ~ ~ cp ~ ~ ~", "~ ~ oh ~ ~ ~ oh ~ ~ ~ oh ~ ~ ~ oh ~", "a1 ~ ~ ~ ~ ~ e2 ~ a1 ~ ~ ~ ~ ~ e2 ~", "a4 ~ c5 ~ e5 ~ ~ ~ g5 ~ e5 ~ c5 ~ ~ ~"];
const expectedArrangement = [{ role: "intro", bars: 8 }, { role: "groove", bars: 16 }, { role: "breakdown", bars: 8 }, { role: "build", bars: 8 }, { role: "hook", bars: 32 }, { role: "breakdown", bars: 8 }, { role: "build", bars: 8 }, { role: "hook", bars: 32 }, { role: "outro", bars: 8 }];

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
    expectedArrangement.map((block) => ({ section: card.starterSong.sections.find((section) => section.role === block.role && section.bars === block.bars)?.id, repeats: 1 })));
  assert.deepEqual(card.starterSong.master, { ceilingDb: -1, targetLufs: -14 });
  for (const section of card.starterSong.sections) {
    if (section.role === "breakdown") assert.deepEqual(section.patterns, { melody: null, kick: null, bass: null, snare: null });
    if (section.role === "build") assert.equal(section.patterns?.bass, null);
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
  assert.equal(timeline.bars, 128);
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

test("house named arrangements retain default parity and evidence", () => {
  const card = house;
  assert.equal(card.defaultArrangement, "radio");
  assert.deepEqual(card.arrangement, card.arrangements.find((variant) => variant.id === card.defaultArrangement)?.blocks);
  assert.deepEqual(Object.fromEntries(card.arrangements.map((variant) => [variant.id, variant.blocks.reduce((sum, block) => sum + block.bars, 0)])), {"radio": 128, "extended": 224});
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
  assert.equal(bar - 1, 128);
  assert.equal(firstHook, 41);
});

test("house breakdown removes rhythm layers before the drop", () => {
  const breakdown = house.starterSong.sections.find((section) => section.role === "breakdown");
  const hook = house.starterSong.sections.find((section) => section.role === "hook");
  for (const trackId of ["kick", "snare", "bass"]) {
    assert.equal(breakdown?.patterns?.[trackId], null);
    assert.notEqual(hook?.patterns?.[trackId], null);
  }
});
