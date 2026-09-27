import assert from "node:assert/strict";
import { test } from "node:test";
import { validateSong, buildTimeline } from "../../song/index.ts";
import { renderSong, VOICES } from "../../render/index.ts";
import { techno } from "./techno.ts";

const expectedRoles = ["kick", "snare", "hats", "bass", "melody"];
const expectedPatterns = ["bd ~ ~ ~ bd ~ ~ ~ bd ~ ~ ~ bd ~ ~ ~", "~ ~ ~ ~ cp ~ ~ ~ ~ ~ ~ ~ cp ~ ~ ~", "~ ~ oh ~ ~ ~ oh ~ ~ ~ oh ~ ~ ~ oh ~", "e2 ~ ~ ~ ~ ~ ~ ~ e2 ~ ~ ~ ~ ~ ~ ~", "e4 ~ ~ ~ g4 ~ ~ ~ e4 ~ ~ ~ b4 ~ ~ ~"];
const expectedArrangement = [{ role: "intro", bars: 16 }, { role: "build", bars: 16 }, { role: "groove", bars: 32 }, { role: "breakdown", bars: 16 }, { role: "groove", bars: 32 }, { role: "outro", bars: 16 }];

test("techno card matches the starter contract", () => {
  const card = techno;
  assert.equal(card.id, "techno");
  assert.equal(card.bpm.default, 130);
  assert.equal(card.swing.default, 0.5);
  assert.equal(card.starterSong.bpm, 130);
  assert.equal(card.starterSong.swing, 0.5);
  assert.equal(card.starterSong.key, "E minor");
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
    Array.from({ length: 6 }, (_, index) => `techno/${index + 1}`));
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

test("techno starter validates and all tracks produce events", () => {
  const song = validateSong(techno.starterSong);
  const timeline = buildTimeline(song);
  assert.equal(timeline.bars, 128);
  for (const role of expectedRoles) {
    assert.ok(timeline.events.some((event) => event.track === role), `${role} has no onsets`);
  }
});

test("techno starter renders finite audible stereo over two bars", async () => {
  const song = validateSong(techno.starterSong);
  const result = await renderSong(song, "starter.song.json", { bars: { start: 32, end: 34 }, stems: true });
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
