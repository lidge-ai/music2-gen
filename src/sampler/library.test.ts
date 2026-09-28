import { test } from "node:test";
import assert from "node:assert/strict";
import { Music2Error } from "../shared/index.ts";
import { libraryInstrument, libraryManifest } from "./library.tool.ts";

test("library manifest exposes valid built-in instruments and useful unknown-id errors", () => {
  const manifest = libraryManifest();
  assert.equal(manifest.version, 1);
  assert.deepEqual(manifest.instruments.map((item) => item.id), ["grand-piano", "strings", "strings-staccato"]);
  assert.equal(libraryInstrument("grand-piano").role, "focal");
  assert.equal(libraryInstrument("strings").role, "bed");
  assert.throws(() => libraryInstrument("missing"), (error: unknown) => error instanceof Music2Error &&
    error.code === "E_SCHEMA" && /grand-piano, strings, strings-staccato/.test(error.message));
});
