import assert from "node:assert/strict";
import test from "node:test";
import { Music2Error } from "../shared/index.ts";
import { createStereo, peakLinear, resampleLinear, truePeakLinear, truePeakLinearOf } from "./buffer.tool.ts";

void test("linear resampling uses source coordinates and clamps the final sample", () => {
  assert.deepEqual([...resampleLinear(new Float32Array([0, 1]), 22050, 44100)], [0, 0.5, 1, 1]);
  assert.deepEqual([...resampleLinear(new Float32Array([0.25, 0.25]), 22050, 44100)], [0.25, 0.25, 0.25, 0.25]);
  assert.equal(resampleLinear(new Float32Array(), 44100, 48000).length, 0);
});

void test("silence and intersample peak use the shared polyphase estimate", () => {
  const silent = createStereo(44100, 64);
  assert.equal(peakLinear(silent), 0);
  assert.equal(truePeakLinear(silent), 0);
  const audio = createStereo(44100, 64);
  audio.left[20] = 1; audio.left[21] = 1;
  assert.ok(truePeakLinear(audio) >= peakLinear(audio));
  assert.equal(truePeakLinearOf(audio.left, 44100), truePeakLinear(audio));
  assert.equal(audio.sourceChannels, 2);
});

void test("invalid buffer shape and samples fail E_RENDER", () => {
  const mismatched = createStereo(44100, 2);
  mismatched.right = new Float32Array(1);
  assert.throws(() => peakLinear(mismatched), (error: unknown) => error instanceof Music2Error && error.code === "E_RENDER");
  const nonfinite = createStereo(44100, 2);
  nonfinite.left[1] = NaN;
  assert.throws(() => truePeakLinear(nonfinite), (error: unknown) => error instanceof Music2Error && error.code === "E_RENDER");
  assert.throws(() => createStereo(7999, 1), (error: unknown) => error instanceof Music2Error && error.code === "E_RENDER");
});
