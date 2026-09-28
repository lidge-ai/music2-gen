import assert from "node:assert/strict";
import test from "node:test";
import { Music2Error } from "../../shared/index.ts";
import { validateSong } from "../../song/song.schema.ts";
import { validateResolvedFx } from "./fx-validate.tool.ts";

const base = { version: 1 as const, bpm: 120,
  tracks: [{ id: "lead", kind: "notes" as const, instrument: "lead", pattern: "c4" }],
  sections: [{ id: "one", bars: 1 }], arrangement: [{ section: "one" }] };

test("direct resolved songs reject mutated effect settings as E_SCHEMA", () => {
  const song = validateSong(base);
  song.master.fx.push({ type: "drive", amount: 2, toneHz: 8000, mix: 1 });
  (song.master.fx[0] as { amount: number }).amount = Infinity;
  assert.throws(() => validateResolvedFx(song), (error: unknown) => error instanceof Music2Error &&
    error.code === "E_SCHEMA" && (error.details?.["issues"] as { path: string }[]).some((issue) => issue.path === "$.master.fx[0].amount"));
});

test("unknown effect parameters and excessive chains report source paths", () => {
  const extra = { ...base, tracks: [{ ...base.tracks[0], fx: [{ type: "drive", wrong: 1 }] }] };
  assert.throws(() => validateSong(extra), (error: unknown) => error instanceof Music2Error &&
    (error.details?.["issues"] as { path: string }[]).some((issue) => issue.path === "$.tracks[0].fx[0].wrong"));
  const long = { ...base, tracks: [{ ...base.tracks[0], fx: Array.from({ length: 13 }, () => ({ type: "width" })) }] };
  assert.throws(() => validateSong(long), (error: unknown) => error instanceof Music2Error &&
    (error.details?.["issues"] as { path: string }[]).some((issue) => issue.path === "$.tracks[0].fx"));
});

test("direct resolved bus retains unknown-key validation", () => {
  const song = validateSong({ ...base, fx: {} });
  Object.assign(song.fx!, { typo: 1 });
  assert.throws(() => validateResolvedFx(song), (error: unknown) => error instanceof Music2Error &&
    (error.details?.["issues"] as { path: string }[]).some((issue) => issue.path === "$.fx.typo"));
});
