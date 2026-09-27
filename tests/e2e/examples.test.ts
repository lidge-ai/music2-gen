import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, isAbsolute, join, relative } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("../../", import.meta.url));
const CLI = "src/cli/index.ts";
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

interface ExampleCase {
  file: string;
  genre: "drill_uk" | "trap" | "boom_bap" | "lofi_hiphop" | "house";
  bpm: number;
  key: string;
}

const examples: ExampleCase[] = [
  { file: "drill-140", genre: "drill_uk", bpm: 140, key: "C minor" },
  { file: "trap-150", genre: "trap", bpm: 150, key: "A minor" },
  { file: "boom-bap-90", genre: "boom_bap", bpm: 90, key: "C minor" },
  { file: "lofi-75", genre: "lofi_hiphop", bpm: 75, key: "A minor" },
  { file: "house-124", genre: "house", bpm: 124, key: "A minor" },
  { file: "dogfood/boom-bap-dogfood", genre: "boom_bap", bpm: 90, key: "D minor" },
];

interface CliResult {
  status: number;
  body: {
    ok: boolean;
    data?: Record<string, unknown>;
    error?: { code: string; details?: { report?: { results: { id: string }[] } } };
  };
}

function cli(command: string, args: string[], expectedStatus = 0): CliResult {
  const run = spawnSync(process.execPath, [CLI, command, ...args, "--json"], {
    cwd: ROOT, encoding: "utf8", maxBuffer: 20_000_000,
    env: { ...process.env, MUSIC2_JSON: "0" },
  });
  assert.ifError(run.error);
  assert.equal(run.status, expectedStatus, `${command} ${args.join(" ")}\n${run.stdout}\n${run.stderr}`);
  assert.equal(run.stderr, "");
  assert.equal(run.stdout.trim().split("\n").length, 1, `${command} must emit one JSON object`);
  const body = JSON.parse(run.stdout) as CliResult["body"];
  assert.equal(body.ok, expectedStatus === 0, `${command}: ${run.stdout}`);
  return { status: run.status, body };
}

function data(result: CliResult): Record<string, unknown> {
  assert.ok(result.body.data);
  return result.body.data;
}

function artifact(path: unknown, directory: string): string {
  assert.equal(typeof path, "string");
  const file = path as string;
  const within = relative(directory, file);
  assert.ok(within && within !== ".." && !within.startsWith(`..${process.platform === "win32" ? "\\" : "/"}`)
    && !isAbsolute(within), `artifact escaped temp directory: ${file}`);
  assert.ok(statSync(file).size > 0);
  return file;
}

function assertPng(path: unknown, directory: string, expectedWidth?: number, expectedHeight?: number): void {
  const bytes = readFileSync(artifact(path, directory));
  assert.ok(bytes.subarray(0, 8).equals(PNG_SIGNATURE));
  assert.equal(bytes.toString("ascii", 12, 16), "IHDR");
  assert.ok(bytes.readUInt32BE(16) > 0);
  assert.ok(bytes.readUInt32BE(20) > 0);
  if (expectedWidth !== undefined) assert.equal(bytes.readUInt32BE(16), expectedWidth);
  if (expectedHeight !== undefined) assert.equal(bytes.readUInt32BE(20), expectedHeight);
}

