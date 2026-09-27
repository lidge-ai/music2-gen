import assert from "node:assert/strict";
import test from "node:test";
import { arrange } from "./arrange.tool.ts";
import { validateSong } from "./song.schema.ts";

void test("ordinal and occurrence count across separated arrangement entries", () => {
  const song = validateSong({ version: 1, bpm: 120,
    tracks: [{ id: "d", kind: "drums", instrument: "drums" }],
    sections: [{ id: "a", bars: 2 }, { id: "b", bars: 1 }],
    arrangement: [{ section: "a" }, { section: "b" }, { section: "a", repeats: 2 }] });
  assert.deepEqual(arrange(song).map(({ entry, repeat, ordinal, occurrence, startBar }) =>
    [entry, repeat, ordinal, occurrence, startBar]),
  [[0, 0, 0, 0, 0], [1, 0, 1, 0, 2], [2, 0, 2, 1, 3], [2, 1, 3, 2, 5]]);
});
