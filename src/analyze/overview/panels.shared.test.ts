import assert from "node:assert/strict";
import test from "node:test";
import { clock, number, timeX } from "./panels.shared.tool.ts";

test("all time panels share inclusive 136..1168 coordinates", () => {
  assert.equal(timeX(0, 16), 136);
  assert.equal(timeX(8, 16), 652);
  assert.equal(timeX(16, 16), 1168);
  assert.equal(timeX(20, 16), 1168);
});

test("time and absent measurements have explicit readable labels", () => {
  assert.equal(clock(68), "1:08");
  assert.equal(number(null), "N/A");
  assert.equal(number(-14.14), "-14.1");
});
