import assert from "node:assert/strict";
import test from "node:test";
import { validateSong } from "../../song/index.ts";
import { Music2Error } from "../../shared/index.ts";
import type { ResolvedSong, ResolvedTrack } from "../../song/index.ts";
import { DRUM_NAMES } from "./drums.tool.ts";
import { declaredSampleNames, mergeParams, resolveVoice, validateDawVoiceLanes, validateVoiceParams, VOICES } from "./registry.tool.ts";

function songWith(tracks: { id: string; kind: "drums" | "notes"; instrument: string;
  mono?: boolean; params?: Record<string, number> }[]): ResolvedSong {
  return validateSong({ version: 1, bpm: 120, tracks,
    sections: [{ id: "one", bars: 1 }], arrangement: [{ section: "one" }] });
}

function issuePaths(error: unknown): string[] {
  assert.ok(error instanceof Music2Error);
  assert.equal(error.code, "E_SCHEMA");
  return (error.details?.["issues"] as { path: string }[]).map(({ path }) => path);
}

void test("legacy voice ids and every registered voice resolve with their declared kinds", () => {
  for (const id of ["drums", "808", "bass", "bell", "keys", "pluck", "pad", "lead", "supersaw"])
    assert.ok(Object.hasOwn(VOICES, id), `missing legacy voice ${id}`);
  for (const spec of Object.values(VOICES)) {
    const track = songWith([{ id: "voice", kind: spec.kind, instrument: spec.id }]).tracks[0]!;
    assert.equal(resolveVoice(track, 0), spec);
  }
  assert.deepEqual(DRUM_NAMES, ["bd", "sd", "cp", "hh", "oh", "rim", "perc", "tom"]);
});

void test("kit instruments bypass built-in voice resolution", () => {
  const track = songWith([{ id: "kit", kind: "drums", instrument: "kit:my-kit.json" }]).tracks[0]!;
  assert.equal(resolveVoice(track, 0), null);
  assert.equal(declaredSampleNames(track.instrument), null);
});

void test("built-in drum-kind voices declare separate sample vocabularies", () => {
  assert.deepEqual(declaredSampleNames("drums"), DRUM_NAMES);
  assert.deepEqual(declaredSampleNames("sfx"), ["riser", "pitchriser", "downlifter", "impact",
    "whoosh", "revcymbal", "noisebuild", "subdrop", "zap", "crackle"]);
  assert.equal(declaredSampleNames("bass"), null);
  assert.equal(declaredSampleNames("missing"), null);
  assert.equal(declaredSampleNames("kit:anything"), null);
  const wrongKind = songWith([{ id: "x", kind: "notes", instrument: "sfx" }]).tracks[0]!;
  assert.throws(() => resolveVoice(wrongKind, 0), (error: unknown) => {
    assert.deepEqual(issuePaths(error), ["tracks[0].kind"]); return true;
  });
});

void test("unknown instrument and kind mismatch identify the indexed track", () => {
  const unknown = songWith([{ id: "x", kind: "notes", instrument: "cowbell" }]).tracks[0]!;
  assert.throws(() => resolveVoice(unknown, 2), (error: unknown) => {
    assert.deepEqual(issuePaths(error), ["tracks[2].instrument"]); return true;
  });
  const wrongKind = songWith([{ id: "x", kind: "notes", instrument: "drums" }]).tracks[0]!;
  assert.throws(() => resolveVoice(wrongKind, 3), (error: unknown) => {
    assert.deepEqual(issuePaths(error), ["tracks[3].kind"]); return true;
  });
});

void test("mergeParams fills defaults and applies known overrides without mutating input", () => {
  const given = { cutoffHz: 200, unused: 9 };
  const merged = mergeParams(VOICES["bass"]!, given);
  assert.deepEqual(merged, { wave: 0, cutoffHz: 200, resonance: .15, releaseMs: 80,
    unison: 1, detuneCents: 0, filterEnvAmount: 0, filterEnvDecayMs: 500 });
  assert.deepEqual(given, { cutoffHz: 200, unused: 9 });
  assert.deepEqual(mergeParams(VOICES["808"]!, {}), { drive: 2.2, decayMs: 1100, attackMs: 3 });
});

