import { test } from "node:test";
import assert from "node:assert/strict";
import { resolve } from "node:path";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createStereo, writeWav } from "../audio-io/index.ts";
import { buildTimeline, loadSong, validateSong } from "../song/index.ts";
import { Music2Error } from "../shared/index.ts";
import { renderSong } from "./render.tool.ts";

const drillPath = resolve("examples/drill-140.song.json");

test("drill duration and crop preserve full-timeline event addressing", async () => {
  const song = await loadSong(drillPath);
  const timeline = buildTimeline(song);
  const full = await renderSong(song, drillPath, { stems: true });
  assert.equal(full.bars, 16);
  assert.equal(full.audio.left.length, Math.ceil((16 * 4 * 60 / 140 + 2) * 44100));
  assert.ok(full.events > 0);
  const crop = await renderSong(song, drillPath, { bars: { start: 4, end: 12 }, stems: true });
  assert.equal(crop.bars, 8);
  assert.equal(crop.audio.left.length, Math.ceil((8 * 4 * 60 / 140 + 2) * 44100));
  const firstHook = timeline.events.find((event) => event.bar === 4 && event.track === "kick")!;
  assert.ok(Math.abs(firstHook.time - 4 * timeline.secondsPerBar) < 1e-8);
  const hookFrame = Math.round(firstHook.time * song.sampleRate);
  assert.deepEqual(crop.stems[0]!.audio.left.slice(0, 10000),
    full.stems[0]!.audio.left.slice(hookFrame, hookFrame + 10000));
  assert.ok(crop.events < full.events);
  assert.ok(crop.audio.left.some((sample) => sample !== 0));
});

test("same drill renders identical PCM; elapsed time is reported", async () => {
  const song = await loadSong(drillPath);
  const start = performance.now();
  const first = await renderSong(song, drillPath);
  const elapsed = performance.now() - start;
  const second = await renderSong(song, drillPath);
  assert.deepEqual(first.audio.left, second.audio.left);
  assert.deepEqual(first.audio.right, second.audio.right);
  assert.ok(first.peakDbfs <= song.master.ceilingDb);
  assert.ok(first.truePeakDbtp <= song.master.ceilingDb + .1);
  console.log(`drill render ${elapsed.toFixed(1)} ms`);
});

test("mono overlap is single-valued while poly chord sums", async () => {
  const song = validateSong({ version: 1, bpm: 120, tailSeconds: 0,
    tracks: [
      { id: "sub", kind: "notes", instrument: "808", mono: true, pattern: "c2 g2 ~ ~" },
      { id: "bell", kind: "notes", instrument: "bell", pattern: "[c5,e5] ~ ~ ~" },
    ], sections: [{ id: "one", bars: 1 }], arrangement: [{ section: "one" }] });
  const result = await renderSong(song, "fixture.song.json", { stems: true });
  assert.equal(result.events, 4);
  assert.ok(result.stems[0]!.audio.left.some((sample) => sample !== 0));
  assert.ok(result.stems[1]!.audio.left.some((sample) => sample !== 0));
});

test("simultaneous mono notes retain the final Timeline event", async () => {
  const make = (pattern: string) => validateSong({ version: 1, bpm: 120, tailSeconds: 0,
    tracks: [{ id: "sub", kind: "notes", instrument: "808", pattern }],
    sections: [{ id: "one", bars: 1 }], arrangement: [{ section: "one" }] });
  const layered = make("[c2,g2] ~ ~ ~");
  const single = make("g2 ~ ~ ~");
  const both = await renderSong(layered, "fixture.song.json", { stems: true });
  const last = await renderSong(single, "fixture.song.json", { stems: true });
  assert.deepEqual(both.stems[0]!.audio.left, last.stems[0]!.audio.left);
});

test("targetLufs no longer blocks render validation; bad drum names point to track index", async () => {
  const song = validateSong({ version: 1, bpm: 120, master: { targetLufs: -14 },
    tracks: [{ id: "drum", kind: "drums", instrument: "drums", pattern: "cowbell" }],
    sections: [{ id: "one", bars: 1 }], arrangement: [{ section: "one" }] });
  await assert.rejects(renderSong(song, "fixture.song.json"),
    (error: unknown) => error instanceof Music2Error && error.code === "E_SCHEMA" &&
      (error.details?.["issues"] as { path: string }[])[0]?.path === "tracks[0].pattern");
});

