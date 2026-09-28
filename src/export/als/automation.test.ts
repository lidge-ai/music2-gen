import assert from "node:assert/strict";
import test from "node:test";
import { serialize } from "../xml.tool.ts";
import { buildAlsEnvelope, encodeAlsMeter, gainLinear } from "./automation.tool.ts";

test("Live meter encoding and gain conversion use numeric oracles", () => {
  assert.equal(encodeAlsMeter(4, 4), 201);
  assert.equal(encodeAlsMeter(3, 4), 200);
  assert.equal(encodeAlsMeter(6, 8), 302);
  assert.equal(gainLinear(0), 1);
  assert.equal(gainLinear(12), 1.99526238);
});
test("native gain and pan envelopes preserve hold and equal-tick points", () => {
  const gain = serialize(buildAlsEnvelope({ target: "gain", points: [
    { tick: 0, value: -12, curve: "linear" }, { tick: 960, value: 0, curve: "linear" },
  ] }, 1001, "volume", 0));
  assert.match(gain, /PointeeId Value="1001"/);
  assert.match(gain, /Time="-63072000"/);
  assert.match(gain, /Time="1" Value="1"/);
  const pan = serialize(buildAlsEnvelope({ target: "pan", points: [
    { tick: 0, value: -1, curve: "hold" }, { tick: 960, value: 1, curve: "linear" },
  ] }, 1002, "pan", 1));
  assert.equal((pan.match(/Time="1"/g) ?? []).length, 2);
  const same = serialize(buildAlsEnvelope({ target: "pan", points: [
    { tick: 960, value: -1, curve: "linear" }, { tick: 960, value: 1, curve: "linear" },
  ] }, 1002, "pan", 1));
  assert.equal((same.match(/Time="1"/g) ?? []).length, 2);
});
