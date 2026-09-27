import { test } from "node:test";
import assert from "node:assert/strict";
import { Music2Error } from "../shared/index.ts";
import { parseMini } from "./parse.tool.ts";

test("parser rejects malformed patterns at exact offsets", () => {
  for (const [src, offset] of [["[bd", 3], ["bd*0", 3], ["bd,sd|cp", 5], ["bd?2", 3], ["bd@2*2", 4]] as const) {
    assert.throws(() => parseMini(src), (error: unknown) => {
      assert.ok(error instanceof Music2Error);
      assert.equal(error.code, "E_PARSE");
      assert.equal(error.details?.["src"], src);
      assert.equal(error.details?.["offset"], offset);
      assert.match(error.fix ?? "", /\^ expected/);
      return true;
    });
  }
});

test("parser limits and separator rules", () => {
  for (const src of ["", "bd*65", "bd/0", "bd@65", "bd(4,3)", "bd(3,65)", "bd?1.1", "bd*2/2", "bd,sd|cp", "[bd,]", "{" + "bd" + "}", "x".repeat(4001)]) {
    assert.throws(() => parseMini(src), (error: unknown) => error instanceof Music2Error && error.code === "E_PARSE", src);
  }
  assert.throws(() => parseMini("[".repeat(33) + "bd" + "]".repeat(33)), /depth/);
});

test("preorder ids, copies, weights and atom values", () => {
  const node = parseMini("bd!2 sd@3");
  assert.equal(node.type, "seq");
  if (node.type !== "seq") return;
  assert.deepEqual(node.steps.map((step) => step.weight), [1, 1, 3]);
  assert.deepEqual(node.steps.map((step) => step.node.id), [1, 2, 3]);
  const sample = parseMini("bd:3");
  assert.equal(sample.type, "atom");
  if (sample.type === "atom") assert.deepEqual(sample.atom, { raw: "bd:3", name: "bd", index: 3, num: null, offset: 0 });
  const number = parseMini("60.5");
  assert.equal(number.type, "atom");
  if (number.type === "atom") assert.equal(number.atom.num, 60.5);
  const multipliedCopies = parseMini("bd!9!9");
  assert.equal(multipliedCopies.type, "seq");
  if (multipliedCopies.type === "seq") assert.equal(multipliedCopies.steps.length, 81);
});