test("list notes render audible PCM and declared samples report their input index", async () => {
  const source = (sample: string) => validateSong({ version: 1, bpm: 120, tailSeconds: 0,
    tracks: [{ id: "beat", kind: "drums", instrument: "drums", notes: [
      { start: 1, length: .25, sample: "bd" }, { start: 0, length: .25, sample }] }],
    sections: [{ id: "one", bars: 1 }], arrangement: [{ section: "one" }] });
  const rendered = await renderSong(source("sd"), "fixture.song.json");
  assert.equal(rendered.events, 2);
  assert.ok(rendered.audio.left.some((sample) => sample !== 0));
  await assert.rejects(renderSong(source("cowbell"), "fixture.song.json"), (error: unknown) =>
    sampleIssue(error, "tracks[0].notes[1].sample"));
});

test("list pitch errors point to the note field after timeline sorting", async () => {
  const song = validateSong({ version: 1, bpm: 120, tailSeconds: 0,
    tracks: [{ id: "lead", kind: "notes", instrument: "piano", notes: [
      { start: 1, length: 1, pitch: 64 }, { start: 0, length: 1, pitch: 60 }] }],
    sections: [{ id: "one", bars: 1 }], arrangement: [{ section: "one" }] });
  song.tracks[0]!.notes!.find((note) => note.inputIndex === 0)!.pitch = 128;
  await assert.rejects(renderSong(song, "fixture.song.json"), (error: unknown) =>
    sampleIssue(error, "tracks[0].notes[0].pitch"));
});

test("automation remains capability-gated before partial mixing", async () => {
  const base = (instrument = "piano") => validateSong({ version: 1, bpm: 120,
    tracks: [{ id: "lead", kind: "notes", instrument, pattern: "c4" }],
    sections: [{ id: "one", bars: 1 }], arrangement: [{ section: "one" }] });
  const automation = base();
  automation.tracks[0]!.automation = [{ target: "gain", points: [{ tick: 0, value: 0, curve: "linear" }] }];
  for (const song of [automation]) {
    await assert.rejects(renderSong(song, "fixture.song.json"), (error: unknown) =>
      error instanceof Music2Error && error.code === "E_CAPABILITY" && error.exit === 3);
  }
});

function sampleIssue(error: unknown, path: string): boolean {
  return error instanceof Music2Error && error.code === "E_SCHEMA" &&
    (error.details?.["issues"] as { path: string }[])[0]?.path === path;
}

test("declared atom names reject the opposite built-in voice at each base path", async () => {
  for (const [instrument, pattern] of [["drums", "riser"], ["sfx", "bd"]]) {
    const song = validateSong({ version: 1, bpm: 120,
      tracks: [{ id: "cue", kind: "drums", instrument, pattern }],
      sections: [{ id: "one", bars: 1 }], arrangement: [{ section: "one" }] });
    await assert.rejects(renderSong(song, "fixture.song.json"), (error: unknown) =>
      sampleIssue(error, "tracks[0].pattern"));
  }
});

test("all section override branches validate, including unplaced sections", async () => {
  const song = validateSong({ version: 1, bpm: 120,
    tracks: [{ id: "cue", kind: "drums", instrument: "sfx", pattern: "riser" }],
    sections: [
      { id: "active", bars: 1, patterns: { cue: "[riser|bd]" } },
      { id: "unused", bars: 1, patterns: { cue: "whoosh mystery" } },
    ], arrangement: [{ section: "active" }] });
  await assert.rejects(renderSong(song, "fixture.song.json"), (error: unknown) =>
    sampleIssue(error, "sections[0].patterns.cue"));
  song.sections[0]!.patterns["cue"] = "impact";
  await assert.rejects(renderSong(song, "fixture.song.json"), (error: unknown) =>
    sampleIssue(error, "sections[1].patterns.cue"));
});

test("unplaced drum overrides reject unknown atoms before mixing", async () => {
  const song = validateSong({ version: 1, bpm: 120,
    tracks: [{ id: "drum", kind: "drums", instrument: "drums", pattern: "bd" }],
    sections: [{ id: "active", bars: 1 }, { id: "unused", bars: 1, patterns: { drum: "[sd|cowbell]" } }],
    arrangement: [{ section: "active" }] });
  await assert.rejects(renderSong(song, "fixture.song.json"), (error: unknown) =>
    sampleIssue(error, "sections[1].patterns.drum"));
});

