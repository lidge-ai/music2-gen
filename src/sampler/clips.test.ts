import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { StereoBuffer } from "../audio-io/buffer.schema.ts";
import { writeWav } from "../audio-io/wav.tool.ts";
import type { ResolvedAudioTrack, ResolvedClip } from "../song/song-daw.schema.ts";
import { loadClipSources, renderClips } from "./clips.tool.ts";
import { createDecodeBudget } from "./decode-budget.tool.ts";

const RATE = 44100;
function tone(seconds: number): StereoBuffer {
  const length = Math.round(seconds * RATE);
  const left = new Float32Array(length);
  const right = new Float32Array(length);
  for (let i = 0; i < length; i++) left[i] = Math.sin(2 * Math.PI * 440 * i / RATE) * 0.5;
  return { sampleRate: RATE, left, right, sourceChannels: 2 };
}
function clip(stretch: ResolvedClip["stretch"], changes: Partial<ResolvedClip> = {}): ResolvedClip {
  return { tick: 0, lengthTicks: 3840, file: "sample.wav", offsetSeconds: 0, gainDb: 0,
    pitchSemitones: 0, stretch, fadeInSeconds: 0, fadeOutSeconds: 0, ...changes };
}
function track(...clips: ResolvedClip[]): ResolvedAudioTrack {
  return { id: "audio", gain: 0, pan: 0, sends: { reverb: 0, delay: 0 }, fx: [], duck: null, clips };
}
function frequency(audio: Float32Array, start: number, end: number): number {
  const crossings: number[] = [];
  for (let i = start + 1; i < end; i++) {
    const previous = audio[i - 1]!;
    const current = audio[i]!;
    if (previous < 0 && current >= 0) crossings.push(i - 1 - previous / (current - previous));
  }
  return (crossings.length - 1) * RATE / (crossings.at(-1)! - crossings[0]!);
}

test("tempo 120 to 150 contracts two seconds to 1.6 seconds without repitching", () => {
  const source = tone(2);
  const sources = new Map([["sample.wav", source]]);
  const at120 = renderClips(track(clip({ mode: "tempo", sourceBpm: 120 })), sources,
    { sampleRate: RATE, bpm: 120, startFrame: 0, frames: 2 * RATE });
  const at150 = renderClips(track(clip({ mode: "tempo", sourceBpm: 120 })), sources,
    { sampleRate: RATE, bpm: 150, startFrame: 0, frames: Math.round(1.6 * RATE) });
  assert.equal(at120.left.length, 2 * RATE);
  assert.equal(at150.left.length, Math.round(1.6 * RATE));
  assert.ok(Math.abs(frequency(at120.left, RATE / 2, RATE) - 440) < 2);
  assert.ok(Math.abs(frequency(at150.left, RATE / 3, RATE) - 440) < 2);
});

test("varispeed changes pitch and fit keeps target length through pitch shift", () => {
  const sources = new Map([["sample.wav", tone(2)]]);
  const sped = renderClips(track(clip({ mode: "varispeed", ratio: 1.25 })), sources,
    { sampleRate: RATE, bpm: 150, startFrame: 0, frames: Math.round(1.6 * RATE) });
  assert.ok(Math.abs(frequency(sped.left, RATE / 3, RATE) - 550) < 2);
  const fit = renderClips(track(clip({ mode: "fit", sourceSeconds: 2 }, { pitchSemitones: 12 })), sources,
    { sampleRate: RATE, bpm: 150, startFrame: 0, frames: Math.round(1.6 * RATE) });
  assert.equal(fit.left.length, Math.round(1.6 * RATE));
  assert.ok(Math.abs(frequency(fit.left, RATE / 3, RATE) - 880) < 3);
});

test("absolute crop equals the full clip window and preserves channel separation", () => {
  const source = tone(2);
  const sources = new Map([["sample.wav", source]]);
  const lane = track(clip({ mode: "none" }, { tick: 960, lengthTicks: 2880, offsetSeconds: 0.25,
    gainDb: -6, fadeInSeconds: 0.01, fadeOutSeconds: 0.01 }));
  const full = renderClips(lane, sources, { sampleRate: RATE, bpm: 120, startFrame: 0, frames: 2 * RATE });
  const crop = renderClips(lane, sources, { sampleRate: RATE, bpm: 120, startFrame: RATE, frames: RATE / 2 });
  assert.deepEqual(crop.left, full.left.slice(RATE, RATE * 1.5));
  assert.deepEqual(crop.right, full.right.slice(RATE, RATE * 1.5));
  assert.ok(Math.abs(full.left[RATE / 2 + 500]! - source.left[Math.round(0.25 * RATE) + 500]! * 10 ** (-6 / 20)) < 1e-6);
  assert.ok(crop.left.some((value) => value !== 0));
  assert.ok(crop.right.every((value) => value === 0));
  assert.throws(() => renderClips(track(clip({ mode: "none" }, { offsetSeconds: 2 })), sources,
    { sampleRate: RATE, bpm: 120, startFrame: 0, frames: RATE }), { code: "E_INPUT" });
});

test("source loading caches aliases and rejects symlink escape", async () => {
  const root = await mkdtemp(join(tmpdir(), "music2-clips-"));
  const outside = await mkdtemp(join(tmpdir(), "music2-clips-outside-"));
  try {
    await writeWav(join(root, "source.wav"), tone(0.1), { bits: 24, seed: 1 });
    await writeWav(join(outside, "outside.wav"), tone(0.1), { bits: 16, seed: 1 });
    await symlink(join(outside, "outside.wav"), join(root, "escaped.wav"));
    const clips = [clip({ mode: "none" }, { file: "source.wav" }),
      clip({ mode: "none" }, { file: "./source.wav" })];
    const loaded = await loadClipSources(join(root, "song.json"), clips);
    assert.equal(loaded.get("source.wav"), loaded.get("./source.wav"));
    await assert.rejects(loadClipSources(join(root, "song.json"), [clip({ mode: "none" }, { file: "escaped.wav" })]),
      { code: "E_ACCESS" });
    await assert.rejects(loadClipSources(join(root, "song.json"), [clip({ mode: "none" }, { file: "../outside.wav" })]),
      { code: "E_ACCESS" });
    await writeFile(join(root, "broken.wav"), "not a RIFF file");
    await assert.rejects(loadClipSources(join(root, "song.json"), [clip({ mode: "none" }, { file: "broken.wav" })]),
      (error: unknown) => typeof error === "object" && error !== null && "details" in error
        && (error as { details: { file: string } }).details.file === "broken.wav");
    const budget = createDecodeBudget(tone(0.1).left.byteLength * 2);
    const shared = await loadClipSources(join(root, "song.json"), [clips[0]!], budget);
    assert.equal((await loadClipSources(join(root, "song.json"), [clips[1]!], budget)).get("./source.wav"),
      shared.get("source.wav"));
  } finally {
    await rm(root, { recursive: true, force: true });
    await rm(outside, { recursive: true, force: true });
  }
});