void test("validation collects unknown, nonfinite, range, integer and mono issues", () => {
  const song = songWith([
    { id: "b", kind: "notes", instrument: "bass", mono: false, params: { wave: .5, cutoffHz: 39 } },
    { id: "p", kind: "notes", instrument: "pad", params: { cutoffHz: 12001 } },
    { id: "s", kind: "notes", instrument: "808", mono: false, params: { unknown: 1 } },
    { id: "k", kind: "notes", instrument: "keys" },
  ]);
  song.tracks[3]!.params["attackMs"] = Number.NaN;
  assert.throws(() => validateVoiceParams(song), (error: unknown) => {
    assert.deepEqual(issuePaths(error), [
      "tracks[0].mono", "tracks[0].params.wave", "tracks[0].params.cutoffHz",
      "tracks[1].params.cutoffHz", "tracks[2].mono", "tracks[2].params.unknown",
      "tracks[3].params.attackMs",
    ]);
    return true;
  });
});

void test("validation collects instrument and kind issues across tracks", () => {
  const song = songWith([
    { id: "missing", kind: "notes", instrument: "cowbell" },
    { id: "wrong", kind: "drums", instrument: "bell", params: { ratio: 3 } },
  ]);
  assert.throws(() => validateVoiceParams(song), (error: unknown) => {
    assert.deepEqual(issuePaths(error), ["tracks[0].instrument", "tracks[1].kind"]);
    return true;
  });
});

void test("valid boundary values and omitted params pass", () => {
  const song = songWith([
    { id: "b", kind: "notes", instrument: "bass", params: { wave: 1, cutoffHz: 40, resonance: .9 } },
    { id: "d", kind: "drums", instrument: "drums", params: { tone: 0, decayMs: 1000 } },
  ]);
  assert.doesNotThrow(() => validateVoiceParams(song));
  const bass: ResolvedTrack = song.tracks[0]!;
  assert.equal(mergeParams(resolveVoice(bass, 0)!, bass.params)["releaseMs"], 80);
});

void test("voice automation accepts only opted-in numeric parameters and their ranges", () => {
  assert.deepEqual(VOICES["pad"]?.automatable, ["cutoffHz"]);
  assert.deepEqual(VOICES["bass"]?.automatable, ["cutoffHz"]);
  assert.deepEqual(VOICES["lead"]?.automatable, ["vibratoCents"]);
  for (const [instrument, target, value] of [
    ["pad", "param.cutoffHz", 80], ["bass", "param.cutoffHz", 8000],
    ["lead", "param.vibratoCents", 100],
  ] as const) {
    const song = validateSong({ version: 1, bpm: 120,
      tracks: [{ id: "v", kind: "notes", instrument, notes: [{ start: 0, length: 1, pitch: 60 }],
        automation: [{ target, points: [{ at: 0, value }] }] }],
      sections: [{ id: "one", bars: 1 }], arrangement: [{ section: "one" }] });
    assert.doesNotThrow(() => validateDawVoiceLanes(song));
  }
  const rejected = validateSong({ version: 1, bpm: 120,
    tracks: [
      { id: "p", kind: "notes", instrument: "piano", pattern: "c4",
        automation: [{ target: "param.decayMs", points: [{ at: 0, value: 500 }] }] },
      { id: "k", kind: "notes", instrument: "pad", pattern: "c4",
        automation: [{ target: "param.attackMs", points: [{ at: 0, value: 400 }] }] },
      { id: "b", kind: "notes", instrument: "bass", pattern: "c2",
        automation: [{ target: "param.cutoffHz", points: [{ at: 0, value: 39 }] }] },
    ], sections: [{ id: "one", bars: 1 }], arrangement: [{ section: "one" }] });
  assert.throws(() => validateDawVoiceLanes(rejected), (error: unknown) => {
    assert.deepEqual(issuePaths(error), ["$.tracks[0].automation[0].target",
      "$.tracks[1].automation[0].target", "$.tracks[2].automation[0].points[0].value"]);
    return true;
  });
  const sfz = validateSong({ version: 1, bpm: 120,
    tracks: [{ id: "sampled", kind: "notes", instrument: "sfz:a.sfz", pattern: "c4",
      automation: [{ target: "param.cutoffHz", points: [{ at: 0, value: 1200 }] }] }],
    sections: [{ id: "one", bars: 1 }], arrangement: [{ section: "one" }] });
  assert.doesNotThrow(() => validateDawVoiceLanes(sfz));
});

