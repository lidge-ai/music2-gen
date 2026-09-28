import assert from "node:assert/strict";
import test from "node:test";
import type { ProjectIR } from "../../project/index.ts";
import { serialize } from "../xml.tool.ts";
import { buildAlsSkeleton, createAlsIds } from "./skeleton.tool.ts";

const project = { ppq: 960, tempo: [{ tick: 0, bpm: 120 }],
  meter: [{ tick: 0, numerator: 4, denominator: 4 }], markers: [] } as unknown as ProjectIR;
test("music2-authored Live 12 skeleton has stable top-level order and main/prehear tracks", () => {
  const root = buildAlsSkeleton(project, [], createAlsIds(1000));
  assert.deepEqual(root.attrs, [["MajorVersion", "5"], ["MinorVersion", "12.0_12203"],
    ["SchemaChangeCount", "3"], ["Creator", "music2"]]);
  const liveSet = root.children[0];
  assert.equal(typeof liveSet, "object");
  if (typeof liveSet === "string" || !liveSet) throw new Error("missing LiveSet");
  assert.deepEqual(liveSet.children.map((child) => typeof child === "string" ? "text" : child.tag),
    ["NextPointeeId", "Tracks", "MainTrack", "PreHearTrack", "Scenes", "Transport", "Grid",
      "SequencerNavigator", "Locators", "TracksListWrapper", "VisibleTracksListWrapper", "ReturnTracksListWrapper", "ScenesListWrapper"]);
  const body = serialize(root);
  assert.ok(!body.includes("DefaultLiveSet"));
  assert.ok(!body.includes("MasterTrack"));
  assert.match(body, /<Manual Value="201" \/>/);
});
