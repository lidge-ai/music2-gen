import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, readdir, rm, truncate, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { writeWav } from "../../audio-io/index.ts";
import type { StereoBuffer } from "../../audio-io/index.ts";
import { buildTimeline, validateSong } from "../../song/index.ts";
import type { CommandContext } from "../registry.ts";
import { slice, sliceSong } from "./slice.ts";

function context(input: string, output: string, values: Record<string, unknown> = {}): CommandContext {
  return { args: [input], values: { out: output, ...values }, json: true, cwd: process.cwd(), stderr: process.stderr };
}
function fixture(rate: number): StereoBuffer {
  const length = Math.round(rate * 0.6);
  const left = new Float32Array(length);
  const right = new Float32Array(length);
  for (let i = 0; i < 4; i++) {
    const at = Math.round((0.1 + i * 0.12) * rate);
    left[at] = 0.8;
    right[at] = -0.4;
  }
  return { sampleRate: rate, left, right, sourceChannels: 2 };
}

test("slice song partitions 1, 16, 17, 32 and 128 variants into one-bar sections", () => {
  for (const count of [1, 16, 17, 32, 128]) {
    const { song, pattern } = sliceSong(count, 120, 44100);
    assert.equal(song.sections.length, Math.ceil(count / 16));
    assert.equal(song.arrangement.length, Math.ceil(count / 16));
    assert.equal(pattern.length, Math.ceil(count / 16));
    assert.ok(song.sections.every((section) => section.bars === 1));
    const events = buildTimeline(validateSong(song)).events;
    assert.deepEqual(events.map((event) => event.sample?.index), Array.from({ length: count }, (_, i) => i));
  }
});

test("slice writes stable 16/24-bit input artifacts and a playable Song v1", async () => {
  const root = await mkdtemp(join(tmpdir(), "music2-slice-"));
  try {
    for (const bits of [16, 24] as const) {
      const input = join(root, `source-${bits}.wav`);
      await writeWav(input, fixture(44100), { bits, seed: 1 });
      const first = join(root, `first-${bits}`);
      const second = join(root, `second-${bits}`);
      const a = await slice.run(context(input, first));
      const b = await slice.run(context(input, second));
      assert.equal(a.command, "slice");
      assert.equal(a.artifacts?.length, b.artifacts?.length);
      for (let i = 0; i < a.artifacts!.length; i++)
        assert.deepEqual(await readFile(a.artifacts![i]!), await readFile(b.artifacts![i]!));
      const song = JSON.parse(await readFile(join(first, "slice.song.json"), "utf8")) as unknown;
      const events = buildTimeline(validateSong(song)).events;
      const metadata = a.data["slices"] as { index: number; startSample: number; sourceFrames: number; wavFrames: number }[];
      assert.equal(events.length, metadata.length);
      assert.deepEqual(events.map((event) => event.sample?.index), metadata.map((entry) => entry.index));
      assert.equal(metadata[0]?.startSample, 0);
      assert.equal(metadata.reduce((sum, entry) => sum + entry.sourceFrames, 0), fixture(44100).left.length);
      assert.ok(metadata.every((entry) => entry.wavFrames === entry.sourceFrames));
      assert.ok(!(await readFile(join(first, "kit.json"), "utf8")).includes(root));
    }
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("existing output rolls back new files; force replaces owned files and preserves unrelated data", async () => {
  const root = await mkdtemp(join(tmpdir(), "music2-slice-force-"));
  try {
    const input = join(root, "source.wav");
    const output = join(root, "out");
    await writeWav(input, fixture(44100), { bits: 16, seed: 1 });
    await slice.run(context(input, output));
    await writeFile(join(output, "other.txt"), "keep me\n");
    const before = await readFile(join(output, "kit.json"));
    await assert.rejects(slice.run(context(input, output)), { code: "E_ACCESS" });
    assert.deepEqual(await readFile(join(output, "kit.json")), before);
    await slice.run(context(input, output, { force: true }));
    assert.equal(await readFile(join(output, "other.txt"), "utf8"), "keep me\n");
    assert.ok((await readdir(output)).includes("slice.song.json"));
    const collision = join(output, "slice-00.wav");
    await assert.rejects(slice.run(context(collision, output, { force: true })), { code: "E_INPUT" });
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("a late manifest collision leaves no newly published slices", async () => {
  const root = await mkdtemp(join(tmpdir(), "music2-slice-rollback-"));
  try {
    const input = join(root, "source.wav");
    const output = join(root, "out");
    await writeWav(input, fixture(44100), { bits: 16, seed: 1 });
    await mkdir(output);
    await writeFile(join(output, "kit.json"), "older kit\n");
    await assert.rejects(slice.run(context(input, output)), { code: "E_ACCESS" });
    assert.deepEqual(await readdir(output), ["kit.json"]);
    assert.equal(await readFile(join(output, "kit.json"), "utf8"), "older kit\n");
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("unsupported Song output rates convert slice WAVs to 44.1 kHz", async () => {
  const root = await mkdtemp(join(tmpdir(), "music2-slice-rate-"));
  try {
    const input = join(root, "source.wav");
    const output = join(root, "out");
    await writeWav(input, fixture(32000), { bits: 24, seed: 1 });
    const result = await slice.run(context(input, output));
    const song = validateSong(JSON.parse(await readFile(join(output, "slice.song.json"), "utf8")) as unknown);
    assert.equal(song.sampleRate, 44100);
    const first = result.data["slices"] as { sourceFrames: number; wavFrames: number }[];
    assert.ok(first.some((entry) => entry.sourceFrames !== entry.wavFrames));
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("invalid flags and empty input fail with E_INPUT", async () => {
  const root = await mkdtemp(join(tmpdir(), "music2-slice-invalid-"));
  try {
    const input = join(root, "source.wav");
    const output = join(root, "out");
    await writeWav(input, fixture(44100), { bits: 16, seed: 1 });
    for (const values of [{ sensitivity: "NaN" }, { "min-gap-ms": "1.5" },
      { "max-slices": "129" }, { bpm: "Infinity" }, { bpm: "39" }])
      await assert.rejects(slice.run(context(input, output, values)), { code: "E_INPUT" });
    const empty = join(root, "empty.wav");
    await writeWav(empty, { sampleRate: 44100, left: new Float32Array(), right: new Float32Array(), sourceChannels: 2 },
      { bits: 16, seed: 1 });
    await assert.rejects(slice.run(context(empty, output)), { code: "E_INPUT" });
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("oversized input is rejected from stat before WAV decode", async () => {
  const root = await mkdtemp(join(tmpdir(), "music2-slice-size-"));
  try {
    const input = join(root, "oversized.wav");
    await writeFile(input, "not a WAV");
    await truncate(input, 512 * 1024 * 1024 + 1);
    await assert.rejects(slice.run(context(input, join(root, "out"))), { code: "E_CAPABILITY" });
  } finally { await rm(root, { recursive: true, force: true }); }
});