for (const example of examples) {
  test(`${example.file} validates, lints, renders, and analyzes`, () => {
    const directory = mkdtempSync(join(tmpdir(), "music2-example-"));
    const song = join(ROOT, "examples", `${example.file}.song.json`);
    try {
      const source = JSON.parse(readFileSync(song, "utf8")) as { genre: string; bpm: number; key: string };
      assert.equal(source.genre, example.genre);
      assert.equal(source.bpm, example.bpm);
      assert.equal(source.key, example.key);
      const validated = data(cli("validate", [song]));
      assert.equal(validated["bpm"], example.bpm);
      assert.ok(Number.isFinite(validated["bars"]));

      const lint = data(cli("lint", [song, "--strict"]));
      assert.equal(lint["genre"], example.genre);
      assert.deepEqual(lint["results"], []);

      const wav = join(directory, `${basename(example.file)}.wav`);
      const rendered = data(cli("render", [song, "-o", wav]));
      assert.ok(Number.isFinite(rendered["frames"]));
      assert.ok((rendered["frames"] as number) > 0);
      const pcm = readFileSync(artifact(wav, directory));
      assert.ok(pcm.length > 44);
      assert.equal(pcm.toString("ascii", 0, 4), "RIFF");
      assert.equal(pcm.toString("ascii", 8, 12), "WAVE");

      const analyzed = data(cli("analyze", [wav, "--song", song, "--out", join(directory, "analysis")]));
      const summary = analyzed["summary"] as { declaredBpm: number; estimatedBpm: number; integratedLufs: number };
      assert.equal(summary.declaredBpm, example.bpm);
      assert.ok(Number.isFinite(summary.estimatedBpm));
      assert.ok(Math.abs(summary.estimatedBpm - example.bpm) <= 2,
        `${example.file}: estimated ${summary.estimatedBpm} BPM, declared ${example.bpm}`);
      assert.ok(Number.isFinite(summary.integratedLufs));
      artifact(analyzed["analysisJson"], directory);
      artifact(analyzed["analysisMd"], directory);
      artifact(analyzed["beatsJson"], directory);
      assert.equal(basename(analyzed["spectrogramPng"] as string), "spectrogram.png");
      assert.equal(basename(analyzed["overviewPng"] as string), "overview.png");
      assert.equal(basename(analyzed["pianoRollPng"] as string), "pianoroll.png");
      assertPng(analyzed["spectrogramPng"], directory);
      assertPng(analyzed["overviewPng"], directory, 1600, 1400);
      assertPng(analyzed["pianoRollPng"], directory);

      if (example.genre === "drill_uk") {
        const songAgain = data(cli("analyze", [wav, "--song", song, "--out", join(directory, "analysis-again")]));
        assert.deepEqual(readFileSync(songAgain["overviewPng"] as string), readFileSync(analyzed["overviewPng"] as string));
        const wavOnlyFirst = data(cli("analyze", [wav, "--out", join(directory, "wav-only-first")]));
        const wavOnlySecond = data(cli("analyze", [wav, "--out", join(directory, "wav-only-second")]));
        assertPng(wavOnlyFirst["overviewPng"], directory, 1600, 1400);
        assert.deepEqual(readFileSync(wavOnlyFirst["overviewPng"] as string), readFileSync(wavOnlySecond["overviewPng"] as string));
        const wavFlow = (JSON.parse(readFileSync(wavOnlyFirst["analysisJson"] as string, "utf8")) as {
          flow: { axisKind: string; sectionMeans: unknown[]; annotations: string[] } }).flow;
        assert.ok(wavFlow.axisKind === "beats" || wavFlow.axisKind === "0.5 s");
        assert.deepEqual(wavFlow.sectionMeans, []);
        assert.ok(wavFlow.annotations.every((line) => !/HOOK|BARS/.test(line)));
        const second = join(directory, "drill-again.wav");
        cli("render", [song, "-o", second]);
        assert.deepEqual(readFileSync(second), pcm, "same song and seed must render byte-identically");
        assert.ok(summary.estimatedBpm >= 138 && summary.estimatedBpm <= 142);
      }
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
}

test("drill fails strict house lint with named house rules", () => {
  const song = join(ROOT, "examples/drill-140.song.json");
  const result = cli("lint", [song, "--genre", "house", "--strict"], 6);
  assert.equal(result.body.error?.code, "E_QA");
  const ids = result.body.error?.details?.report?.results.map(({ id }) => id) ?? [];
  assert.ok(ids.some((id) => id.startsWith("house/")), ids.join(", "));
});
