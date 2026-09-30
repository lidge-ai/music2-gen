import { test } from "node:test";
import assert from "node:assert/strict";
import { parseLibraryIndex } from "./library.schema.ts";

test("index validator rejects wrong shapes, timestamps and negative counts", () => {
  const index = { version: 1, roots: [], instruments: [], kits: [], skipped: { caf: 0, exs: 0, aaz: 0, other: 0 } };
  assert.deepEqual(parseLibraryIndex(index), index);
  for (const input of [null, [], {}, { ...index, scannedAt: "today" }, { ...index, roots: [1] }, { ...index, skipped: { ...index.skipped, caf: -1 } }, { ...index, kits: [{}] }]) assert.throws(() => parseLibraryIndex(input), { code: "E_SCHEMA" });
});
