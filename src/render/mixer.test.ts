import { test } from "node:test";
import assert from "node:assert/strict";
import { buildTimeline, validateSong } from "../song/index.ts";
import { createStereo, measureLoudness, peakLinear, truePeakLinear, writeWav } from "../audio-io/index.ts";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { fnv1a32, Music2Error, packageRoot } from "../shared/index.ts";
import type { Song } from "../song/index.ts";
import { mixTracks } from "./mixer.tool.ts";

function fixture(overrides: Partial<Song> = {}): Song {
  return { version: 1, bpm: 120, sampleRate: 44100, tailSeconds: 0,
    tracks: [{ id: "lead", kind: "notes", instrument: "lead", pattern: "c4 ~ ~ ~" }],
    sections: [{ id: "one", bars: 1 }], arrangement: [{ section: "one" }], ...overrides };
}
function rms(input: Float32Array, end = input.length): number {
  let sum = 0;
  for (let i = 0; i < end; i++) sum += input[i]! * input[i]!;
  return Math.sqrt(sum / end);
}

// Digest recorded on Node 24 / macOS; float library differences can change bytes on other platforms or Node majors.
const digestPlatform = process.platform === "darwin" && process.versions.node.startsWith("24.");

test("drill-140 no-FX WAV retains the pre-integration byte digest", { skip: !digestPlatform && "digest is pinned to the recording platform" }, async () => {
  const source = join(packageRoot(), "examples/drill-140.song.json");
  const song = validateSong(JSON.parse(readFileSync(source, "utf8")) as unknown);
  const result = await mixTracks(song, buildTimeline(song), source);
  const dir = await mkdtemp(join(tmpdir(), "music2-fx-digest-"));
  try {
    const wav = join(dir, "drill.wav");
    await writeWav(wav, result.audio, { bits: 16, seed: fnv1a32(song.seed, "master", "wav") });
    assert.equal(createHash("sha256").update(readFileSync(wav)).digest("hex"),
      "3170c6f0981f68875dce2e972b46f49f5d7063c25d229867aa8069c23cceca33");
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test("stereo insert is reflected in dry stems and remains before sends", async () => {
  const base = fixture({ tracks: [{ id: "lead", kind: "notes", instrument: "lead", pattern: "c4 ~ ~ ~",
    fx: [{ type: "drive", amount: 3, mix: 1 }], sends: { delay: 0.3 }, pan: 0.25 }] });
  const song = validateSong(base);
  const result = await mixTracks(song, buildTimeline(song), "fixture.song.json", { stems: true });
  const plain = validateSong({ ...base, tracks: [{ ...base.tracks[0]!, fx: [] }] });
  const before = await mixTracks(plain, buildTimeline(plain), "fixture.song.json", { stems: true });
  assert.notDeepEqual(result.stems[0]!.audio.left, before.stems[0]!.audio.left);
  assert.ok(rms(result.stems[0]!.audio.left) > 0);
  assert.ok(result.audio.left.some((sample, i) => sample !== result.stems[0]!.audio.left[i]));
});

test("configured buses and master inserts remain finite and ceiling-limited", async () => {
  const song = validateSong(fixture({ fx: { reverb: { type: "room", mix: 0.2 }, delay: { time: "1/8", mix: 0.2 } },
    master: { ceilingDb: -3, fx: [{ type: "drive", amount: 2, mix: 0.2 }] },
    tracks: [{ id: "lead", kind: "notes", instrument: "lead", pattern: "c4 ~ ~ ~",
      sends: { reverb: 0.2, delay: 0.2 } }] }));
  const result = await mixTracks(song, buildTimeline(song), "fixture.song.json");
  assert.ok(result.audio.left.every(Number.isFinite));
  assert.ok(result.audio.right.every(Number.isFinite));
  assert.ok(result.truePeakDbtp <= -2.9);
});

test("center pan retains insert stereo while hard pan attenuates the opposite side", async () => {
  const track = { id: "lead", kind: "notes" as const, instrument: "lead", pattern: "c4 ~ ~ ~",
    fx: [{ type: "chorus" as const, mix: 1 }] };
  const center = validateSong(fixture({ tracks: [track] }));
  const a = await mixTracks(center, buildTimeline(center), "fixture.song.json", { stems: true });
  assert.ok(a.stems[0]!.audio.left.some((sample, i) => sample !== a.stems[0]!.audio.right[i]));
  const left = validateSong(fixture({ tracks: [{ ...track, pan: -1 }] }));
  const b = await mixTracks(left, buildTimeline(left), "fixture.song.json", { stems: true });
  assert.ok(rms(b.stems[0]!.audio.right) < 1e-6);
});

test("empty song.fx preserves both legacy send processors", async () => {
  const source = fixture({ tracks: [{ id: "lead", kind: "notes", instrument: "lead", pattern: "c4 ~ ~ ~",
    sends: { reverb: 0.2, delay: 0.2 } }] });
  const legacy = validateSong(source);
  const empty = validateSong({ ...source, fx: {} });
  const a = await mixTracks(legacy, buildTimeline(legacy), "fixture.song.json");
  const b = await mixTracks(empty, buildTimeline(empty), "fixture.song.json");
  assert.deepEqual(a.audio.left, b.audio.left);
  assert.deepEqual(a.audio.right, b.audio.right);
});

test("tapestop partial stems equal the full-song window with earlier sustained notes in 4/4 and 3/4", async () => {
  for (const meter of [4, 3]) {
    const cropStart = meter === 4 ? 1 : 2;
    const startBar = cropStart + 1;
    const source = fixture({ meter: { numerator: meter, denominator: 4 }, tailSeconds: 0,
      tracks: [{ id: "pad", kind: "notes", instrument: "pad", pattern: "c4",
        fx: [{ type: "tapestop", startBar, beats: 2 }] }],
      sections: [{ id: "notes", bars: cropStart }, { id: "rest", bars: 2, patterns: { pad: "~" } }],
      arrangement: [{ section: "notes" }, { section: "rest" }] });
    const song = validateSong(source);
    const timeline = buildTimeline(song);
    const full = await mixTracks(song, timeline, "fixture.song.json", { stems: true });
    const cropped = await mixTracks(song, timeline, "fixture.song.json",
      { bars: { start: cropStart, end: timeline.bars }, stems: true });
    const offset = Math.round(cropStart * timeline.secondsPerBar * song.sampleRate);
    assert.deepEqual(cropped.stems[0]!.audio.left,
      full.stems[0]!.audio.left.subarray(offset, offset + cropped.stems[0]!.audio.left.length));
    assert.deepEqual(cropped.stems[0]!.audio.right,
      full.stems[0]!.audio.right.subarray(offset, offset + cropped.stems[0]!.audio.right.length));
    assert.ok(cropped.stems[0]!.audio.left.subarray(0, 1000).some((sample) => sample !== 0));
    assert.equal((startBar - 1) * timeline.secondsPerBar, meter === 3 ? 3 : 2);
  }
});

test("tapestop respects its declared position relative to EQ", async () => {
  const eq = { type: "eq" as const, midGainDb: 12, midHz: 500 };
  const tape = { type: "tapestop" as const, startBar: 1, beats: 2 };
  const source = fixture({ tracks: [{ id: "lead", kind: "notes", instrument: "lead", pattern: "c4",
    fx: [eq, tape] }] });
  const first = validateSong(source);
  const second = validateSong({ ...source, tracks: [{ ...source.tracks[0]!, fx: [tape, eq] }] });
  const before = await mixTracks(first, buildTimeline(first), "fixture.song.json", { stems: true });
  const after = await mixTracks(second, buildTimeline(second), "fixture.song.json", { stems: true });
  let delta = 0;
  for (let i = 0; i < before.stems[0]!.audio.left.length; i++) {
    delta += Math.abs(before.stems[0]!.audio.left[i]! - after.stems[0]!.audio.left[i]!);
  }
  assert.ok(delta > 1, `chain-order difference ${delta}`);
});

 test("center and hard-left pan; dry gain is in dB before master", async () => {
  const base = fixture();
  const center = validateSong(base);
  const centered = await mixTracks(center, buildTimeline(center), "fixture.song.json", { stems: true });
  assert.deepEqual(centered.stems[0]!.audio.left, centered.stems[0]!.audio.right);
  const leftSong = validateSong(fixture({ tracks: [{ ...base.tracks[0]!, pan: -1 }] }));
  const left = await mixTracks(leftSong, buildTimeline(leftSong), "fixture.song.json", { stems: true });
  assert.ok(rms(left.stems[0]!.audio.right) < 1e-6);
  const hotSong = validateSong(fixture({ tracks: [{ ...base.tracks[0]!, gain: 6 }] }));
  const hot = await mixTracks(hotSong, buildTimeline(hotSong), "fixture.song.json", { stems: true });
  assert.ok(Math.abs(rms(hot.stems[0]!.audio.left) / rms(centered.stems[0]!.audio.left) - 10 ** (6 / 20)) < 1e-4);
});

test("duck onset halves a target dry stem", async () => {
  const tracks: Song["tracks"] = [
    { id: "kick", kind: "drums", instrument: "drums", pattern: "bd ~ ~ ~" },
    { id: "lead", kind: "notes", instrument: "lead", pattern: "c4 ~ ~ ~", duck: { by: "kick", amount: .5, releaseMs: 1000 } },
  ];
  const ducked = validateSong(fixture({ tracks }));
  const plain = validateSong(fixture({ tracks: [tracks[0]!, { ...tracks[1]!, duck: { by: "kick", amount: 0 } }] }));
  const a = await mixTracks(ducked, buildTimeline(ducked), "fixture.song.json", { stems: true });
  const b = await mixTracks(plain, buildTimeline(plain), "fixture.song.json", { stems: true });
  const frame = 300;
  const ratio = a.stems[1]!.audio.left[frame]! / b.stems[1]!.audio.left[frame]!;
  assert.ok(ratio > .5 && ratio < .51);
});

test("silence remains zero and reports negative infinity", async () => {
  const song = validateSong(fixture({ tracks: [{ id: "lead", kind: "notes", instrument: "lead", pattern: "~" }] }));
  const result = await mixTracks(song, buildTimeline(song), "fixture.song.json");
  assert.equal(result.peakDbfs, -Infinity);
  assert.equal(result.truePeakDbtp, -Infinity);
  assert.equal(rms(result.audio.left), 0);
});

test("nonfinite gain is rejected at mix boundary", async () => {
  const song = validateSong(fixture());
  song.tracks[0]!.gain = NaN;
  await assert.rejects(mixTracks(song, buildTimeline(song), "fixture.song.json"),
    (error: unknown) => error instanceof Music2Error && error.code === "E_RENDER");
});

test("peak and true peak remain below ceiling", async () => {
  const song = validateSong(fixture({ master: { gainDb: 12, ceilingDb: -3 } }));
  const result = await mixTracks(song, buildTimeline(song), "fixture.song.json");
  assert.ok(result.peakDbfs <= -3 + 1e-5);
  assert.ok(result.truePeakDbtp <= -2.9);
  assert.ok(Math.abs(result.truePeakDbtp - 20 * Math.log10(truePeakLinear(result.audio))) < 1e-8);
});

test("loop folds the rendered release, trims stems, and rejects partial bars", async () => {
  const source = fixture({ loop: true, tailSeconds: 2, master: { ceilingDb: -3 },
    tracks: [{ id: "hit", kind: "notes", instrument: "bell", pattern: "~ ~ ~ c4",
      sends: { reverb: .4, delay: .3 } }] });
  const loop = validateSong(source);
  const timeline = buildTimeline(loop);
  const rendered = await mixTracks(loop, timeline, "fixture.song.json", { stems: true });
  const frames = Math.ceil(timeline.durationSeconds * loop.sampleRate);
  assert.deepEqual(rendered.loop, { startSample: 0, endSample: frames });
  assert.equal(rendered.audio.left.length, frames);
  assert.equal(rendered.stems[0]!.audio.left.length, frames);
  assert.ok(rendered.truePeakDbtp <= -2.9);
  const normal = validateSong({ ...source, loop: false });
  const unwrapped = await mixTracks(normal, buildTimeline(normal), "fixture.song.json", { stems: true });
  assert.equal(unwrapped.loop, null);
  assert.equal(unwrapped.audio.left.length, Math.ceil((timeline.durationSeconds + 2) * loop.sampleRate));
  assert.notDeepEqual(rendered.audio.left.subarray(0, 100), unwrapped.audio.left.subarray(0, 100));
  await assert.rejects(mixTracks(loop, timeline, "fixture.song.json", { bars: { start: 0, end: 1 } }), { code: "E_INPUT" });
});

test("loop tail longer than body adds each stereo frame at its modulo position exactly once", async () => {
  const source = fixture({ loop: true, tailSeconds: 5,
    tracks: [{ id: "hit", kind: "notes", instrument: "bell", gain: -30, pan: -.5,
      pattern: "~ ~ ~ c4", sends: { reverb: .5, delay: .4 } }] });
  const loop = validateSong(source);
  const normal = validateSong({ ...source, loop: false });
  const timeline = buildTimeline(loop);
  const wrapped = await mixTracks(loop, timeline, "fixture.song.json", { mastering: "lufs" });
  const expanded = await mixTracks(normal, buildTimeline(normal), "fixture.song.json", { mastering: "lufs" });
  const body = wrapped.audio.left.length;
  const unmaster = (value: number): number => Math.atanh(value * 1.2) / 1.2;
  for (const side of ["left", "right"] as const) for (let i = 0; i < 1000; i++) {
    let expected = 0;
    for (let sourceFrame = i; sourceFrame < expanded.audio[side].length; sourceFrame += body) {
      expected += unmaster(expanded.audio[side][sourceFrame]!);
    }
    assert.ok(Math.abs(unmaster(wrapped.audio[side][i]!) - expected) < 2e-6,
      `${side} frame ${i}`);
  }
});

test("drill target -14 LUFS uses static loudness gain before limiting", async () => {
  const song = validateSong(fixture({ master: { targetLufs: -14 },
    tracks: [{ id: "kick", kind: "drums", instrument: "drums", pattern: "bd ~ sd ~" },
      { id: "hats", kind: "drums", instrument: "drums", pattern: "hh hh hh hh" },
      { id: "bass", kind: "notes", instrument: "808", pattern: "c2 ~ c2 ~" }],
    sections: [{ id: "one", bars: 4 }], arrangement: [{ section: "one" }] }));
  const result = await mixTracks(song, buildTimeline(song), "fixture.song.json");
  const measured = measureLoudness(result.audio).integratedLufs;
  assert.ok(measured !== null && measured > -16 && measured < -13, String(measured));
});


test("intersample impulse is limited below the true-peak ceiling", async () => {
  const dir = await mkdtemp(join(tmpdir(), "music2-intersample-"));
  try {
    const impulse = createStereo(44100, 16);
    impulse.left[1] = 1; impulse.left[2] = 1;
    impulse.right[1] = 1; impulse.right[2] = 1;
    assert.ok(truePeakLinear(impulse) > peakLinear(impulse) * 1.1);
    await writeWav(join(dir, "pulse.wav"), impulse, { bits: 24, seed: 0 });
    await writeFile(join(dir, "kit.json"), JSON.stringify({ version: 1, samples: { bd: ["pulse.wav"] } }));
    const song = validateSong(fixture({ master: { ceilingDb: -3 },
      tracks: [{ id: "pulse", kind: "drums", instrument: "kit:.", pattern: "bd ~ ~ ~" }] }));
    const result = await mixTracks(song, buildTimeline(song), join(dir, "song.json"));
    assert.ok(result.peakDbfs <= -3);
    assert.ok(result.truePeakDbtp <= -2.9);
    assert.ok(result.audio.left.some((sample) => sample !== 0));
  } finally { await rm(dir, { recursive: true, force: true }); }
});
