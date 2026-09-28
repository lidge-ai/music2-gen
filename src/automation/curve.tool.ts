import type { ResolvedLane } from "../song/song-daw.schema.ts";
import { Music2Error, PPQ } from "../shared/index.ts";

export interface CurveRenderOptions {
  frames: number;
  sampleRate: number;
  bpm: number;
  startTick: number;
}

export interface CurveSmoothOptions {
  sampleRate: number;
  initialValue: number;
}

/** The outgoing shape belongs to the preceding point; equal-tick points form a step. */
export function valueAt(lane: ResolvedLane, tick: number): number {
  const points = lane.points;
  if (points.length === 0) throw new Music2Error("E_INPUT", "automation lane has no points");
  let lo = 0;
  let hi = points.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (points[mid]!.tick <= tick) lo = mid + 1;
    else hi = mid;
  }
  if (lo === 0) return points[0]!.value;
  const left = points[lo - 1]!;
  const right = points[lo];
  if (!right || left.curve === "hold") return left.value;
  return left.value + (right.value - left.value) * (tick - left.tick) / (right.tick - left.tick);
}

/** Evaluate the physical lane at the absolute tick of each audio frame. */
export function renderCurve(lane: ResolvedLane, opts: CurveRenderOptions): Float32Array {
  const { frames, sampleRate, bpm, startTick } = opts;
  if (!Number.isSafeInteger(frames) || frames < 0 || !Number.isFinite(sampleRate) || sampleRate <= 0 ||
      !Number.isFinite(bpm) || bpm <= 0 || !Number.isFinite(startTick) || startTick < 0) {
    throw new Music2Error("E_INPUT", "invalid curve render options");
  }
  const result = new Float32Array(frames);
  const ticksPerFrame = bpm * PPQ / (60 * sampleRate);
  for (let frame = 0; frame < frames; frame++) {
    const value = valueAt(lane, startTick + frame * ticksPerFrame);
    if (!Number.isFinite(value)) throw new Music2Error("E_RENDER", "nonfinite automation value", {
      details: { target: lane.target, frame },
    });
    result[frame] = value;
  }
  return result;
}

/** Causal 5 ms one-pole control smoothing; initialize at the preceding state. */
export function smoothCurve(raw: Float32Array, opts: CurveSmoothOptions): Float32Array {
  const { sampleRate, initialValue } = opts;
  if (!Number.isFinite(sampleRate) || sampleRate <= 0 || !Number.isFinite(initialValue)) {
    throw new Music2Error("E_INPUT", "invalid curve smoothing options");
  }
  const result = new Float32Array(raw.length);
  if (raw.length === 0) return result;
  const alpha = 1 - Math.exp(-1 / (0.005 * sampleRate));
  result[0] = initialValue;
  for (let frame = 1; frame < raw.length; frame++) {
    const previous = result[frame - 1]!;
    const value = previous + alpha * (raw[frame]! - previous);
    if (!Number.isFinite(value)) throw new Music2Error("E_RENDER", "nonfinite smoothed automation value", {
      details: { frame },
    });
    result[frame] = value;
  }
  return result;
}
