import { Music2Error } from "../shared/index.ts";

interface AiffAudio {
  sampleRate: number; channels: Float32Array[]; bits: number;
  baseNote: number | null; loop: { start: number; end: number } | null;
}
function invalid(message: string): never { throw new Music2Error("E_INPUT", `invalid AIFF: ${message}`); }

/** IEEE 754 extended precision rate, stored with an explicit integer significand. */
function extendedRate(bytes: Buffer, at: number): number {
  const exponent = bytes.readUInt16BE(at);
  if (exponent & 0x8000 || (exponent & 0x7fff) === 0x7fff) invalid("invalid sample rate");
  const significand = bytes.readUInt32BE(at + 2) * 2 ** 32 + bytes.readUInt32BE(at + 6);
  const rate = significand * 2 ** ((exponent & 0x7fff) - 16383 - 63);
  if (!Number.isFinite(rate) || rate < 8000 || rate > 192000 || !Number.isInteger(rate)) invalid("invalid sample rate");
  return rate;
}

function markers(bytes: Buffer): Map<number, number> {
  if (bytes.length < 2) invalid("truncated MARK");
  const result = new Map<number, number>();
  let at = 2;
  for (let i = 0; i < bytes.readUInt16BE(0); i++) {
    if (at + 7 > bytes.length) invalid("truncated marker");
    result.set(bytes.readInt16BE(at), bytes.readUInt32BE(at + 2));
    const nameBytes = 1 + bytes.readUInt8(at + 6);
    at += 6 + nameBytes + (nameBytes & 1);
    if (at > bytes.length) invalid("truncated marker name");
  }
  return result;
}

/** Decode uncompressed AIFF/AIFC PCM; loop endpoints retain their inclusive source frames. */
export function decodeAiff(bytes: Buffer): AiffAudio {
  if (bytes.length < 12 || bytes.toString("ascii", 0, 4) !== "FORM") invalid("expected FORM");
  const kind = bytes.toString("ascii", 8, 12);
  if (kind !== "AIFF" && kind !== "AIFC") invalid("expected AIFF or AIFC");
  const end = bytes.readUInt32BE(4) + 8;
  if (end > bytes.length || end < 12) invalid("truncated FORM");
  const chunks = new Map<string, Buffer>();
  for (let at = 12; at < end;) {
    if (at + 8 > end) invalid("truncated chunk header");
    const size = bytes.readUInt32BE(at + 4);
    const next = at + 8 + size + (size & 1);
    if (next > end) invalid("truncated chunk payload");
    const name = bytes.toString("ascii", at, at + 4);
    if (!chunks.has(name)) chunks.set(name, bytes.subarray(at + 8, at + 8 + size));
    at = next;
  }
  const comm = chunks.get("COMM"); const ssnd = chunks.get("SSND");
  if (!comm || comm.length < (kind === "AIFC" ? 22 : 18)) invalid("missing or truncated COMM");
  if (!ssnd || ssnd.length < 8) invalid("missing or truncated SSND");
  const count = comm.readUInt16BE(0); const frames = comm.readUInt32BE(2); const bits = comm.readUInt16BE(6);
  if (count !== 1 && count !== 2) invalid("unsupported channel count");
  if (![8, 16, 24, 32].includes(bits)) invalid("unsupported PCM bit depth");
  const compression = kind === "AIFC" ? comm.toString("ascii", 18, 22) : "NONE";
  if (compression !== "NONE" && compression !== "sowt") invalid(`unsupported compression ${compression}`);
  const sampleRate = extendedRate(comm, 8);
  const offset = 8 + ssnd.readUInt32BE(0); const width = bits / 8;
  // blockSize is an alignment hint; offset is the number of bytes before the first PCM frame.
  if (offset > ssnd.length || frames * count * width > ssnd.length - offset) invalid("truncated SSND frames");
  const channels = Array.from({ length: count }, () => new Float32Array(frames));
  for (let frame = 0; frame < frames; frame++) for (let channel = 0; channel < count; channel++) {
    const at = offset + (frame * count + channel) * width;
    const value = compression === "sowt" ? ssnd.readIntLE(at, width) : ssnd.readIntBE(at, width);
    channels[channel]![frame] = value / 2 ** (bits - 1);
  }
  const inst = chunks.get("INST"); let baseNote: number | null = null; let loop: AiffAudio["loop"] = null;
  if (inst) {
    if (inst.length < 20) invalid("truncated INST");
    const note = inst.readUInt8(0); baseNote = note <= 127 ? note : null;
    const mark = chunks.get("MARK"); const positions = mark ? markers(mark) : new Map<number, number>();
    if (inst.readUInt16BE(8) === 1) {
      const start = positions.get(inst.readInt16BE(10)); const stop = positions.get(inst.readInt16BE(12));
      if (start !== undefined && stop !== undefined && start < stop && stop < frames) loop = { start, end: stop };
    }
  } else if (chunks.has("MARK")) markers(chunks.get("MARK")!);
  return { sampleRate, channels, bits, baseNote, loop };
}
