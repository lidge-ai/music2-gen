import assert from "node:assert/strict";
import test from "node:test";
import { inflateSync } from "node:zlib";
import { buildTimeline, validateSong } from "../song/index.ts";
import { renderPianoRoll } from "./pianoroll.tool.ts";

function decode(bytes: Buffer): { width: number; height: number; rgb: Uint8Array } {
  assert.equal(bytes.toString("hex", 0, 8), "89504e470d0a1a0a");
  const width = bytes.readUInt32BE(16), height = bytes.readUInt32BE(20);
  const pos = bytes.indexOf("IDAT");
  const length = bytes.readUInt32BE(pos - 4);
  const raw = inflateSync(bytes.subarray(pos + 4, pos + 4 + length));
  const rgb = new Uint8Array(width * height * 3);
  for (let y = 0; y < height; y++) {
    assert.equal(raw[y * (width * 3 + 1)], 0);
    rgb.set(raw.subarray(y * (width * 3 + 1) + 1, (y + 1) * (width * 3 + 1)), y * width * 3);
  }
  return { width, height, rgb };
}

function at(image: ReturnType<typeof decode>, x: number, y: number): number[] {
  return [...image.rgb.subarray((y * image.width + x) * 3, (y * image.width + x) * 3 + 3)];
}

test("single C4 occupies only MIDI-60 row and exclusive 0..1 s interval", () => {
  const song = validateSong({ version: 1, bpm: 60,
    tracks: [{ id: "lead", kind: "notes", instrument: "keys", pattern: "c4" }],
    sections: [{ id: "verse", bars: 1, role: "verse" }], arrangement: [{ section: "verse" }] });
  const timeline = buildTimeline(song);
  timeline.events[0]!.duration = 1;
  const image = decode(renderPianoRoll(song, timeline));
  assert.equal(image.width, 720);
  assert.equal(image.height, 24 + 50 + 24);
  const row60 = 24 + 2 * 10 + 3;
  assert.notDeepEqual(at(image, 82, row60), at(image, 241, row60));
  assert.deepEqual(at(image, 82, row60), at(image, 239, row60));
  assert.notDeepEqual(at(image, 82, row60), at(image, 82, row60 + 10));
  assert.ok(image.rgb.subarray(0, 24 * image.width * 3).some((v) => v > 200), "section role text");
});

test("two drums use distinct labelled lanes and a section boundary", () => {
  const song = validateSong({ version: 1, bpm: 120,
    tracks: [{ id: "kick", kind: "drums", instrument: "drums", pattern: "bd" },
      { id: "snare", kind: "drums", instrument: "drums", pattern: "sd" }],
    sections: [{ id: "intro", bars: 1, role: "intro" }, { id: "hook", bars: 1, role: "hook" }],
    arrangement: [{ section: "intro" }, { section: "hook" }] });
  const timeline = buildTimeline(song);
  const image = decode(renderPianoRoll(song, timeline));
  const drumTop = 24 + 25 * 10;
  assert.notDeepEqual(at(image, 82, drumTop + 5), at(image, 82, drumTop + 18 + 5));
  assert.ok(image.rgb.subarray((drumTop + 5) * image.width * 3, (drumTop + 12) * image.width * 3).some((v) => v > 200), "drum labels");
  const sectionX = 80 + Math.round(2 / 4 * 640);
  assert.deepEqual(at(image, sectionX, 30), [246, 197, 91]);
  assert.ok(image.rgb.subarray(0, 24 * image.width * 3).some((v) => v > 200), "section label");
  const noNotesText = image.rgb.subarray((24 + 120) * image.width * 3, (24 + 130) * image.width * 3);
  assert.ok(noNotesText.some((v) => v > 150), "NO NOTES");
});

test("mono 808 notes are drawn until the next onset of the same track", () => {
  const song = validateSong({ version: 1, bpm: 60,
    tracks: [{ id: "sub", kind: "notes", instrument: "808", pattern: "c2 ~ ~ ~ ~ ~ ~ ~ c2 ~ ~ ~ ~ ~ ~ ~" }],
    sections: [{ id: "hook", bars: 1, role: "hook" }], arrangement: [{ section: "hook" }] });
  const timeline = buildTimeline(song);
  const image = decode(renderPianoRoll(song, timeline));
  const row = 24 + 2 * 10 + 3;
  const noteColor = at(image, 82, row);
  const xMid = 80 + Math.round(1.5 / 4 * 640);
  assert.deepEqual(at(image, xMid, row), noteColor, "first note sustains past its sixteenth slot");
});
