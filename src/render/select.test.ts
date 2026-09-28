import { test } from "node:test";
import assert from "node:assert/strict";
import { buildTimeline, validateSong } from "../song/index.ts";
import { selectEvents } from "./select.tool.ts";

test("selectEvents preserves seeded ordering and mono stop frames", () => {
  const song = validateSong({ version: 1, bpm: 120, sampleRate: 44100, tailSeconds: 0,
    tracks: [{ id: "bass", kind: "notes", instrument: "bass", mono: true, pattern: "c2 d2 ~ ~" }],
    sections: [{ id: "one", bars: 1 }], arrangement: [{ section: "one" }] });
  const timeline = buildTimeline(song);
  const events = selectEvents(song, timeline, 0, 1, 88200)[0]!;
  assert.equal(events.length, 2);
  assert.equal(events[0]!.stopFrame, events[1]!.startFrame);
  assert.notEqual(events[0]!.seed, events[1]!.seed);
});
