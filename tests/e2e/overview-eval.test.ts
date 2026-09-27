import assert from "node:assert/strict";
import { cpSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { encodeRgbPng } from "../../src/analyze/png.tool.ts";

interface Truth {
  schemaVersion: 1; caseId: string; corpus: "core" | "use_case"; sourceSha256: string; analysisSha256: string;
  imageSha256: { overview: string; spectrogram: string };
  preparedImageSha256: { overview: Record<string, string>; spectrogram: Record<string, string> };
  sectionOrder: string[]; boundaryBars: number[]; sectionIntegratedLufs: Record<string, number | null>;
  loudestSection: string | null; loudestMarginLu: number | null; firstHookBar: number | null;
  excluded: "loudest_tie" | "null_section_lufs" | null;
}
interface Capture {
  schemaVersion: 1; caseId: string; imageKind: "overview" | "spectrogram"; longSide: 1600 | 1280 | 1024;
  repetition: number; model: "gpt-6-sol"; modelId?: string; requestedModelId?: string; servedModelId?: string;
  promptSha256: string; imageSha256: string; rawResponse: string;
}
interface Score {
  c3CaseCorrect: boolean; boundaryHitFraction: number; allBoundariesWithinOne: boolean;
  validSchema: boolean; fourWayCorrect: boolean; orderExact: boolean; error: string | null;
  caseId: string; imageKind: string; longSide: number;
}
interface Summary {
  nativeOverviewPasses: number; c3Complete: boolean; c3Pass: boolean; scores: Score[];
}
interface Harness {
  PROMPT_SHA256: string;
  selectCases: (extras: string[]) => string[];
  deriveGroundTruth: (song: string, analysis: string, images: { overview: string; spectrogram: string }) => Promise<Truth>;
  scoreAnswer: (truth: Truth, capture: Capture) => Score;
  scoreCorpus: (truths: Truth[], captures: Capture[]) => Summary;
  resizeRgbArea: (image: { width: number; height: number; rgb: Uint8Array }, width: number, height: number) => { rgb: Uint8Array };
  decodeRgbPng: (bytes: Buffer) => { width: number; height: number; rgb: Uint8Array };
  prepareImages: (bytes: Buffer) => Record<number, Buffer>;
}
// @ts-expect-error The standalone .mjs harness intentionally has no declaration file.
const harness = await import("../../scripts/eval-overview.mjs") as unknown as Harness;
const { decodeRgbPng, deriveGroundTruth, prepareImages, PROMPT_SHA256, resizeRgbArea, scoreAnswer, scoreCorpus, selectCases } = harness;

test("case selection keeps core order and rejects duplicate or missing examples", () => {
  assert.deepEqual(selectCases([]), ["drill-140", "trap-150", "boom-bap-90", "house-124"].map((id) => `examples/${id}.song.json`));
  assert.throws(() => selectCases(["examples/drill-140.song.json"]), /duplicate case stem/);
  assert.throws(() => selectCases(["examples/no-such-overview-case.song.json"]), /existing examples/);
});

const answer = (bars: number[] = [1, 5, 9], order = ["intro#0", "hook#0"], loudest = "hook#0", hook: number | null = 5): string =>
  JSON.stringify({ section_order: order, boundary_bars: bars, loudest_section: loudest, hook_start_bar: hook });

function capture(truth: Truth, changes: Partial<Capture> = {}): Capture {
  return { schemaVersion: 1, caseId: truth.caseId, imageKind: "overview", longSide: 1600, repetition: 1,
    model: "gpt-6-sol", promptSha256: PROMPT_SHA256,
    imageSha256: truth.preparedImageSha256.overview[1600]!, rawResponse: answer(), ...changes };
}

async function fixture(lufs: [number | null, number | null] = [-20, -14]): Promise<{ dir: string; truth: Truth }> {
  const dir = mkdtempSync(join(tmpdir(), "music2-overview-vector-"));
  const song = join(dir, "vector.song.json"), analysis = join(dir, "analysis.json");
  const overview = join(dir, "overview.png"), spectrogram = join(dir, "spectrogram.png");
  writeFileSync(song, JSON.stringify({ version: 1, title: "Vector", bpm: 120, key: "C minor",
    tracks: [{ id: "drums", kind: "drums", instrument: "drums", pattern: "bd" }],
    sections: [{ id: "intro", bars: 4, role: "intro" }, { id: "hook", bars: 4, role: "hook" }],
    arrangement: [{ section: "intro", repeats: 1 }, { section: "hook", repeats: 1 }] }));
  writeFileSync(analysis, JSON.stringify({ version: 1, source: "wav", sections: [
    { id: "intro#0", integratedLufs: lufs[0] }, { id: "hook#0", integratedLufs: lufs[1] },
  ] }));
  const png = encodeRgbPng(2, 2, Uint8Array.from([0, 0, 0, 100, 0, 0, 0, 100, 0, 100, 100, 0]));
  writeFileSync(overview, png);
  writeFileSync(spectrogram, encodeRgbPng(2, 2, Uint8Array.from([1, 0, 0, 100, 0, 0, 0, 100, 0, 100, 100, 0])));
  const truth = await deriveGroundTruth(song, analysis, { overview, spectrogram });
  return { dir, truth };
}

test("timeline placements set zero-based occurrence IDs and one-based boundaries", async () => {
  const { dir, truth } = await fixture();
  try {
    assert.deepEqual(truth.sectionOrder, ["intro#0", "hook#0"]);
    assert.deepEqual(truth.boundaryBars, [1, 5, 9]);
    assert.equal(truth.firstHookBar, 5);
    assert.equal(truth.loudestSection, "hook#0");
    assert.equal(truth.loudestMarginLu, 6);
    assert.equal(truth.excluded, null);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("answer schema, whole order, boundaries, and hook are scored separately", async () => {
  const { dir, truth } = await fixture();
  try {
    assert.equal(scoreAnswer(truth, capture(truth, { rawResponse: answer([1, 6, 9]) })).c3CaseCorrect, true);
    const miss = scoreAnswer(truth, capture(truth, { rawResponse: answer([1, 7, 9]) }));
    assert.equal(miss.boundaryHitFraction, 2 / 3);
    assert.equal(miss.allBoundariesWithinOne, false);
    assert.equal(miss.c3CaseCorrect, false);
    const swapped = scoreAnswer(truth, capture(truth, { rawResponse: answer([1, 5, 9], ["hook#0", "intro#0"]) }));
    assert.equal(swapped.boundaryHitFraction, 0);
    for (const rawResponse of [answer([1, 5]), answer() .replace(/}$/, ',"extra":1}'),
      answer().replace("[1,5,9]", '[1,"5",9]'), "not JSON"]) {
      const scored = scoreAnswer(truth, capture(truth, { rawResponse }));
      assert.equal(scored.c3CaseCorrect, false);
      assert.equal(scored.validSchema, false);
    }
    assert.equal(scoreAnswer(truth, capture(truth, { rawResponse: answer([1, 5, 9], truth.sectionOrder, "hook#0", 7) })).fourWayCorrect, false);
    // Printed labels are uppercase with a rail index; only case and a leading "NN " are normalized.
    assert.equal(scoreAnswer(truth, capture(truth, { rawResponse: answer([1, 5, 9], ["01 INTRO#0", "02 HOOK#0"], "HOOK#0") })).c3CaseCorrect, true);
    assert.equal(scoreAnswer(truth, capture(truth, { rawResponse: answer([1, 5, 9], ["INTRO#0", "HOOK_A#0"], "HOOK#0") })).orderExact, false);
    assert.equal(scoreAnswer(truth, capture(truth, { rawResponse: answer([1, 5, 9], ["INTRO#0", "HOOK#1"], "HOOK#0") })).orderExact, false);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("0.1 LU ties exclude a case; a 0.11 LU margin remains eligible", async () => {
  const tied = await fixture([-14.05, -14]);
  const eligible = await fixture([-14.11, -14]);
  try {
    assert.equal(tied.truth.excluded, "loudest_tie");
    assert.equal(eligible.truth.excluded, null);
    assert.equal(eligible.truth.loudestSection, "hook#0");
  } finally { rmSync(tied.dir, { recursive: true, force: true }); rmSync(eligible.dir, { recursive: true, force: true }); }
});

test("only four eligible valid native overview r1 captures can satisfy the 3-of-4 gate", async () => {
  const { dir, truth } = await fixture();
  try {
    const ids = ["drill-140", "trap-150", "boom-bap-90", "house-124"];
    const truths = ids.map((caseId) => ({ ...truth, caseId, corpus: "core" as const }));
    const answers = truths.map((item) => capture(item));
    answers[3] = capture(truths[3]!, { rawResponse: answer([1, 7, 9]) });
    assert.equal(scoreCorpus(truths, answers).nativeOverviewPasses, 3);
    assert.equal(scoreCorpus(truths, answers).c3Pass, true);
    const control = capture(truths[0]!, { imageKind: "spectrogram", imageSha256: truths[0]!.preparedImageSha256.spectrogram[1600]!, rawResponse: "invalid" });
    assert.equal(scoreCorpus(truths, [...answers, control]).c3Pass, true);
    assert.equal(scoreCorpus(truths, answers.slice(0, 3)).c3Complete, false);
    assert.equal(scoreCorpus(truths, [...answers, answers[0]!]).c3Complete, false);
    assert.equal(scoreCorpus([{ ...truths[0]!, excluded: "loudest_tie" }, ...truths.slice(1)], answers).c3Complete, false);
    const two = [...answers]; two[2] = capture(truths[2]!, { rawResponse: answer([1, 7, 9]) });
    assert.equal(scoreCorpus(truths, two).c3Pass, false);
    const stale = [...answers]; stale[0] = capture(truths[0]!, { imageSha256: "0".repeat(64) });
    assert.equal(scoreCorpus(truths, stale).c3Complete, false);
    assert.equal(scoreCorpus(truths, stale).scores.find((row: { caseId: string; imageKind: string; longSide: number }) => row.caseId === "drill-140" && row.imageKind === "overview" && row.longSide === 1600)?.error, "evidence_integrity");
    assert.equal(scoreAnswer(truths[0]!, capture(truths[0]!, { modelId: "other" })).error, "evidence_integrity");
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("RGB8 area-average and all paired image sizes are deterministic", () => {
  const rgb = Uint8Array.from([0, 0, 0, 100, 0, 0, 0, 100, 0, 100, 100, 0]);
  assert.deepEqual([...resizeRgbArea({ width: 2, height: 2, rgb }, 1, 1).rgb], [50, 50, 0]);
  const png = encodeRgbPng(2, 2, rgb);
  assert.deepEqual([...decodeRgbPng(png).rgb], [...rgb]);
  const overview = prepareImages(png);
  const control = prepareImages(encodeRgbPng(2, 2, Uint8Array.from([1, 0, 0, 100, 0, 0, 0, 100, 0, 100, 100, 0])));
  for (const side of [1600, 1280, 1024]) {
    assert.equal(Math.max(decodeRgbPng(overview[side]!).width, decodeRgbPng(overview[side]!).height), side);
    assert.notDeepEqual(overview[side], control[side]);
  }
});

test("score summary bytes survive an evidence-directory move", async () => {
  const { dir, truth } = await fixture();
  const first = join(dir, "first"), moved = join(dir, "archive", "moved");
  try {
    mkdirSync(join(first, "ground-truth"), { recursive: true });
    mkdirSync(join(first, "answers"));
    const ids = ["drill-140", "trap-150", "boom-bap-90", "house-124"];
    for (const caseId of ids) {
      const item = { ...truth, caseId, corpus: "core" };
      writeFileSync(join(first, "ground-truth", `${caseId}.json`), JSON.stringify(item));
      writeFileSync(join(first, "answers", `${caseId}.overview.1600.r1.json`), JSON.stringify(capture(item as Truth)));
    }
    const script = join(import.meta.dirname, "../../scripts/eval-overview.mjs");
    const run = (evidence: string): void => {
      const result = spawnSync(process.execPath, [script, "score", "--evidence-dir", evidence], { encoding: "utf8" });
      assert.equal(result.status, 0, result.stderr);
    };
    run(first);
    cpSync(first, moved, { recursive: true });
    run(moved);
    assert.deepEqual(readFileSync(join(first, "summary.json")), readFileSync(join(moved, "summary.json")));
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
