import { test } from "node:test";
import assert from "node:assert/strict";
import { bjorklund, rotateLeft } from "./euclid.tool.ts";

test("three in eight anchors and left rotations", () => {
  const positions = (bits: boolean[]): number[] => bits.flatMap((bit, index) => bit ? [index] : []);
  assert.deepEqual(positions(bjorklund(3, 8)), [0, 3, 6]);
  assert.deepEqual(positions(rotateLeft(bjorklund(3, 8), 1)), [2, 5, 7]);
  assert.deepEqual(positions(rotateLeft(bjorklund(3, 8), 2)), [1, 4, 6]);
});

test("euclidean edges", () => {
  assert.deepEqual(bjorklund(0, 4), [false, false, false, false]);
  assert.deepEqual(bjorklund(4, 4), [true, true, true, true]);
  assert.deepEqual(rotateLeft([1, 2, 3], -1), [3, 1, 2]);
  assert.throws(() => bjorklund(5, 4), /pulses/);
});
