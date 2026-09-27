import assert from "node:assert/strict";
import test from "node:test";
import type { BandValue } from "./analysis.schema.ts";
import { balanceWarnings } from "./balance-warnings.tool.ts";

function bands(sub: number, low: number, lowMid = 0, presence = .1, air = .1): BandValue[] {
  return ([sub, low, lowMid, 0, presence, air] as const).map((share, i) => ({
    name: (["sub", "low", "lowMid", "mid", "presence", "air"] as const)[i]!,
    fromHz: 0, toHz: 0, share, dbRelative: null,
  }));
}
const codes = (b: BandValue[], genre?: string): string[] => balanceWarnings(b, genre).map((row) => row.code);

test("A1 uses strict genre guides and names the selected guide", () => {
  for (const [genre, limit] of [["trap", .92], ["drill_uk", .92], ["drill_ny", .92], ["house", .92],
    ["techno", .92], ["boom_bap", .85], ["lofi_hiphop", .85], ["unknown", .55]] as const) {
    assert.ok(!codes(bands(0, limit), genre).includes("LOW_END_DOMINANCE"), genre);
    const warning = balanceWarnings(bands(0, limit + .0001), genre).find((row) => row.code === "LOW_END_DOMINANCE");
    assert.equal(warning?.threshold, limit, genre);
    assert.match(warning.message, /guide/);
    if (genre !== "unknown") assert.match(warning.message, new RegExp(genre));
    assert.ok(warning?.fix);
  }
  assert.ok(!codes(bands(0, .55)).includes("LOW_END_DOMINANCE"));
  assert.ok(codes(bands(0, .5501)).includes("LOW_END_DOMINANCE"));
});

test("A2–A4 fire only across their exact boundaries and exemptions", () => {
  assert.ok(!codes(bands(0, 0, .25)).includes("LOW_MID_BUILDUP"));
  assert.ok(codes(bands(0, 0, .2501)).includes("LOW_MID_BUILDUP"));
  assert.ok(!codes(bands(.325, .175)).includes("SUB_WITHOUT_BODY"));
  assert.ok(!codes(bands(.325, .1751)).includes("SUB_WITHOUT_BODY"));
  assert.ok(!codes(bands(.33, .17)).includes("SUB_WITHOUT_BODY"));
  assert.ok(!codes(bands(.51 * .65, .51 * .35)).includes("SUB_WITHOUT_BODY"));
  const sub = .51 * .651, low = .51 - sub;
  const body = balanceWarnings(bands(sub, low)).find((row) => row.code === "SUB_WITHOUT_BODY");
  assert.equal(body?.threshold, .65);
  assert.equal(body?.observed, sub / (sub + low));
  assert.match(body.message, /total share 0\.510/);
  assert.ok(!codes(bands(0, 0, 0, .01, .01)).includes("HIGH_END_THIN"));
  assert.ok(codes(bands(0, 0, 0, .01, .0099)).includes("HIGH_END_THIN"));
  assert.ok(!codes(bands(0, 0, 0, .01, .0099), "lofi_hiphop").includes("HIGH_END_THIN"));
  assert.deepEqual(codes(bands(0, 0, 0, 0, 0)), []);
});

test("balance warnings preserve A1–A4 order and numeric fields", () => {
  const warnings = balanceWarnings(bands(.7, .24, .251, .001, .001), "trap");
  assert.deepEqual(warnings.map((row) => row.code), ["LOW_END_DOMINANCE", "LOW_MID_BUILDUP", "SUB_WITHOUT_BODY", "HIGH_END_THIN"]);
  for (const row of warnings) {
    assert.ok(Number.isFinite(row.observed));
    assert.ok(Number.isFinite(row.threshold));
    assert.ok(row.fix);
  }
});