void test("supersaw and expanded voice bounds validate", () => {
  const song = songWith([
    { id: "s", kind: "notes", instrument: "supersaw", params: { unison: 10, mix: 1.1 } },
    { id: "b", kind: "notes", instrument: "bass", params: { unison: 2.5 } },
  ]);
  assert.throws(() => validateVoiceParams(song), (error: unknown) => {
    assert.deepEqual(issuePaths(error), ["tracks[0].params.unison", "tracks[0].params.mix", "tracks[1].params.unison"]);
    return true;
  });
});

void test("twelve virtual instruments register as notes voices with validated selectors", () => {
  const ids = ["piano", "epiano", "organ", "strings", "brass", "flute", "choir", "marimba", "vibraphone", "glockenspiel", "kalimba", "guitar"];
  for (const id of ids) assert.equal(VOICES[id]?.kind, "notes", id);
  const song = (instrument: string, params: Record<string, number>) => validateSong({ version: 1, bpm: 120,
    tracks: [{ id: "t", kind: "notes", instrument, pattern: "c4", params }],
    sections: [{ id: "a", bars: 1 }], arrangement: [{ section: "a" }] });
  for (const tremoloHz of [0, 2, 7]) assert.doesNotThrow(() => validateVoiceParams(song("vibraphone", { tremoloHz })));
  assert.throws(() => validateVoiceParams(song("vibraphone", { tremoloHz: 1 })), (error: unknown) =>
    JSON.stringify((error as { details?: unknown }).details).includes("tracks[0].params.tremoloHz"));
  assert.throws(() => validateVoiceParams(song("guitar", { type: 0.5 })));
  assert.throws(() => validateVoiceParams(song("choir", { vowel: 5 })));
  assert.throws(() => validateVoiceParams(song("organ", { d8: 9 })));
});

void test("SFZ bypasses built-in voices and rejects drum-kind tracks", () => {
  const song = songWith([{ id: "sfz", kind: "notes", instrument: "sfz:keys.sfz" }]);
  const notes = song.tracks[0]!;
  assert.equal(resolveVoice(notes, 0), null);
  assert.equal(declaredSampleNames(notes.instrument), null);
  const drums = { ...notes, kind: "drums" as const };
  assert.deepEqual(issuePaths(assert.throws(() => resolveVoice(drums, 0))), ["tracks[0].kind"]);
  const parameter = { ...notes, params: { cutoffHz: 1000 } };
  assert.deepEqual(issuePaths(assert.throws(() => validateVoiceParams({ ...song, tracks: [parameter] }))),
    ["tracks[0].params.cutoffHz"]);
  const lane = { ...notes, automation: [{ target: "param.cutoffHz", points: [{ tick: 0, value: 1000, curve: "hold" as const }] }] };
  assert.deepEqual(issuePaths(assert.throws(() => validateDawVoiceLanes({ ...song, tracks: [lane] }))),
    ["$.tracks[0].automation[0].target"]);
});
