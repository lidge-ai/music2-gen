import type { StereoBuffer } from "../audio-io/index.ts";
import { Music2Error } from "../shared/index.ts";

const BLOCK_SECONDS = 0.05;
const GATE_POWER = 10 ** (-60 / 10);

/** Gate 50 ms blocks, weight partial blocks by frames, and retain the whole-window peak. */
export function gatedLevel(audio: StereoBuffer, startFrame = 0, endFrame = audio.left.length):
  { rmsDb: number | null; peakDb: number | null; activeRatio: number } {
  if (!Number.isFinite(audio.sampleRate) || audio.sampleRate <= 0 ||
    audio.left.length !== audio.right.length || !Number.isSafeInteger(startFrame) ||
    !Number.isSafeInteger(endFrame) || startFrame < 0 || endFrame < startFrame || endFrame > audio.left.length)
    throw new Music2Error("E_INPUT", "invalid measurement frame range or stereo buffer");
  const blockFrames = Math.max(1, Math.round(audio.sampleRate * BLOCK_SECONDS));
  let activeFrames = 0, activePower = 0, peak = 0;
  for (let start = startFrame; start < endFrame; start += blockFrames) {
    const end = Math.min(start + blockFrames, endFrame);
    let power = 0;
    for (let frame = start; frame < end; frame++) {
      const left = audio.left[frame]!, right = audio.right[frame]!;
      if (!Number.isFinite(left) || !Number.isFinite(right))
        throw new Music2Error("E_RENDER", "nonfinite measurement sample", { details: { frame } });
      power += (left * left + right * right) / 2;
      peak = Math.max(peak, Math.abs(left), Math.abs(right));
    }
    if (power / (end - start) >= GATE_POWER) {
      activeFrames += end - start;
      activePower += power;
    }
  }
  return { rmsDb: activeFrames === 0 ? null : 10 * Math.log10(activePower / activeFrames),
    peakDb: peak === 0 ? null : 20 * Math.log10(peak),
    activeRatio: endFrame === startFrame ? 0 : activeFrames / (endFrame - startFrame) };
}
