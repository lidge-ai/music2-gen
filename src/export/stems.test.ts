import assert from "node:assert/strict";
import test from "node:test";
import { createStereo } from "../audio-io/index.ts";
import { fnv1a32, Music2Error } from "../shared/index.ts";
import { buildTimeline, validateSong } from "../song/index.ts";
import type { Song } from "../song/index.ts";
import { mixTracks } from "../render/mixer.tool.ts";
import { planStems } from "./stems.tool.ts";
import { validateStemsManifest } from "./manifest.schema.ts";
import type { StemsManifest } from "./manifest.schema.ts";

function fixture(overrides: Partial<Song> = {}): Song {
  return { version: 1, title: "bundle", bpm: 120, sampleRate: 48000, tailSeconds: 0,
    tracks: [{ id: "lead", kind: "notes", instrument: "lead", pattern: "c4 ~ ~ ~" }],
    sections: [{ id: "intro", bars: 1 }, { id: "hook", bars: 1 }],
    arrangement: [{ section: "intro" }, { section: "hook", repeats: 2 }], ...overrides };
}

test("stem manifest marks tracks whose static controls are overridden by automation", async () => {
  const song = validateSong(fixture({ tracks: [{ id: "lead", kind: "notes", instrument: "lead", pattern: "c4 ~ ~ ~",
    gain: -3, automation: [{ target: "gain", points: [{ at: 0, value: -12 }] }] }] }));
  const timeline = buildTimeline(song);
  const result = await mixTracks(song, timeline, "fixture.song.json", { stems: true, returns: true });
  const plan = planStems(song, timeline, result, { bits: 24, includeMaster: true, includePremaster: false });
  const manifest = JSON.parse(Buffer.from((plan.files.at(-1)! as { bytes: Uint8Array }).bytes).toString()) as StemsManifest;
  assert.equal(manifest.tracks[0]?.automated, true);
  assert.equal(manifest.tracks[0]?.gainDb, -3);
});

test("stem plan orders paths, JSON keys and cropped occurrence markers", async () => {
  const song = validateSong(fixture({ tailSeconds: 2, tracks: [
    { id: "lead", kind: "notes", instrument: "lead", pattern: "c4 ~ ~ ~", sends: { reverb: .2 } },
    { id: "bass", kind: "notes", instrument: "bass", pattern: "c2 ~ ~ ~" },
  ] }));
  const timeline = buildTimeline(song);
  const bars = { start: 1, end: 3 };
  const result = await mixTracks(song, timeline, "fixture.song.json", { stems: true, returns: true, premaster: true, bars });
  const plan = planStems(song, timeline, result, { bits: 24, includeMaster: false, includePremaster: true, bars });
  assert.deepEqual(plan.data.files, ["tracks/lead.wav", "tracks/bass.wav", "returns/reverb.wav", "premaster.wav", "stems.json"]);
  const manifest = JSON.parse(Buffer.from((plan.files.at(-1)! as { bytes: Uint8Array }).bytes).toString()) as StemsManifest;
  assert.deepEqual(Object.keys(manifest), ["version", "title", "bpm", "meter", "key", "sampleRate", "bits", "frames",
    "barOrigin", "bars", "loop", "sectionMarkers", "tracks", "returns", "master", "premaster"]);
  assert.equal(manifest.frames, 288000);
  assert.deepEqual(manifest.sectionMarkers, [
    { name: "hook", section: "hook", role: null, bar: 1, sourceBar: 2, seconds: 0 },
    { name: "hook (2)", section: "hook", role: null, bar: 2, sourceBar: 3, seconds: 2 },
  ]);
  assert.equal(manifest.master, null);
  assert.equal(manifest.premaster, "premaster.wav");
  assert.deepEqual(manifest.returns.map((row) => [row.id, row.legacy, row.params]), [["reverb", true, null]]);
  assert.equal((plan.files[0] as { seed: number }).seed, fnv1a32(song.seed, "lead", "wav"));
  validateStemsManifest(manifest, plan.files);
});

