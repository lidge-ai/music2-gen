import { test } from "node:test";
import assert from "node:assert/strict";
import { Fraction } from "../shared/index.ts";
import type { Hap } from "./ast.schema.ts";
import { parseMini } from "./parse.tool.ts";
import { onsets, queryArc } from "./query.tool.ts";

const F = (n: number, d = 1): Fraction => Fraction.of(n, d);
const ctx = { seed: 1, salt: "test" };
const events = (source: string, begin = 0, end = 1): string[] =>
  onsets(parseMini(source), F(begin), F(end), ctx)
    .map((hap) => `${hap.atom.raw}@[${hap.whole.begin.toString()},${hap.whole.end.toString()})`);

test("004 sequence, subdivision, rest and nesting vectors", () => {
  assert.deepEqual(events("bd sd"), ["bd@[0,1/2)", "sd@[1/2,1)"]);
  assert.deepEqual(events("bd ~ sd"), ["bd@[0,1/3)", "sd@[2/3,1)"]);
  assert.deepEqual(events("bd [hh hh] sd"), ["bd@[0,1/3)", "hh@[1/3,1/2)", "hh@[1/2,2/3)", "sd@[2/3,1)"]);
  assert.deepEqual(events("[bd [~ hh]]"), ["bd@[0,1/2)", "hh@[3/4,1)"]);
  assert.deepEqual(events("[bd [hh hh]]*2"), [
    "bd@[0,1/4)", "hh@[1/4,3/8)", "hh@[3/8,1/2)",
    "bd@[1/2,3/4)", "hh@[3/4,7/8)", "hh@[7/8,1)",
  ]);
});

test("004 alternation and stack vectors", () => {
  assert.deepEqual(events("<bd sd>", 0, 1), ["bd@[0,1)"]);
  assert.deepEqual(events("<bd sd>", 1, 2), ["sd@[1,2)"]);
  assert.deepEqual(events("<[bd ~] [~ sd]>", 0, 1), ["bd@[0,1/2)"]);
  assert.deepEqual(events("<[bd ~] [~ sd]>", 1, 2), ["sd@[3/2,2)"]);
  assert.deepEqual(events("c4,eb4,g4"), ["c4@[0,1)", "eb4@[0,1)", "g4@[0,1)"]);
  assert.deepEqual(events("[bd sd,hh hh hh hh]"), [
    "bd@[0,1/2)", "hh@[0,1/4)", "hh@[1/4,1/2)",
    "sd@[1/2,1)", "hh@[1/2,3/4)", "hh@[3/4,1)",
  ]);
  assert.deepEqual(events("[c4,eb4] sd"), ["c4@[0,1/2)", "eb4@[0,1/2)", "sd@[1/2,1)"]);
  assert.deepEqual(events("<a b,c d>", 0, 1), ["a@[0,1)", "c@[0,1)"]);
  assert.deepEqual(events("<a b,c d>", 1, 2), ["b@[1,2)", "d@[1,2)"]);
});

test("004 speed, repetition and weight vectors", () => {
  assert.deepEqual(events("hh*2"), ["hh@[0,1/2)", "hh@[1/2,1)"]);
  assert.deepEqual(events("[bd sd]*2"), ["bd@[0,1/4)", "sd@[1/4,1/2)", "bd@[1/2,3/4)", "sd@[3/4,1)"]);
  assert.deepEqual(events("[bd sd]/2", 0, 1), ["bd@[0,1)"]);
  assert.deepEqual(events("[bd sd]/2", 1, 2), ["sd@[1,2)"]);
  assert.deepEqual(events("[bd sd]/4", 0, 1), ["bd@[0,2)"]);
  assert.deepEqual(events("[bd sd]/4", 1, 2), []);
  const sustained = queryArc(parseMini("[bd sd]/4"), F(1), F(2), ctx);
  assert.equal(sustained.length, 1);
  assert.equal(sustained[0]?.whole.end.toString(), "2");
  assert.equal(sustained[0]?.part.begin.toString(), "1");
  assert.deepEqual(events("bd!2 sd"), ["bd@[0,1/3)", "bd@[1/3,2/3)", "sd@[2/3,1)"]);
  assert.deepEqual(events("bd!3 sd"), ["bd@[0,1/4)", "bd@[1/4,1/2)", "bd@[1/2,3/4)", "sd@[3/4,1)"]);
  assert.deepEqual(events("bd! sd"), ["bd@[0,1/3)", "bd@[1/3,2/3)", "sd@[2/3,1)"]);
  assert.deepEqual(events("bd@2 sd"), ["bd@[0,2/3)", "sd@[2/3,1)"]);
  assert.deepEqual(events("bd sd@3"), ["bd@[0,1/4)", "sd@[1/4,1)"]);
});

