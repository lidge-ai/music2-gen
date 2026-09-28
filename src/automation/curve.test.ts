import assert from "node:assert/strict";
import { test } from "node:test";
import type { ResolvedLane } from "../song/song-daw.schema.ts";
import { Music2Error } from "../shared/index.ts";
import { renderCurve, smoothCurve, valueAt } from "./curve.tool.ts";

const lane = (points: ResolvedLane["points"]): ResolvedLane => ({ target: "pan", points });

void test("linear, hold, endpoints, and before-first hold", () => {
  const linear = lane([{ tick: 0, value: 0, curve: "linear" }, { tick: 960, value: 1, curve: "linear" }]);
  assert.deepEqual([0, 240, 480, 960, 1200].map((tick) => valueAt(linear, tick)), [0, 0.25, 0.5, 1, 1]);
  const hold = lane([{ tick: 0, value: 0, curve: "hold" }, { tick: 960, value: 1, curve: "linear" }]);
  assert.deepEqual([0, 480, 959, 960, 1200].map((tick) => valueAt(hold, tick)), [0, 0, 0, 1, 1]);
  const single = lane([{ tick: 3840, value: -6, curve: "linear" }]);
  assert.deepEqual([0, 3840, 8000].map((tick) => valueAt(single, tick)), [-6, -6, -6]);
});

void test("same-tick pair jumps to its second point at the tick", () => {
  const stepped = lane([
    { tick: 0, value: 0, curve: "linear" },
    { tick: 960, value: 1, curve: "linear" },
    { tick: 960, value: 0.2, curve: "hold" },
    { tick: 1920, value: 0.5, curve: "linear" },
  ]);
  assert.ok(Math.abs(valueAt(stepped, 959) - 959 / 960) < 1e-12);
  assert.equal(valueAt(stepped, 960), 0.2);
  assert.equal(valueAt(stepped, 1919), 0.2);
  assert.equal(valueAt(stepped, 1920), 0.5);
});

void test("raw frame grid uses fractional ticks and absolute crop origin", () => {
  const ramp = lane([{ tick: 0, value: 0, curve: "linear" }, { tick: 960, value: 1, curve: "linear" }]);
  const full = renderCurve(ramp, { frames: 24001, sampleRate: 48000, bpm: 120, startTick: 0 });
  assert.equal(full[12000], 0.5);
  assert.equal(full[24000], 1);
  const crop = renderCurve(ramp, { frames: 1001, sampleRate: 48000, bpm: 120, startTick: 480 });
  for (let frame = 0; frame < crop.length; frame++) {
    assert.ok(Math.abs(crop[frame]! - full[12000 + frame]!) < 1e-6);
  }
  assert.throws(() => renderCurve(ramp, { frames: -1, sampleRate: 48000, bpm: 120, startTick: 0 }),
    (error: unknown) => error instanceof Music2Error && error.code === "E_INPUT");
});

void test("5 ms one-pole smoother is causal and pre-roll preserves crop state", () => {
  const raw = new Float32Array(520);
  raw.fill(1, 500);
  const smooth = smoothCurve(raw, { sampleRate: 1000, initialValue: 0 });
  assert.equal(smooth[0], 0);
  assert.ok(Math.abs(smooth[500]! - 0.181269247) < 1e-6);
  assert.ok(Math.abs(smooth[505]! - 0.698805788) < 1e-6);
  assert.notEqual(smoothCurve(raw.slice(500), { sampleRate: 1000, initialValue: 0 })[0], smooth[500]);
});
