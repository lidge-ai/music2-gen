import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";

const fixtureUrl = new URL("../../../tests/fixtures/dawproject/", import.meta.url);
const expected = {
  "Project.xsd": "58e2fd9864772850aac3eab1f3de8693857dc5384df6d29fbc320ae1de2347cc",
  "MetaData.xsd": "fb3ba378271770dddbcced8990aba537de3d36ff2d58573523460a699221c99f",
  "LICENSE": "3aaee5877c9df985f935e40f42f4452182df9e8a8308dcc6cf1a2341458cdfeb",
} as const;

test("D16 upstream DAWproject schemas and MIT license are byte-exact", () => {
  for (const [name, hash] of Object.entries(expected)) {
    const actual = createHash("sha256").update(readFileSync(new URL(name, fixtureUrl))).digest("hex");
    assert.equal(actual, hash, `${name} differs from the D16 pin`);
  }
});
