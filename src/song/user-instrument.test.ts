import { test } from "node:test";
import assert from "node:assert/strict";
import { validateSong } from "./index.ts";
import { Music2Error } from "../shared/index.ts";

const song = (instrument: string, kind: "notes" | "drums", list = false) => ({ version: 1, bpm: 120,
  tracks: [{ id: "t", kind, instrument, ...(list ? { notes: [{ start: 0, length: 1,
    ...(kind === "notes" ? { pitch: 60 } : { sample: "bd" }) }] } : { pattern: kind === "notes" ? "c4" : "bd" }) }],
  sections: [{ id: "one", bars: 1 }], arrangement: [{ section: "one" }] });

test("user instrument syntax is validated without loading files for patterns and lists", () => {
  for (const kind of ["notes", "drums"] as const) for (const list of [false, true]) {
    for (const id of ["unimported", "a", "a".repeat(48), "a-0"])
      assert.equal(validateSong(song(`user:${id}`, kind, list)).tracks[0]!.instrument, `user:${id}`);
    for (const id of ["", "Upper", "../escape", "a/b", "a_b", "-a", "a".repeat(49)])
      assert.throws(() => validateSong(song(`user:${id}`, kind, list)), (error: unknown) =>
        error instanceof Music2Error && error.code === "E_SCHEMA" &&
        JSON.stringify(error.details).includes("$.tracks[0].instrument"));
  }
});
