import assert from "node:assert/strict";
import { test } from "node:test";
import { validateSong, buildTimeline } from "../../song/index.ts";
import { renderSong, VOICES } from "../../render/index.ts";
import { techno } from "./techno.ts";
import { newSong } from "../new.tool.ts";

const expectedRoles = ["kick", "snare", "hats", "bass", "melody"];
const expectedPatterns = ["bd ~ ~ ~ bd ~ ~ ~ bd ~ ~ ~ bd ~ ~ ~", "~ ~ ~ ~ cp ~ ~ ~ ~ ~ ~ ~ cp ~ ~ ~", "~ ~ oh ~ ~ ~ oh ~ ~ ~ oh ~ ~ ~ oh ~", "e2 ~ ~ ~ ~ ~ ~ ~ e2 ~ ~ ~ ~ ~ ~ ~", "e4 ~ ~ ~ g4 ~ ~ ~ e4 ~ ~ ~ b4 ~ ~ ~"];
const expectedArrangement = [{ role: "intro", bars: 8 }, { role: "build", bars: 8 }, { role: "groove", bars: 16 }, { role: "breakdown", bars: 2 }, { role: "groove", bars: 32 }, { role: "bridge", bars: 4 }, { role: "groove", bars: 32 }, { role: "breakdown", bars: 4 }, { role: "groove", bars: 32 }, { role: "outro", bars: 16 }];

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
    expectedArrangement.map((block) => ({ section: card.starterSong.sections.find((section) => section.role === block.role && section.bars === block.bars)?.id, repeats: 1 })));
  assert.deepEqual(card.starterSong.master, { ceilingDb: -1, targetLufs: -14 });
  const intro = card.starterSong.sections.find((section) => section.role === "intro");
  assert.deepEqual(intro?.patterns, { bass: null, snare: null, hats: null });
  for (const section of card.starterSong.sections.filter((section) => section.role === "breakdown" || section.role === "bridge")) {
    assert.equal(section.patterns?.bass, null);
    assert.equal(section.patterns?.hats, null);
    assert.notEqual(section.patterns?.kick, null);
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
  assert.equal(timeline.bars, 154);
  for (const role of expectedRoles) {
    assert.ok(timeline.events.some((event) => event.track === role), `${role} has no onsets`);
  }
});

test("techno starter renders finite audible stereo over two bars", async () => {
  const song = validateSong(techno.starterSong);
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

test("techno named arrangements retain default parity and evidence", () => {
  const card = techno;
  assert.equal(card.defaultArrangement, "detroit_linear");
  assert.deepEqual(card.arrangement, card.arrangements.find((variant) => variant.id === card.defaultArrangement)?.blocks);
  assert.deepEqual(Object.fromEntries(card.arrangements.map((variant) => [variant.id, variant.blocks.reduce((sum, block) => sum + block.bars, 0)])), {"detroit_linear": 154, "plateau": 192});
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
  assert.equal(bar - 1, 154);
  assert.equal(firstHook, 0);
});

test("Detroit form enters with kick and motif, then adds hats and clap", () => {
  const timeline = buildTimeline(validateSong(newSong({ genre: "techno" })));
  const tracksAt = (bar: number) => new Set(timeline.events.filter((event) => event.bar === bar - 1).map((event) => event.track));
  assert.ok(tracksAt(1).has("kick") && tracksAt(1).has("melody"));
  assert.equal(tracksAt(1).has("hats"), false);
  assert.ok(tracksAt(9).has("hats"));
  assert.equal(tracksAt(9).has("snare"), false);
  assert.ok(tracksAt(17).has("snare"));
  assert.equal(tracksAt(35).has("melody"), false);
  assert.ok(tracksAt(35).has("bass"));
  assert.equal(timeline.placements.find((placement) => placement.role === "breakdown")?.bars, 2);
  assert.ok(timeline.placements.some((placement) => placement.role === "bridge" && placement.bars === 4));
});
