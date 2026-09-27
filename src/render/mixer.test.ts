import { test } from "node:test";
import assert from "node:assert/strict";
import { buildTimeline, validateSong } from "../song/index.ts";
import { createStereo, measureLoudness, peakLinear, truePeakLinear, writeWav } from "../audio-io/index.ts";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Music2Error } from "../shared/index.ts";
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
