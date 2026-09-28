import type { ProjectIR } from "../../project/index.ts";
import { element as x, value as v, type XmlNode } from "../xml.tool.ts";
import { automationTarget, buildMainEnvelopes, encodeAlsMeter, parameter } from "./automation.tool.ts";

export interface AlsIdAllocator { next(): number; readonly nextPointeeId: number }
export function createAlsIds(firstGlobalId: number): AlsIdAllocator {
  if (!Number.isSafeInteger(firstGlobalId) || firstGlobalId < 1000) throw new RangeError("invalid ALS first ID");
  let cursor = firstGlobalId;
  return { next: () => cursor++, get nextPointeeId() { return cursor; } };
}
export const EMPTY = (tag: string): XmlNode => x(tag);
export function trackName(name: string): XmlNode {
  return x("Name", [], [v("EffectiveName", name), v("UserName", name), v("Annotation", ""), v("MemorizedFirstClipName", "")]);
}
export function arranger(clips: readonly XmlNode[]): XmlNode {
  return x("ArrangerAutomation", [], [x("Events", [], clips), x("AutomationTransformViewState")]);
}
export function mixer(ids: AlsIdAllocator, gain: number, pan: number, muted: boolean,
  sends: { reverb: number; delay: number }, buses: readonly ("reverb" | "delay")[]): { node: XmlNode; volumeId: number; panId: number } {
  const volumeId = ids.next(); const panId = ids.next();
  const sendNodes = buses.map((bus) => x("Send", { Id: ids.next() }, [
    v("Manual", sends[bus]), automationTarget(ids.next())]));
  return { volumeId, panId, node: x("Mixer", [], [
    parameter("Volume", gain, volumeId, ids.next()), parameter("Pan", pan, panId, ids.next()),
    parameter("Speaker", muted ? 0 : 1, ids.next()), x("Sends", [], sendNodes),
  ]) };
}
/** Music2-authored minimum Live 12 topology; no copied Live set or device preset. */
export function trackShell(tag: "MidiTrack" | "AudioTrack" | "ReturnTrack", name: string,
  ids: AlsIdAllocator, mix: XmlNode, envelopes: readonly XmlNode[], sequencer?: XmlNode): XmlNode {
  const chain = x("DeviceChain", [], [
    x("AutomationLanes"), x("ClipEnvelopeChooserViewState"), x("AudioInputRouting"),
    x("MidiInputRouting"), x("AudioOutputRouting"), x("MidiOutputRouting"), mix,
    ...(sequencer ? [sequencer, x("FreezeSequencer")] : []),
    x("DeviceChain", [], [x("Devices")]),
  ]);
  return x(tag, { Id: ids.next() }, [v("LomId", 0), v("LomIdView", 0), trackName(name), v("Color", 0),
    x("AutomationEnvelopes", [], [x("Envelopes", [], envelopes)]), v("TrackGroupId", -1),
    x("TakeLanes", [], [x("TakeLanes")]), chain]);
}
export function buildAlsSkeleton(project: ProjectIR, tracks: readonly XmlNode[], ids: AlsIdAllocator): XmlNode {
  const tempoId = ids.next(); const tempoModId = ids.next(); const meterId = ids.next();
  const main = x("MainTrack", [], [v("LomId", 0), v("LomIdView", 0), trackName("Main"),
    buildMainEnvelopes(project, tempoId, meterId), x("DeviceChain", [], [x("Mixer", [], [
      x("Tempo", [], [v("LomId", 0), v("Manual", project.tempo[0]!.bpm),
        x("MidiControllerRange", [], [v("Min", 20), v("Max", 999)]), automationTarget(tempoId),
        x("ModulationTarget", { Id: tempoModId }, [v("LockEnvelope", 0)])]),
      parameter("TimeSignature", encodeAlsMeter(project.meter[0]!.numerator, project.meter[0]!.denominator), meterId),
    ])])]);
  const locators = [...project.markers].sort((a, b) => a.tick - b.tick || a.ordinal - b.ordinal || a.occurrence - b.occurrence)
    .map((marker, index) => x("Locator", { Id: index }, [v("LomId", 0), v("Time", marker.tick / 960),
      v("Name", marker.name), v("Annotation", ""), v("IsSongStart", false)]));
  const set = x("LiveSet", [], [v("NextPointeeId", ids.nextPointeeId), x("Tracks", [], tracks), main,
    x("PreHearTrack", [], [trackName("PreHear"), x("DeviceChain", [], [x("Mixer")])]),
    x("Scenes"), x("Transport"), x("Grid"), x("SequencerNavigator"),
    x("Locators", [], [x("Locators", [], locators)]), x("TracksListWrapper"),
    x("VisibleTracksListWrapper"), x("ReturnTracksListWrapper"), x("ScenesListWrapper")]);
  return x("Ableton", [["MajorVersion", "5"], ["MinorVersion", "12.0_12203"],
    ["SchemaChangeCount", "3"], ["Creator", "music2"]], [set]);
}
