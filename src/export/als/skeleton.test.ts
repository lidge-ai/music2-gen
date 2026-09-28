import assert from "node:assert/strict";
import test from "node:test";
import type { ProjectIR } from "../../project/index.ts";
import { serialize } from "../xml.tool.ts";
import { buildAlsSkeleton, createAlsIds } from "./skeleton.tool.ts";
import { buildAlsTracks } from "./tracks.tool.ts";
import type { XmlNode } from "../xml.tool.ts";

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
const tags = (node: XmlNode): string[] => node.children.map((child) => typeof child === "string" ? "text" : child.tag);
const child = (node: XmlNode, tag: string): XmlNode => {
  const found = node.children.find((entry) => typeof entry !== "string" && entry.tag === tag);
  if (!found || typeof found === "string") throw new Error(`missing ${tag}`);
  return found;
};
test("Live 12 observed track and sequencer child order", () => {
  const source = { id: "lead", type: "notes", instrument: { kind: "voice", id: "piano", params: {} },
    notes: [], gainDb: 0, pan: 0, sends: { reverb: 0.2, delay: 0 }, automation: [], inserts: [], duck: null };
  const full = { ...project, seed: 1, sampleRate: 48000, buses: { reverb: null, delay: null },
    tracks: [source] } as unknown as ProjectIR;
  const audio = { left: new Float32Array(1), right: new Float32Array(1), sampleRate: 48000 as const,
    sourceChannels: 2 as const };
  const ids = createAlsIds(1000);
  const built = buildAlsTracks(full, "both", { stems: [{ trackId: "lead", audio }],
    returns: { reverb: null, delay: null } }, 24, ids);
  const [midi, frozen, returned] = built.nodes;
  if (!midi || !frozen || !returned) throw new Error("missing observed track types");
  // R3_als_dawproject.md:80-82; raw R3_als_dawproject.exec.log:4747-4774.
  const prefix = ["LomId", "LomIdView", "IsContentSelectedInDocument", "PreferredContentViewMode",
    "TrackDelay", "Name", "Color", "AutomationEnvelopes", "TrackGroupId", "TrackUnfolded",
    "DevicesListWrapper", "ClipSlotsListWrapper", "ViewData", "TakeLanes", "LinkedTrackGroupId"];
  const regularTail = ["SavedPlayingSlot", "SavedPlayingOffset", "Freeze", "NeedArrangerRefreeze",
    "PostProcessFreezeClips", "DeviceChain"];
  assert.deepEqual(tags(midi), [...prefix, ...regularTail, "ReWireDeviceMidiTargetId", "PitchbendRange",
    "IsTuned", "ControllerLayoutRemoteable", "ControllerLayoutCustomization"]);
  assert.deepEqual(tags(frozen), [...prefix, ...regularTail]);
  assert.deepEqual(tags(returned), [...prefix, "DeviceChain"]);
  for (const track of [midi, frozen, returned]) assert.deepEqual(track.attrs.map(([name]) => name),
    ["Id", "SelectedToolPanel", "SelectedTransformationName", "SelectedGeneratorName"]);
  // R3_als_dawproject.md:89; raw R3_als_dawproject.exec.log:4748,4761,4774.
  const chainPrefix = ["AutomationLanes", "ClipEnvelopeChooserViewState", "AudioInputRouting",
    "MidiInputRouting", "AudioOutputRouting", "MidiOutputRouting", "Mixer"];
  assert.deepEqual(tags(child(midi, "DeviceChain")), [...chainPrefix, "MainSequencer", "FreezeSequencer", "DeviceChain"]);
  assert.deepEqual(tags(child(frozen, "DeviceChain")), [...chainPrefix, "MainSequencer", "FreezeSequencer", "DeviceChain"]);
  assert.deepEqual(tags(child(returned, "DeviceChain")), [...chainPrefix, "DeviceChain", "FreezeSequencer"]);
  // Raw R3_als_dawproject.exec.log:4749,4762 (MainSequencer lists); R3 note:93-95 (clip paths).
  const seqPrefix = ["LomId", "LomIdView", "IsExpanded", "BreakoutIsExpanded", "On",
    "ModulationSourceCount", "ParametersListWrapper", "Pointee", "LastSelectedTimeableIndex",
    "LastSelectedClipEnvelopeIndex", "LastPresetRef", "LockedScripts", "IsFolded",
    "ShouldShowPresetName", "UserName", "Annotation", "SourceContext", "ClipSlotList",
    "MonitoringEnum", "KeepRecordMonitoringLatency"];
  const midiSeq = child(child(midi, "DeviceChain"), "MainSequencer");
  const audioSeq = child(child(frozen, "DeviceChain"), "MainSequencer");
  assert.deepEqual(tags(midiSeq), [...seqPrefix, "ClipTimeable", "Recorder", "MidiControllers"]);
  assert.deepEqual(tags(audioSeq), [...seqPrefix, "Sample", "VolumeModulationTarget", "TranspositionModulationTarget",
    "TransientEnvelopeModulationTarget", "GrainSizeModulationTarget", "FluxModulationTarget",
    "SampleOffsetModulationTarget", "ComplexProFormantsModulationTarget", "ComplexProEnvelopeModulationTarget",
    "PitchViewScrollPosition", "SampleOffsetModulationScrollPosition", "Recorder"]);
  // Raw R3_als_dawproject.exec.log:5986 (Live 12.2 MainTrack children).
  const main = child(child(buildAlsSkeleton(full, built.nodes, ids), "LiveSet"), "MainTrack");
  assert.deepEqual(tags(main), ["LomId", "LomIdView", "IsContentSelectedInDocument", "PreferredContentViewMode",
    "TrackDelay", "Name", "Color", "AutomationEnvelopes", "TrackGroupId", "TrackUnfolded",
    "DevicesListWrapper", "ClipSlotsListWrapper", "ArrangementClipsListWrapper", "TakeLanesListWrapper",
    "ViewData", "TakeLanes", "LinkedTrackGroupId", "DeviceChain"]);
});
