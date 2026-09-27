import assert from "node:assert/strict";
import { test } from "node:test";
import { buildTimeline, loadSong } from "../song/index.ts";
import type { TempoEstimate } from "./analysis.schema.ts";
import { makeBeatMap } from "./beats.tool.ts";

const contrary: TempoEstimate = { bpm: 90, confidence: .8, candidates: [],
  beatsSeconds: [0.15, .82, 1.49, 2.16, 99], downbeatsSeconds: [.15, 2.82, 99] };

test("audio beat map has numeric provisional 4/4 meter and bounded times", () => {
  const map = makeBeatMap(contrary, 3);
  assert.ok(map);
  assert.equal(map.source, "audio");
  assert.equal(map.bpm, 90);
  assert.equal(typeof map.meter, "number");
  assert.equal(map.meter, 4);
  assert.deepEqual(map.timeSignature, { numerator: 4, denominator: 4 });
  assert.equal(map.offsetFrames, 0);
  assert.ok(Math.abs(map.confidence - .56) < 1e-12);
  assert.deepEqual(map.beatsSeconds, [0.15, .82, 1.49, 2.16]);
  assert.deepEqual(map.sections, []);
  const vid2Projection = { bpm: map.bpm, offsetFrames: map.offsetFrames, meter: map.meter };
  assert.equal(60 / vid2Projection.bpm * vid2Projection.meter, 60 / 90 * 4);
});

test("silence has no beat map", () => {
  assert.equal(makeBeatMap({ bpm: null, confidence: 0, candidates: [], beatsSeconds: [], downbeatsSeconds: [] }, 4), null);
});

test("song meter, origin and musical end override contrary audio estimate", async () => {
  const song = await loadSong("examples/drill-140.song.json");
  const timeline = buildTimeline(song);
  const map = makeBeatMap(contrary, timeline.durationSeconds + song.tailSeconds, song, timeline);
  assert.ok(map);
  assert.equal(map.source, "song"); assert.equal(map.confidence, 1);
  assert.equal(map.bpm, song.bpm); assert.equal(map.meter, song.meter.numerator);
  assert.equal(typeof map.meter, "number");
  assert.deepEqual(map.timeSignature, song.meter);
  assert.equal(map.beatsSeconds[0], 0);
  assert.ok(map.beatsSeconds.every((time) => time < timeline.durationSeconds));
  assert.equal(map.sections.at(-1)?.endSeconds, timeline.durationSeconds);
  const projection = { bpm: map.bpm, offsetFrames: map.offsetFrames, meter: map.meter };
  assert.ok(Math.abs(map.downbeatsSeconds[1]! - 60 / projection.bpm * projection.meter) < 1e-9);
});

test("repeated arrangement entries have unique placement occurrence IDs", async () => {
  const song = await loadSong("examples/drill-140.song.json");
  song.arrangement = [{ section: song.sections[0]!.id, repeats: 1 },
    { section: song.sections[0]!.id, repeats: 2 }];
  const map = makeBeatMap(contrary, 99, song);
  assert.ok(map);
  assert.deepEqual(map.sections.map((section) => section.id),
    [`${song.sections[0]!.id}#0`, `${song.sections[0]!.id}#1`, `${song.sections[0]!.id}#2`]);
  assert.ok(map.sections.every((section) => section.endSeconds <= map.beatsSeconds.at(-1)! + 60 / map.bpm));
});
