import { test } from "node:test";
import assert from "node:assert/strict";
import { buildTimeline, validateSong } from "../song/index.ts";
import { createGeometry } from "./lint-geometry.tool.ts";
import { genericRules } from "./lint-generic.tool.ts";

test("generic rules identify empty, chromatic, polyphonic and high onset sum", () => {
  const song = validateSong({ version: 1, bpm: 120, key: "C minor", tracks: [
    { id: "drums", kind: "drums", instrument: "drums", pattern: "bd" },
    { id: "bass", kind: "notes", instrument: "808", mono: false, pattern: "[c2,e2]" },
    { id: "empty", kind: "notes", instrument: "bass", pattern: "~" }],
    sections: [{ id: "groove", bars: 1, role: "groove" }], arrangement: [{ section: "groove" }] });
  const ids = genericRules(createGeometry(song, buildTimeline(song)), false).map((result) => result.id);
  assert.deepEqual(ids.sort(), ["generic/808_polyphony", "generic/clipping_risk", "generic/empty_track", "generic/out_of_key"]);
});
