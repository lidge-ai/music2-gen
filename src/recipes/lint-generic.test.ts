import { test } from "node:test";
import assert from "node:assert/strict";
import { buildTimeline, validateSong } from "../song/index.ts";
import { createGeometry } from "./lint-geometry.tool.ts";
import { CLIP_RISK_SUM, SLOW_ATTACK_MS, clippingRisk, genericRules } from "./lint-generic.tool.ts";
import { VOICES } from "../render/index.ts";
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
    { id: "clap", kind: "drums", instrument: "drums", pattern: "cp" },
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

const risk = (tracks: Song["tracks"]): number => {
  const song = validateSong({ version: 1, bpm: 142, tracks, sections: [{ id: "hook", bars: 1, role: "hook" }], arrangement: [{ section: "hook" }] });
  return clippingRisk(createGeometry(song, buildTimeline(song)));
};

test("a default kick and 808 downbeat stays under the clipping threshold (issue #1 repro 3)", () => {
  const value = risk([{ id: "kick", kind: "drums", instrument: "drums", pattern: "bd ~ ~ ~" },
    { id: "sub", kind: "notes", instrument: "808", pattern: "g1 ~ ~ ~" }]);
  assert.ok(Math.abs(value - 1.6) < .01, String(value));
  assert.ok(value <= CLIP_RISK_SUM);
});

test("three separate drum hits plus an 808 on one step still exceed the threshold", () => {
  const value = risk([{ id: "kick", kind: "drums", instrument: "drums", velocity: 1, pattern: "bd" },
    { id: "clap", kind: "drums", instrument: "drums", velocity: 1, pattern: "cp" },
    { id: "hat", kind: "drums", instrument: "drums", velocity: 1, pattern: "hh" },
    { id: "sub", kind: "notes", instrument: "808", velocity: 1, pattern: "g1" }]);
  assert.ok(value > CLIP_RISK_SUM, String(value));
});

test("chord tones add as sqrt(n) and slow attacks are weighted down", () => {
  const chord = risk([{ id: "keys", kind: "notes", instrument: "keys", velocity: 1, mono: false, pattern: "[c4,e4,g4]" }]);
  assert.ok(Math.abs(chord - Math.sqrt(3)) < 1e-9, String(chord));
  const strings = risk([{ id: "strings", kind: "notes", instrument: "strings", velocity: 1, mono: false, pattern: "[c4,e4,g4]" }]);
  assert.ok(Math.abs(strings - Math.sqrt(3) * 10 / 300) < 1e-9, String(strings));
  const library = risk([{ id: "bed", kind: "notes", instrument: "lib:strings", velocity: 1, pattern: "c4" }]);
  assert.ok(Math.abs(library - 10 / 250) < 1e-9, String(library));
  const fastPad = risk([{ id: "pad", kind: "notes", instrument: "pad", velocity: 1, params: { attackMs: 10 }, pattern: "c4" }]);
  assert.ok(Math.abs(fastPad - 1) < 1e-9, String(fastPad));
});

test("slow-attack table matches the render voice defaults", () => {
  for (const [id, attack] of Object.entries(SLOW_ATTACK_MS)) assert.equal(VOICES[id]?.params["attackMs"]?.default, attack, id);
});
