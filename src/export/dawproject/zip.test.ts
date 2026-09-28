import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { Music2Error } from "../../shared/errors.tool.ts";
import { writeStoreZip } from "./zip.tool.ts";

const utf8 = new TextEncoder();

function view(bytes: Uint8Array): DataView {
  return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
}

function expectError(invoke: () => unknown, code: string): void {
  assert.throws(invoke, (error: unknown) => error instanceof Music2Error && error.code === code);
}

test("one STORE entry has independent CRC-32 and exact ZIP32 header offsets", () => {
  const zip = writeStoreZip([{ path: "a.txt", bytes: utf8.encode("123456789") }]);
  const data = view(zip);
  // PKZIP's published CRC-32 check vector: "123456789" -> CBF43926.
  assert.equal(data.getUint32(0, true), 0x0403_4b50);
  assert.equal(data.getUint16(4, true), 20);
  assert.equal(data.getUint16(6, true), 0x0800);
  assert.equal(data.getUint16(8, true), 0);
  assert.equal(data.getUint16(10, true), 0);
  assert.equal(data.getUint16(12, true), 0x0021);
  assert.equal(data.getUint32(14, true), 0xcbf4_3926);
  assert.equal(data.getUint32(18, true), 9);
  assert.equal(data.getUint32(22, true), 9);
  assert.equal(data.getUint16(26, true), 5);
  assert.equal(data.getUint16(28, true), 0);
  assert.equal(Buffer.from(zip.subarray(30, 35)).toString(), "a.txt");
  assert.equal(Buffer.from(zip.subarray(35, 44)).toString(), "123456789");

  assert.equal(zip.length, 117); // local 44 + central 51 + EOCD 22
  assert.equal(data.getUint32(44, true), 0x0201_4b50);
  assert.equal(data.getUint16(48, true), 20);
  assert.equal(data.getUint16(50, true), 20);
  assert.equal(data.getUint16(52, true), 0x0800);
  assert.equal(data.getUint16(54, true), 0);
  assert.equal(data.getUint16(56, true), 0);
  assert.equal(data.getUint16(58, true), 0x0021);
  assert.equal(data.getUint32(60, true), 0xcbf4_3926);
  assert.equal(data.getUint16(72, true), 5);
  assert.equal(data.getUint16(74, true), 0);
  assert.equal(data.getUint16(76, true), 0);
  assert.equal(data.getUint32(86, true), 0);
  assert.equal(data.getUint32(95, true), 0x0605_4b50);
  assert.equal(data.getUint16(103, true), 1);
  assert.equal(data.getUint16(105, true), 1);
  assert.equal(data.getUint32(107, true), 51);
  assert.equal(data.getUint32(111, true), 44);
  assert.equal(data.getUint16(115, true), 0);
});

test("caller order, UTF-8 names and bytes are stable across writes", () => {
  const entries = [
    { path: "metadata.xml", bytes: utf8.encode("<MetaData/>") },
    { path: "project.xml", bytes: utf8.encode("<Project/>") },
    { path: "audio/한.wav", bytes: Uint8Array.of(0, 255) },
  ];
  const first = writeStoreZip(entries);
  assert.deepEqual(first, writeStoreZip(entries));
  const data = view(first);
  let local = 0;
  for (const entry of entries) {
    assert.equal(data.getUint32(local, true), 0x0403_4b50);
    const nameBytes = utf8.encode(entry.path);
    assert.equal(data.getUint16(local + 26, true), nameBytes.length);
    assert.deepEqual(first.subarray(local + 30, local + 30 + nameBytes.length), nameBytes);
    local += 30 + nameBytes.length + entry.bytes.length;
  }
  const end = first.length - 22;
  assert.equal(data.getUint32(end + 16, true), local);
  assert.equal(data.getUint16(end + 10, true), 3);
  let central = local;
  let expectedOffset = 0;
  for (const entry of entries) {
    assert.equal(data.getUint32(central, true), 0x0201_4b50);
    assert.equal(data.getUint32(central + 42, true), expectedOffset);
    assert.equal(data.getUint16(central + 8, true), 0x0800);
    assert.equal(data.getUint16(central + 10, true), 0);
    assert.equal(data.getUint16(central + 30, true), 0);
    assert.equal(data.getUint16(central + 32, true), 0);
    const nameBytes = utf8.encode(entry.path);
    assert.deepEqual(first.subarray(central + 46, central + 46 + nameBytes.length), nameBytes);
    expectedOffset += 30 + nameBytes.length + entry.bytes.length;
    central += 46 + nameBytes.length;
  }
  assert.equal(central, end);
});

test("unsafe, duplicate and non-normalized entry names are rejected", () => {
  const bytes = new Uint8Array();
  for (const path of ["", "/root.wav", "C:/root.wav", "a\\b", "a//b", "a/./b", "a/../b", "a/", "a\0b", "e\u0301.wav"]) {
    expectError(() => writeStoreZip([{ path, bytes }]), "E_INPUT");
  }
  expectError(() => writeStoreZip([{ path: "same", bytes }, { path: "same", bytes }]), "E_INPUT");
});

test("ZIP32 size, UTF-8 name and count limits fail before output allocation", () => {
  const bytes = new Uint8Array();
  expectError(() => writeStoreZip([{ path: "é".repeat(32768), bytes }]), "E_CAPABILITY");
  class OversizedBytes extends Uint8Array {
    override get byteLength(): number { return 0x1_0000_0000; }
  }
  const huge = new OversizedBytes();
  expectError(() => writeStoreZip([{ path: "a", bytes: huge }]), "E_CAPABILITY");
  class AggregateOverflowBytes extends Uint8Array {
    override get byteLength(): number { return 0xffff_ffd0; }
  }
  const aggregateOverflow = new AggregateOverflowBytes();
  expectError(() => writeStoreZip([{ path: "a", bytes: aggregateOverflow }]), "E_CAPABILITY");
  const repeated = { path: "a", bytes };
  expectError(() => writeStoreZip(Array(65536).fill(repeated) as typeof repeated[]), "E_CAPABILITY");
});

test("system unzip checks CRC and extracts all entries when available", (t) => {
  const probe = spawnSync("unzip", ["-v"], { encoding: "utf8" });
  if (probe.error && "code" in probe.error && probe.error.code === "ENOENT") {
    t.skip("unzip not installed");
    return;
  }
  assert.equal(probe.status, 0);
  const folder = mkdtempSync(join(tmpdir(), "music2-daw-zip-"));
  const archive = join(folder, "sample.dawproject");
  const entries = [
    { path: "metadata.xml", bytes: utf8.encode("<MetaData/>") },
    { path: "project.xml", bytes: utf8.encode("<Project/>") },
    { path: "audio/tone.wav", bytes: Uint8Array.of(0, 255) },
  ];
  writeFileSync(archive, writeStoreZip(entries));
  const checked = spawnSync("unzip", ["-t", archive], { encoding: "utf8" });
  assert.equal(checked.status, 0, checked.stderr || checked.stdout);
  const names = spawnSync("unzip", ["-Z1", archive], { encoding: "utf8" });
  assert.equal(names.status, 0, names.stderr);
  assert.deepEqual(names.stdout.trimEnd().split("\n"), entries.map((entry) => entry.path));
  for (const entry of entries) {
    const extracted = spawnSync("unzip", ["-p", archive, entry.path]);
    assert.equal(extracted.status, 0, extracted.stderr?.toString());
    assert.deepEqual(extracted.stdout, Buffer.from(entry.bytes));
  }
});
