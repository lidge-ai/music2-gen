import { test } from "node:test";
import assert from "node:assert/strict";
import { Fraction, max, min } from "./rational.tool.ts";

const F = (n: number, d = 1): Fraction => Fraction.of(n, d);

test("arithmetic reduces", () => {
  assert.equal(F(1, 3).add(F(1, 6)).toString(), "1/2");
  assert.equal(F(3, 4).sub(F(1, 4)).toString(), "1/2");
  assert.equal(F(2, 3).mul(F(3, 4)).toString(), "1/2");
  assert.equal(F(1, 2).div(F(1, 4)).toString(), "2");
  assert.equal(F(2, -4).toString(), "-1/2");
  assert.equal(F(6, 3).toString(), "2");
});

test("floor and sam handle negatives", () => {
  assert.equal(F(-1, 4).floor(), -1);
  assert.equal(F(7, 4).floor(), 1);
  assert.equal(F(-8, 4).floor(), -2);
  assert.equal(F(9, 4).sam().toString(), "2");
});

test("comparison", () => {
  assert.ok(F(1, 3).lt(F(1, 2)));
  assert.ok(F(2, 4).eq(F(1, 2)));
  assert.ok(F(3, 2).gte(F(3, 2)));
  assert.equal(min(F(1, 3), F(1, 4)).toString(), "1/4");
  assert.equal(max(F(1, 3), F(1, 4)).toString(), "1/3");
  assert.equal(F(1, 4).valueOf(), 0.25);
});

test("overflow and zero denominators throw internal errors", () => {
  assert.throws(() => new Fraction(2n ** 41n, 1), /overflow/);
  assert.throws(() => F(1, 0), /zero denominator/);
  assert.throws(() => F(1, 2).div(F(0)), /division by zero/);
  assert.throws(() => F(0.5), /integers/);
});
