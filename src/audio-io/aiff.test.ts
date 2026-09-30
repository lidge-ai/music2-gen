import { test } from "node:test";
import assert from "node:assert/strict";
import { decodeAiff } from "./aiff.tool.ts";

function chunk(name: string, payload: Buffer): Buffer {
  const out = Buffer.alloc(8 + payload.length + (payload.length & 1));
  out.write(name); out.writeUInt32BE(payload.length, 4); payload.copy(out, 8); return out;
}
function fixture(bits: number, compression?: string, offset = 0, metadata = false): Buffer {
  const comm = Buffer.alloc(compression ? 24 : 18);
  comm.writeUInt16BE(2, 0); comm.writeUInt32BE(3, 2); comm.writeUInt16BE(bits, 6);
  comm.writeUInt16BE(0x400e, 8); comm.writeUInt32BE(0xbb800000, 10); // 48000 as extended 80-bit
  if (compression) comm.write(compression, 18);
  const ssnd = Buffer.alloc(8 + offset + 6 * bits / 8);
  ssnd.writeUInt32BE(offset); ssnd.writeUInt32BE(512, 4);
  for (const [i, sample] of [0, 0.5, -0.5, 0.25, -1, 0].entries()) {
    const value = sample * 2 ** (bits - 1);
    if (compression === "sowt") ssnd.writeIntLE(value, 8 + offset + i * bits / 8, bits / 8);
    else ssnd.writeIntBE(value, 8 + offset + i * bits / 8, bits / 8);
  }
  const inst = Buffer.alloc(20); inst[0] = 60;
  inst.writeUInt16BE(1, 8); inst.writeInt16BE(1, 10); inst.writeInt16BE(2, 12);
  const mark = Buffer.alloc(18); mark.writeUInt16BE(2); mark.writeInt16BE(1, 2); mark.writeUInt32BE(0, 4);
  mark.writeInt16BE(2, 10); mark.writeUInt32BE(2, 12);
  const payload = Buffer.concat([chunk("COMM", comm), chunk("SSND", ssnd), ...(metadata ? [chunk("INST", inst), chunk("MARK", mark)] : [])]);
  const header = Buffer.alloc(12); header.write("FORM"); header.writeUInt32BE(payload.length + 4, 4); header.write(compression ? "AIFC" : "AIFF", 8);
  return Buffer.concat([header, payload]);
}
for (const bits of [8, 16, 24, 32]) test(`AIFF big-endian ${bits}-bit PCM and SSND offset/block size`, () => {
  const decoded = decodeAiff(fixture(bits, undefined, 7));
  assert.equal(decoded.sampleRate, 48000); assert.equal(decoded.bits, bits);
  assert.deepEqual([...decoded.channels[0]!], [0, -0.5, -1]);
  assert.deepEqual([...decoded.channels[1]!], [0.5, 0.25, 0]);
  assert.equal(decoded.baseNote, null); assert.equal(decoded.loop, null);
});
for (const compression of ["NONE", "sowt"]) test(`AIFC ${compression} PCM`, () => {
  assert.deepEqual([...decodeAiff(fixture(24, compression)).channels[0]!], [0, -0.5, -1]);
});
test("AIFF INST unity and MARK sustain loop retain inclusive endpoints", () => {
  const decoded = decodeAiff(fixture(16, undefined, 0, true));
  assert.equal(decoded.baseNote, 60); assert.deepEqual(decoded.loop, { start: 0, end: 2 });
});
test("AIFF truncation and unsupported compression are E_INPUT", () => {
  const bytes = fixture(16);
  assert.throws(() => decodeAiff(bytes.subarray(0, bytes.length - 2)), { code: "E_INPUT" });
  const truncated = Buffer.from(bytes); truncated.writeUInt32BE(100, 22); // COMM declares too many frames
  assert.throws(() => decodeAiff(truncated), { code: "E_INPUT" });
  assert.throws(() => decodeAiff(fixture(16, "fl32")), { code: "E_INPUT" });
  assert.throws(() => decodeAiff(Buffer.alloc(4)), { code: "E_INPUT" });
});
