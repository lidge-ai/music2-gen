import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, readFile, rm, stat, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { main } from "../main.ts";
import type { ProjectIR } from "../../project/index.ts";

interface Envelope {
  command: string; artifacts: string[]; warnings: string[];
  data: { ir: ProjectIR; quantization: ProjectIR["quantization"] };
  error: { code: string };
}
function envelope(text: string): Envelope { return JSON.parse(text) as Envelope; }

const source = { version: 1, bpm: 120,
  tracks: [{ id: "lead", kind: "notes", instrument: "piano", notes: [{ start: 0, length: 1, pitch: 60 }] }],
  sections: [{ id: "hook", bars: 1 }], arrangement: [{ section: "hook" }] };

async function invoke(argv: string[], cwd: string): Promise<{ exit: number; stdout: string; stderr: string }> {
  let stdout = ""; let stderr = "";
  const exit = await main(argv, { cwd,
    stdout: { write(chunk: string) { stdout += chunk; return true; } } as NodeJS.WritableStream,
    stderr: { write(chunk: string) { stderr += chunk; return true; } } as NodeJS.WritableStream });
  return { exit, stdout, stderr };
}

test("IR and MIDI CLI envelopes surface layer flattening while keeping main tracks", async () => {
  const dir = await mkdtemp(join(tmpdir(), "music2-layer-export-"));
  try {
    await writeFile(join(dir, "song.json"), JSON.stringify({ ...source,
      tracks: source.tracks.map((track) => ({ ...track, layers: [{ id: "double", instrument: "lead", transpose: 12 }] })) }));
    for (const args of [["ir"], ["ir", "-o", "ir.json"], ["midi", "-o", "song.mid"]]) {
      const [kind, ...options] = args;
      const result = await invoke(["export", kind!, "song.json", ...options, "--json"], dir);
      assert.equal(result.exit, 0, result.stdout + result.stderr);
      assert.equal(result.stdout.trim().split("\n").length, 1);
      assert.ok(envelope(result.stdout).warnings.includes("LAYERS_FLATTENED:lead:1"));
    }
    const ir = JSON.parse(await readFile(join(dir, "ir.json"), "utf8")) as ProjectIR;
    assert.equal(ir.tracks.length, 1);
    assert.deepEqual(ir.tracks[0]?.type === "notes" ? ir.tracks[0].instrument : null,
      { kind: "voice", id: "piano", params: {} });
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test("export ir prints one JSON envelope or formatted human IR", async () => {
  const dir = await mkdtemp(join(tmpdir(), "music2-ir-cli-"));
  try {
    await writeFile(join(dir, "song.json"), JSON.stringify(source));
    const json = await invoke(["export", "ir", "song.json", "--json"], dir);
    assert.equal(json.exit, 0);
    assert.equal(json.stderr, "");
    const result = envelope(json.stdout);
    assert.equal(result.command, "export");
    assert.deepEqual(result.artifacts, []);
    assert.equal(result.data.ir.ppq, 960);
    assert.deepEqual(Object.keys(result.data.ir).slice(0, 4), ["version", "ppq", "title", "seed"]);
    const human = await invoke(["export", "ir", "song.json"], dir);
    assert.equal(human.exit, 0);
    assert.equal((JSON.parse(human.stdout) as ProjectIR).ppq, 960);
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test("staged output is newline terminated, no-replace and --force replaces", async () => {
  const dir = await mkdtemp(join(tmpdir(), "music2-ir-file-"));
  try {
    await writeFile(join(dir, "song.json"), JSON.stringify(source));
    const args = ["export", "ir", "song.json", "-o", "ir.json", "--json"];
    const first = await invoke(args, dir);
    assert.equal(first.exit, 0);
    const body = await readFile(join(dir, "ir.json"), "utf8");
    assert.ok(body.endsWith("\n"));
    assert.equal(body, JSON.stringify(JSON.parse(body) as unknown, null, 2) + "\n");
    const result = envelope(first.stdout);
    assert.deepEqual(result.artifacts, [join(dir, "ir.json")]);
    assert.deepEqual(result.data.quantization, { events: 0, inexact: 0, maxErrorTicks: 0 });
    const second = await invoke(args, dir);
    assert.equal(second.exit, 4);
    assert.equal(envelope(second.stdout).error.code, "E_ACCESS");
    assert.equal(await readFile(join(dir, "ir.json"), "utf8"), body);
    const replaced = await invoke([...args, "--force"], dir);
    assert.equal(replaced.exit, 0);
    assert.equal(await readFile(join(dir, "ir.json"), "utf8"), body);
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test("aliases, reserved subverbs and malformed flags produce one input error", async () => {
  const dir = await mkdtemp(join(tmpdir(), "music2-ir-errors-"));
  try {
    await writeFile(join(dir, "song.json"), JSON.stringify(source));
    for (const argv of [
      ["export", "ir", "song.json", "-o", "song.json", "--json"],
      ["export", "midi", "song.json", "--json"],
      ["export", "--json"],
      ["export", "ir", "song.json", "--bogus", "--json"],
      ["export", "ir", "song.json", "-o", "out.wav", "--json"],
    ]) {
      const result = await invoke(argv, dir);
      assert.equal(result.exit, 2, argv.join(" "));
      assert.equal(result.stderr, "");
      assert.equal(envelope(result.stdout).error.code, "E_INPUT");
      assert.equal(result.stdout.trim().split("\n").length, 1);
    }
    await symlink("song.json", join(dir, "alias.json"));
    const alias = await invoke(["export", "ir", "song.json", "-o", "alias.json", "--force", "--json"], dir);
    assert.equal(alias.exit, 2);
    assert.equal(envelope(alias.stdout).error.code, "E_INPUT");
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test("song schema failure retains its error code and single envelope", async () => {
  const dir = await mkdtemp(join(tmpdir(), "music2-ir-schema-"));
  try {
    await writeFile(join(dir, "bad.json"), JSON.stringify({ ...source, tracks: [] }));
    const result = await invoke(["export", "ir", "bad.json", "--json"], dir);
    assert.equal(result.exit, 2);
    assert.equal(envelope(result.stdout).error.code, "E_SCHEMA");
    assert.equal(result.stdout.trim().split("\n").length, 1);
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test("export midi writes type-1 bytes with a placement marker and deterministic output", async () => {
  const dir = await mkdtemp(join(tmpdir(), "music2-midi-export-"));
  try {
    await writeFile(join(dir, "song.json"), JSON.stringify(source));
    const args = ["export", "midi", "song.json", "-o", "one.mid", "--json"];
    const result = await invoke(args, dir);
    assert.equal(result.exit, 0);
    const response = JSON.parse(result.stdout) as { artifacts: string[]; data: { format: number; ppq: number; tracks: number; notes: number; channels: Record<string, number> } };
    assert.equal(result.stdout.trim().split("\n").length, 1);
    assert.deepEqual(response.artifacts, [join(dir, "one.mid")]);
    assert.deepEqual([response.data.format, response.data.ppq, response.data.tracks, response.data.notes], [1, 960, 2, 1]);
    assert.deepEqual(response.data.channels, { lead: 1 });
    const body = await readFile(join(dir, "one.mid"));
    assert.equal(body.subarray(0, 14).toString("hex"), "4d546864000000060001000203c0");
    assert.ok(body.includes(Buffer.from("00ff0604686f6f6b", "hex"))); // FF 06 hook, hand-derived
    assert.equal((await invoke(args, dir)).exit, 4);
    assert.equal((await invoke([...args, "--force"], dir)).exit, 0);
    assert.deepEqual(await readFile(join(dir, "one.mid")), body);
    assert.equal((await invoke(["export", "midi", "song.json", "-o", "two.mid", "--json"], dir)).exit, 0);
    assert.deepEqual(await readFile(join(dir, "two.mid")), body);
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test("export midi rejects source/output identity and escaped kit manifest", async () => {
  const dir = await mkdtemp(join(tmpdir(), "music2-midi-kit-"));
  try {
    await writeFile(join(dir, "song.json"), JSON.stringify(source));
    const alias = await invoke(["export", "midi", "song.json", "-o", "song.json", "--json"], dir);
    assert.equal(alias.exit, 2);
    const kitSong = { ...source, tracks: [{ id: "kit", kind: "drums", instrument: "kit:assets/kit",
      notes: [{ start: 0, length: 1, sample: "kick" }] }] };
    await writeFile(join(dir, "kit-song.json"), JSON.stringify(kitSong));
    const outside = await mkdtemp(join(tmpdir(), "music2-midi-outside-"));
    try {
      await writeFile(join(outside, "kit.json"), JSON.stringify({ version: 1, samples: { kick: ["kick.wav"] } }));
      const { mkdir } = await import("node:fs/promises");
      await mkdir(join(dir, "assets", "kit"), { recursive: true });
      await symlink(join(outside, "kit.json"), join(dir, "assets", "kit", "kit.json"));
      const rejected = await invoke(["export", "midi", "kit-song.json", "-o", "kit.mid", "--json"], dir);
      assert.equal(rejected.exit, 4);
      assert.equal((JSON.parse(rejected.stdout) as { error: { code: string } }).error.code, "E_ACCESS");
      await assert.rejects(readFile(join(dir, "kit.mid")), { code: "ENOENT" });
    } finally { await rm(outside, { recursive: true, force: true }); }
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test("export stems writes aligned PCM, exact envelope, crop markers and master parity", async () => {
  const dir = await mkdtemp(join(tmpdir(), "music2-stems-cli-"));
  try {
    const song = { ...source, sampleRate: 48000, tailSeconds: 0,
      sections: [{ id: "hook", bars: 1 }], arrangement: [{ section: "hook", repeats: 3 }] };
    await writeFile(join(dir, "song.json"), JSON.stringify(song));
    const args = ["export", "stems", "song.json", "-o", "bundle", "--bars", "1:3", "--bits", "16", "--premaster", "--json"];
    const first = await invoke(args, dir);
    assert.equal(first.exit, 0, first.stdout);
    assert.equal(first.stderr, "");
    assert.equal(first.stdout.trim().split("\n").length, 1);
    const response = JSON.parse(first.stdout) as { data: { dir: string; manifest: string; files: string[]; frames: number; sampleRate: number }; artifacts: string[]; warnings: string[] };
    assert.deepEqual(Object.keys(response.data), ["dir", "manifest", "files", "frames", "sampleRate"]);
    assert.deepEqual(response.data.files, ["tracks/lead.wav", "master.wav", "premaster.wav", "stems.json"]);
    assert.deepEqual(response.artifacts, response.data.files.map((path) => join(dir, "bundle", path)));
    assert.deepEqual(response.warnings, []);
    assert.equal(response.data.frames, 192000);
    const manifest = JSON.parse(await readFile(response.data.manifest, "utf8")) as { barOrigin: number; bars: number; sectionMarkers: { bar: number; sourceBar: number; seconds: number }[] };
    assert.equal(manifest.barOrigin, 2);
    assert.equal(manifest.bars, 2);
    assert.deepEqual(manifest.sectionMarkers.map((marker) => [marker.bar, marker.sourceBar, marker.seconds]),
      [[1, 2, 0], [2, 3, 2]]);
    for (const path of response.data.files.filter((name) => name.endsWith(".wav"))) {
      const wav = await readFile(join(dir, "bundle", path));
      assert.equal(wav.readUInt16LE(20), 1);
      assert.equal(wav.readUInt16LE(22), 2);
      assert.equal(wav.readUInt32LE(24), 48000);
      assert.equal(wav.readUInt16LE(34), 16);
      assert.equal(wav.length, 44 + response.data.frames * 4);
    }
    const rendered = await invoke(["render", "song.json", "-o", "legacy.wav", "--bits", "16", "--bars", "1:3", "--json"], dir);
    assert.equal(rendered.exit, 0, rendered.stdout);
    assert.deepEqual(await readFile(join(dir, "legacy.wav")), await readFile(join(dir, "bundle", "master.wav")));
    assert.equal((await invoke(args, dir)).exit, 4);
    await writeFile(join(dir, "bundle", "unrelated"), "keep");
    assert.equal((await invoke([...args, "--force"], dir)).exit, 0);
    assert.equal(await readFile(join(dir, "bundle", "unrelated"), "utf8"), "keep");
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test("export stems rejects occupied directories, invalid ranges and output identity", async () => {
  const dir = await mkdtemp(join(tmpdir(), "music2-stems-errors-"));
  try {
    await writeFile(join(dir, "song.json"), JSON.stringify(source));
    const { mkdir, readdir } = await import("node:fs/promises");
    await mkdir(join(dir, "occupied"));
    await writeFile(join(dir, "occupied", "keep"), "old");
    const occupied = await invoke(["export", "stems", "song.json", "-o", "occupied", "--json"], dir);
    assert.equal(occupied.exit, 4);
    assert.equal(envelope(occupied.stdout).error.code, "E_ACCESS");
    for (const range of ["1:1", "2:1", "-1:1", "0:2", "0:1.5"]) {
      const rejected = await invoke(["export", "stems", "song.json", "-o", "new", "--bars", range, "--json"], dir);
      assert.equal(rejected.exit, 2, range);
      assert.equal(envelope(rejected.stdout).error.code, "E_INPUT");
    }
    for (const argv of [
      ["export", "stems", "song.json", "-o", "song.json", "--json"],
      ["export", "stems", "song.json", "-o", "new", "--bits", "32", "--json"],
      ["export", "stems", "song.json", "--json"],
    ]) assert.equal((await invoke(argv, dir)).exit, 2);
    await writeFile(join(dir, "loop.json"), JSON.stringify({ ...source, loop: true }));
    const loopCrop = await invoke(["export", "stems", "loop.json", "-o", "loop-bundle",
      "--bars", "0:1", "--json"], dir);
    assert.equal(loopCrop.exit, 2);
    assert.equal(envelope(loopCrop.stdout).error.code, "E_INPUT");
    assert.deepEqual((await readdir(join(dir, "occupied"))), ["keep"]);
    await assert.rejects(readdir(join(dir, "new")), { code: "ENOENT" });
    await assert.rejects(readdir(join(dir, "loop-bundle")), { code: "ENOENT" });
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test("export stems 24-bit no-master bundle is deterministic across output names", async () => {
  const dir = await mkdtemp(join(tmpdir(), "music2-stems-24-"));
  try {
    await writeFile(join(dir, "song.json"), JSON.stringify(source));
    for (const name of ["one", "two"]) {
      const response = await invoke(["export", "stems", "song.json", "-o", name,
        "--bits", "24", "--no-master", "--premaster", "--json"], dir);
      assert.equal(response.exit, 0, response.stdout);
    }
    for (const file of ["tracks/lead.wav", "premaster.wav", "stems.json"])
      assert.deepEqual(await readFile(join(dir, "one", file)), await readFile(join(dir, "two", file)));
    const wav = await readFile(join(dir, "one", "premaster.wav"));
    assert.equal(wav.readUInt16LE(34), 24);
    assert.equal(wav.length, 44 + wav.readUInt32LE(40));
    await assert.rejects(readFile(join(dir, "one", "master.wav")), { code: "ENOENT" });
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test("export als emits one experimental JSON envelope for MIDI and both", async () => {
  const dir = await mkdtemp(join(tmpdir(), "music2-als-cli-"));
  try {
    await writeFile(join(dir, "song.json"), JSON.stringify(source));
    const midi = await invoke(["export", "als", "song.json", "-o", "midi", "--content", "midi", "--json"], dir);
    assert.equal(midi.exit, 0, midi.stdout);
    const midiResult = JSON.parse(midi.stdout) as { data: { experimental: boolean; samples: string[] }; warnings: string[] };
    assert.equal(midiResult.data.experimental, true);
    assert.deepEqual(midiResult.data.samples, []);
    assert.match(midiResult.warnings[0]!, /^ALS_EXPERIMENTAL:/);
    const midiArtifact = (JSON.parse(midi.stdout) as { artifacts: string[] }).artifacts[0]!;
    const contents = await readFile(midiArtifact);
    const occupied = await invoke(["export", "als", "song.json", "-o", "midi", "--content", "midi", "--json"], dir);
    assert.equal(occupied.exit, 4);
    assert.deepEqual(await readFile(midiArtifact), contents);
    await writeFile(join(dir, "midi", "unrelated.txt"), "keep");
    const forced = await invoke(["export", "als", "song.json", "-o", "midi", "--content", "midi", "--force", "--json"], dir);
    assert.equal(forced.exit, 0, forced.stdout);
    assert.equal(await readFile(join(dir, "midi", "unrelated.txt"), "utf8"), "keep");
    const both = await invoke(["export", "als", "song.json", "-o", "both", "--content", "both", "--json"], dir);
    assert.equal(both.exit, 0, both.stdout);
    const bothResult = JSON.parse(both.stdout) as { data: { experimental: boolean; samples: string[] }; artifacts: string[] };
    assert.equal(bothResult.data.experimental, true);
    assert.equal(bothResult.data.samples.length, 1);
    assert.equal(bothResult.artifacts.length, 2);
    const audio16 = await invoke(["export", "als", "song.json", "-o", "audio16", "--content", "audio", "--bits", "16", "--json"], dir);
    assert.equal(audio16.exit, 0, audio16.stdout);
    const audioResult = JSON.parse(audio16.stdout) as { data: { samples: string[]; tracks: number } };
    assert.equal(audioResult.data.tracks, 1);
    const header = await readFile(audioResult.data.samples[0]!);
    assert.equal(header.readUInt16LE(34), 16);
    const collision = await invoke(["export", "als", "song.json", "-o", ".", "--content", "midi", "--force", "--json"], dir);
    assert.equal(collision.exit, 2);
    assert.equal(envelope(collision.stdout).error.code, "E_INPUT");
    const invalid = await invoke(["export", "als", "song.json", "-o", "bad", "--content", "bogus", "--json"], dir);
    assert.equal(invalid.exit, 2);
    assert.equal(envelope(invalid.stdout).error.code, "E_INPUT");
    assert.equal(invalid.stdout.trim().split("\n").length, 1);
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test("dawproject content flags, one-object output, collision and force", async () => {
  const dir = await mkdtemp(join(tmpdir(), "music2-dawproject-cli-"));
  try {
    await writeFile(join(dir, "song.json"), JSON.stringify(source));
    const args = ["export", "dawproject", "song.json", "-o", "song.dawproject", "--content", "midi", "--json"];
    const first = await invoke(args, dir);
    assert.equal(first.exit, 0, first.stdout);
    assert.equal(first.stdout.trim().split("\n").length, 1);
    const result = JSON.parse(first.stdout) as { data: { content: string; entries: string[] }; artifacts: string[] };
    assert.equal(result.data.content, "midi");
    assert.deepEqual(result.data.entries, ["metadata.xml", "project.xml"]);
    assert.deepEqual(result.artifacts, [join(dir, "song.dawproject")]);
    const bytes = await readFile(join(dir, "song.dawproject"));
    assert.equal(bytes.readUInt32LE(0), 0x04034b50);
    const occupied = await invoke(args, dir);
    assert.equal(occupied.exit, 4);
    assert.equal(envelope(occupied.stdout).error.code, "E_ACCESS");
    assert.deepEqual(await readFile(join(dir, "song.dawproject")), bytes);
    const forced = await invoke([...args, "--force"], dir);
    assert.equal(forced.exit, 0);
    assert.deepEqual(await readFile(join(dir, "song.dawproject")), bytes);
    for (const invalid of [
      ["export", "dawproject", "song.json", "-o", "bad.zip", "--json"],
      ["export", "dawproject", "song.json", "-o", "new.dawproject", "--content", "wrong", "--json"],
      ["export", "dawproject", "song.json", "-o", "new.dawproject", "--bits", "16", "--json"],
    ]) {
      const response = await invoke(invalid, dir);
      assert.equal(response.exit, 2, invalid.join(" "));
      assert.equal(envelope(response.stdout).error.code, "E_INPUT");
    }
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test("dawproject confines original clip media before staging output", async () => {
  const dir = await mkdtemp(join(tmpdir(), "music2-dawproject-confine-"));
  const outside = await mkdtemp(join(tmpdir(), "music2-dawproject-outside-"));
  try {
    await writeFile(join(outside, "source.wav"), "outside");
    await symlink(join(outside, "source.wav"), join(dir, "source.wav"));
    await writeFile(join(dir, "song.json"), JSON.stringify({ ...source,
      audioTracks: [{ id: "vox", clips: [{ file: "source.wav", start: 0, length: 1 }] }] }));
    const response = await invoke(["export", "dawproject", "song.json", "-o", "blocked.dawproject",
      "--content", "midi", "--json"], dir);
    assert.equal(response.exit, 4);
    assert.equal(envelope(response.stdout).error.code, "E_ACCESS");
    await assert.rejects(readFile(join(dir, "blocked.dawproject")));
  } finally {
    await rm(dir, { recursive: true, force: true });
    await rm(outside, { recursive: true, force: true });
  }
});

test("plugin-bearing audio exports require opt-in before artifact creation", async () => {
  const dir = await mkdtemp(join(tmpdir(), "music2-export-plugin-"));
  const previous = process.env["MUSIC2_HOME"];
  process.env["MUSIC2_HOME"] = dir;
  try {
    const song = { ...source, tailSeconds: 0, tracks: [{ ...source.tracks[0]!, plugins: [{ id: "softclip" }] }] };
    await writeFile(join(dir, "song.json"), JSON.stringify(song));
    await writeFile(join(dir, "effect.vst3"), "stub");
    await writeFile(join(dir, "plugins.json"), JSON.stringify({ version: 1,
      plugins: { softclip: { path: join(dir, "effect.vst3") } } }));
    const host = JSON.stringify([process.execPath, resolve("tests/fixtures/plugin-host/stub-host.mjs")]);
    for (const [format, output] of [["stems", "stems"], ["als", "als"], ["dawproject", "song.dawproject"]]) {
      const args = ["export", format!, "song.json", "-o", output!, "--json"];
      const blocked = await invoke(args, dir);
      assert.equal(blocked.exit, 3, blocked.stdout);
      assert.equal(envelope(blocked.stdout).error.code, "E_CAPABILITY");
      assert.match(blocked.stdout, /--allow-plugins/);
      await assert.rejects(stat(join(dir, output!)), { code: "ENOENT" });
      const allowed = await invoke([...args, "--allow-plugins", "--plugin-host", host], dir);
      assert.equal(allowed.exit, 0, allowed.stdout);
      const result = JSON.parse(allowed.stdout) as { data: { deterministic?: false }; warnings: string[] };
      assert.equal(result.data.deterministic, false);
      assert.ok(result.warnings.some((warning) => warning.includes("may vary")));
    }
    for (const format of ["als", "dawproject"]) {
      const output = format === "als" ? "midi-only" : "midi-only.dawproject";
      const result = await invoke(["export", format, "song.json", "-o", output, "--content", "midi", "--json"], dir);
      assert.equal(result.exit, 0, result.stdout);
      assert.ok((JSON.parse(result.stdout) as { warnings: string[] }).warnings.some((warning) => warning.includes("frozen audio")));
    }
  } finally {
    if (previous === undefined) delete process.env["MUSIC2_HOME"]; else process.env["MUSIC2_HOME"] = previous;
    await rm(dir, { recursive: true, force: true });
  }
});
