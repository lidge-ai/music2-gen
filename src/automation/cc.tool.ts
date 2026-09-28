import type { ResolvedLane } from "../song/song-daw.schema.ts";
import { Music2Error } from "../shared/index.ts";
import { valueAt } from "./curve.tool.ts";

export interface CcEvent { tick: number; controller: 7 | 10; value: number }

const CC_GRID_TICKS = 120;
const GAIN_FLOOR_DB = -60;
const GAIN_CEILING_DB = 12;

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}

function validateCc(cc: number): void {
  if (!Number.isInteger(cc) || cc < 0 || cc > 127) throw new Music2Error("E_INPUT", "CC value must be an integer from 0 to 127");
}

function validateControl(value: number, minimum: number, maximum: number): void {
  if (!Number.isFinite(value) || value < minimum || value > maximum) {
    throw new Music2Error("E_INPUT", `automation value must be within ${minimum}..${maximum}`);
  }
}

export function gainDbToCc7(db: number): number {
  validateControl(db, GAIN_FLOOR_DB, GAIN_CEILING_DB);
  return clamp(Math.round(127 * 10 ** (db / 40)), 0, 127);
}

export function cc7ToGainDb(cc: number): number {
  validateCc(cc);
  return cc === 0 ? GAIN_FLOOR_DB : clamp(40 * Math.log10(cc / 127), GAIN_FLOOR_DB, GAIN_CEILING_DB);
}

export function panToCc10(pan: number): number {
  validateControl(pan, -1, 1);
  return clamp(Math.round(64 + 63 * pan), 0, 127);
}

export function cc10ToPan(cc: number): number {
  validateCc(cc);
  return clamp((cc - 64) / 63, -1, 1);
}

/** Return the named warning only when the retained incoming CC cannot round-trip. */
export function ccImportClampWarning(trackId: string, event: CcEvent): string | undefined {
  validateCc(event.value);
  if (event.controller === 7 ? event.value >= 4 : event.value >= 1) return undefined;
  return `MIDI_CC_CLAMPED:${trackId}.${event.controller}@${event.tick}=${event.value}`;
}

/** A positive gain saturates CC7 and cannot be reconstructed on import. */
export function gainCcClippedWarning(trackId: string, gain: number | ResolvedLane): string | undefined {
  const clipped = typeof gain === "number" ? gain > 0 : gain.points.some((point) => point.value > 0);
  return clipped ? `gainCcClipped:${trackId}` : undefined;
}

/** The MIDI projection calls this for any lane it cannot export, including shared-channel conflicts. */
export function midiAutomationOmittedWarning(trackId: string, lane: ResolvedLane): string {
  return `MIDI_AUTOMATION_OMITTED:${trackId}.${lane.target}`;
}

/** Tick-zero state, 120-tick linear grid, and every exact point tick; unchanged CCs collapse. */
export function laneToCcEvents(lane: ResolvedLane, endTick: number): CcEvent[] {
  if (lane.target !== "gain" && lane.target !== "pan") throw new Music2Error("E_INPUT", "lane has no MIDI CC mapping");
  if (!Number.isSafeInteger(endTick) || endTick < 0) throw new Music2Error("E_INPUT", "invalid MIDI end tick");
  if (lane.points.length === 0) throw new Music2Error("E_INPUT", "automation lane has no points");
  const ticks = new Set<number>([0]);
  for (let tick = CC_GRID_TICKS; tick <= endTick; tick += CC_GRID_TICKS) ticks.add(tick);
  for (const point of lane.points) if (point.tick <= endTick) ticks.add(point.tick);
  const events: CcEvent[] = [];
  const controller = lane.target === "gain" ? 7 : 10;
  for (const tick of [...ticks].sort((a, b) => a - b)) {
    const physical = valueAt(lane, tick);
    const value = controller === 7 ? gainDbToCc7(physical) : panToCc10(physical);
    if (events.length === 0 || events[events.length - 1]!.value !== value) events.push({ tick, controller, value });
  }
  return events;
}

/** Incoming events are ordered by tick; the last event at a shared tick wins. */
export function ccEventsToLane(target: "gain" | "pan", events: readonly CcEvent[]):
  { staticValue: number; lane?: never } | { staticValue?: never; lane: ResolvedLane } {
  if (events.length === 0) throw new Music2Error("E_INPUT", "CC lane has no events");
  const controller = target === "gain" ? 7 : 10;
  const ordered = events.map((event, index) => ({ event, index })).sort((a, b) =>
    a.event.tick - b.event.tick || a.index - b.index);
  const points: ResolvedLane["points"] = [];
  for (const { event } of ordered) {
    if (event.controller !== controller || !Number.isSafeInteger(event.tick) || event.tick < 0) {
      throw new Music2Error("E_INPUT", "invalid CC event for target");
    }
    const value = target === "gain" ? cc7ToGainDb(event.value) : cc10ToPan(event.value);
    if (points.length && points[points.length - 1]!.tick === event.tick) points[points.length - 1] = { tick: event.tick, value, curve: "hold" };
    else points.push({ tick: event.tick, value, curve: "hold" });
  }
  if (points.length === 1 && points[0]!.tick === 0) return { staticValue: points[0]!.value };
  return { lane: { target, points } };
}
