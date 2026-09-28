import { Music2Error } from "../../shared/errors.tool.ts";

const UINT32_MAX = 0xffff_ffff;
const UINT16_MAX = 0xffff;
const LOCAL_HEADER_SIZE = 30;
const CENTRAL_HEADER_SIZE = 46;
const END_HEADER_SIZE = 22;
const ZIP_VERSION = 20;
const UTF8_FLAG = 1 << 11;
const STORE_METHOD = 0;
const DOS_TIME = 0;
const DOS_DATE = 0x0021; // 1980-01-01

const CRC_TABLE = Uint32Array.from({ length: 256 }, (_, index) => {
  let value = index;
  for (let bit = 0; bit < 8; bit++) {
    value = (value >>> 1) ^ ((value & 1) ? 0xedb8_8320 : 0);
  }
  return value >>> 0;
});

interface PreparedEntry {
  name: Uint8Array;
  bytes: Uint8Array;
  crc: number;
  offset: number;
}

function capacity(message: string): never {
  throw new Music2Error("E_CAPABILITY", message, { fix: "reduce the DAWproject archive below ZIP32 limits" });
}

function validPath(path: string): string {
  if (typeof path !== "string" || !path || path !== path.normalize("NFC") ||
      path.startsWith("/") || /^[A-Za-z]:/.test(path) || path.includes("\\") || path.includes("\0") ||
      path.split("/").some((part) => !part || part === "." || part === "..")) {
    throw new Music2Error("E_INPUT", "invalid ZIP entry path");
  }
  return path;
}

function crc32(bytes: Uint8Array): number {
  let crc = UINT32_MAX;
  for (const byte of bytes) crc = (crc >>> 8) ^ CRC_TABLE[(crc ^ byte) & 0xff]!;
  return (crc ^ UINT32_MAX) >>> 0;
}

function put16(view: DataView, at: number, value: number): void {
  view.setUint16(at, value, true);
}

function put32(view: DataView, at: number, value: number): void {
  view.setUint32(at, value, true);
}

function writeLocal(view: DataView, at: number, entry: PreparedEntry): void {
  put32(view, at, 0x0403_4b50);
  put16(view, at + 4, ZIP_VERSION);
  put16(view, at + 6, UTF8_FLAG);
  put16(view, at + 8, STORE_METHOD);
  put16(view, at + 10, DOS_TIME);
  put16(view, at + 12, DOS_DATE);
  put32(view, at + 14, entry.crc);
  put32(view, at + 18, entry.bytes.byteLength);
  put32(view, at + 22, entry.bytes.byteLength);
  put16(view, at + 26, entry.name.byteLength);
  put16(view, at + 28, 0);
}

function writeCentral(view: DataView, at: number, entry: PreparedEntry): void {
  put32(view, at, 0x0201_4b50);
  put16(view, at + 4, ZIP_VERSION); // made by: DOS host, version 2.0
  put16(view, at + 6, ZIP_VERSION);
  put16(view, at + 8, UTF8_FLAG);
  put16(view, at + 10, STORE_METHOD);
  put16(view, at + 12, DOS_TIME);
  put16(view, at + 14, DOS_DATE);
  put32(view, at + 16, entry.crc);
  put32(view, at + 20, entry.bytes.byteLength);
  put32(view, at + 24, entry.bytes.byteLength);
  put16(view, at + 28, entry.name.byteLength);
  put16(view, at + 30, 0); // extra length
  put16(view, at + 32, 0); // comment length
  put16(view, at + 34, 0); // disk start
  put16(view, at + 36, 0); // internal attributes
  put32(view, at + 38, 0); // external attributes
  put32(view, at + 42, entry.offset);
}

/** Write ordered, relative UTF-8 entries as a deterministic ZIP32 STORE archive. */
export function writeStoreZip(entries: readonly { path: string; bytes: Uint8Array }[]): Uint8Array {
  if (entries.length > UINT16_MAX) capacity("ZIP32 supports at most 65535 entries");

  const encoder = new TextEncoder();
  const names = new Set<string>();
  const prepared: PreparedEntry[] = [];
  let localSize = 0;
  let centralSize = 0;

  // Complete every ZIP32 bound and path check before allocating the archive.
  for (const entry of entries) {
    const path = validPath(entry.path);
    if (names.has(path)) throw new Music2Error("E_INPUT", "duplicate ZIP entry path");
    names.add(path);
    if (!(entry.bytes instanceof Uint8Array)) throw new Music2Error("E_INPUT", "ZIP entry must contain bytes");
    const name = encoder.encode(path);
    if (name.byteLength > UINT16_MAX) capacity("ZIP entry name exceeds 65535 UTF-8 bytes");
    if (entry.bytes.byteLength > UINT32_MAX) capacity("ZIP entry exceeds ZIP32 size limit");
    const nextLocal = localSize + LOCAL_HEADER_SIZE + name.byteLength + entry.bytes.byteLength;
    const nextCentral = centralSize + CENTRAL_HEADER_SIZE + name.byteLength;
    if (nextLocal + nextCentral + END_HEADER_SIZE > UINT32_MAX) capacity("archive exceeds ZIP32 size limit");
    prepared.push({ name, bytes: entry.bytes, crc: crc32(entry.bytes), offset: localSize });
    localSize = nextLocal;
    centralSize = nextCentral;
  }

  const totalSize = localSize + centralSize + END_HEADER_SIZE;
  let output: Uint8Array;
  try {
    output = new Uint8Array(totalSize);
  } catch (cause) {
    if (cause instanceof RangeError) capacity("archive allocation exceeds runtime capacity");
    throw cause;
  }
  const view = new DataView(output.buffer);
  for (const entry of prepared) {
    writeLocal(view, entry.offset, entry);
    output.set(entry.name, entry.offset + LOCAL_HEADER_SIZE);
    output.set(entry.bytes, entry.offset + LOCAL_HEADER_SIZE + entry.name.byteLength);
  }
  let cursor = localSize;
  for (const entry of prepared) {
    writeCentral(view, cursor, entry);
    output.set(entry.name, cursor + CENTRAL_HEADER_SIZE);
    cursor += CENTRAL_HEADER_SIZE + entry.name.byteLength;
  }
  put32(view, cursor, 0x0605_4b50);
  put16(view, cursor + 4, 0); // current disk
  put16(view, cursor + 6, 0); // central-directory disk
  put16(view, cursor + 8, entries.length);
  put16(view, cursor + 10, entries.length);
  put32(view, cursor + 12, centralSize);
  put32(view, cursor + 16, localSize);
  put16(view, cursor + 20, 0); // archive comment
  return output;
}
