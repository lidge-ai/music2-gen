import assert from "node:assert/strict";
import { test } from "node:test";
import type { ResolvedLane } from "../song/song-daw.schema.ts";
import { Music2Error } from "../shared/index.ts";
import { cc10ToPan, cc7ToGainDb, ccEventsToLane, ccImportClampWarning, gainCcClippedWarning,
  gainDbToCc7, laneToCcEvents, midiAutomationOmittedWarning, panToCc10 } from "./cc.tool.ts";

const lane = (target: string, points: ResolvedLane["points"]): ResolvedLane => ({ target, points });

void test("CC7 logarithmic gain and CC10 bipolar pan laws", () => {
  assert.deepEqual([-60, -12, -6, 0, 12].map(gainDbToCc7), [4, 64, 90, 127, 127]);
  assert.equal(cc7ToGainDb(0), -60);
  assert.equal(cc7ToGainDb(127), 0);
  assert.ok(Math.abs(cc7ToGainDb(64) - (-11.904949878882789)) < 1e-10);
  assert.deepEqual([-1, 0, 1].map(panToCc10), [1, 64, 127]);
  assert.deepEqual([0, 64, 127].map(cc10ToPan), [-1, 0, 1]);
  for (let cc = 4; cc <= 127; cc++) assert.equal(gainDbToCc7(cc7ToGainDb(cc)), cc);
  for (let cc = 1; cc <= 127; cc++) assert.equal(panToCc10(cc10ToPan(cc)), cc);
});

void test("invalid CCs and physical values fail at the codec boundary", () => {
  for (const cc of [-1, 0.5, 128, NaN]) {
    assert.throws(() => cc7ToGainDb(cc), (error: unknown) => error instanceof Music2Error && error.code === "E_INPUT");
    assert.throws(() => cc10ToPan(cc), (error: unknown) => error instanceof Music2Error && error.code === "E_INPUT");
  }
  assert.throws(() => gainDbToCc7(-61), (error: unknown) => error instanceof Music2Error && error.code === "E_INPUT");
  assert.throws(() => panToCc10(1.01), (error: unknown) => error instanceof Music2Error && error.code === "E_INPUT");
});

void test("writer emits a tick-zero state, exact endpoints and 120-tick ramp samples", () => {
  const hold = lane("gain", [{ tick: 0, value: -12, curve: "hold" }, { tick: 960, value: 0, curve: "linear" }]);
  assert.deepEqual(laneToCcEvents(hold, 1200), [
    { tick: 0, controller: 7, value: 64 }, { tick: 960, controller: 7, value: 127 },
  ]);
  const ramp = lane("gain", [{ tick: 0, value: -12, curve: "linear" }, { tick: 960, value: 0, curve: "linear" }]);
  const events = laneToCcEvents(ramp, 960);
  assert.deepEqual(events.map((event) => event.tick), [0, 120, 240, 360, 480, 600, 720, 840, 960]);
  assert.equal(events[0]?.value, 64);
  assert.equal(events.at(-1)?.value, 127);
  const offGrid = lane("pan", [{ tick: 0, value: -1, curve: "linear" }, { tick: 125, value: 1, curve: "hold" }]);
  assert.deepEqual(laneToCcEvents(offGrid, 240).map((event) => event.tick), [0, 120, 125]);
});

void test("duplicate tick uses the effective right point and reader preserves hold changes", () => {
  const stepped = lane("gain", [
    { tick: 0, value: -12, curve: "hold" },
    { tick: 960, value: -12, curve: "linear" },
    { tick: 960, value: 0, curve: "hold" },
  ]);
  assert.deepEqual(laneToCcEvents(stepped, 960), [
    { tick: 0, controller: 7, value: 64 }, { tick: 960, controller: 7, value: 127 },
  ]);
  const imported = ccEventsToLane("gain", [
    { tick: 960, controller: 7, value: 90 },
    { tick: 0, controller: 7, value: 64 },
    { tick: 960, controller: 7, value: 127 },
  ]);
  assert.ok("lane" in imported && imported.lane);
  assert.deepEqual(imported.lane.points.map((point) => [point.tick, point.curve]), [[0, "hold"], [960, "hold"]]);
  assert.deepEqual(laneToCcEvents(imported.lane, 960), [
    { tick: 0, controller: 7, value: 64 }, { tick: 960, controller: 7, value: 127 },
  ]);
  assert.deepEqual(ccEventsToLane("pan", [{ tick: 0, controller: 10, value: 64 }]), { staticValue: 0 });
});

void test("clamped imports and positive-gain saturation emit exact named warnings", () => {
  for (const cc of [0, 1, 2, 3]) {
    const event = { tick: 960, controller: 7 as const, value: cc };
    assert.equal(cc7ToGainDb(cc), -60);
    assert.equal(gainDbToCc7(cc7ToGainDb(cc)), 4);
    assert.equal(ccImportClampWarning("lead", event), `MIDI_CC_CLAMPED:lead.7@960=${cc}`);
  }
  assert.equal(ccImportClampWarning("lead", { tick: 0, controller: 7, value: 4 }), undefined);
  assert.equal(ccImportClampWarning("lead", { tick: 0, controller: 10, value: 0 }), "MIDI_CC_CLAMPED:lead.10@0=0");
  assert.equal(panToCc10(cc10ToPan(0)), 1);
  assert.equal(ccImportClampWarning("lead", { tick: 0, controller: 10, value: 1 }), undefined);
  assert.equal(gainCcClippedWarning("lead", 1), "gainCcClipped:lead");
  assert.equal(gainCcClippedWarning("lead", lane("gain", [{ tick: 0, value: -6, curve: "linear" },
    { tick: 960, value: 1, curve: "linear" }])), "gainCcClipped:lead");
  assert.equal(gainCcClippedWarning("lead", 0), undefined);
  assert.equal(midiAutomationOmittedWarning("lead", lane("send.delay", [
    { tick: 0, value: 0.5, curve: "hold" },
  ])), "MIDI_AUTOMATION_OMITTED:lead.send.delay");
});
