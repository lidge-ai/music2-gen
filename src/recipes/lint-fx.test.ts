import assert from "node:assert/strict";
import test from "node:test";
import { validateSong } from "../song/song.schema.ts";
import { fxRules } from "./lint-fx.tool.ts";

const base = { version: 1 as const, bpm: 120,
  tracks: [{ id: "sub", kind: "notes" as const, instrument: "808", pattern: "c2" }],
  sections: [{ id: "one", bars: 1 }], arrangement: [{ section: "one" }] };

test("FX lint flags high low-end reverb, delay feedback and widening as warnings", () => {
  const song = validateSong({ ...base, fx: { delay: { feedback: 0.93 } }, tracks: [{ ...base.tracks[0],
    sends: { reverb: 0.2 }, fx: [{ type: "width", amount: 1.5 }, { type: "delay", feedback: 0.93 }] }] });
  const results = fxRules(song);
  assert.deepEqual(results.map((item) => item.id), ["generic/fx_low_reverb", "generic/fx_width_low",
    "generic/fx_delay_feedback", "generic/fx_delay_feedback"]);
  assert.ok(results.every((item) => item.severity === "warning"));
});
