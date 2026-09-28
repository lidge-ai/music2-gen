import type { StereoBuffer } from "../audio-io/index.ts";
import { findLane, renderCurve, smoothCurve } from "../automation/index.ts";
import { Music2Error } from "../shared/index.ts";
import type { ResolvedLane } from "../song/song-daw.schema.ts";

export interface MixControls { gain: number; pan: number; sends: { reverb: number; delay: number }; automation?: readonly ResolvedLane[] }
export interface PreparedCurves { gain?: Float32Array; pan?: Float32Array; reverb?: Float32Array;
  delay?: Float32Array; inserts: Readonly<Record<number, Readonly<Record<string, Float32Array>>>> }

export function sendActive(track: MixControls, bus: "reverb" | "delay"): boolean {
  return track.sends[bus] > 0 || (findLane(track.automation, `send.${bus}`)?.points.some((point) => point.value > 0) ?? false);
}

/** Prepare smoothed controls from song frame zero so partial renders retain filter and smoother history. */
export function prepareTrackCurves(track: MixControls, frames: number, sampleRate: number, bpm: number): PreparedCurves {
  if (!Number.isSafeInteger(frames) || frames < 0 || ![44100, 48000].includes(sampleRate) || bpm < 40 || bpm > 240) {
    throw new Music2Error("E_RENDER", "invalid automation render grid");
  }
  const curves: { gain?: Float32Array; pan?: Float32Array; reverb?: Float32Array; delay?: Float32Array;
    inserts: Record<number, Record<string, Float32Array>> } = { inserts: {} };
  for (const lane of track.automation ?? []) {
    if (lane.target.startsWith("param.")) continue;
    const raw = renderCurve(lane, { frames, sampleRate, bpm, startTick: 0 });
    const smoothed = smoothCurve(raw, { sampleRate, initialValue: raw[0] ?? lane.points[0]!.value });
    const effect = /^fx\.(\d+)\.([A-Za-z][A-Za-z0-9]*)$/.exec(lane.target);
    if (effect) (curves.inserts[Number(effect[1])] ??= {})[effect[2]!] = smoothed;
    else if (lane.target === "gain") curves.gain = smoothed;
    else if (lane.target === "pan") curves.pan = smoothed;
    else if (lane.target === "send.reverb") curves.reverb = smoothed;
    else if (lane.target === "send.delay") curves.delay = smoothed;
  }
  return curves;
}

/** Mix a processed mono or stereo source in the requested window after fader, duck and sends. */
export function mixAutomated(buses: { master: StereoBuffer; reverb: StereoBuffer; delay: StereoBuffer },
  source: StereoBuffer | Float32Array, offset: number, frames: number, track: MixControls & { id: string },
  curves: PreparedCurves, duck: Float32Array | null, stem: StereoBuffer | null): void {
  const mono = source instanceof Float32Array;
  for (let i = 0; i < frames; i++) {
    const absolute = offset + i;
    const gain = 10 ** ((curves.gain?.[absolute] ?? track.gain) / 20);
    const pan = curves.pan?.[absolute] ?? track.pan;
    const leftGain = gain * Math.cos((pan + 1) * Math.PI / 4) * Math.SQRT2;
    const rightGain = gain * Math.sin((pan + 1) * Math.PI / 4) * Math.SQRT2;
    const factor = duck?.[i] ?? 1;
    const left = (mono ? source[absolute]! : source.left[absolute]!) * leftGain * factor;
    const right = (mono ? source[absolute]! : source.right[absolute]!) * rightGain * factor;
    if (!Number.isFinite(left) || !Number.isFinite(right)) throw new Music2Error("E_RENDER",
      `nonfinite automated sample on ${track.id}`, { details: { track: track.id, frame: i } });
    buses.master.left[i]! += left; buses.master.right[i]! += right;
    const reverb = curves.reverb?.[absolute] ?? track.sends.reverb;
    const delay = curves.delay?.[absolute] ?? track.sends.delay;
    if (reverb !== 0) { buses.reverb.left[i]! += left * reverb; buses.reverb.right[i]! += right * reverb; }
    if (delay !== 0) { buses.delay.left[i]! += left * delay; buses.delay.right[i]! += right * delay; }
    if (stem) { stem.left[i] = left; stem.right[i] = right; }
  }
}
