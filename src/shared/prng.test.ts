import { test } from "node:test";
import assert from "node:assert/strict";
import { fnv1a32, mulberry32, unitHash } from "./prng.tool.ts";

test("fnv1a32 known vectors", () => {
  assert.equal(fnv1a32(""), 0x811c9dc5);
  assert.equal(fnv1a32("a"), 0xe40c292c);
  assert.notEqual(fnv1a32("a", "b"), fnv1a32("ab"));
});

test("mulberry32 is deterministic and bounded", () => {
  const a = mulberry32(42);
  const b = mulberry32(42);
  for (let i = 0; i < 100; i++) {
    const x = a();
    assert.equal(x, b());
    assert.ok(x >= 0 && x < 1);
  }
});

test("mulberry32 mean is near one half", () => {
  const r = mulberry32(7);
  let s = 0;
  for (let i = 0; i < 10000; i++) s += r();
  assert.ok(Math.abs(s / 10000 - 0.5) < 0.02);
});

test("unitHash is stable per address", () => {
  assert.equal(unitHash(1, "hats", 3, "1/2"), unitHash(1, "hats", 3, "1/2"));
  assert.notEqual(unitHash(1, "hats", 3, "1/2"), unitHash(2, "hats", 3, "1/2"));
});
