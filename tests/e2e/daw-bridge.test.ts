import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { gunzipSync } from "node:zlib";
import { readWav } from "../../src/audio-io/index.ts";

const root = resolve(import.meta.dirname, "../..");
const notes = join(root, "examples/daw-notes-automation.song.json");
const balance = new Set(["LOW_END_DOMINANCE", "LOW_MID_BUILDUP", "SUB_WITHOUT_BODY", "HIGH_END_THIN"]);

interface Result {
  ok: boolean;
  command: string;
  data: Record<string, unknown>;
  artifacts: string[];
  warnings: string[];
}
function cli(...args: string[]): Result {
  const run = spawnSync(process.execPath, ["src/cli/index.ts", ...args, "--json"],
    { cwd: root, encoding: "utf8", maxBuffer: 20_000_000 });
  assert.ifError(run.error);
  assert.equal(run.status, 0, `${args.join(" ")}\n${run.stdout}\n${run.stderr}`);
  assert.equal(run.stderr, "");
  assert.equal(run.stdout.trim().split("\n").length, 1);
  const result = JSON.parse(run.stdout) as Result;
  assert.equal(result.ok, true);
  for (const file of result.artifacts) assert.ok(statSync(file).size > 0, file);
  return result;
}
function storeEntries(bytes: Buffer): Map<string, Buffer> {
  const entries = new Map<string, Buffer>();
  for (let offset = 0; offset + 30 <= bytes.length && bytes.readUInt32LE(offset) === 0x04034b50;) {
    assert.equal(bytes.readUInt16LE(offset + 8), 0, "ZIP STORE");
    const size = bytes.readUInt32LE(offset + 18);
    const nameLength = bytes.readUInt16LE(offset + 26);
    const extraLength = bytes.readUInt16LE(offset + 28);
    const start = offset + 30 + nameLength + extraLength;
    const name = bytes.toString("utf8", offset + 30, offset + 30 + nameLength);
    assert.ok(!entries.has(name));
    entries.set(name, bytes.subarray(start, start + size));
    offset = start + size;
  }
  return entries;
}
function energy(samples: Float32Array, first: number, last: number): number {
  let total = 0;
  for (let i = first; i < last; i++) {
    const value = samples[i]!;
    assert.ok(Number.isFinite(value));
    total += value * value;
  }
  return total;
}

