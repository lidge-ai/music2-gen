import { test } from "node:test";
import assert from "node:assert/strict";
import { newSong } from "../recipes/new.tool.ts";
import { buildTimeline, validateSong } from "../song/index.ts";
import { Music2Error } from "../shared/index.ts";
import { renderSong } from "../render/render.tool.ts";
import { applyUseCase, recommendedArrangement } from "./usecase.tool.ts";

test("short_30 searches exact renderer frames and moves hook to bar one", () => {
  const source = newSong({ genre: "drill_uk", seed: 7 });
  const song = applyUseCase(source, "short_30");
  assert.equal(song.bpm, 144);
  assert.equal(song.tailSeconds, 0);
  assert.equal(song.useCase, "short_30");
  assert.equal(song.master?.targetLufs, -14);
  assert.equal(song.arrangement[0]?.section, "hook");
  assert.equal(buildTimeline(validateSong(song)).bars, 18);
  assert.equal(Math.ceil((18 * 4 * 60 / song.bpm + (song.tailSeconds ?? 0)) * 44100), 1323000);
  assert.deepEqual(song, applyUseCase(source, "short_30"));
  assert.equal(source.useCase, undefined);
});

test("short_30 actually renders 1,323,000 frames", async () => {
  const song = validateSong(applyUseCase(newSong({ genre: "drill_uk", seed: 1 }), "short_30"));
  const result = await renderSong(song, "short-30.song.json");
  assert.equal(result.audio.left.length, 1323000);
  assert.equal(result.audio.right.length, 1323000);
});

test("explicit BPM and impossible durations reject as input", () => {
  assert.throws(() => applyUseCase(newSong({ genre: "drill_uk", bpm: 140 }), "short_30", { lockedBpm: 140 }),
    (error: unknown) => error instanceof Music2Error && error.exit === 2 && error.message.includes("tails 0/0.5/1"));
  assert.throws(() => applyUseCase(newSong({ genre: "drill_uk" }), "short_30", { seconds: 29 }),
    (error: unknown) => error instanceof Music2Error && error.exit === 2);
  assert.throws(() => applyUseCase(newSong({ genre: "drill_uk" }), "vo_bed", { seconds: 1 / 44101 }),
    (error: unknown) => error instanceof Music2Error && error.exit === 2);
});

test("15 and 60 second shorts also meet the exact frame equation", () => {
  for (const [id, seconds] of [["short_15", 15], ["short_60", 60]] as const) {
    const song = applyUseCase(newSong({ genre: "drill_uk" }), id);
    const bars = buildTimeline(validateSong(song)).bars;
    assert.equal(Math.ceil((bars * 4 * 60 / song.bpm + (song.tailSeconds ?? 0)) * (song.sampleRate ?? 44100)),
      seconds * (song.sampleRate ?? 44100));
    assert.equal(song.arrangement[0]?.section.startsWith("hook"), true);
  }
});

test("bed, loop and type beat apply source structure and mix choices", () => {
  const bed = applyUseCase(newSong({ genre: "drill_uk" }), "vo_bed");
  assert.equal(bed.master?.targetLufs, -22);
  assert.equal(buildTimeline(validateSong(bed)).bars, 16);
  assert.ok(bed.sections.every((section) => section.patterns?.melody === null));
  const loop = applyUseCase(newSong({ genre: "lofi_hiphop" }), "game_loop");
  assert.equal(loop.loop, true);
  assert.equal(loop.arrangement.length, 1);
  assert.equal(loop.sections[0]?.role, "groove");
  assert.equal(buildTimeline(validateSong(loop)).bars, 16);
  const beat = applyUseCase(newSong({ genre: "trap" }), "type_beat");
  assert.equal(beat.master?.targetLufs, -12);
  assert.equal(beat.master?.ceilingDb, -2);
  assert.equal(buildTimeline(validateSong(beat)).bars, 80);
  const intro = beat.sections.find((section) => section.role === "intro");
  assert.equal(intro?.patterns?.kick, null);
  assert.equal(intro?.patterns?.bass, null);
  assert.equal(recommendedArrangement("short_30", "drill_uk"), "default");
  assert.equal(recommendedArrangement("study_lofi", "lofi_hiphop"), "vignette");
  const study = applyUseCase(newSong({ genre: "lofi_hiphop", arrangement: "vignette" }), "study_lofi");
  const studyBars = buildTimeline(validateSong(study)).bars;
  assert.ok(studyBars >= 28 && studyBars <= 60);
  assert.ok(study.arrangement.length >= 4);
  for (let index = 1; index < study.arrangement.length; index++) {
    const previous = study.sections.find((section) => section.id === study.arrangement[index - 1]?.section);
    const current = study.sections.find((section) => section.id === study.arrangement[index]?.section);
    assert.notEqual(previous?.patterns?.melody, current?.patterns?.melody);
  }
});
