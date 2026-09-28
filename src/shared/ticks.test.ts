import assert from "node:assert/strict";
import test from "node:test";
import { Music2Error } from "./errors.tool.ts";
import { Fraction } from "./rational.tool.ts";
import { PPQ, barTicks, beatsToTicks, fractionToTicks, secondsToTicks, ticksToSeconds } from "./ticks.tool.ts";

void test("960 PPQ exact and inexact rational boundaries", () => {
  assert.equal(PPQ, 960);
  assert.equal(barTicks(4), 3840);
  assert.equal(barTicks(3), 2880);
  assert.equal(beatsToTicks(1.5), 1440);
  assert.equal(ticksToSeconds(1440, 120), 0.75);
  assert.deepEqual(fractionToTicks(Fraction.of(1, 3), 4), { ticks: 1280, exact: true });
  assert.deepEqual(fractionToTicks(Fraction.of(1, 5), 4), { ticks: 768, exact: true });
  assert.deepEqual(fractionToTicks(Fraction.of(1, 7), 4), { ticks: 549, exact: false });
  assert.deepEqual(fractionToTicks(Fraction.of(1, 2560), 4), { ticks: 2, exact: false });
  assert.deepEqual(fractionToTicks(Fraction.of(1, 2), 3), { ticks: 1440, exact: true });
});

void test("half ticks round up and seconds conversion round trips", () => {
  assert.equal(beatsToTicks(0.5 / 960), 1);
  assert.equal(beatsToTicks(0.0005208333333333332), 0);
  assert.equal(beatsToTicks(0.49 / 960), 0);
  assert.equal(secondsToTicks(0.5 * 60 / (120 * 960), 120), 1);
  for (const tick of [0, 1, 549, 3840, 999999]) assert.equal(secondsToTicks(ticksToSeconds(tick, 123), 123), tick);
});

void test("invalid inputs and overflowing ticks raise E_INTERNAL", () => {
  for (const invoke of [() => barTicks(1), () => barTicks(2.1), () => beatsToTicks(-1),
    () => beatsToTicks(Infinity), () => beatsToTicks(Number.MAX_SAFE_INTEGER),
    () => ticksToSeconds(-1, 120), () => ticksToSeconds(1, 0),
    () => secondsToTicks(-1, 120), () => secondsToTicks(1, NaN),
    () => fractionToTicks(Fraction.of(-1), 4), () => fractionToTicks(Fraction.of(2 ** 40), 12)])
    assert.throws(invoke, (error: unknown) => error instanceof Music2Error && error.code === "E_INTERNAL");
});
