import type { StereoBuffer } from "../audio-io/index.ts";
import { Music2Error } from "../shared/index.ts";
const PAN_SCALE = Math.SQRT2;
function renderError(message: string, frame?: number): Music2Error {
  return new Music2Error("E_RENDER", message, frame === undefined ? {} : { details: { frame } });
}
export function mixDry(master: StereoBuffer, reverb: StereoBuffer, delay: StereoBuffer,
  mono: Float32Array, gain: number, pan: number, duck: Float32Array | null,
  reverbSend: number, delaySend: number, stem: StereoBuffer | null): void {
  const leftGain = gain * Math.cos((pan + 1) * Math.PI / 4) * PAN_SCALE;
  const rightGain = gain * Math.sin((pan + 1) * Math.PI / 4) * PAN_SCALE;
  for (let i = 0; i < mono.length; i++) {
    const sample = mono[i]!;
    if (!Number.isFinite(sample)) throw renderError("nonfinite voice sample", i);
    const factor = duck?.[i] ?? 1;
    const left = sample * leftGain * factor;
    const right = sample * rightGain * factor;
    if (!Number.isFinite(left) || !Number.isFinite(right)) throw renderError("nonfinite track sample", i);
    master.left[i]! += left; master.right[i]! += right;
    if (reverbSend !== 0) { reverb.left[i]! += left * reverbSend; reverb.right[i]! += right * reverbSend; }
    if (delaySend !== 0) { delay.left[i]! += left * delaySend; delay.right[i]! += right * delaySend; }
    if (stem) { stem.left[i] = left; stem.right[i] = right; }
  }
}

export function mixStereo(master: StereoBuffer, reverb: StereoBuffer, delay: StereoBuffer,
  stereo: StereoBuffer, gain: number, pan: number, duck: Float32Array | null,
  reverbSend: number, delaySend: number, stem: StereoBuffer | null, track: string): void {
  const leftGain = gain * Math.cos((pan + 1) * Math.PI / 4) * PAN_SCALE;
  const rightGain = gain * Math.sin((pan + 1) * Math.PI / 4) * PAN_SCALE;
  for (let i = 0; i < stereo.left.length; i++) {
    const factor = duck?.[i] ?? 1;
    const left = stereo.left[i]! * leftGain * factor;
    const right = stereo.right[i]! * rightGain * factor;
    if (!Number.isFinite(left) || !Number.isFinite(right))
      throw new Music2Error("E_RENDER", `nonfinite track sample on ${track} at frame ${i}`, { details: { track, frame: i } });
    master.left[i]! += left; master.right[i]! += right;
    if (reverbSend !== 0) { reverb.left[i]! += left * reverbSend; reverb.right[i]! += right * reverbSend; }
    if (delaySend !== 0) { delay.left[i]! += left * delaySend; delay.right[i]! += right * delaySend; }
    if (stem) { stem.left[i] = left; stem.right[i] = right; }
  }
}

