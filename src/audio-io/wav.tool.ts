import { open, readFile } from "node:fs/promises";
import { Music2Error, mulberry32 } from "../shared/index.ts";
import type { StereoBuffer, WavInfo, WavWriteOptions } from "./buffer.schema.ts";
import { validateSampleRate, validateStereo } from "./buffer.tool.ts";

const WRITE_FRAMES = 16384;
const RIFF_LIMIT = 0xffffffff;

function invalid(path: string, chunk: string, message: string): never {
  throw new Music2Error("E_INPUT", `invalid WAV ${chunk}: ${message}`, { details: { file: path, chunk } });
}

interface Format { channels: 1 | 2; sampleRate: number; bits: 16 | 24 | 32; tag: 1 | 3; blockAlign: number }

function parseFormat(bytes: Buffer, offset: number, size: number, path: string): Format {
  if (size < 16) invalid(path, "fmt ", "chunk too short");
  const tag = bytes.readUInt16LE(offset);
  const channels = bytes.readUInt16LE(offset + 2);
  const sampleRate = bytes.readUInt32LE(offset + 4);
  const byteRate = bytes.readUInt32LE(offset + 8);
  const blockAlign = bytes.readUInt16LE(offset + 12);
  const bits = bytes.readUInt16LE(offset + 14);
  if (tag !== 1 && tag !== 3) invalid(path, "fmt ", `unsupported format ${tag}`);
  if (channels !== 1 && channels !== 2) invalid(path, "fmt ", `unsupported channel count ${channels}`);
  if (!Number.isInteger(sampleRate) || sampleRate < 8000 || sampleRate > 192000) invalid(path, "fmt ", "invalid sample rate");
  if (!((tag === 1 && (bits === 16 || bits === 24 || bits === 32)) || (tag === 3 && bits === 32))) {
    invalid(path, "fmt ", `unsupported bit depth ${bits}`);
  }
  if (blockAlign !== channels * bits / 8 || byteRate !== sampleRate * blockAlign) invalid(path, "fmt ", "invalid byte rate or block alignment");
  return { channels, sampleRate, bits, tag, blockAlign };
}

function decodeSample(bytes: Buffer, offset: number, format: Format, path: string): number {
  let sample: number;
  if (format.tag === 3) sample = bytes.readFloatLE(offset);
  else if (format.bits === 16) sample = bytes.readInt16LE(offset) / 32768;
  else if (format.bits === 24) {
    const unsigned = bytes.readUIntLE(offset, 3);
    sample = (unsigned & 0x800000 ? unsigned - 0x1000000 : unsigned) / 8388608;
  } else sample = bytes.readInt32LE(offset) / 2147483648;
  if (!Number.isFinite(sample)) invalid(path, "data", `nonfinite float at byte ${offset}`);
  return sample;
}

export async function readWav(path: string): Promise<StereoBuffer> {
  let bytes: Buffer;
  try { bytes = await readFile(path); }
  catch (cause) { throw new Music2Error("E_ACCESS", `cannot read WAV: ${path}`, { details: { file: path }, cause }); }
  if (bytes.length < 12) invalid(path, "RIFF", "header too short");
  if (bytes.toString("ascii", 0, 4) !== "RIFF") invalid(path, "RIFF", "expected RIFF; RF64 is unsupported");
  if (bytes.toString("ascii", 8, 12) !== "WAVE") invalid(path, "RIFF", "expected WAVE");
  const end = bytes.readUInt32LE(4) + 8;
  if (end > bytes.length || end < 12) invalid(path, "RIFF", "truncated RIFF payload");
  let format: Format | undefined;
  let dataOffset: number | undefined;
  let dataSize = 0;
  for (let offset = 12; offset < end;) {
    if (offset + 8 > end) invalid(path, "RIFF", "truncated chunk header");
    const chunk = bytes.toString("ascii", offset, offset + 4);
    const size = bytes.readUInt32LE(offset + 4);
    const payload = offset + 8;
    const next = payload + size + (size & 1);
    if (payload + size > end || next > end) invalid(path, chunk, "truncated chunk payload or pad byte");
    if (chunk === "fmt " && format === undefined) format = parseFormat(bytes, payload, size, path);
    if (chunk === "data" && dataOffset === undefined) { dataOffset = payload; dataSize = size; }
    offset = next;
  }
  if (format === undefined) invalid(path, "fmt ", "missing format chunk");
  if (dataOffset === undefined) invalid(path, "data", "missing data chunk");
  if (dataSize % format.blockAlign !== 0) invalid(path, "data", "partial sample frame");
  const frames = dataSize / format.blockAlign;
  const left = new Float32Array(frames);
  const right = new Float32Array(frames);
  const width = format.bits / 8;
  for (let i = 0; i < frames; i++) {
    const offset = dataOffset + i * format.blockAlign;
    left[i] = decodeSample(bytes, offset, format, path);
    right[i] = format.channels === 1 ? (left[i] ?? 0) : decodeSample(bytes, offset + width, format, path);
  }
  return { sampleRate: format.sampleRate, left, right, sourceChannels: format.channels };
}

