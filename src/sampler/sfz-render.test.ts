import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, symlink, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadSfz, renderSfz } from "./sfz-render.tool.ts";
import type { SfzEvent } from "./sfz.schema.ts";

function wav(values: readonly number[], rate = 48000, smpl?: { unity: number; fraction: number; start: number; end: number }): Buffer {
  const data = Buffer.alloc(values.length * 2);
  values.forEach((value, i) => data.writeInt16LE(Math.round(value * 32767), i * 2));
  const meta = smpl ? Buffer.alloc(68) : Buffer.alloc(0);
  if (smpl) {
    meta.write("smpl", 0); meta.writeUInt32LE(60, 4);
    meta.writeUInt32LE(smpl.unity, 20); meta.writeUInt32LE(smpl.fraction, 24);
    meta.writeUInt32LE(1, 36); meta.writeUInt32LE(smpl.start, 52); meta.writeUInt32LE(smpl.end, 56);
  }
  const result = Buffer.alloc(44 + meta.length + data.length);
  result.write("RIFF", 0); result.writeUInt32LE(result.length - 8, 4); result.write("WAVEfmt ", 8);
  result.writeUInt32LE(16, 16); result.writeUInt16LE(1, 20); result.writeUInt16LE(1, 22);
  result.writeUInt32LE(rate, 24); result.writeUInt32LE(rate * 2, 28); result.writeUInt16LE(2, 32);
  result.writeUInt16LE(16, 34); meta.copy(result, 36); result.write("data", 36 + meta.length);
  result.writeUInt32LE(data.length, 40 + meta.length); data.copy(result, 44 + meta.length);
  return result;
}
function event(midi: number, gateFrames = 400): SfzEvent {
  return { midi, velocity: 1, startFrame: 0, gateFrames, stopFrame: 2000, eventIndex: 0, seed: 1 };
}
function positiveCrossingHz(samples: Float32Array, rate: number, start: number, end: number): number {
  const crossings: number[] = [];
  for (let i = start + 1; i < end; i++) {
    const a = samples[i - 1]!; const b = samples[i]!;
    if (a <= 0 && b > 0) crossings.push(i - 1 - a / (b - a));
  }
  return (crossings.length - 1) * rate / (crossings.at(-1)! - crossings[0]!);
}

