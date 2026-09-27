import { test } from "node:test";
import assert from "node:assert/strict";
import { resolve } from "node:path";
import { buildTimeline, loadSong, validateSong } from "../song/index.ts";
import { Music2Error } from "../shared/index.ts";
import { renderSong } from "./render.tool.ts";

const drillPath = resolve("examples/drill-140.song.json");

test("drill duration and crop preserve full-timeline event addressing", async () => {
  const song = await loadSong(drillPath);
  const timeline = buildTimeline(song);
  const full = await renderSong(song, drillPath, { stems: true });
  assert.equal(full.bars, 16);
  assert.equal(full.audio.left.length, Math.ceil((16 * 4 * 60 / 140 + 2) * 44100));
  assert.ok(full.events > 0);
  const crop = await renderSong(song, drillPath, { bars: { start: 4, end: 12 }, stems: true });
  assert.equal(crop.bars, 8);
  assert.equal(crop.audio.left.length, Math.ceil((8 * 4 * 60 / 140 + 2) * 44100));
  const firstHook = timeline.events.find((event) => event.bar === 4 && event.track === "kick")!;
  assert.ok(Math.abs(firstHook.time - 4 * timeline.secondsPerBar) < 1e-8);
  const hookFrame = Math.round(firstHook.time * song.sampleRate);
  assert.deepEqual(crop.stems[0]!.audio.left.slice(0, 10000),
    full.stems[0]!.audio.left.slice(hookFrame, hookFrame + 10000));
  assert.ok(crop.events < full.events);
  assert.ok(crop.audio.left.some((sample) => sample !== 0));
});

test("same drill renders identical PCM; elapsed time is reported", async () => {
  const song = await loadSong(drillPath);
  const start = performance.now();
  const first = await renderSong(song, drillPath);
  const elapsed = performance.now() - start;
  const second = await renderSong(song, drillPath);
  assert.deepEqual(first.audio.left, second.audio.left);
  assert.deepEqual(first.audio.right, second.audio.right);
  assert.ok(first.peakDbfs <= song.master.ceilingDb);
  assert.ok(first.truePeakDbtp <= song.master.ceilingDb + .1);
  console.log(`drill render ${elapsed.toFixed(1)} ms`);
});

test("mono overlap is single-valued while poly chord sums", async () => {
  const song = validateSong({ version: 1, bpm: 120, tailSeconds: 0,
    tracks: [
      { id: "sub", kind: "notes", instrument: "808", mono: true, pattern: "c2 g2 ~ ~" },
      { id: "bell", kind: "notes", instrument: "bell", pattern: "[c5,e5] ~ ~ ~" },
    ], sections: [{ id: "one", bars: 1 }], arrangement: [{ section: "one" }] });
  const result = await renderSong(song, "fixture.song.json", { stems: true });
  assert.equal(result.events, 4);
  assert.ok(result.stems[0]!.audio.left.some((sample) => sample !== 0));
  assert.ok(result.stems[1]!.audio.left.some((sample) => sample !== 0));
});

test("simultaneous mono notes retain the final Timeline event", async () => {
  const make = (pattern: string) => validateSong({ version: 1, bpm: 120, tailSeconds: 0,
    tracks: [{ id: "sub", kind: "notes", instrument: "808", pattern }],
    sections: [{ id: "one", bars: 1 }], arrangement: [{ section: "one" }] });
  const layered = make("[c2,g2] ~ ~ ~");
  const single = make("g2 ~ ~ ~");
  const both = await renderSong(layered, "fixture.song.json", { stems: true });
  const last = await renderSong(single, "fixture.song.json", { stems: true });
  assert.deepEqual(both.stems[0]!.audio.left, last.stems[0]!.audio.left);
});

test("targetLufs no longer blocks render validation; bad drum names point to track index", async () => {
  const song = validateSong({ version: 1, bpm: 120, master: { targetLufs: -14 },
    tracks: [{ id: "drum", kind: "drums", instrument: "drums", pattern: "cowbell" }],
    sections: [{ id: "one", bars: 1 }], arrangement: [{ section: "one" }] });
  await assert.rejects(renderSong(song, "fixture.song.json"),
    (error: unknown) => error instanceof Music2Error && error.code === "E_SCHEMA" &&
      (error.details?.["issues"] as { path: string }[])[0]?.path === "tracks[0].pattern");
});

test("optional 180-second six-track benchmark", { skip: process.env.MUSIC2_BENCH !== "1" }, async () => {
  const song = await loadSong(drillPath);
  song.arrangement = [{ section: "hook", repeats: 13 }];
  const start = performance.now();
  const result = await renderSong(song, drillPath);
  const elapsed = performance.now() - start;
  console.log(`180-second six-track render ${elapsed.toFixed(1)} ms`);
  assert.ok(result.durationSeconds >= 180);
  assert.ok(elapsed < 20000, `render took ${elapsed.toFixed(1)} ms`);
});
