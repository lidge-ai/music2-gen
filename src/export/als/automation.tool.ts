import type { ProjectIR } from "../../project/index.ts";
import type { ResolvedLane } from "../../song/song-daw.schema.ts";
import { element as x, value as v, type XmlNode } from "../xml.tool.ts";

export const ALS_SENTINEL = -63072000;
export function encodeAlsMeter(numerator: number, denominator: 1 | 2 | 4 | 8 | 16): number {
  if (!Number.isSafeInteger(numerator) || numerator < 1 || numerator > 99 || ![1, 2, 4, 8, 16].includes(denominator))
    throw new RangeError("invalid Ableton meter");
  return 99 * Math.log2(denominator) + numerator - 1;
}
export function gainLinear(db: number): number {
  if (!Number.isFinite(db)) throw new RangeError("nonfinite gain");
  return Math.max(0.0003162277571, Math.min(1.99526238, 10 ** (db / 20)));
}
export function automationTarget(id: number): XmlNode {
  return x("AutomationTarget", { Id: id }, [v("LockEnvelope", 0)]);
}
export function parameter(tag: string, manual: number, target: number, modulation?: number): XmlNode {
  return x(tag, [], [v("LomId", 0), v("Manual", manual), automationTarget(target),
    ...(modulation === undefined ? [] : [x("ModulationTarget", { Id: modulation }, [v("LockEnvelope", 0)])])]);
}
function envelope(target: number, id: number, kind: "FloatEvent" | "EnumEvent",
  events: readonly { time: number; value: number }[]): XmlNode {
  return x("AutomationEnvelope", { Id: id }, [
    x("EnvelopeTarget", [], [v("PointeeId", target)]),
    x("Automation", [], [x("Events", [], events.map((event, index) => x(kind,
      { Id: index, Time: event.time, Value: event.value }))),
    x("AutomationTransformViewState", [], [v("IsTransformPending", false), x("TimeAndValueTransforms")])]),
  ]);
}
export function buildAlsEnvelope(lane: ResolvedLane, targetId: number, kind: "volume" | "pan", envelopeId: number): XmlNode {
  if (lane.points.length === 0) throw new RangeError("empty automation lane");
  const convert = kind === "volume" ? gainLinear : (n: number) => {
    if (!Number.isFinite(n)) throw new RangeError("nonfinite pan");
    return Math.max(-1, Math.min(1, n));
  };
  const first = lane.points[0]!;
  const events: { time: number; value: number }[] = [{ time: ALS_SENTINEL, value: convert(first.value) }];
  for (let i = 0; i < lane.points.length; i++) {
    const point = lane.points[i]!;
    const prior = lane.points[i - 1];
    if (prior && point.tick > prior.tick && prior.curve === "hold")
      events.push({ time: point.tick / 960, value: convert(prior.value) });
    events.push({ time: point.tick / 960, value: convert(point.value) });
  }
  return envelope(targetId, envelopeId, "FloatEvent", events);
}
export function buildMainEnvelopes(project: ProjectIR, tempoTargetId: number, meterTargetId: number): XmlNode {
  const bpm = project.tempo[0]!.bpm;
  const meter = encodeAlsMeter(project.meter[0]!.numerator, project.meter[0]!.denominator);
  return x("AutomationEnvelopes", [], [x("Envelopes", [], [
    envelope(meterTargetId, 0, "EnumEvent", [{ time: ALS_SENTINEL, value: meter }]),
    envelope(tempoTargetId, 1, "FloatEvent", [{ time: ALS_SENTINEL, value: bpm }]),
  ])]);
}
