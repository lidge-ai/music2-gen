import { test } from "node:test";
import assert from "node:assert/strict";
import { Music2Error } from "../shared/index.ts";
import { midiToName, noteToMidi, parseNumber, parseSampleRef } from "./values.tool.ts";

test("note and MIDI conversion", () => {
  assert.equal(noteToMidi("c4"), 60);
  assert.equal(noteToMidi("eb3"), 51);
  assert.equal(noteToMidi("f#2"), 42);
  assert.equal(noteToMidi("fs2"), 42);
  assert.equal(midiToName(60), "c4");
  assert.equal(midiToName(51), "eb3");
});

test("note octave is required with a location bearing error", () => {
  assert.throws(() => noteToMidi("c"), (error: unknown) => {
    assert.ok(error instanceof Music2Error);
    assert.equal(error.code, "E_PARSE");
    assert.equal(error.details?.["offset"], 0);
    return true;
  });
});

test("sample refs and numeric values", () => {
  assert.deepEqual(parseSampleRef("bd:3"), { name: "bd", index: 3 });
  assert.deepEqual(parseSampleRef("sd"), { name: "sd", index: 0 });
  assert.equal(parseNumber("60.5"), 60.5);
  assert.throws(() => parseSampleRef("bd:-1"), /sample/);
});
