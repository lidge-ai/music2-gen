import assert from "node:assert/strict";
import test from "node:test";
import { validateSong } from "../../song/index.ts";
import { Music2Error } from "../../shared/index.ts";
import type { ResolvedSong, ResolvedTrack } from "../../song/index.ts";
import { DRUM_NAMES } from "./drums.tool.ts";
import { mergeParams, resolveVoice, validateVoiceParams, VOICES } from "./registry.tool.ts";

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

void test("all eight voice ids resolve with their declared kinds", () => {
  assert.deepEqual(Object.keys(VOICES).sort(),
    ["drums", "808", "bass", "bell", "keys", "pluck", "pad", "lead"].sort());
  for (const spec of Object.values(VOICES)) {
    const track = songWith([{ id: "voice", kind: spec.kind, instrument: spec.id }]).tracks[0]!;
    assert.equal(resolveVoice(track, 0), spec);
  }
  assert.deepEqual(DRUM_NAMES, ["bd", "sd", "cp", "hh", "oh", "rim", "perc", "tom"]);
});

void test("kit instruments bypass built-in voice resolution", () => {
  const track = songWith([{ id: "kit", kind: "drums", instrument: "kit:my-kit.json" }]).tracks[0]!;
  assert.equal(resolveVoice(track, 0), null);
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
  assert.deepEqual(merged, { wave: 0, cutoffHz: 200, resonance: .15, releaseMs: 80 });
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
