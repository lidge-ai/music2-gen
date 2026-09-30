import { test } from "node:test";
import assert from "node:assert/strict";
import { namedMidi, drumAtom } from "./names.tool.ts";
test("note suffixes and first-match drum vocabulary", () => {
  assert.equal(namedMidi("Pad C3 M.aif"), 48); assert.equal(namedMidi("Pad Db4.wav"), 61);
  assert.equal(namedMidi("Pad C-1.aiff"), 0); assert.equal(namedMidi("noise.wav"), null);
  for (const [name, atom] of [["Kick_1", "bd"], ["Snare-2", "sd"], ["Clap", "cp"], ["Hi-Hat_Closed", "hh"], ["Hi-Hat_Open", "oh"], ["rimshot", "rim"], ["shaker", "perc"], ["tom1", "tom"], ["Crash", "cr"], ["Ride", "rd"]]) assert.equal(drumAtom(name!), atom);
});
