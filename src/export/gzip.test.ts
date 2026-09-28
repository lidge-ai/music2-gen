import assert from "node:assert/strict";
import test from "node:test";
import { gunzipSync } from "node:zlib";
import { gzipAls } from "./gzip.tool.ts";

test("ALS gzip has a fixed header, valid trailer and stable bytes", () => {
  const payload = Buffer.from('<Ableton Creator="music2" />\n');
  const first = gzipAls(payload);
  assert.equal(Buffer.from(first).subarray(0, 10).toString("hex"), "1f8b08000000000000ff");
  assert.deepEqual(gunzipSync(first), payload);
  assert.deepEqual(gzipAls(payload), first);
  const corrupt = Buffer.from(first); corrupt[corrupt.length - 8] = corrupt[corrupt.length - 8]! ^ 1;
  assert.throws(() => gunzipSync(corrupt));
});