test("kit manifest names remain separate from built-in declared names", async (t) => {
  const dir = await mkdtemp(join(tmpdir(), "music2-declared-kit-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const kitDir = join(dir, "kit");
  await mkdir(kitDir);
  const audio = createStereo(44100, 64);
  audio.left[0] = .5; audio.right[0] = .5;
  await writeWav(join(kitDir, "hit.wav"), audio, { bits: 16, seed: 1 });
  await writeFile(join(kitDir, "kit.json"), JSON.stringify({ version: 1, samples: { riser: ["hit.wav"] } }));
  const song = validateSong({ version: 1, bpm: 120, tailSeconds: 0,
    tracks: [{ id: "cue", kind: "drums", instrument: "kit:kit", pattern: "riser" },
      { id: "drum", kind: "drums", instrument: "drums", pattern: "bd" }],
    sections: [{ id: "one", bars: 1 }], arrangement: [{ section: "one" }] });
  const result = await renderSong(song, join(dir, "song.json"));
  assert.equal(result.events, 2);
  assert.ok(result.audio.left.some((sample) => sample !== 0));
});

test("optional 180-second six-track benchmark", { skip: process.env.MUSIC2_BENCH !== "1" }, async () => {
  const song = await loadSong(drillPath);
  song.arrangement = [{ section: "hook", repeats: 13 }];
  const start = performance.now();
  const result = await renderSong(song, drillPath);
  const elapsed = performance.now() - start;
  console.log(`180-second six-track render ${elapsed.toFixed(1)} ms`);
  assert.ok(result.durationSeconds >= 180);
  assert.ok(elapsed < 20000, `render took ${elapsed.toFixed(1)} ms`);
});

test("explicit drums kit 0 writes the same WAV bytes as an omitted kit", async () => {
  const dir = await mkdtemp(join(tmpdir(), "music2-kit0-"));
  try {
    const build = (params: Record<string, number>) => validateSong({ version: 1, bpm: 120, seed: 4,
      tracks: [{ id: "d", kind: "drums", instrument: "drums", pattern: "bd sd:2 hh oh", params }],
      sections: [{ id: "a", bars: 2 }], arrangement: [{ section: "a" }] });
    const omitted = await renderSong(build({ tone: 0.4 }), join(dir, "a.song.json"));
    const explicit = await renderSong(build({ tone: 0.4, kit: 0 }), join(dir, "b.song.json"));
    await writeWav(join(dir, "a.wav"), omitted.audio, { bits: 16, seed: 4 });
    await writeWav(join(dir, "b.wav"), explicit.audio, { bits: 16, seed: 4 });
    assert.deepEqual(await readFile(join(dir, "a.wav")), await readFile(join(dir, "b.wav")));
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test("SFZ plus audio clip renders and surfaces parser warnings", async () => {
  const dir = await mkdtemp(join(tmpdir(), "music2-render-sfz-"));
  try {
    const audio = createStereo(44100, 44100);
    for (let i = 0; i < audio.left.length; i++) audio.left[i] = Math.sin(2 * Math.PI * 440 * i / 44100) * .25;
    await writeWav(join(dir, "tone.wav"), audio, { bits: 16, seed: 1 });
    await writeFile(join(dir, "tone.sfz"), "<region> sample=tone.wav key=69 pitch_keycenter=69 unsupported_wp5=1\n");
    const song = validateSong({ version: 1, bpm: 120, sampleRate: 44100,
      tracks: [{ id: "sfz", kind: "notes", instrument: "sfz:tone.sfz", pattern: "a4 ~ ~ ~" }],
      audioTracks: [{ id: "clip", clips: [{ file: "tone.wav", start: 0, length: 1, fadeIn: 0, fadeOut: 0 }] }],
      sections: [{ id: "one", bars: 1 }], arrangement: [{ section: "one" }] });
    const rendered = await renderSong(song, join(dir, "song.json"), { stems: true, returns: true, premaster: true });
    assert.equal(rendered.stems.length, 2);
    assert.equal(rendered.audio.left.length, 88200);
    assert.ok(rendered.warnings?.some((warning) => warning.includes("unsupported_wp5")));
    assert.ok(rendered.stems[0]!.audio.left.some((value) => value !== 0));
    assert.ok(rendered.stems[1]!.audio.left.some((value) => value !== 0));
    const partial = await renderSong(song, join(dir, "song.json"), { bars: { start: 0, end: 1 }, stems: true });
    assert.deepEqual(partial.stems[1]!.audio.left, rendered.stems[1]!.audio.left);
    const taped = validateSong({ version: 1, bpm: 120, sampleRate: 44100,
      tracks: [{ id: "sfz", kind: "notes", instrument: "sfz:tone.sfz", pattern: "a4 ~ ~ ~",
        fx: [{ type: "tapestop", startBar: 2, beats: 2 }] }],
      audioTracks: [{ id: "clip", clips: [{ file: "tone.wav", start: 3, length: 2, fadeIn: 0, fadeOut: 0 }] }],
      sections: [{ id: "two", bars: 2 }], arrangement: [{ section: "two" }] });
    const tapedCrop = await renderSong(taped, join(dir, "song.json"), { bars: { start: 1, end: 2 }, stems: true });
    assert.equal(tapedCrop.stems.length, 2);
    assert.equal(tapedCrop.stems[0]!.audio.left.length, 88200);
    assert.ok(tapedCrop.stems[0]!.audio.right.every((value) => value === 0));
  } finally { await rm(dir, { recursive: true, force: true }); }
});
