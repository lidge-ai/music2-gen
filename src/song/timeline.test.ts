import assert from "node:assert/strict";
import test from "node:test";
import { validateSong } from "./song.schema.ts";
import { buildTimeline } from "./timeline.tool.ts";

void test("120 BPM maps bar quarters to half-second slots and repeats restart patterns", () => {
  const song = validateSong({ version: 1, bpm: 120,
    tracks: [{ id: "d", kind: "drums", instrument: "drums", pattern: "bd sd hh cp" }],
    sections: [{ id: "a", bars: 1 }], arrangement: [{ section: "a", repeats: 2 }] });
  const timeline = buildTimeline(song);
  assert.equal(timeline.bars, 2); assert.equal(timeline.durationSeconds, 4);
  assert.deepEqual(timeline.events.map((event) => event.time), [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5]);
  assert.deepEqual(timeline.events.map((event) => event.cycleBegin), ["0", "1/4", "1/2", "3/4", "0", "1/4", "1/2", "3/4"]);
  assert.equal(timeline.events[0]?.slot, 0.5);
  assert.equal(timeline.events[0]?.duration, 0.45);
});

void test("swing shifts odd sixteenths only on opted-in tracks", () => {
  const song = validateSong({ version: 1, bpm: 120, swing: 0.75,
    tracks: [{ id: "on", kind: "drums", instrument: "drums", pattern: "hh*16", swing: true },
      { id: "off", kind: "drums", instrument: "drums", pattern: "hh*16" }],
    sections: [{ id: "a", bars: 1 }], arrangement: [{ section: "a" }] });
  const events = buildTimeline(song).events;
  const on = events.filter((event) => event.track === "on");
  const off = events.filter((event) => event.track === "off");
  for (let i = 0; i < 16; i++) {
    assert.equal(off[i]?.time, i * 0.125);
    assert.equal(on[i]?.time, i * 0.125 + (i % 2 ? 0.0625 : 0));
  }
});

void test("transpose, velocity sampling and mono slot duration", () => {
  const song = validateSong({ version: 1, bpm: 120,
    tracks: [{ id: "n", kind: "notes", instrument: "808", pattern: "c2 d2", transpose: 12,
      velocity: "0.2 0.9", gate: 0.1 }],
    sections: [{ id: "a", bars: 1 }], arrangement: [{ section: "a" }] });
  const events = buildTimeline(song).events;
  assert.deepEqual(events.map((event) => event.midi), [48, 50]);
  assert.deepEqual(events.map((event) => event.velocity), [0.2, 0.9]);
  assert.deepEqual(events.map((event) => event.duration), events.map((event) => event.slot));
});

void test("velocity pattern value is held across finer note onsets", () => {
  const song = validateSong({ version: 1, bpm: 120,
    tracks: [{ id: "n", kind: "notes", instrument: "keys", pattern: "c4*4", velocity: "0.2 0.9" }],
    sections: [{ id: "a", bars: 1 }], arrangement: [{ section: "a" }] });
  assert.deepEqual(buildTimeline(song).events.map((event) => event.velocity), [0.2, 0.2, 0.9, 0.9]);
});

void test("seeded choice and degradation remain identical on repeated builds", () => {
  const song = validateSong({ version: 1, bpm: 120, seed: 77,
    tracks: [{ id: "d", kind: "drums", instrument: "drums", pattern: "[bd|sd] hh?0.5" }],
    sections: [{ id: "a", bars: 4 }], arrangement: [{ section: "a", repeats: 2 }] });
  assert.deepEqual(buildTimeline(song), buildTimeline(song));
  const events = buildTimeline(song).events;
  assert.deepEqual(events.filter((event) => event.bar < 4).map((event) => event.atom.raw),
    events.filter((event) => event.bar >= 4).map((event) => event.atom.raw));
});

void test("SFX fills weighted slots regardless of gate while classic drums keep gate", () => {
  const song = validateSong({ version: 1, bpm: 120,
    tracks: [
      { id: "fx", kind: "drums", instrument: "sfx", pattern: "riser@3 impact@1", gate: .05 },
      { id: "single", kind: "drums", instrument: "sfx", pattern: "whoosh", gate: .05 },
      { id: "kit", kind: "drums", instrument: "drums", pattern: "bd", gate: .05 },
    ], sections: [{ id: "one", bars: 1 }], arrangement: [{ section: "one" }] });
  const timeline = buildTimeline(song);
  assert.deepEqual(timeline.events.filter((event) => event.track === "fx").map((event) =>
    [event.slot, event.duration]), [[1.5, 1.5], [.5, .5]]);
  assert.deepEqual(timeline.events.filter((event) => event.track === "single").map((event) =>
    [event.slot, event.duration]), [[2, 2]]);
  assert.deepEqual(timeline.events.filter((event) => event.track === "kit").map((event) =>
    [event.slot, event.duration]), [[2, .1]]);
});

void test("mixed list and pattern tracks preserve legacy pattern event shape and absolute list time", () => {
  const raw = { version: 1, bpm: 120, tracks: [
    { id: "drum", kind: "drums", instrument: "drums", pattern: "bd" },
    { id: "lead", kind: "notes", instrument: "piano", notes: [{ start: 4, length: 1, pitch: 64 }] },
  ], sections: [{ id: "a", bars: 1 }], arrangement: [{ section: "a", repeats: 2 }] };
  const legacy = validateSong({ ...raw, tracks: [raw.tracks[0]] });
  const mixed = buildTimeline(validateSong(raw));
  assert.equal(JSON.stringify(mixed.events.filter((event) => event.track === "drum")), JSON.stringify(buildTimeline(legacy).events));
  assert.deepEqual(mixed.events.map((event) => [event.track, event.time, event.cycleBegin]),
    [["drum", 0, "0"], ["drum", 2, "0"], ["lead", 2, "1"]]);
  assert.equal(mixed.events[2]?.bar, 1);
});
