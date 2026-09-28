import assert from "node:assert/strict";
import test from "node:test";
import { createStereo } from "../audio-io/index.ts";
import { mixDry, mixStereo } from "./mix-static.tool.ts";

test("extracted legacy mono and stereo mixers retain the same center-pan sum", () => {
  const mono = Float32Array.of(.25, -.5);
  const a = createStereo(44100, 2), ar = createStereo(44100, 2), ad = createStereo(44100, 2);
  const b = createStereo(44100, 2), br = createStereo(44100, 2), bd = createStereo(44100, 2);
  const source = createStereo(44100, 2); source.left.set(mono); source.right.set(mono);
  mixDry(a, ar, ad, mono, .5, 0, null, .2, .3, null);
  mixStereo(b, br, bd, source, .5, 0, null, .2, .3, null, "legacy");
  assert.deepEqual(a.left, b.left); assert.deepEqual(a.right, b.right);
  assert.deepEqual(ar.left, br.left); assert.deepEqual(ad.right, bd.right);
});
