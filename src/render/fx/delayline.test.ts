import assert from "node:assert/strict";
import { test } from "node:test";
import { DelayLine } from "./delayline.tool.ts";

test("fractional read interpolates adjacent past samples and wraps", () => {
  const line = new DelayLine(4);
  line.write(1);
  line.write(0);
  assert.equal(line.read(1.5), 0.5);
  for (let i = 0; i < 12; i++) line.write(i);
  assert.equal(line.read(1.5), 10.5);
});
