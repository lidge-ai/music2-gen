import assert from "node:assert/strict";
import test from "node:test";
import { deflateSync, inflateSync } from "node:zlib";
import { encodeRgbPng } from "./png.tool.ts";

const SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10];

function testCrc(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function decodeRgbPngForTest(bytes: Uint8Array): { width: number; height: number; rgb: Uint8Array; types: string[] } {
  const input = Buffer.from(bytes);
  assert.deepEqual([...input.subarray(0, 8)], SIGNATURE);
  let pos = 8;
  let width = 0;
  let height = 0;
  const types: string[] = [];
  const chunks: Buffer[] = [];
  while (pos < input.length) {
    assert.ok(pos + 12 <= input.length);
    const length = input.readUInt32BE(pos);
    assert.ok(pos + 12 + length <= input.length);
    const type = input.toString("ascii", pos + 4, pos + 8);
    const data = input.subarray(pos + 8, pos + 8 + length);
    assert.equal(input.readUInt32BE(pos + 8 + length), testCrc(input.subarray(pos + 4, pos + 8 + length)), `CRC ${type}`);
    types.push(type);
    if (type === "IHDR") {
      assert.equal(length, 13);
      width = data.readUInt32BE(0); height = data.readUInt32BE(4);
      assert.deepEqual([...data.subarray(8)], [8, 2, 0, 0, 0]);
    }
    if (type === "IDAT") chunks.push(data);
    pos += 12 + length;
    if (type === "IEND") break;
  }
  assert.equal(pos, input.length);
  assert.deepEqual(types, ["IHDR", "IDAT", "IEND"]);
  const raw = inflateSync(Buffer.concat(chunks));
  const stride = width * 3;
  assert.equal(raw.length, (stride + 1) * height);
  const rgb = new Uint8Array(stride * height);
  for (let y = 0; y < height; y++) {
    assert.equal(raw[y * (stride + 1)], 0, "unsupported PNG filter");
    rgb.set(raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1)), y * stride);
  }
  return { width, height, rgb, types };
}

test("RGB8 PNG round trip, chunks and filter zero", () => {
  const bytes = encodeRgbPng(1, 1, Uint8Array.of(17, 34, 51));
  const decoded = decodeRgbPngForTest(bytes);
  assert.equal(decoded.width, 1); assert.equal(decoded.height, 1);
  assert.deepEqual([...decoded.rgb], [17, 34, 51]);
  assert.deepEqual(decoded.types, ["IHDR", "IDAT", "IEND"]);
});

test("decoder detects IDAT CRC corruption", () => {
  const bytes = Buffer.from(encodeRgbPng(1, 1, Uint8Array.of(1, 2, 3)));
  const idat = bytes.indexOf("IDAT");
  bytes[idat + 5] = bytes[idat + 5]! ^ 1;
  assert.throws(() => decodeRgbPngForTest(bytes), /CRC IDAT/);
});

test("invalid RGB length and dimensions are input errors", () => {
  for (const [w, h, rgb] of [[1, 1, new Uint8Array(2)], [0, 1, new Uint8Array()], [4097, 1, new Uint8Array()] ] as const) {
    assert.throws(() => encodeRgbPng(w, h, rgb), { code: "E_INPUT" });
  }
});

test("test decoder rejects nonzero scanline filter even with valid CRC", () => {
  const encoded = encodeRgbPng(1, 1, Uint8Array.of(1, 2, 3));
  const idat = encoded.indexOf("IDAT");
  const len = encoded.readUInt32BE(idat - 4);
  const raw = inflateSync(encoded.subarray(idat + 4, idat + 4 + len));
  raw[0] = 1;
  // Assemble an otherwise valid PNG using the local CRC implementation.
  const payload = deflateSync(raw);
  const replacement = Buffer.alloc(12 + payload.length);
  replacement.writeUInt32BE(payload.length, 0);
  replacement.write("IDAT", 4);
  replacement.set(payload, 8);
  replacement.writeUInt32BE(testCrc(replacement.subarray(4, 8 + payload.length)), 8 + payload.length);
  const changed = Buffer.concat([encoded.subarray(0, idat - 4), replacement, encoded.subarray(idat + 8 + len)]);
  assert.throws(() => decodeRgbPngForTest(changed), /unsupported PNG filter/);
});
