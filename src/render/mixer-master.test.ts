import { test } from "node:test";
import assert from "node:assert/strict";
import { createStereo, peakLinear } from "../audio-io/index.ts";
import { validateSong } from "../song/index.ts";
import { masterAudio } from "./mixer-master.tool.ts";

const song = validateSong({ version: 1, bpm: 120, tracks: [{ id: "lead", kind: "notes", instrument: "lead", pattern: "c4" }],
  sections: [{ id: "a", bars: 1 }], arrangement: [{ section: "a" }] });

test("peak mastering keeps a hot mix under the song ceiling", () => {
  const audio = createStereo(44100, 4410);
  for (let i = 0; i < 4410; i++) { const value = 1.8 * Math.sin(2 * Math.PI * 220 * i / 44100); audio.left[i] = value; audio.right[i] = value; }
  const result = masterAudio(audio, song, "peak");
  assert.ok(peakLinear(audio) <= 10 ** (song.master.ceilingDb / 20) + 1e-6);
  assert.ok(result.peakDbfs <= song.master.ceilingDb + 1e-6);
});
