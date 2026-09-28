import assert from "node:assert/strict";
import test from "node:test";
import { polyBlepSaw, polyBlepSquare, UnisonOscillator, VoiceLowpass } from "./osc.tool.ts";

void test("PolyBLEP smooths saw and square wrap edges", () => {
  const step = 0.01;
  assert.ok(Math.abs(polyBlepSaw(0.999, step) - polyBlepSaw(0, step)) < 0.5);
  assert.ok(Math.abs(polyBlepSquare(0.499, step) - polyBlepSquare(0.501, step)) < 0.5);
});

void test("unison has repeatable seeded phases and bounded output", () => {
  const a = new UnisonOscillator(7, 18, 42);
  const b = new UnisonOscillator(7, 18, 42);
  const c = new UnisonOscillator(7, 18, 43);
  assert.deepEqual(a.phases, b.phases);
  assert.notDeepEqual(a.phases, c.phases);
  for (let i = 0; i < 44100; i++) {
    const sample = a.sample(440, 44100);
    assert.ok(Number.isFinite(sample) && Math.abs(sample) <= 1.01);
    assert.equal(sample, b.sample(440, 44100));
  }
});

void test("8 kHz PolyBLEP saw suppresses the fifth-harmonic alias at 4.1 kHz", () => {
  const rate = 44100, step = 8000 / rate, frames = 4410;
  let phase = 0, naiveRe = 0, naiveIm = 0, blepRe = 0, blepIm = 0;
  for (let i = 0; i < frames; i++) {
    const angle = -2 * Math.PI * 4100 * i / rate;
    const cosine = Math.cos(angle), sine = Math.sin(angle);
    const naive = 2 * phase - 1;
    const blep = polyBlepSaw(phase, step);
    naiveRe += naive * cosine; naiveIm += naive * sine;
    blepRe += blep * cosine; blepIm += blep * sine;
    phase += step;
    if (phase >= 1) phase -= 1;
  }
  assert.ok(Math.hypot(blepRe, blepIm) < Math.hypot(naiveRe, naiveIm) * 0.316);
});

void test("even unison with center-only mix remains finite", () => {
  const oscillator = new UnisonOscillator(8, 50, 1);
  for (let i = 0; i < 1000; i++) assert.ok(Number.isFinite(oscillator.sample(440, 48000, false, 0)));
});

void test("TPT lowpass state remains bounded on an impulse", () => {
  const lowpass = new VoiceLowpass(0.9);
  const g = Math.tan(Math.PI * 1000 / 48000);
  let peak = 0;
  for (let i = 0; i < 48000; i++) {
    const output = lowpass.process(i === 0 ? 1 : 0, g);
    assert.ok(Number.isFinite(output));
    peak = Math.max(peak, Math.abs(output));
  }
  assert.ok(peak < 2);
});
