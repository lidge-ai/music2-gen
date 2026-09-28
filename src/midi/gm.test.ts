import assert from "node:assert/strict";
import test from "node:test";
import { TRANSITION_ATOMS } from "../sfx/presets.tool.ts";
import {
  DRUM_NOTES, GM_PROGRAMS, SFX_NOTES, drumNameFor, drumNoteFor, instrumentForProgram,
  keyToSmf, kitMidiMap, programForInstrument, sfxNameFor, sfxNoteFor, smfToKey,
} from "./gm.tool.ts";

test("all declared GM programs reverse to their first canonical instrument", () => {
  const seen = new Set<number>();
  for (const [instrument, program] of Object.entries(GM_PROGRAMS)) {
    assert.equal(programForInstrument(instrument), program);
    if (!seen.has(program)) assert.equal(instrumentForProgram(program), instrument);
    seen.add(program);
  }
  assert.equal(programForInstrument("unknown"), undefined);
  assert.equal(instrumentForProgram(127), undefined);
});

test("drum names, aliases, tom modulo, and reverse map", () => {
  for (const [name, note] of Object.entries(DRUM_NOTES)) {
    assert.equal(drumNoteFor(name), note);
    assert.equal(drumNameFor(note), name);
  }
  assert.equal(drumNoteFor("kick"), 36);
  assert.equal(drumNoteFor("snare"), 38);
  assert.equal(drumNoteFor("hat:1"), 42);
  assert.equal(drumNoteFor("tom:7"), 50);
  assert.equal(drumNoteFor("tom", 5), 47);
  assert.equal(drumNameFor(84), undefined);
});

test("private SFX notes follow TRANSITION_ATOMS exactly", () => {
  assert.deepEqual(Object.keys(SFX_NOTES), [...TRANSITION_ATOMS]);
  for (const [index, atom] of TRANSITION_ATOMS.entries()) {
    assert.equal(sfxNoteFor(atom), 84 + index);
    assert.equal(sfxNameFor(84 + index), atom);
  }
  assert.equal(sfxNoteFor("riser:1"), 84);
});

test("kit explicit mapping wins, aliases follow, unused notes start at 60", () => {
  assert.deepEqual(kitMidiMap(["kick", "clay", "snare"], { kick: 36, clay: 62 }), {
    byName: { kick: 36, clay: 62, snare: 38 }, warnings: [],
  });
  assert.deepEqual(kitMidiMap(["kick", "clay", "dirt"]), {
    byName: { kick: 36, clay: 60, dirt: 61 },
    warnings: ["KIT_FALLBACK_NOTE:clay=60", "KIT_FALLBACK_NOTE:dirt=61"],
  });
  for (const invalid of [{ clay: 128 }, { clay: 36, kick: 36 }, { absent: 62 }]) {
    assert.throws(() => kitMidiMap(["kick", "clay"], invalid), { code: "E_SCHEMA" });
  }
});

test("key signatures preserve legal spellings and omit Fb major", () => {
  assert.deepEqual(keyToSmf("Eb major"), { sf: -3, mi: 0 });
  assert.deepEqual(keyToSmf("A minor"), { sf: 0, mi: 1 });
  assert.deepEqual(keyToSmf("C# major"), { sf: 7, mi: 0 });
  assert.equal(keyToSmf("Fb major"), null);
  for (let sf = -7; sf <= 7; sf++) {
    for (const mi of [0, 1] as const) {
      assert.deepEqual(keyToSmf(smfToKey(sf, mi)), { sf, mi });
    }
  }
});
