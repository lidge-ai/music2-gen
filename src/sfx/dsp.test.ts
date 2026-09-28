import test from "node:test";
import assert from "node:assert/strict";
import { Biquad, pulse, saw } from "./dsp.tool.ts";

test("local lowpass/highpass pass the intended spectral bands", () => {
  const rate = 48000;
  function gain(kind: "lowpass" | "highpass", hz: number): number {
    const filter = new Biquad(); filter.configure(kind, 1000, rate);
    let sum = 0;
    for (let i = 0; i < rate / 4; i++) {
      const y = filter.sample(Math.sin(2 * Math.PI * hz * i / rate));
      if (i > rate / 8) sum += y * y;
    }
    return sum;
  }
  assert.ok(gain("lowpass", 200) > gain("lowpass", 8000) * 20);
  assert.ok(gain("highpass", 8000) > gain("highpass", 200) * 20);
});

test("polyBLEP oscillators remain finite around phase wrap and high pitch", () => {
  for (const phase of [0, .001, .5, .999]) {
    for (const dt of [.01, .45]) {
      assert.ok(Number.isFinite(saw(phase, dt)));
      assert.ok(Number.isFinite(pulse(phase, dt, .5)));
    }
  }
});
