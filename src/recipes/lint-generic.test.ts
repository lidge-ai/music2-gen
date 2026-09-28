import { test } from "node:test";
import assert from "node:assert/strict";
import { buildTimeline, validateSong } from "../song/index.ts";
import { createGeometry } from "./lint-geometry.tool.ts";
import { genericRules } from "./lint-generic.tool.ts";
import type { Song } from "../song/index.ts";

function check(genre: string, arrangement: { role: "verse" | "hook" | "groove" | "breakdown"; bars: number; layers: number }[],
  useCase?: Song["useCase"]): Map<string, number | string> {
  const tracks: Song["tracks"] = Array.from({ length: 6 }, (_, index) => ({ id: `layer${index}`,
    kind: "notes", instrument: "lead", pattern: "c4 ~ ~ ~" }));
  const sections: Song["sections"] = arrangement.map((row, index) => ({ id: `section${index}`, role: row.role,
    bars: row.bars, patterns: Object.fromEntries(tracks.slice(row.layers).map((track) => [track.id, null])) }));
  const song = validateSong({ version: 1, bpm: 120, genre, ...(useCase ? { useCase } : {}),
    tracks, sections, arrangement: sections.map((section) => ({ section: section.id })) });
  return new Map(genericRules(createGeometry(song, buildTimeline(song)), false)
    .map((result) => [result.id, result.observed]));
}

test("generic rules identify empty, chromatic, polyphonic and high onset sum", () => {
  const song = validateSong({ version: 1, bpm: 120, key: "C minor", tracks: [
    { id: "drums", kind: "drums", instrument: "drums", pattern: "bd" },
    { id: "bass", kind: "notes", instrument: "808", mono: false, pattern: "[c2,e2]" },
    { id: "empty", kind: "notes", instrument: "bass", pattern: "~" }],
    sections: [{ id: "groove", bars: 1, role: "groove" }], arrangement: [{ section: "groove" }] });
  const ids = genericRules(createGeometry(song, buildTimeline(song)), false).map((result) => result.id);
  assert.deepEqual(ids.sort(), ["generic/808_polyphony", "generic/clipping_risk", "generic/empty_track", "generic/out_of_key"]);
});

test("generic lint warns only for synthetic strings and brass acoustic emulations", () => {
  const song = validateSong({ version: 1, bpm: 120, tracks: [
    { id: "synthetic-strings", kind: "notes", instrument: "strings", pattern: "c4" },
    { id: "synthetic-brass", kind: "notes", instrument: "brass", pattern: "c4" },
    { id: "synth-lead", kind: "notes", instrument: "lead", pattern: "c4", params: { wave: 0 } },
    { id: "sample-strings", kind: "notes", instrument: "lib:strings", pattern: "c4" },
    { id: "sample-brass", kind: "notes", instrument: "lib:brass", pattern: "c4" },
    { id: "choir", kind: "notes", instrument: "choir", pattern: "c4" },
  ], sections: [{ id: "main", bars: 1 }], arrangement: [{ section: "main" }] });
  const findings = genericRules(createGeometry(song, buildTimeline(song)), false)
    .filter((result) => result.id === "generic/synthetic_acoustic");
  assert.deepEqual(findings.map(({ path }) => path),
    ["tracks.synthetic-strings.instrument", "tracks.synthetic-brass.instrument"]);
  assert.match(findings[0]!.fix, /lib:strings-staccato/);
  assert.match(findings[1]!.fix, /lib:brass-staccato/);
});

test("hook placement uses inclusive genre and short limits with house drop fallback", () => {
  for (const [genre, limit] of [["trap", 9], ["drill_ny", 9], ["drill_uk", 13], ["boom_bap", 41], ["house", 65]] as const) {
    assert.equal(check(genre, [{ role: "verse", bars: limit - 1, layers: 4 }, { role: "hook", bars: 1, layers: 5 }]).has("generic/hook_too_late"), false);
    assert.equal(check(genre, [{ role: "verse", bars: limit, layers: 4 }, { role: "hook", bars: 1, layers: 5 }]).get("generic/hook_too_late"), limit + 1);
  }
  assert.equal(check("trap", [{ role: "hook", bars: 1, layers: 5 }], "short_30").has("generic/hook_too_late"), false);
  assert.equal(check("trap", [{ role: "verse", bars: 1, layers: 4 }, { role: "hook", bars: 1, layers: 5 }], "short_30").get("generic/hook_too_late"), 2);
  assert.equal(check("house", [{ role: "breakdown", bars: 64, layers: 4 }, { role: "groove", bars: 1, layers: 6 }]).has("generic/hook_too_late"), false);
  assert.equal(check("house", [{ role: "breakdown", bars: 65, layers: 4 }, { role: "groove", bars: 1, layers: 6 }]).get("generic/hook_too_late"), 66);
  assert.equal(check("techno", [{ role: "breakdown", bars: 100, layers: 4 }, { role: "hook", bars: 1, layers: 6 }]).has("generic/hook_too_late"), false);
  assert.equal(check("house", [{ role: "groove", bars: 3, layers: 6 }]).has("generic/hook_too_late"), false);
});

test("density compares onset-bearing occurrence track counts at exact limits", () => {
  assert.equal(check("trap", [{ role: "verse", bars: 1, layers: 4 }, { role: "hook", bars: 1, layers: 5 }]).has("generic/no_density_contrast"), false);
  assert.equal(check("trap", [{ role: "verse", bars: 1, layers: 4 }, { role: "hook", bars: 1, layers: 4 }]).get("generic/no_density_contrast"), 0);
  for (const genre of ["house", "techno"]) {
    assert.equal(check(genre, [{ role: "breakdown", bars: 1, layers: 4 }, { role: "groove", bars: 1, layers: 6 }]).has("generic/no_density_contrast"), false);
    assert.equal(check(genre, [{ role: "breakdown", bars: 1, layers: 4 }, { role: "groove", bars: 1, layers: 5 }]).get("generic/no_density_contrast"), 1);
  }
  assert.equal(check("trap", [{ role: "verse", bars: 1, layers: 4 }]).has("generic/no_density_contrast"), false);
  assert.equal(check("lofi_hiphop", [{ role: "verse", bars: 1, layers: 4 }, { role: "hook", bars: 1, layers: 4 }]).has("generic/no_density_contrast"), false);
});