test("004 euclidean and deterministic random vectors", () => {
  assert.deepEqual(events("bd(3,8)"), ["bd@[0,1/8)", "bd@[3/8,1/2)", "bd@[3/4,7/8)"]);
  assert.deepEqual(events("bd(3,8,1)"), ["bd@[1/4,3/8)", "bd@[5/8,3/4)", "bd@[7/8,1)"]);
  assert.deepEqual(events("bd(3,8,2)"), ["bd@[1/8,1/4)", "bd@[1/2,5/8)", "bd@[3/4,7/8)"]);
  assert.deepEqual(events("bd?0 sd"), ["bd@[0,1/2)", "sd@[1/2,1)"]);
  assert.deepEqual(events("bd?1 sd"), ["sd@[1/2,1)"]);
  assert.ok([["bd@[0,1)"], ["sd@[0,1)"]].some((value) => JSON.stringify(value) === JSON.stringify(events("bd|sd"))));
  const chosen = events("[bd|sd] hh");
  assert.equal(chosen.length, 2);
  assert.ok(["bd@[0,1/2)", "sd@[0,1/2)"].includes(chosen[0] ?? ""));
  assert.equal(chosen[1], "hh@[1/2,1)");
});

test("004 value timing vectors", () => {
  assert.deepEqual(events("c4 eb3 f#2"), ["c4@[0,1/3)", "eb3@[1/3,2/3)", "f#2@[2/3,1)"]);
  assert.deepEqual(events("60 60.5"), ["60@[0,1/2)", "60.5@[1/2,1)"]);
  assert.deepEqual(events("bd:3 sd"), ["bd:3@[0,1/2)", "sd@[1/2,1)"]);
});

test("drill hat line has exact thirteen onsets", () => {
  const actual = onsets(parseMini("hh hh hh [hh hh hh] hh hh [hh hh hh hh] hh"), F(0), F(1), ctx)
    .map((hap) => hap.whole.begin.toString());
  assert.deepEqual(actual, ["0", "1/8", "1/4", "3/8", "5/12", "11/24", "1/2", "5/8", "3/4", "25/32", "13/16", "27/32", "7/8"]);
});

test("alternation restarts per item cycle and isolated arcs agree", () => {
  const node = parseMini("<[bd sd] [hh cp]>");
  const whole = onsets(node, F(0), F(2), ctx).filter((hap) => hap.whole.begin.gte(F(1)));
  assert.deepEqual(onsets(node, F(1), F(2), ctx), whole);
  assert.deepEqual(events("<[bd sd] [hh cp]>", 2, 3), ["bd@[2,5/2)", "sd@[5/2,3)"]);
});

test("random addressing is deterministic across query partitions and seeds", () => {
  const node = parseMini("hh*16?0.5");
  const signature = (haps: Hap[]): string => haps.map((hap) => hap.whole.begin.toString()).join(",");
  const a = onsets(node, F(0), F(16), ctx);
  const b = Array.from({ length: 16 }, (_, cycle) => onsets(node, F(cycle), F(cycle + 1), ctx)).flat();
  assert.equal(signature(a), signature(b));
  assert.equal(signature(a), signature(onsets(node, F(0), F(16), ctx)));
  assert.notEqual(signature(a), signature(onsets(node, F(0), F(16), { ...ctx, seed: 2 })));
});

test("nested alternation keeps each inner counter", () => {
  assert.deepEqual(events("<a <b c>>", 0, 4), ["a@[0,1)", "b@[1,2)", "a@[2,3)", "c@[3,4)"]);
});

test("slow patterns keep whole spans across cycle boundaries", () => {
  const haps = queryArc(parseMini("[bd sd]/4"), F(1), F(2), ctx);
  assert.equal(haps.length, 1);
  const hap = haps[0];
  assert.ok(hap);
  assert.equal(hap.whole.begin.toString(), "0");
  assert.equal(hap.whole.end.toString(), "2");
  assert.equal(hap.part.begin.toString(), "1");
  assert.equal(hap.part.end.toString(), "2");
  assert.deepEqual(events("[bd sd]/4", 1, 2), []);
});

test("bare replicate adds one copy", () => {
  assert.deepEqual(events("bd! sd"), ["bd@[0,1/3)", "bd@[1/3,2/3)", "sd@[2/3,1)"]);
});

test("stacked alternations advance independently", () => {
  assert.deepEqual(events("<a b, c d e>", 0, 3), ["a@[0,1)", "c@[0,1)", "b@[1,2)", "d@[1,2)", "a@[2,3)", "e@[2,3)"]);
});

test("three-item alternation cycles with period three", () => {
  assert.deepEqual(events("<a b c>", 0, 6), ["a@[0,1)", "b@[1,2)", "c@[2,3)", "a@[3,4)", "b@[4,5)", "c@[5,6)"]);
});
