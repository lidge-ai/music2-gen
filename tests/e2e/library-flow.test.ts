import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { createStereo, readWav, writeWav } from "../../src/audio-io/index.ts";

const root = resolve(import.meta.dirname, "../.."), launcher = join(root, "bin/music2.js");
interface Envelope {
  ok: boolean; command: string; artifacts: string[]; warnings: string[];
  data: { index: { roots: string[]; instruments: { path: string }[]; kits: { path: string }[] };
    candidates: { path: string; kind: string }[]; instruments: { id: string; kind: string }[];
    instrument: string; kind: string; files: { named: number | null; measured: number; offset: number }[];
    notes: { want: number; ok: boolean; cents: number }[]; ok: boolean; frames: number; wav: string };
  error: { code: string };
}
function cli(dir: string, args: string[], status = 0): Envelope {
  const result = spawnSync(process.execPath, [launcher, ...args, "--json"], { cwd: dir, encoding: "utf8",
    env: { ...process.env, MUSIC2_HOME: join(dir, "home"), MUSIC2_SAMPLE_ROOTS: join(dir, "missing"), MUSIC2_JSON: undefined },
    timeout: 60_000, maxBuffer: 4 * 1024 * 1024 });
  assert.equal(result.error, undefined);
  assert.equal(result.status, status, result.stdout + result.stderr);
  assert.equal(result.stderr, "");
  const lines = result.stdout.trim().split("\n"); assert.equal(lines.length, 1);
  const resultObject = JSON.parse(lines[0]!) as Envelope;
  assert.equal(resultObject.ok, status === 0);
  return resultObject;
}
function harmonic(midi: number, seconds = 1.2): Float32Array {
  const rate = 44100, frequency = 440 * 2 ** ((midi - 69) / 12), samples = new Float32Array(Math.round(rate * seconds));
  for (let i = 0; i < samples.length; i++) {
    const phase = 2 * Math.PI * frequency * i / rate;
    samples[i] = .2 * (Math.sin(phase) + .5 * Math.sin(2 * phase) + .25 * Math.sin(3 * phase) + .125 * Math.sin(4 * phase));
  }
  return samples;
}
function aiff(samples: Float32Array): Buffer {
  // Generated mono 16-bit PCM, extended-80 rate 44100, no vendor sample data.
  const bytes = Buffer.alloc(54 + samples.length * 2);
  bytes.write("FORM", 0); bytes.writeUInt32BE(bytes.length - 8, 4); bytes.write("AIFF", 8);
  bytes.write("COMM", 12); bytes.writeUInt32BE(18, 16); bytes.writeUInt16BE(1, 20);
  bytes.writeUInt32BE(samples.length, 22); bytes.writeUInt16BE(16, 26);
  Buffer.from("400eac44000000000000", "hex").copy(bytes, 28);
  bytes.write("SSND", 38); bytes.writeUInt32BE(8 + samples.length * 2, 42);
  for (let i = 0; i < samples.length; i++) bytes.writeInt16BE(Math.round(samples[i]! * 32767), 54 + 2 * i);
  return bytes;
}
async function wav(path: string, samples: Float32Array, smpl = false): Promise<void> {
  const pcm = createStereo(44100, samples.length); pcm.left.set(samples); pcm.right.set(samples);
  await writeWav(path, pcm, { bits: 24, seed: 7 });
  if (!smpl) return;
  const chunk = Buffer.alloc(68); chunk.write("smpl", 0); chunk.writeUInt32LE(60, 4);
  chunk.writeUInt32LE(67, 20); chunk.writeUInt32LE(0x80000000, 24); chunk.writeUInt32LE(1, 36);
  chunk.writeUInt32LE(8820, 52); chunk.writeUInt32LE(39689, 56);
  const bytes = Buffer.concat([await readFile(path), chunk]); bytes.writeUInt32LE(bytes.length - 8, 4);
  await writeFile(path, bytes);
}