test("DAW examples expose note timing, media, automation and exchange artifacts", async (t) => {
  const temp = mkdtempSync(join(tmpdir(), "music2-daw-bridge-"));
  try {
    const fixture = join(temp, "fixture");
    const setup = spawnSync(process.execPath, ["examples/daw-bridge/make-fixtures.mjs", fixture],
      { cwd: root, encoding: "utf8" });
    assert.equal(setup.status, 0, setup.stderr);
    const song = join(fixture, "audio-sfz.song.json");
    assert.ok(readFileSync(join(fixture, "assets/tiny.sfz"), "utf8").includes("sample=tiny.wav"));
    const repeatFixture = join(temp, "fixture-again");
    const repeated = spawnSync(process.execPath, ["examples/daw-bridge/make-fixtures.mjs", repeatFixture],
      { cwd: root, encoding: "utf8" });
    assert.equal(repeated.status, 0, repeated.stderr);
    for (const file of ["audio-sfz.song.json", "assets/tiny.sfz", "assets/tiny.wav", "assets/clip.wav"])
      assert.deepEqual(readFileSync(join(fixture, file)), readFileSync(join(repeatFixture, file)), file);
    for (const source of [notes, song]) {
      assert.equal(cli("validate", source).data["bars"], 2);
      assert.deepEqual((cli("lint", source, "--strict").data["results"] as { severity: string }[])
        .filter((item) => item.severity !== "info"), []);
      const events = cli("events", source).data["events"] as { track: string; time: number; midi?: number }[];
      assert.ok(events.some((event) => event.track === (source === notes ? "hook" : "sampled_hook") && event.time === 0));
      const ir = cli("export", "ir", source).data["ir"] as { ppq: number; quantization: { inexact: number } };
      assert.equal(ir.ppq, 960);
      assert.equal(ir.quantization.inexact, 0);
      const wav = join(temp, source === notes ? "notes.wav" : "sample.wav");
      assert.equal(cli("render", source, "-o", wav).data["frames"], 198450);
      const analysis = cli("analyze", wav, "--song", source, "--out", join(temp, source === notes ? "notes-analysis" : "sample-analysis"));
      const report = JSON.parse(readFileSync(analysis.data["analysisJson"] as string, "utf8")) as { warnings: { code: string }[] };
      assert.deepEqual(report.warnings.filter((warning) => balance.has(warning.code)), []);
    }

    const noteMidi = join(temp, "notes.mid");
    const midi = cli("export", "midi", notes, "-o", noteMidi);
    assert.equal(midi.data["ppq"], 960);
    assert.equal(midi.data["format"], 1);
    assert.equal(midi.data["notes"], 24);
    const imported = join(temp, "imported.song.json");
    cli("import", "midi", noteMidi, "-o", imported);
    assert.ok((cli("validate", imported).data["tracks"] as unknown[]).length > 0);

    const sampleMidi = cli("export", "midi", song, "-o", join(temp, "sample.mid"));
    assert.ok(sampleMidi.warnings.some((warning) => warning.includes("AUDIO_TRACK_DROPPED")));
    const sampleMidiAgain = cli("export", "midi", song, "-o", join(temp, "sample-again.mid"));
    assert.deepEqual(readFileSync(sampleMidi.artifacts[0]!), readFileSync(sampleMidiAgain.artifacts[0]!));
    const stemsDir = join(temp, "stems");
    const stems = cli("export", "stems", song, "-o", stemsDir, "--premaster");
    assert.equal(stems.data["frames"], 198450);
    assert.ok(stems.artifacts.some((file) => file.endsWith("premaster.wav")));
    assert.deepEqual((stems.data["files"] as string[]).slice(0, 3),
      ["tracks/beat.wav", "tracks/sampled_hook.wav", "tracks/recorded_clip.wav"]);
    const sfz = await readWav(join(stemsDir, "tracks/sampled_hook.wav"));
    const clip = await readWav(join(stemsDir, "tracks/recorded_clip.wav"));
    assert.ok(energy(sfz.left, 0, 44100) > 1, "SFZ note has nonzero energy in bar one");
    assert.ok(energy(clip.left, 44100, 77000) > 1, "audio clip has nonzero energy after beat two");
    const manifest = JSON.parse(readFileSync(join(stemsDir, "stems.json"), "utf8")) as Record<string, unknown>;
    assert.ok(manifest);

    const als = cli("export", "als", song, "-o", join(temp, "live"), "--content", "both");
    assert.equal(als.data["experimental"], true);
    assert.equal(als.data["content"], "both");
    assert.ok(als.warnings.some((warning) => warning.startsWith("ALS_EXPERIMENTAL")));
    assert.match(gunzipSync(readFileSync(als.data["als"] as string)).toString("utf8"), /<Ableton /);
    assert.ok((als.data["samples"] as string[]).every((file) => statSync(file).size > 44));
    const alsAgain = cli("export", "als", song, "-o", join(temp, "live-again"), "--content", "both");
    assert.deepEqual(readFileSync(als.data["als"] as string), readFileSync(alsAgain.data["als"] as string));

    const archive = cli("export", "dawproject", song, "-o", join(temp, "bridge.dawproject"), "--content", "both");
    const entries = storeEntries(readFileSync(archive.data["dawproject"] as string));
    assert.deepEqual([...entries.keys()], archive.data["entries"]);
    assert.deepEqual([...entries.keys()].slice(0, 2), ["metadata.xml", "project.xml"]);
    assert.ok([...entries.keys()].some((name) => name.startsWith("audio/")));
    const archiveAgain = cli("export", "dawproject", song, "-o", join(temp, "bridge-again.dawproject"), "--content", "both");
    assert.deepEqual(readFileSync(archive.artifacts[0]!), readFileSync(archiveAgain.artifacts[0]!));
    const xml = join(temp, "project.xml");
    writeFileSync(xml, entries.get("project.xml")!);
    const probe = spawnSync("xmllint", ["--version"], { encoding: "utf8" });
    if (probe.error && (probe.error as NodeJS.ErrnoException).code === "ENOENT") {
      if (process.env["MUSIC2_REQUIRE_XMLLINT"] === "1") assert.fail("xmllint required");
      t.diagnostic("SKIP DAWproject XSD: xmllint unavailable");
    } else {
      assert.equal(probe.status, 0, probe.stderr);
      const valid = spawnSync("xmllint", ["--noout", "--schema", join(root, "tests/fixtures/dawproject/Project.xsd"), xml], { encoding: "utf8" });
      assert.equal(valid.status, 0, valid.stderr);
    }

    const sliced = cli("slice", join(fixture, "assets/clip.wav"), "-o", join(temp, "slices"), "--bpm", "120");
    assert.ok(sliced.artifacts.some((file) => file.endsWith("kit.json")));
    assert.ok(sliced.artifacts.some((file) => file.endsWith("slice.song.json")));
  } finally { rmSync(temp, { recursive: true, force: true }); }
});
