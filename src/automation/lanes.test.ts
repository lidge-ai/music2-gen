import assert from "node:assert/strict";
import { test } from "node:test";
import type { ResolvedLane } from "../song/song-daw.schema.ts";
import { findLane } from "./lanes.tool.ts";

void test("findLane handles absence and returns the first matching resolved lane", () => {
  const first: ResolvedLane = { target: "gain", points: [{ tick: 0, value: -6, curve: "hold" }] };
  const later: ResolvedLane = { target: "gain", points: [{ tick: 0, value: 0, curve: "hold" }] };
  assert.equal(findLane(undefined, "gain"), undefined);
  assert.equal(findLane([], "gain"), undefined);
  assert.equal(findLane([first], "pan"), undefined);
  assert.equal(findLane([first, later], "gain"), first);
});
