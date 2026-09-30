export interface WavSmpl { unityNote: number | null; pitchFraction: number; loop: { start: number; end: number } | null; warnings: string[] }

/** Read optional RIFF sampler metadata; malformed or absent metadata is ignored. */
export function readWavSmpl(bytes: Buffer): WavSmpl {
  const warnings: string[] = [];
  const empty: WavSmpl = { unityNote: null, pitchFraction: 0, loop: null, warnings };
  if (bytes.length < 12 || bytes.toString("ascii", 0, 4) !== "RIFF") return empty;
  const end = Math.min(bytes.length, bytes.readUInt32LE(4) + 8);
  for (let offset = 12; offset + 8 <= end;) {
    const size = bytes.readUInt32LE(offset + 4);
    const data = offset + 8;
    if (data + size > end) break;
    if (bytes.toString("ascii", offset, offset + 4) === "smpl" && size >= 36) {
      const unity = bytes.readUInt32LE(data + 12);
      const pitchFraction = bytes.readUInt32LE(data + 16);
      const loops = bytes.readUInt32LE(data + 28);
      let loop: WavSmpl["loop"] = null;
      if (loops > 0 && size >= 60) {
        const type = bytes.readUInt32LE(data + 40);
        if (type === 0) loop = { start: bytes.readUInt32LE(data + 44), end: bytes.readUInt32LE(data + 48) };
        else warnings.push("unsupported loop type; loop disabled");
      } else if (loops > 0) {
        warnings.push("truncated loop metadata; loop disabled");
      }
      return { unityNote: unity <= 127 ? unity : null, pitchFraction, loop, warnings };
    }
    offset = data + size + (size & 1);
  }
  return empty;
}

