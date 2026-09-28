import assert from "node:assert/strict";
import test from "node:test";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { writeWav } from "../../src/audio-io/index.ts";
import { main } from "../../src/cli/main.ts";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const fixture = join(root, "tests/fixtures/dawproject");
const hashes = {
  "Project.xsd": "58e2fd9864772850aac3eab1f3de8693857dc5384df6d29fbc320ae1de2347cc",
  "MetaData.xsd": "fb3ba378271770dddbcced8990aba537de3d36ff2d58573523460a699221c99f",
  LICENSE: "3aaee5877c9df985f935e40f42f4452182df9e8a8308dcc6cf1a2341458cdfeb",
};
function extractStore(zip: Buffer): Map<string, Buffer> {
  const entries = new Map<string, Buffer>();
  for (let at = 0; at < zip.length && zip.readUInt32LE(at) === 0x04034b50;) {
    assert.equal(zip.readUInt16LE(at + 8), 0, "STORE method");
    assert.equal(zip.readUInt16LE(at + 12), 0x21, "1980-01-01 DOS date");
    assert.equal(zip.readUInt16LE(at + 28), 0, "no ZIP extras");
    const size = zip.readUInt32LE(at + 18);
    const nameLength = zip.readUInt16LE(at + 26);
    const start = at + 30 + nameLength;
    const name = zip.toString("utf8", at + 30, start);
    assert.ok(!entries.has(name));
    entries.set(name, zip.subarray(start, start + size));
    at = start + size;
  }
  return entries;
}
function schema(schemaName: string, path: string) {
  return spawnSync("xmllint", ["--noout", "--schema", join(fixture, schemaName), path], { encoding: "utf8" });
}

test("vendored DAWproject XSD and license bytes match pinned upstream", async () => {
  for (const [name, expected] of Object.entries(hashes)) {
    const digest = createHash("sha256").update(await readFile(join(fixture, name))).digest("hex");
    assert.equal(digest, expected, name);
  }
});

test("mixed song ZIP resolves media and validates both official schemas", async (t) => {
  for (const [name, expected] of Object.entries(hashes))
    assert.equal(createHash("sha256").update(await readFile(join(fixture, name))).digest("hex"), expected, name);
  const dir = await mkdtemp(join(tmpdir(), "music2-dawproject-e2e-"));
  try {
    const audio = { sampleRate: 48000, sourceChannels: 2 as const,
      left: new Float32Array(48000), right: new Float32Array(48000) };
    await writeWav(join(dir, "source.wav"), audio, { bits: 16, seed: 1 });
    const song = { version: 1, title: "Mixed & <Song>", bpm: 120, sampleRate: 48000,
      tracks: [{ id: "lead", kind: "notes", instrument: "piano",
        notes: [{ start: 0, length: 1, pitch: 60, velocity: 100 / 127 }] }],
      audioTracks: [{ id: "vox", clips: [{ file: "source.wav", start: 0, length: 1 }] }],
      sections: [{ id: "intro", bars: 1 }], arrangement: [{ section: "intro" }] };
    await writeFile(join(dir, "song.json"), JSON.stringify(song));
    let stdout = ""; let stderr = "";
    const code = await main(["export", "dawproject", "song.json", "-o", "mixed.dawproject", "--content", "both", "--json"], {
      cwd: dir, stdout: { write(chunk: string) { stdout += chunk; return true; } } as NodeJS.WritableStream,
      stderr: { write(chunk: string) { stderr += chunk; return true; } } as NodeJS.WritableStream });
    assert.equal(code, 0, stderr || stdout);
    const response = JSON.parse(stdout) as { ok: boolean; artifacts: string[]; data: { entries: string[] } };
    assert.equal(response.ok, true);
    assert.deepEqual(response.artifacts, [join(dir, "mixed.dawproject")]);
    const entries = extractStore(await readFile(join(dir, "mixed.dawproject")));
    assert.deepEqual([...entries.keys()], response.data.entries);
    assert.deepEqual([...entries.keys()], ["metadata.xml", "project.xml", "audio/source-0000.wav",
      "audio/stem-lead.wav", "audio/stem-vox.wav"]);
    const projectXml = entries.get("project.xml")!.toString("utf8");
    const metadataXml = entries.get("metadata.xml")!.toString("utf8");
    assert.ok(metadataXml.includes("Mixed &amp; &lt;Song&gt;"));
    assert.match(projectXml, /<Notes /);
    assert.match(projectXml, /<Audio /);
    assert.match(projectXml, /<Mute [^>]*value="true"/);
    for (const match of projectXml.matchAll(/<Audio ([^>]+)>\s*<File path="([^"]+)"/g)) {
      const attrs = match[1]!; const path = match[2]!; const bytes = entries.get(path);
      assert.ok(bytes, `missing media ${path}`);
      const sampleRate = Number(/sampleRate="(\d+)"/.exec(attrs)![1]);
      const channels = Number(/channels="(\d+)"/.exec(attrs)![1]);
      const duration = Number(/duration="([\d.]+)"/.exec(attrs)![1]);
      assert.equal(bytes.readUInt32LE(24), sampleRate);
      assert.equal(bytes.readUInt16LE(22), channels);
      assert.ok(Math.abs(duration - bytes.readUInt32LE(40) / bytes.readUInt16LE(32) / sampleRate) < 1e-6);
    }
    await writeFile(join(dir, "project.xml"), entries.get("project.xml")!);
    await writeFile(join(dir, "metadata.xml"), entries.get("metadata.xml")!);
    const probe = spawnSync("xmllint", ["--version"], { encoding: "utf8" });
    if (probe.error && (probe.error as NodeJS.ErrnoException).code === "ENOENT") {
      if (process.env["MUSIC2_REQUIRE_XMLLINT"] === "1") assert.fail("xmllint required by MUSIC2_REQUIRE_XMLLINT=1");
      t.skip("SKIP DAWproject XSD (xmllint not found)");
      return;
    }
    assert.equal(probe.status, 0, probe.stderr);
    const projectResult = schema("Project.xsd", join(dir, "project.xml"));
    assert.equal(projectResult.status, 0, projectResult.stderr);
    const metadataResult = schema("MetaData.xsd", join(dir, "metadata.xml"));
    assert.equal(metadataResult.status, 0, metadataResult.stderr);
    await writeFile(join(dir, "invalid.xml"), projectXml.replace("<Transport>", "<Invalid/><Transport>"));
    const invalid = schema("Project.xsd", join(dir, "invalid.xml"));
    assert.notEqual(invalid.status, 0, "schema rejects invalid child order");
  } finally { await rm(dir, { recursive: true, force: true }); }
});
