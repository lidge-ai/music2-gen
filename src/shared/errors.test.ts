import { test } from "node:test";
import assert from "node:assert/strict";
import { ERROR_CODES, EXIT, Music2Error, exitFor, isMusic2Error } from "./errors.tool.ts";

test("every error code maps to a documented exit", () => {
  const exits = new Set<number>(Object.values(EXIT));
  for (const code of ERROR_CODES) assert.ok(exits.has(exitFor(code)), code);
  assert.equal(ERROR_CODES.length, 13);
});

test("specific mappings", () => {
  assert.equal(exitFor("E_PARSE"), 2);
  assert.equal(exitFor("E_SCHEMA"), 2);
  assert.equal(exitFor("E_FFMPEG_MISSING"), 3);
  assert.equal(exitFor("E_PROVIDER"), 4);
  assert.equal(exitFor("E_RENDER"), 5);
  assert.equal(exitFor("E_QA"), 6);
  assert.equal(exitFor("E_TIMEOUT"), 7);
  assert.equal(exitFor("E_INTERNAL"), 1);
});

test("Music2Error carries code, exit, fix and details", () => {
  const e = new Music2Error("E_CAPABILITY", "no ffmpeg", { fix: "install ffmpeg", details: { a: 1 }, retryable: true });
  assert.equal(e.exit, 3);
  assert.equal(e.fix, "install ffmpeg");
  assert.deepEqual(e.details, { a: 1 });
  assert.equal(e.retryable, true);
  assert.ok(isMusic2Error(e));
  assert.ok(!isMusic2Error(new Error("x")));
});
