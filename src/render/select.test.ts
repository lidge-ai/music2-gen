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

test("voice parameters sample raw automation once at each note onset", () => {
  const song = validateSong({ version: 1, bpm: 120, sampleRate: 44100, tailSeconds: 0,
    tracks: [{ id: "bass", kind: "notes", instrument: "bass", mono: true,
      notes: [{ start: 0, length: 2, pitch: 48 }, { start: 1, length: 1, pitch: 50 }],
      automation: [{ target: "param.cutoffHz", points: [
        { at: 0, value: 300, curve: "hold" }, { at: 1, value: 2400, curve: "hold" },
      ] }] }], sections: [{ id: "one", bars: 1 }], arrangement: [{ section: "one" }] });
  const selected = selectEvents(song, buildTimeline(song), 0, 1, 88200)[0]!;
  assert.deepEqual(selected.map((event) => event.params), [{ cutoffHz: 300 }, { cutoffHz: 2400 }]);
  assert.equal(selected[0]!.stopFrame, selected[1]!.startFrame);
});
