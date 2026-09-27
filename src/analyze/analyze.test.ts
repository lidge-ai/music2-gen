import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { inflateSync } from "node:zlib";
import { writeWav } from "../audio-io/index.ts";
import type { StereoBuffer } from "../audio-io/index.ts";
import { renderSong } from "../render/index.ts";
import { loadSong } from "../song/index.ts";
import { validateSong } from "../song/index.ts";
import type { Song } from "../song/index.ts";
import { analyzeAudio, analyzeFile } from "./analyze.tool.ts";

const drill = resolve("examples/drill-140.song.json");
function sine(seconds: number, hz = 1000, amplitude = .1): StereoBuffer {
  const sampleRate = 8000;
  const left = Float32Array.from({ length: sampleRate * seconds }, (_, i) => amplitude * Math.sin(2 * Math.PI * hz * i / sampleRate));
  return { sampleRate, left, right: left, sourceChannels: 1 };
}
function checkPng(bytes: Buffer): void {
  assert.deepEqual([...bytes.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
  let pos = 8, width = 0, height = 0;
  const chunks: Buffer[] = [];
  const crc32 = (data: Uint8Array): number => {
    let crc = 0xffffffff;
    for (const byte of data) {
      crc ^= byte;
      for (let bit = 0; bit < 8; bit++) crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
    }
    return (crc ^ 0xffffffff) >>> 0;
  };
  while (pos < bytes.length) {
    const length = bytes.readUInt32BE(pos);
    const type = bytes.toString("ascii", pos + 4, pos + 8);
    assert.equal(bytes.readUInt32BE(pos + 8 + length), crc32(bytes.subarray(pos + 4, pos + 8 + length)));
    if (type === "IHDR") { width = bytes.readUInt32BE(pos + 8); height = bytes.readUInt32BE(pos + 12); }
    if (type === "IDAT") chunks.push(bytes.subarray(pos + 8, pos + 8 + length));
    pos += 12 + length;
    if (type === "IEND") break;
  }
  assert.ok(width > 0 && height > 0);
  const raw = inflateSync(Buffer.concat(chunks));
  assert.equal(raw.length, height * (1 + width * 3));
  for (let y = 0; y < height; y++) assert.equal(raw[y * (1 + width * 3)], 0);
}

function checkOverview(bytes: Buffer): void {
  checkPng(bytes);
  assert.equal(bytes.readUInt32BE(16), 1600);
  assert.equal(bytes.readUInt32BE(20), 1400);
}

test("PCM validation and ordered threshold warnings", () => {
  const audio = sine(1, 50, 1.2);
  assert.throws(() => analyzeAudio({ ...audio, right: new Float32Array(0) }), { code: "E_INPUT" });
  const report = analyzeAudio(audio, { targetLufs: -30 });
  assert.ok(report.analysis.clippedSamples > 0);
  const codes = report.analysis.warnings.map((item) => item.code);
  assert.equal(codes[0], "CLIPPING");
  assert.ok(codes.includes("LUFS_OFF_TARGET"));
  assert.ok(codes.includes("LOW_END_DOMINANCE"));
  assert.ok(codes.includes("EMPTY_HIGH_BAND"));
  assert.ok(codes.includes("NO_BEATS"));
  assert.ok(codes.includes("SUB_WITHOUT_BODY"));
  assert.ok(codes.includes("HIGH_END_THIN"));
  assert.ok(codes.indexOf("EMPTY_HIGH_BAND") < codes.indexOf("LOW_END_DOMINANCE"));
  assert.equal(report.analysis.flow.verdicts[0].split(" ")[0], "CLIPPING");
});

test("the same measured bands use song genre for WAV-backed and song analysis", () => {
  const rate = 8000;
  const left = Float32Array.from({ length: rate }, (_, i) =>
    .2 * Math.sin(2 * Math.PI * 50 * i / rate) + .1 * Math.sin(2 * Math.PI * 1000 * i / rate));
  const pcm: StereoBuffer = { sampleRate: rate, left, right: left, sourceChannels: 1 };
  const song = validateSong({ version: 1, bpm: 120, genre: "trap",
    tracks: [{ id: "tone", kind: "notes", instrument: "lead", pattern: "~" }],
    sections: [{ id: "part", role: "verse", bars: 1 }], arrangement: [{ section: "part" }] });
  const plain = analyzeAudio(pcm);
  const withSong = analyzeAudio(pcm, { song, source: "wav" });
  const lowShare = plain.analysis.bands[0]!.share + plain.analysis.bands[1]!.share;
  assert.ok(lowShare > .55 && lowShare < .85, `low share ${lowShare}`);
  assert.ok(plain.analysis.warnings.some((row) => row.code === "LOW_END_DOMINANCE" && row.threshold === .55));
  assert.ok(!withSong.analysis.warnings.some((row) => row.code === "LOW_END_DOMINANCE"));
  assert.equal(withSong.analysis.source, "wav");
  assert.deepEqual(withSong.analysis.bands, plain.analysis.bands);
  assert.ok(plain.analysis.warnings.some((row) => row.code === "EMPTY_HIGH_BAND"));
  assert.ok(plain.analysis.warnings.some((row) => row.code === "HIGH_END_THIN"));
  assert.ok(plain.reportMarkdown.includes("| EMPTY_HIGH_BAND |"));
  assert.ok(plain.reportMarkdown.includes("| HIGH_END_THIN |"));
  assert.equal(plain.analysis.flow.verdicts[0].split(" ")[0], "LOW_END_DOMINANCE");
});

test("analysis accepts finite PCM rates outside the shared meter range", () => {
  for (const sampleRate of [5000, 200000]) {
    const left = Float32Array.from({ length: Math.round(sampleRate * .05) }, (_, i) => .1 * Math.sin(2 * Math.PI * 500 * i / sampleRate));
    const result = analyzeAudio({ sampleRate, left, right: left, sourceChannels: 1 });
    assert.equal(result.analysis.sampleRate, sampleRate);
    assert.ok(result.analysis.samplePeakLinear > 0);
  }
});

test("WAV-only steady tone has four artifacts and no beat map", async () => {
  const dir = await mkdtemp(join(tmpdir(), "music2-analysis-wav-"));
  try {
    const wav = join(dir, "tone.wav");
    // Float32 mono RIFF keeps the input free of dither-induced onset noise.
    const audio = sine(1);
    const bytes = Buffer.alloc(44 + audio.left.length * 4);
    bytes.write("RIFF", 0); bytes.writeUInt32LE(bytes.length - 8, 4); bytes.write("WAVEfmt ", 8);
    bytes.writeUInt32LE(16, 16); bytes.writeUInt16LE(3, 20); bytes.writeUInt16LE(1, 22);
    bytes.writeUInt32LE(audio.sampleRate, 24); bytes.writeUInt32LE(audio.sampleRate * 4, 28);
    bytes.writeUInt16LE(4, 32); bytes.writeUInt16LE(32, 34);
    bytes.write("data", 36); bytes.writeUInt32LE(audio.left.length * 4, 40);
    for (let i = 0; i < audio.left.length; i++) bytes.writeFloatLE(audio.left[i]!, 44 + i * 4);
    await writeFile(wav, bytes);
    const artifacts = await analyzeFile(wav);
    assert.equal(artifacts.pianoRollPng, null);
    assert.equal(artifacts.beatsJson, null);
    checkPng(await readFile(artifacts.spectrogramPng));
    checkOverview(await readFile(artifacts.overviewPng));
    assert.match(await readFile(artifacts.analysisMd, "utf8"), /No song timeline supplied/);
    const analysis = JSON.parse(await readFile(artifacts.analysisJson, "utf8")) as { warnings: { code: string }[];
      flow: { axisKind: string; sectionMeans: unknown[]; shortTermLufs1Hz: unknown[] } };
    assert.ok(analysis.warnings.some(({ code }) => code === "NO_BEATS"));
    assert.equal(analysis.flow.axisKind, "0.5 s");
    assert.deepEqual(analysis.flow.sectionMeans, []);
    assert.deepEqual(analysis.flow.shortTermLufs1Hz, []);
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test("drill song produces six reproducible artifacts with independent 140 BPM estimate", async () => {
  const dir = await mkdtemp(join(tmpdir(), "music2-analysis-song-"));
  try {
    const artifacts = await analyzeFile(drill, { outDir: dir });
    assert.ok(artifacts.pianoRollPng && artifacts.beatsJson);
    const paths = [artifacts.analysisJson, artifacts.analysisMd, artifacts.spectrogramPng, artifacts.overviewPng,
      artifacts.pianoRollPng, artifacts.beatsJson] as string[];
    const first = await Promise.all(paths.map((path) => readFile(path)));
    checkPng(first[2]!); checkOverview(first[3]!); checkPng(first[4]!);
    const analysis = JSON.parse(first[0]!.toString()) as { declaredBpm: number; estimatedBpm: number; sections: unknown[]; tracks: unknown[];
      warnings: { code: string }[]; flow: { sectionMeans: unknown[]; annotations: string[] } };
    assert.deepEqual(artifacts.summary.warnings.map((row) => row.code), analysis.warnings.map((row) => row.code));
    for (const row of analysis.warnings) assert.ok(first[1]!.toString().includes(`| ${row.code} |`));
    assert.ok(first[0]!.toString().indexOf('"bands"') < first[0]!.toString().indexOf('"flow"'));
    assert.ok(first[0]!.toString().indexOf('"flow"') < first[0]!.toString().indexOf('"sections"'));
    assert.equal(analysis.declaredBpm, 140);
    assert.ok(analysis.estimatedBpm >= 138 && analysis.estimatedBpm <= 142, `estimated BPM ${analysis.estimatedBpm}`);
    assert.ok(analysis.sections.length > 0 && analysis.tracks.length > 0);
    assert.equal(analysis.flow.sectionMeans.length, analysis.sections.length);
    assert.match(first[1]!.toString(), /## Flow/);
    for (const annotation of analysis.flow.annotations) assert.ok(first[1]!.toString().includes(`- ${annotation}`));
    assert.match(first[1]!.toString(), /\| hook#0 \| hook \|/);
    const map = JSON.parse(first[5]!.toString()) as { source: string; meter: number };
    assert.equal(map.source, "song"); assert.equal(map.meter, 4);
    await analyzeFile(drill, { outDir: dir });
    const second = await Promise.all(paths.map((path) => readFile(path)));
    first.forEach((bytes, i) => assert.deepEqual(second[i], bytes));
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test("missing file and song/WAV option ambiguity are input errors", async () => {
  await assert.rejects(analyzeFile("/definitely-absent-music2.wav"), { code: "E_NOT_FOUND" });
  await assert.rejects(analyzeFile(drill, { songPath: drill }), { code: "E_INPUT" });
  const song = await loadSong(drill);
  assert.equal(song.bpm, 140);
});

test("output file collision and inaccessible directory fail before replacing inputs", async () => {
  const dir = await mkdtemp(join(tmpdir(), "music2-analysis-collision-"));
  try {
    const input = join(dir, "analysis.json");
    const minimal = resolve("examples/minimal.song.json");
    const bytes = await readFile(minimal);
    await writeFile(input, bytes);
    await assert.rejects(analyzeFile(input, { outDir: dir }), { code: "E_INPUT" });
    assert.deepEqual(await readFile(input), bytes);
    const blocker = join(dir, "blocker");
    await writeFile(blocker, "file");
    await assert.rejects(analyzeFile(minimal, { outDir: blocker }), { code: "E_ACCESS" });
  } finally { await rm(dir, { recursive: true, force: true }); }
});

function contrast(gap: number, genre: string, loop = false): ReturnType<typeof analyzeAudio> {
  const dance = genre === "house" || genre === "techno";
  const quietRole = dance ? "breakdown" : "verse";
  const loudRole = dance ? "groove" : "hook";
  const song: Song = { version: 1, bpm: 120, sampleRate: 44100, tailSeconds: 0, genre, loop,
    tracks: [{ id: "tone", kind: "notes", instrument: "lead", pattern: "c4" }],
    sections: [{ id: "quiet", role: quietRole, bars: 1 }, { id: "loud", role: loudRole, bars: 1 }],
    arrangement: [{ section: "quiet" }, { section: "loud" }] };
  const rate = 44100, barFrames = rate * 2;
  const left = Float32Array.from({ length: barFrames * 2 }, (_, i) =>
    .05 * (i >= barFrames ? 10 ** (gap / 20) : 1) * (loop && i >= barFrames * 2 - rate * .05 ? 2 : 1)
    * Math.sin(2 * Math.PI * 1000 * i / rate));
  return analyzeAudio({ sampleRate: rate, left, right: left, sourceChannels: 1 }, { song: validateSong(song) });
}

test("song-backed section warning uses ungated means at strict genre limits", () => {
  for (const [genre, threshold] of [["trap", 1], ["house", 3]] as const) {
    const fire = contrast(threshold - .01, genre);
    const warning = fire.analysis.warnings.find((row) => row.code === "SECTION_LOUDNESS_FLAT");
    assert.ok(warning);
    assert.ok(warning.observed! < threshold);
    assert.equal(warning.threshold, threshold);
    assert.ok(fire.reportMarkdown.includes(warning.fix!));
    assert.equal(contrast(threshold, genre).analysis.warnings.some((row) => row.code === "SECTION_LOUDNESS_FLAT"), false);
  }
  assert.equal(analyzeAudio(sine(4)).analysis.warnings.some((row) => row.code === "SECTION_LOUDNESS_FLAT"), false);
  const song = validateSong({ version: 1, bpm: 120, genre: "trap",
    tracks: [{ id: "tone", kind: "notes", instrument: "lead", pattern: "~" }],
    sections: [{ id: "verse", role: "verse", bars: 1 }, { id: "hook", role: "hook", bars: 1 }],
    arrangement: [{ section: "verse" }, { section: "hook" }] });
  const silent = new Float32Array(44100 * 4);
  assert.equal(analyzeAudio({ sampleRate: 44100, left: silent, right: silent, sourceChannels: 1 }, { song })
    .analysis.warnings.some((row) => row.code === "SECTION_LOUDNESS_FLAT"), false);
});

test("loop seam warning follows section warning and refreshes the overview verdict", () => {
  const result = contrast(0, "trap", true);
  const codes = result.analysis.warnings.map((row) => row.code);
  assert.ok(codes.includes("SECTION_LOUDNESS_FLAT"));
  assert.ok(codes.includes("LOOP_SEAM_DISCONTINUITY"));
  assert.ok(codes.indexOf("SECTION_LOUDNESS_FLAT") < codes.indexOf("LOOP_SEAM_DISCONTINUITY"));
  assert.equal(result.analysis.flow.verdicts[0].split(" ")[0], "HIGH_END_THIN");
  assert.ok(result.reportMarkdown.includes(result.analysis.flow.verdicts[0]));
  const detail = result.analysis.warnings.find((row) => row.code === "LOOP_SEAM_DISCONTINUITY")!.details;
  assert.ok(detail && "jumpFs" in detail);
});

test("song-backed loop WAV alignment uses the body frame count", async () => {
  const dir = await mkdtemp(join(tmpdir(), "music2-loop-analysis-"));
  try {
    const path = join(dir, "loop.song.json");
    const wav = join(dir, "loop.wav");
    const source: Song = { version: 1, bpm: 120, sampleRate: 44100, tailSeconds: 1, loop: true,
      tracks: [{ id: "hit", kind: "notes", instrument: "bell", pattern: "c4 ~ ~ ~" }],
      sections: [{ id: "body", role: "groove", bars: 1 }], arrangement: [{ section: "body" }] };
    await writeFile(path, JSON.stringify(source));
    const rendered = await renderSong(validateSong(source), path);
    await writeWav(wav, rendered.audio, { bits: 24, seed: 1 });
    const artifacts = await analyzeFile(wav, { songPath: path, outDir: join(dir, "out") });
    assert.equal(artifacts.analysisJson.endsWith("analysis.json"), true);
    const extra = { ...rendered.audio, left: new Float32Array(rendered.audio.left.length + 88200),
      right: new Float32Array(rendered.audio.right.length + 88200) };
    await writeWav(wav, extra, { bits: 24, seed: 1 });
    await assert.rejects(analyzeFile(wav, { songPath: path, outDir: join(dir, "too-long") }), { code: "E_INPUT" });
  } finally { await rm(dir, { recursive: true, force: true }); }
});