test("configured returns, master print and all Float32 components share one frame origin", async () => {
  const song = validateSong(fixture({ tailSeconds: 1, fx: { reverb: { mix: .25 }, delay: { mix: .2 } },
    master: { targetLufs: -14, fx: [{ type: "drive", amount: 3 }] },
    tracks: [
      { id: "kick", kind: "drums", instrument: "drums", pattern: "bd ~ ~ ~", sends: { reverb: .3, delay: .2 } },
      { id: "lead", kind: "notes", instrument: "lead", pattern: "c4 ~ ~ ~", gain: -3, pan: .2,
        duck: { by: "kick", amount: .4 }, fx: [{ type: "drive", amount: 2 }], sends: { reverb: .2, delay: .3 } },
    ] }));
  const timeline = buildTimeline(song);
  const result = await mixTracks(song, timeline, "fixture.song.json", { stems: true, returns: true, premaster: true });
  const plan = planStems(song, timeline, result, { bits: 16, includeMaster: true, includePremaster: true });
  assert.deepEqual(plan.data.files, ["tracks/kick.wav", "tracks/lead.wav", "returns/reverb.wav",
    "returns/delay.wav", "master.wav", "premaster.wav", "stems.json"]);
  assert.ok(plan.files.slice(0, -1).every((file) => "wav" in file && file.wav.left.length === result.audio.left.length));
  assert.ok(result.premaster!.left.some((sample, i) => sample !== result.audio.left[i]));
  const manifest = JSON.parse(Buffer.from((plan.files.at(-1)! as { bytes: Uint8Array }).bytes).toString()) as StemsManifest;
  assert.deepEqual(manifest.returns.map((row) => [row.id, row.legacy]), [["reverb", false], ["delay", false]]);
  assert.deepEqual(manifest.master?.processing, ["inserts", "saturation", "limiter"]);
  result.returns!.reverb!.left[0] = NaN;
  assert.throws(() => planStems(song, timeline, result,
    { bits: 16, includeMaster: true, includePremaster: true }), { code: "E_RENDER" });
});

test("no-send bus stays absent; malformed components and frame mismatch fail before writing", async () => {
  const song = validateSong(fixture({ fx: { reverb: { mix: .4 } } }));
  const timeline = buildTimeline(song);
  const result = await mixTracks(song, timeline, "fixture.song.json", { stems: true, returns: true, premaster: true });
  const options = { bits: 24 as const, includeMaster: false, includePremaster: false };
  const plan = planStems(song, timeline, result, options);
  assert.deepEqual(plan.data.files, ["tracks/lead.wav", "stems.json"]);
  const altered = { ...result, stems: [{ trackId: "wrong", audio: result.stems[0]!.audio }] };
  assert.throws(() => planStems(song, timeline, altered, options), (error: unknown) =>
    error instanceof Music2Error && error.code === "E_RENDER");
  const manifest = JSON.parse(Buffer.from((plan.files.at(-1)! as { bytes: Uint8Array }).bytes).toString()) as StemsManifest;
  const wrongFrames = { ...plan.files[0]!, wav: createStereo(song.sampleRate, 3) };
  assert.throws(() => validateStemsManifest(manifest, [wrongFrames, plan.files[1]!]), { code: "E_RENDER" });
  result.stems[0]!.audio.left[0] = NaN;
  assert.throws(() => planStems(song, timeline, result, options), { code: "E_RENDER" });
});

test("Float32 sum uses the documented per-frame tolerance", async () => {
  const song = validateSong(fixture({ tracks: [{ id: "silent", kind: "notes", instrument: "lead", pattern: "~" }] }));
  const result = await mixTracks(song, buildTimeline(song), "fixture.song.json",
    { stems: true, returns: true, premaster: true });
  const options = { bits: 24 as const, includeMaster: false, includePremaster: false };
  planStems(song, buildTimeline(song), result, options); // all zero
  result.stems[0]!.audio.left[0] = .5;
  result.premaster!.left[0] = .5;
  planStems(song, buildTimeline(song), result, options); // one source, exact equality
  result.premaster!.left[0] = .50000024;
  planStems(song, buildTimeline(song), result, options);
  result.premaster!.left[0] = .500002;
  assert.throws(() => planStems(song, buildTimeline(song), result, options), { code: "E_RENDER" });
});

test("3/4 at 44.1 kHz preserves the 198450/132300 frame boundary vectors", async () => {
  const song = validateSong(fixture({ sampleRate: 44100, meter: { numerator: 3, denominator: 4 },
    sections: [{ id: "verse", bars: 1 }], arrangement: [{ section: "verse", repeats: 3 }] }));
  const timeline = buildTimeline(song);
  const full = await mixTracks(song, timeline, "fixture.song.json", { stems: true, returns: true });
  const options = { bits: 24 as const, includeMaster: true, includePremaster: false };
  assert.equal(planStems(song, timeline, full, options).data.frames, 198450);
  const bars = { start: 1, end: 3 };
  const crop = await mixTracks(song, timeline, "fixture.song.json", { stems: true, returns: true, bars });
  const plan = planStems(song, timeline, crop, { ...options, bars });
  assert.equal(plan.data.frames, 132300);
  const manifest = JSON.parse(Buffer.from((plan.files.at(-1)! as { bytes: Uint8Array }).bytes).toString()) as StemsManifest;
  assert.equal(manifest.barOrigin, 2);
  assert.deepEqual(manifest.sectionMarkers[1],
    { name: "verse (3)", section: "verse", role: null, bar: 2, sourceBar: 3, seconds: 1.5 });
});
