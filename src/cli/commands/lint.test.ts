import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Music2Error, packageRoot } from "../../shared/index.ts";
import type { CommandContext } from "../registry.ts";
import { summarizeLint, type LintResult } from "../../recipes/lint.tool.ts";
import { lint, lintReportResult } from "./lint.ts";

const ctx = (file: string, values: Record<string, unknown> = {}): CommandContext =>
  ({ args: [file], values, json: true, cwd: packageRoot(), stderr: process.stderr });

test("strict lint permits info-only reports and prints info-prefixed human lines", () => {
  const info: LintResult = { id: "generic/thin_peak_layers", severity: "info", path: "tracks[0]",
    observed: 0, expected: 1, fix: "Consider a sound layer." };
  const report = summarizeLint(null, 1, [info]);
  const result = lintReportResult(report, true);
  assert.equal(result.command, "lint");
  assert.deepEqual(JSON.parse(JSON.stringify(result.data)), { ...report });
  assert.equal(result.data["infos"], 1);
  assert.match(result.text ?? "", /^info generic\/thin_peak_layers tracks\[0\]:/);
  for (const severity of ["error", "warning"] as const) {
    const mixed = summarizeLint(null, 1, [info, { ...info, id: "generic/failure", severity }]);
    assert.throws(() => lintReportResult(mixed, true), (error: unknown) =>
      error instanceof Music2Error && error.code === "E_QA" && error.exit === 6 && error.details?.["report"] === mixed);
    if (severity === "warning") assert.equal(lintReportResult(mixed, false).data["infos"], 1);
    else assert.throws(() => lintReportResult(mixed, false), { code: "E_QA" });
  }
});

test("lint returns report, strict warning exits 6 with complete report, genre override works", async () => {
  const file = "examples/wrong-genre.song.json";
  const result = await lint.run(ctx(file));
  assert.equal(result.command, "lint");
  assert.equal(result.data["infos"], 0);
  assert.match(result.text ?? "", /drill_uk\/1/);
  await assert.rejects(lint.run(ctx(file, { strict: true })), (error: unknown) => {
    assert.ok(error instanceof Music2Error);
    assert.equal(error.code, "E_QA"); assert.equal(error.exit, 6);
    const report = error.details?.["report"] as { results: { id: string }[] };
    assert.ok(report.results.some((item) => item.id === "drill_uk/1"));
    assert.ok(report.results.some((item) => item.id === "drill_uk/2"));
    return true;
  });
  const house = await lint.run(ctx(file, { genre: "house" }));
  assert.equal(house.data["genre"], "house");
  assert.ok((house.data["results"] as { id: string }[]).every((item) => !item.id.startsWith("drill_uk/")));
});

test("lint parse-only QA exit, malformed JSON input exit and mixed schema issues", async () => {
  const dir = await mkdtemp(join(tmpdir(), "music2-lint-"));
  try {
    const file = join(dir, "bad.json");
    await writeFile(file, JSON.stringify({ version: 1, bpm: 120, tracks: [{ id: "drums", kind: "drums", instrument: "drums", pattern: "[bd" }], sections: [{ id: "a", bars: 1 }], arrangement: [{ section: "a" }] }));
    await assert.rejects(lint.run(ctx(file)), (error: unknown) => error instanceof Music2Error && error.code === "E_QA" && error.exit === 6 &&
      (error.details?.["report"] as { results: { id: string }[] }).results[0]?.id === "generic/pattern_parse");
    await writeFile(file, "{");
    await assert.rejects(lint.run(ctx(file)), (error: unknown) => error instanceof Music2Error && error.code === "E_INPUT" && error.exit === 2);
    await writeFile(file, JSON.stringify({ version: 1, bpm: 500, tracks: [{ id: "drums", kind: "drums", instrument: "drums", pattern: "[bd" }], sections: [{ id: "a", bars: 1 }], arrangement: [{ section: "a" }] }));
    await assert.rejects(lint.run(ctx(file)), (error: unknown) => error instanceof Music2Error && error.code === "E_SCHEMA" && error.exit === 2);
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test("human lint display suppresses an identical scale warning but report keeps both ids", async () => {
  const dir = await mkdtemp(join(tmpdir(), "music2-lint-"));
  try {
    const file = join(dir, "chromatic.json");
    await writeFile(file, JSON.stringify({ version: 1, bpm: 140, genre: "drill_uk", key: "C minor", tracks: [
      { id: "kick", kind: "drums", instrument: "drums", pattern: "bd ~ ~ ~" },
      { id: "snare", kind: "drums", instrument: "drums", pattern: "~ ~ sd ~" },
      { id: "melody", kind: "notes", instrument: "bell", pattern: "e4 ~ ~ ~" }],
      sections: [{ id: "hook", bars: 1, role: "hook" }], arrangement: [{ section: "hook" }] }));
    const result = await lint.run(ctx(file));
    assert.ok((result.data["results"] as { id: string }[]).some((r) => r.id === "generic/out_of_key"));
    assert.ok((result.data["results"] as { id: string }[]).some((r) => r.id === "drill_uk/7"));
    assert.match(result.text ?? "", /drill_uk\/7/);
    assert.doesNotMatch(result.text ?? "", /generic\/out_of_key/);
  } finally { await rm(dir, { recursive: true, force: true }); }
});
