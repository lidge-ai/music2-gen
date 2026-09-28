import { gzipSync } from "node:zlib";

/** gzip with fixed MTIME and OS bytes; zlib still writes CRC32/ISIZE trailer. */
export function gzipAls(input: Uint8Array): Uint8Array {
  const bytes = gzipSync(input, { level: 9 });
  if (bytes[0] !== 0x1f || bytes[1] !== 0x8b || bytes[2] !== 8 || bytes[3] !== 0)
    throw new Error("unexpected gzip header");
  bytes.fill(0, 4, 9);
  bytes[9] = 0xff;
  return bytes;
}
