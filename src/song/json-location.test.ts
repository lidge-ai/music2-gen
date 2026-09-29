import assert from "node:assert/strict";
import test from "node:test";
import { jsonErrorLocation, jsonErrorOffset } from "./json-location.tool.ts";

void test("trailing comma is located at the closing brace", () => {
  assert.deepEqual(jsonErrorLocation("{\n\"a\": 1,\n}"), { offset: 10, line: 3, column: 1 });
});

void test("bad escape, truncation, leading zero and a bare minus", () => {
  assert.equal(jsonErrorOffset(String.raw`{"a":"\q"}`), 7);
  assert.equal(jsonErrorOffset("[1,2"), 4);
  assert.equal(jsonErrorOffset('{"a": 01}'), 7);
  assert.equal(jsonErrorOffset("[-]"), 1);
  assert.equal(jsonErrorOffset(String.raw`"a\u12"`), 3);
  assert.equal(jsonErrorOffset("{} x"), 3);
});

void test("valid JSON has no error location", () => {
  for (const source of ['{"a":[1,-2.5e3,true,false,null,"\\u00e9\\n"]}', " [] ", "0"]) {
    assert.equal(jsonErrorOffset(source), null, source);
    assert.deepEqual(jsonErrorLocation(source), {});
  }
});
