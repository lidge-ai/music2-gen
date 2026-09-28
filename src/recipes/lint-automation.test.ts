import { test } from "node:test";
import assert from "node:assert/strict";
import { validateSong } from "../song/index.ts";
import { automationRules } from "./lint-automation.tool.ts";
import { lintSong } from "./lint.tool.ts";

const song = (lanes: unknown[], extra: Record<string, unknown> = {}) => ({ version: 1, bpm: 142, tracks: [
  { id: "strings", kind: "notes", instrument: "strings", gain: -27, pattern: "[c4,eb4,g4]", automation: lanes, ...extra }],
  sections: [{ id: "hook", bars: 4 }], arrangement: [{ section: "hook" }] });
const rules = (input: unknown) => automationRules(validateSong(input));

test("a gain lane written as offsets from 0 warns (issue #2)", () => {
  const rows = rules(song([{ target: "gain", points: [{ at: 0, value: 0, curve: "hold" }, { at: 8, value: -8 }, { at: 12, value: 0, curve: "hold" }] }]));
  assert.equal(rows.length, 1);
  assert.equal(rows[0]!.id, "generic/automation_gain_jump");
  assert.equal(rows[0]!.path, "$.tracks[0].automation[0].points[0].value");
  assert.equal(rows[0]!.observed, 0);
  assert.ok(lintSong(song([{ target: "gain", points: [{ at: 0, value: 0 }] }])).results.some((row) => row.id === "generic/automation_gain_jump"));
});

test("absolute rides near the static gain and fade-ins from silence pass", () => {
  assert.deepEqual(rules(song([{ target: "gain", points: [{ at: 0, value: -27 }, { at: 8, value: -35 }, { at: 12, value: -24 }] }])), []);
  assert.deepEqual(rules(song([{ target: "gain", points: [{ at: 0, value: -60 }, { at: 8, value: -27 }] }])), []);
});

test("send lanes far above a nonzero static send warn; a zero static send is skipped", () => {
  const lane = [{ target: "send.reverb", points: [{ at: 0, value: .8 }] }];
  const rows = rules(song(lane, { sends: { reverb: .1 } }));
  assert.deepEqual(rows.map((row) => row.id), ["generic/automation_send_jump"]);
  assert.deepEqual(rules(song(lane)), []);
  assert.deepEqual(rules(song([{ target: "send.reverb", points: [{ at: 0, value: .3 }] }], { sends: { reverb: .1 } })), []);
});
