import { test } from "node:test";
import assert from "node:assert/strict";
import { lintSong } from "./lint.tool.ts";

test("genre BPM checks are inclusive for all seven cards", () => {
  const spans: [string, number, number][] = [["drill_uk",138,145],["drill_ny",138,145],["trap",130,170],["boom_bap",80,100],["lofi_hiphop",60,90],["house",120,130],["techno",126,140]];
  for (const [genre, min, max] of spans) {
    const make = (bpm: number) => ({ version: 1, bpm, genre, tracks: [{ id: "drums", kind: "drums", instrument: "drums", pattern: "bd sd" }], sections: [{ id: "groove", bars: 1, role: "groove" }], arrangement: [{ section: "groove" }] });
    assert.ok(!lintSong(make(min)).results.some((r) => r.id === `${genre}/1`), `${genre} min`);
    assert.ok(!lintSong(make(max)).results.some((r) => r.id === `${genre}/1`), `${genre} max`);
    assert.ok(lintSong(make(min - 1)).results.some((r) => r.id === `${genre}/1`), `${genre} below`);
    assert.ok(lintSong(make(max + 1)).results.some((r) => r.id === `${genre}/1`), `${genre} above`);
  }
});