test("synthetic sample library scans, finds, imports SFZ and kit, verifies and renders user instruments", { timeout: 60_000 }, async () => {
  const dir = await realpath(await mkdtemp(join(tmpdir(), "music2-library-flow-")));
  try {
    const samples = join(dir, "samples"), pitched = join(samples, "Harmonic"), drums = join(samples, "Drum Kit");
    await mkdir(pitched, { recursive: true }); await mkdir(drums, { recursive: true });
    await writeFile(join(pitched, "Harmonic_C4.aiff"), aiff(harmonic(48)));
    await writeFile(join(pitched, "Harmonic_E4.aif"), aiff(harmonic(52)));
    await wav(join(pitched, "Harmonic_G4.wav"), harmonic(55), true);
    for (const [name, midi] of [["Kick_1.wav", 36], ["Snare_1.wav", 50], ["Hi-Hat_Closed_1.wav", 90]] as const) {
      const hit = harmonic(midi, .15);
      for (let i = 0; i < hit.length; i++) hit[i] = hit[i]! * Math.exp(-10 * i / hit.length);
      await wav(join(drums, name), hit);
    }
    const unavailable = cli(dir, ["library", "scan"], 3);
    assert.equal(unavailable.error.code, "E_CAPABILITY");
    assert.equal(cli(dir, ["library", "import", pitched, "--id", "../escape"], 2).error.code, "E_INPUT");
    const scan = cli(dir, ["library", "scan", "--root", samples]);
    assert.deepEqual(scan.data.index.roots, [samples]);
    assert.ok(scan.data.index.instruments.some((item) => item.path === pitched));
    assert.ok(scan.data.index.kits.some((item) => item.path === drums));
    const found = cli(dir, ["library", "find", "Harmonic", "--kind", "instrument", "--limit", "1"]);
    assert.equal(found.data.candidates.length, 1); assert.equal(found.data.candidates[0]?.path, pitched);
    assert.equal(cli(dir, ["library", "find", "kick", "--kind", "kit"]).data.candidates[0]?.path, drums);
    const imported = cli(dir, ["library", "import", pitched, "--id", "harmonic", "--as", "instrument",
      "--octave", "auto", "--attack", "0.005", "--release", "0.05"]);
    assert.equal(imported.data.instrument, "user:harmonic"); assert.equal(imported.data.kind, "sfz");
    assert.equal(imported.data.files.length, 3);
    assert.ok(imported.data.files.every((file) => file.offset === -1 && file.measured === file.named! - 12));
    const kit = cli(dir, ["library", "import", drums, "--id", "drum-kit", "--as", "kit"]);
    assert.equal(kit.data.instrument, "user:drum-kit"); assert.equal(kit.data.kind, "kit");
    const listed = cli(dir, ["library", "list"]);
    assert.deepEqual(listed.data.instruments.map((item) => item.id), ["drum-kit", "harmonic"]);
    const verified = cli(dir, ["library", "verify", "harmonic"]);
    assert.equal(verified.data.ok, true);
    assert.deepEqual(verified.data.notes.map((note) => note.want), [48, 52, 55, 60]);
    assert.ok(verified.data.notes.every((note) => note.ok && Math.abs(note.cents) <= 50));
    const song = join(dir, "song.json"), output = join(dir, "result.wav");
    await writeFile(song, JSON.stringify({ version: 1, seed: 19, bpm: 120, sampleRate: 44100, tailSeconds: 0,
      tracks: [{ id: "melody", kind: "notes", instrument: "user:harmonic", pattern: "c3 e3 g3 c4", gain: -12 },
        { id: "drums", kind: "drums", instrument: "user:drum-kit", pattern: "bd sd hh bd", gain: -12 }],
      sections: [{ id: "one", bars: 1 }], arrangement: [{ section: "one" }] }));
    const rendered = cli(dir, ["render", song, "-o", output]);
    assert.equal(rendered.data.wav, output); assert.equal(rendered.data.frames, 88200);
    const audio = await readWav(output);
    assert.equal(audio.left.length, 88200); assert.ok(audio.left.some((sample) => Math.abs(sample) > .001));
    const layered = join(dir, "layered.json"), layeredOutput = join(dir, "layered.wav");
    await writeFile(layered, JSON.stringify({ version: 1, seed: 19, bpm: 120, sampleRate: 44100, tailSeconds: 0,
      tracks: [{ id: "bass", kind: "notes", instrument: "bass", pattern: "c3 e3 g3 c4", gain: -12,
        layers: [{ id: "sample", instrument: imported.data.instrument, gain: -6 }] },
        { id: "kick", kind: "drums", instrument: "drums", pattern: "bd sd hh bd", gain: -12,
          layers: [{ id: "sample", instrument: kit.data.instrument, only: ["bd"], gain: -6 }] }],
      sections: [{ id: "one", bars: 1 }], arrangement: [{ section: "one" }] }));
    const layeredRender = cli(dir, ["render", layered, "-o", layeredOutput]);
    assert.equal(layeredRender.data.frames, 88200);
    const layeredAudio = await readWav(layeredOutput);
    assert.ok(layeredAudio.left.some((sample) => Math.abs(sample) > .001));
    const midi = cli(dir, ["export", "midi", layered, "-o", join(dir, "layered.mid")]);
    assert.deepEqual(midi.warnings.filter((warning) => warning.startsWith("LAYERS_FLATTENED:")),
      ["LAYERS_FLATTENED:bass:1", "LAYERS_FLATTENED:kick:1"]);
  } finally { await rm(dir, { recursive: true, force: true }); }
});
