import { test } from "node:test";
import assert from "node:assert/strict";
import { readWavSmpl } from "./wav-meta.tool.ts";
function fixture(type = 0, size = 60, unity = 69): Buffer {
  const bytes = Buffer.alloc(20 + size); bytes.write("RIFF"); bytes.writeUInt32LE(bytes.length - 8, 4);
  bytes.write("WAVEsmpl", 8); bytes.writeUInt32LE(size, 16);
  bytes.writeUInt32LE(unity, 32); bytes.writeUInt32LE(0x80000000, 36); bytes.writeUInt32LE(1, 48);
  if (size >= 60) { bytes.writeUInt32LE(type, 60); bytes.writeUInt32LE(100, 64); bytes.writeUInt32LE(1000, 68); }
  return bytes;
}
test("smpl reads unity, fractional pitch and inclusive forward loop", () => {
  assert.deepEqual(readWavSmpl(fixture()), { unityNote: 69, pitchFraction: 0x80000000, loop: { start: 100, end: 1000 }, warnings: [] });
});
test("smpl preserves warnings and ignores missing or truncated chunks", () => {
  assert.deepEqual(readWavSmpl(Buffer.alloc(4)), { unityNote: null, pitchFraction: 0, loop: null, warnings: [] });
  assert.equal(readWavSmpl(fixture().subarray(0, 50)).unityNote, null);
  assert.deepEqual(readWavSmpl(fixture(1)).warnings, ["unsupported loop type; loop disabled"]);
  assert.deepEqual(readWavSmpl(fixture(0, 36)).warnings, ["truncated loop metadata; loop disabled"]);
  assert.equal(readWavSmpl(fixture(0, 60, 128)).unityNote, null);
});
