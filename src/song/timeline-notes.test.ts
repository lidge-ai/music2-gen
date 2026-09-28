import assert from "node:assert/strict";
import test from "node:test";
import { Music2Error } from "../shared/index.ts";
import { validateSong } from "./song.schema.ts";
import { buildTimeline } from "./timeline.tool.ts";

const source = () => ({ version: 1, bpm: 120, tracks: [
  { id: "lead", kind: "notes", instrument: "piano", transpose: 12, gate: 0.05, notes: [
    { start: 4, length: 0.5, pitch: 62, velocity: 0.7 },
    { start: 0, length: 1, pitch: 60, velocity: 0.2 },
    { start: 0, length: 0.5, pitch: 60, velocity: 0.8 },
  ] },
  { id: "kit", kind: "drums", instrument: "drums", notes: [{ start: 0, length: 0.25, sample: "bd:1" }] },
], sections: [{ id: "a", bars: 2 }], arrangement: [{ section: "a" }] });

void test("list events use absolute bars, exact slots, normalized atoms and stable ties", () => {
  const events = buildTimeline(validateSong(source())).events;
  assert.deepEqual(events.map((event) => [event.track, event.time]),
    [["lead", 0], ["lead", 0], ["kit", 0], ["lead", 2]]);
  assert.deepEqual(events.filter((event) => event.track === "lead").map((event) => event.velocity), [0.2, 0.8, 0.7]);
  assert.deepEqual(events.filter((event) => event.track === "lead").map((event) => event.midi), [72, 72, 74]);
  assert.equal(events[0]?.duration, 0.5);
  assert.equal(events[0]?.slot, 0.5);
  assert.equal(events[0]?.cycleBegin, "0");
  assert.equal(events[3]?.cycleBegin, "1");
  assert.equal(events[3]?.bar, 1);
  assert.deepEqual(events[2]?.sample, { name: "bd", index: 1 });
  assert.equal(events[2]?.atom.raw, "bd:1");
  assert.equal(events[0]?.atom.raw, "72");
  assert.equal(events[0]?.atom.offset, -1);
});

void test("resolved pitch ordering is numeric and same-pitch order follows input", () => {
  const raw = source(); raw.tracks[0]!.notes = [
    { start: 0, length: 1, pitch: 100, velocity: 0.1 },
    { start: 0, length: 1, pitch: 60, velocity: 0.2 },
    { start: 0, length: 1, pitch: 60, velocity: 0.3 },
  ];
  const resolved = validateSong(raw);
  assert.deepEqual(resolved.tracks[0]?.notes?.map((note) => note.velocity), [0.2, 0.3, 0.1]);
  assert.deepEqual(buildTimeline(resolved).events.filter((event) => event.track === "lead").map((event) => event.velocity), [0.2, 0.3, 0.1]);
});

void test("list and pattern events share the per-track 20000 cap", () => {
  const song = validateSong(source());
  song.tracks[0]!.notes = Array.from({ length: 20001 }, (_, inputIndex) =>
    ({ tick: 0, lengthTicks: 1, pitch: 60, sample: null, velocity: 0.8, inputIndex }));
  assert.throws(() => buildTimeline(song), (error: unknown) => error instanceof Music2Error && error.code === "E_SCHEMA" &&
    (error.details?.["issues"] as { path: string }[])[0]?.path === "$.tracks[0]");
});