function header(sampleRate: number, frames: number, bits: 16 | 24): Buffer {
  const blockAlign = bits / 4;
  const dataSize = frames * blockAlign;
  const result = Buffer.alloc(44);
  result.write("RIFF", 0, "ascii"); result.writeUInt32LE(36 + dataSize, 4);
  result.write("WAVEfmt ", 8, "ascii"); result.writeUInt32LE(16, 16);
  result.writeUInt16LE(1, 20); result.writeUInt16LE(2, 22);
  result.writeUInt32LE(sampleRate, 24); result.writeUInt32LE(sampleRate * blockAlign, 28);
  result.writeUInt16LE(blockAlign, 32); result.writeUInt16LE(bits, 34);
  result.write("data", 36, "ascii"); result.writeUInt32LE(dataSize, 40);
  return result;
}

function quantize(sample: number, bits: 16 | 24, rng: (() => number) | undefined): number {
  const scale = bits === 16 ? 32768 : 8388608;
  const dither = rng ? rng() - rng() : 0;
  return Math.max(-scale, Math.min(scale - 1, Math.round(sample * scale + dither)));
}

export async function writeWav(path: string, audio: StereoBuffer, options: WavWriteOptions): Promise<WavInfo> {
  validateStereo(audio);
  validateSampleRate(audio.sampleRate);
  if (options.bits !== 16 && options.bits !== 24) throw new Music2Error("E_RENDER", "WAV bit depth must be 16 or 24");
  if (!Number.isSafeInteger(options.seed) || options.seed < 0 || options.seed > 0xffffffff) {
    throw new Music2Error("E_RENDER", "WAV dither seed must be a uint32");
  }
  const frames = audio.left.length;
  const dataSize = frames * options.bits / 4;
  if (!Number.isSafeInteger(dataSize) || 36 + dataSize > RIFF_LIMIT) throw new Music2Error("E_RENDER", "WAV exceeds the 4 GiB RIFF limit");
  const rng = options.bits === 16 ? mulberry32(options.seed) : undefined;
  let file;
  try {
    file = await open(path, "w");
    await file.writeFile(header(audio.sampleRate, frames, options.bits));
    const width = options.bits / 8;
    for (let start = 0; start < frames; start += WRITE_FRAMES) {
      const count = Math.min(WRITE_FRAMES, frames - start);
      const chunk = Buffer.allocUnsafe(count * width * 2);
      for (let i = 0; i < count; i++) {
        const offset = i * width * 2;
        const left = quantize(audio.left[start + i] ?? 0, options.bits, rng);
        const right = quantize(audio.right[start + i] ?? 0, options.bits, rng);
        if (options.bits === 16) { chunk.writeInt16LE(left, offset); chunk.writeInt16LE(right, offset + width); }
        else { chunk.writeUIntLE(left < 0 ? left + 0x1000000 : left, offset, 3); chunk.writeUIntLE(right < 0 ? right + 0x1000000 : right, offset + width, 3); }
      }
      await file.writeFile(chunk);
    }
  } catch (cause) {
    throw new Music2Error("E_ACCESS", `cannot write WAV: ${path}`, { details: { file: path }, cause });
  } finally { await file?.close(); }
  return { sampleRate: audio.sampleRate, channels: 2, frames, bitsPerSample: options.bits, format: "pcm" };
}