test("SFZ pitch, rate conversion, smpl fraction and deterministic stereo", async () => {
  const root = await mkdtemp(join(tmpdir(), "music2-sfz-render-"));
  try {
    const tone = Array.from({ length: 44100 }, (_, i) => 0.5 * Math.sin(2 * Math.PI * 440 * i / 44100));
    await writeFile(join(root, "tone.wav"), wav(tone, 44100, { unity: 69, fraction: 0x80000000, start: 100, end: 40000 }));
    await writeFile(join(root, "bank.sfz"), "<region> sample=tone.wav pitch_keycenter=sample loop_mode=no_loop ampeg_release=0.01\n");
    const loaded = await loadSfz(join(root, "song.json"), "bank.sfz", 48000);
    assert.equal(loaded.smpl.get("tone.wav")?.unityNote, 69);
    assert.equal(loaded.smpl.get("tone.wav")?.pitchFraction, 0x80000000);
    const pitched = { ...event(81, 21000), stopFrame: 24000 };
    const out = renderSfz([pitched], loaded, 48000, 24000);
    assert.equal(out.left.length, 24000);
    assert.equal(out.sourceChannels, 2);
    assert.deepEqual(out.left, out.right);
    assert.ok(out.left.every(Number.isFinite));
    assert.deepEqual(out.left, renderSfz([pitched], loaded, 48000, 24000).left);
    const actual = positiveCrossingHz(out.left, 48000, 4096, 16384);
    assert.ok(Math.abs(1200 * Math.log2(actual / (880 * 2 ** (0.5 / 12)))) < 0.5);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("inclusive end, offset, gain and one-shot note-off", async () => {
  const root = await mkdtemp(join(tmpdir(), "music2-sfz-render-"));
  try {
    await writeFile(join(root, "dc.wav"), wav(Array(32).fill(1) as number[]));
    await writeFile(join(root, "bank.sfz"), "<region> sample=dc.wav offset=10 end=12 loop_mode=one_shot volume=-6 amplitude=50 amp_veltrack=0\n");
    const loaded = await loadSfz(join(root, "song.json"), "bank.sfz", 48000);
    const out = renderSfz([event(60, 1)], loaded, 48000, 10);
    assert.ok(Math.abs(out.left[0]! - 0.250586) < 0.0001);
    assert.ok(Math.abs(out.left[2]! - 0.250586) < 0.0001);
    assert.equal(out.left[3], 0);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("missing WAV is an access error", async () => {
  const root = await mkdtemp(join(tmpdir(), "music2-sfz-render-"));
  try {
    await writeFile(join(root, "bank.sfz"), "<region> sample=missing.wav\n");
    await assert.rejects(loadSfz(join(root, "song.json"), "bank.sfz", 48000), { code: "E_ACCESS" });
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("sample symlink cannot leave the main SFZ directory", async () => {
  const base = await mkdtemp(join(tmpdir(), "music2-sfz-render-"));
  try {
    const root = join(base, "bank");
    await mkdir(root);
    await writeFile(join(base, "outside.wav"), wav([0, 0.5, 0]));
    await symlink(join(base, "outside.wav"), join(root, "alias.wav"));
    await writeFile(join(root, "bank.sfz"), "<region> sample=alias.wav\n");
    await assert.rejects(loadSfz(join(base, "song.json"), "bank/bank.sfz", 48000), { code: "E_ACCESS" });
  } finally { await rm(base, { recursive: true, force: true }); }
});

test("inclusive loop end wraps to loop start", async () => {
  const root = await mkdtemp(join(tmpdir(), "music2-sfz-render-"));
  try {
    await writeFile(join(root, "ramp.wav"), wav(Array.from({ length: 1000 }, (_, i) => i / 2000)));
    await writeFile(join(root, "bank.sfz"), "<region> sample=ramp.wav loop_mode=loop_continuous loop_start=100 loop_end=199 amp_veltrack=0\n");
    const loaded = await loadSfz(join(root, "song.json"), "bank.sfz", 48000);
    const out = renderSfz([{ ...event(60, 300), stopFrame: 300 }], loaded, 48000, 300);
    assert.ok(Math.abs(out.left[199]! - 199 / 2000) < 0.00004);
    assert.ok(Math.abs(out.left[200]! - 100 / 2000) < 0.00004);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("DAHDSR reaches sustain without undershoot and releases exponentially", async () => {
  const root = await mkdtemp(join(tmpdir(), "music2-sfz-render-"));
  try {
    const rate = 8000;
    await writeFile(join(root, "dc.wav"), wav(Array(16000).fill(1) as number[], rate));
    await writeFile(join(root, "bank.sfz"), "<region> sample=dc.wav amp_veltrack=0 ampeg_attack=0.1 ampeg_decay=1 ampeg_sustain=50 ampeg_release=1\n");
    const loaded = await loadSfz(join(root, "song.json"), "bank.sfz", rate);
    const out = renderSfz([{ ...event(60, 2400), stopFrame: 12000 }], loaded, rate, 12000);
    assert.ok(Math.abs(out.left[400]! - 0.5) < 0.001);
    assert.ok(Math.abs(out.left[1600]! - 0.5) < 0.001);
    assert.ok(Math.abs(out.left[2399]! - 0.5) < 0.001);
    assert.ok(Math.abs(out.left[6400]! - 0.5 * Math.exp(-4)) < 0.0001);
    assert.equal(out.left[10400], 0);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("release-only region uses held velocity and rt_decay at note-off", async () => {
  const root = await mkdtemp(join(tmpdir(), "music2-sfz-render-"));
  try {
    await writeFile(join(root, "dc.wav"), wav(Array(128).fill(1) as number[], 8000));
    await writeFile(join(root, "bank.sfz"), "<region> sample=dc.wav trigger=release rt_decay=6 amp_veltrack=0\n");
    const loaded = await loadSfz(join(root, "song.json"), "bank.sfz", 8000);
    const out = renderSfz([{ ...event(60, 8000), stopFrame: 8100 }], loaded, 8000, 8100);
    assert.equal(out.left[7999], 0);
    assert.ok(Math.abs(out.left[8000]! - 10 ** (-6 / 20)) < 0.0001);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("shared smpl parser retains warning opcode and SFZ source location", async () => {
  const root = await mkdtemp(join(tmpdir(), "music2-sfz-parity-"));
  try {
    const bytes = wav([0, 0.25, 0.5, 0.25], 48000, { unity: 60, fraction: 0, start: 0, end: 3 });
    bytes.writeUInt32LE(1, 84); // smpl loop type is unsupported ping-pong
    await writeFile(join(root, "tone.wav"), bytes);
    await writeFile(join(root, "bank.sfz"), "<region> sample=tone.wav pitch_keycenter=sample\n");
    const loaded = await loadSfz(join(root, "song.json"), "bank.sfz", 48000);
    const warning = loaded.instrument.warnings.find((item) => item.opcode === "smpl");
    assert.equal(warning?.message, "unsupported loop type; loop disabled");
    assert.equal(warning?.file, "bank.sfz"); assert.equal(warning?.line, 1);
    assert.equal(loaded.smpl.get("tone.wav")?.loop, null);
  } finally { await rm(root, { recursive: true, force: true }); }
});
