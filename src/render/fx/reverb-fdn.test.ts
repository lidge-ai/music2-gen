import assert from "node:assert/strict";
import test from "node:test";
import { createStereo } from "../../audio-io/index.ts";
import type { ReverbBusParams } from "./fx.schema.ts";
import { renderFdn } from "./reverb-fdn.tool.ts";

const params: ReverbBusParams = { type: "hall", decaySeconds: 1.5, preDelayMs: 0, damping: 0.5, lowCutHz: 80, highCutHz: 16000, width: 1, mix: 1 };

test("renderFdn turns an impulse into a finite, decaying, deterministic stereo tail", () => {
  const rate = 44100;
  const input = new Float32Array(rate * 2);
  input[0] = 1;
  const a = createStereo(rate, input.length);
  const b = createStereo(rate, input.length);
  renderFdn(input, input, a, params);
  renderFdn(input.slice(), input.slice(), b, params);
  assert.deepEqual(a.left, b.left);
  assert.deepEqual(a.right, b.right);
  let early = 0, late = 0;
  for (let i = 0; i < input.length; i++) {
    assert.ok(Number.isFinite(a.left[i]!) && Number.isFinite(a.right[i]!));
    const e = a.left[i]! ** 2 + a.right[i]! ** 2;
    if (i < rate / 2) early += e; else if (i >= rate) late += e;
  }
  assert.ok(early > 0, "tail present");
  assert.ok(late < early, "tail decays");
  assert.notDeepEqual(a.left, a.right, "stereo output is decorrelated");
});
