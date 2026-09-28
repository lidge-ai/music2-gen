import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { Music2Error } from "../shared/index.ts";
import { createStereo } from "./buffer.tool.ts";
import { readWav, writeWav } from "./wav.tool.ts";

function fixture(tag: 1 | 3, bits: 16 | 24 | 32, channels: 1 | 2, rate: number, samples: number[], unknown = false): Buffer {
  const width = bits / 8;
  const payload = Buffer.alloc(samples.length * width);
  samples.forEach((value, i) => {
    if (tag === 3) payload.writeFloatLE(value, i * width);
    else if (bits === 16) payload.writeInt16LE(value, i * width);
    else if (bits === 24) payload.writeUIntLE(value < 0 ? value + 0x1000000 : value, i * width, 3);
    else payload.writeInt32LE(value, i * width);
  });
  const junk = unknown ? Buffer.from([0x4a, 0x55, 0x4e, 0x4b, 1, 0, 0, 0, 7, 0]) : Buffer.alloc(0);
  const bytes = Buffer.alloc(44 + junk.length + payload.length);
  bytes.write("RIFF", 0); bytes.writeUInt32LE(bytes.length - 8, 4); bytes.write("WAVEfmt ", 8);
  bytes.writeUInt32LE(16, 16); bytes.writeUInt16LE(tag, 20); bytes.writeUInt16LE(channels, 22);
  bytes.writeUInt32LE(rate, 24); bytes.writeUInt32LE(rate * channels * width, 28);
  bytes.writeUInt16LE(channels * width, 32); bytes.writeUInt16LE(bits, 34);
  junk.copy(bytes, 36); bytes.write("data", 36 + junk.length);
  bytes.writeUInt32LE(payload.length, 40 + junk.length); payload.copy(bytes, 44 + junk.length);
  return bytes;
}

void test("reads PCM16/24/32, float32, mono and stereo across rates", async (t) => {
  const dir = await mkdtemp(join(tmpdir(), "music2-wav-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const cases = [
    { tag: 1 as const, bits: 16 as const, channels: 1 as const, rate: 22050, samples: [-32768, 16384], expected: [-1, 0.5] },
    { tag: 1 as const, bits: 24 as const, channels: 2 as const, rate: 44100, samples: [-8388608, 4194304], expected: [-1, 0.5] },
    { tag: 1 as const, bits: 32 as const, channels: 1 as const, rate: 48000, samples: [-2147483648, 1073741824], expected: [-1, 0.5] },
    { tag: 3 as const, bits: 32 as const, channels: 2 as const, rate: 48000, samples: [0.25, -0.25], expected: [0.25, -0.25] },
  ];
  for (const [i, item] of cases.entries()) {
    const path = join(dir, `${i}.wav`);
    await writeFile(path, fixture(item.tag, item.bits, item.channels, item.rate, item.samples, true));
    const audio = await readWav(path);
    assert.equal(audio.sampleRate, item.rate); assert.equal(audio.sourceChannels, item.channels);
    assert.equal(audio.left[0], item.expected[0]);
    assert.equal(audio.right[0], item.channels === 1 ? item.expected[0] : item.expected[1]);
    if (item.channels === 1) assert.equal(audio.left[1], item.expected[1]);
  }
});

void test("16-bit dither is seeded and 24-bit -1 writes exact minimum", async (t) => {
  const dir = await mkdtemp(join(tmpdir(), "music2-wav-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const audio = createStereo(44100, 1024);
  const a = join(dir, "a.wav"); const b = join(dir, "b.wav"); const c = join(dir, "c.wav");
  const info = await writeWav(a, audio, { bits: 16, seed: 1 });
  await writeWav(b, audio, { bits: 16, seed: 1 });
  await writeWav(c, audio, { bits: 16, seed: 2 });
  assert.deepEqual(info, { sampleRate: 44100, channels: 2, frames: 1024, bitsPerSample: 16, format: "pcm" });
  assert.deepEqual(await readFile(a), await readFile(b));
  assert.notDeepEqual(await readFile(a), await readFile(c));
  audio.left[0] = -1; audio.right[0] = -1;
  const d = join(dir, "d.wav");
  await writeWav(d, audio, { bits: 24, seed: 1 });
  const bytes = await readFile(d);
  assert.deepEqual([...bytes.subarray(44, 50)], [0, 0, 128, 0, 0, 128]);
  const decoded = await readWav(d);
  assert.equal(decoded.left[0], -1); assert.equal(decoded.right[0], -1);
});

void test("truncated chunks, RF64, nonfinite floats and three channels fail E_INPUT", async (t) => {
  const dir = await mkdtemp(join(tmpdir(), "music2-wav-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const malformed = fixture(1, 16, 1, 44100, [0]);
  malformed.writeUInt32LE(1000, 4);
  const rf64 = fixture(1, 16, 1, 44100, [0]); rf64.write("RF64", 0);
  const triple = fixture(1, 16, 1, 44100, [0]); triple.writeUInt16LE(3, 22);
  const nan = fixture(3, 32, 1, 44100, [NaN]);
  // An odd chunk without its pad byte before another chunk is still truncated.
  const header = fixture(1, 16, 1, 44100, [0]);
  const midPad = Buffer.concat([header.subarray(0, 36), Buffer.from([0x4a, 0x55, 0x4e, 0x4b, 1, 0, 0, 0, 7]), header.subarray(36)]);
  midPad.writeUInt32LE(midPad.length - 8, 4);
  for (const [name, bytes] of [["truncated", malformed], ["rf64", rf64], ["channels", triple], ["nan", nan], ["midpad", midPad]] as const) {
    const path = join(dir, `${name}.wav`); await writeFile(path, bytes);
    await assert.rejects(readWav(path), (error: unknown) => error instanceof Music2Error && error.code === "E_INPUT" && error.details?.["file"] === path);
  }
});

void test("an empty data chunk decodes as silence", async (t) => {
  const dir = await mkdtemp(join(tmpdir(), "music2-wav-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const path = join(dir, "empty.wav");
  await writeFile(path, fixture(1, 16, 1, 44100, []));
  const audio = await readWav(path);
  assert.equal(audio.left.length, 0);
  assert.equal(audio.right.length, 0);
  assert.equal(audio.sourceChannels, 1);
});

void test("a final odd chunk may omit its pad byte, whether or not the RIFF size counts it", async (t) => {
  const dir = await mkdtemp(join(tmpdir(), "music2-wav-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const trailing = Buffer.concat([fixture(1, 16, 1, 44100, [0]), Buffer.from([0x4a, 0x55, 0x4e, 0x4b, 1, 0, 0, 0, 7])]);
  trailing.writeUInt32LE(trailing.length - 8, 4);
  // 24-bit mono with an odd frame count: the data chunk itself is odd-sized and last.
  const odd = fixture(1, 24, 1, 44100, [4194304]);
  const counted = Buffer.from(odd);
  counted.writeUInt32LE(odd.length - 8 + 1, 4);
  for (const [name, bytes] of [["trailing", trailing], ["odd24", odd], ["counted", counted]] as const) {
    const path = join(dir, `${name}.wav`); await writeFile(path, bytes);
    const audio = await readWav(path);
    assert.equal(audio.left.length, 1, name);
  }
  assert.equal((await readWav(join(dir, "odd24.wav"))).left[0], .5);
});
