import { createStereo } from "../audio-io/index.ts";
import type { StereoBuffer } from "../audio-io/index.ts";
import { Music2Error } from "../shared/index.ts";

const COMB_LENGTHS = [1557, 1617, 1491, 1422] as const;
const ALLPASS_LENGTHS = [225, 556] as const;
const REFERENCE_RATE = 44100;
const STEREO_SPREAD = 23;
const COMB_FEEDBACK = 0.78;
const ALLPASS_FEEDBACK = 0.5;
const DELAY_FEEDBACK = 0.35;

function scaledLength(length: number, sampleRate: number, spread: number): number {
  return Math.max(1, Math.round((length + spread) * sampleRate / REFERENCE_RATE));
}

function reverbChannel(input: Float32Array, sampleRate: number, spread: number): Float32Array {
  const frames = input.length;
  const combined = new Float32Array(frames);
  for (const baseLength of COMB_LENGTHS) {
    const length = scaledLength(baseLength, sampleRate, spread);
    const line = new Float32Array(length);
    let cursor = 0;
    for (let i = 0; i < frames; i++) {
      const delayed = line[cursor] ?? 0;
      line[cursor] = (input[i] ?? 0) + delayed * COMB_FEEDBACK;
      combined[i] = (combined[i] ?? 0) + delayed / COMB_LENGTHS.length;
      cursor = cursor + 1 === length ? 0 : cursor + 1;
    }
  }
  let stage = combined;
  for (const baseLength of ALLPASS_LENGTHS) {
    const length = scaledLength(baseLength, sampleRate, spread);
    const line = new Float32Array(length);
    const output = new Float32Array(frames);
    let cursor = 0;
    for (let i = 0; i < frames; i++) {
      const delayed = line[cursor] ?? 0;
      const current = stage[i] ?? 0;
      output[i] = delayed - ALLPASS_FEEDBACK * current;
      line[cursor] = current + ALLPASS_FEEDBACK * delayed;
      cursor = cursor + 1 === length ? 0 : cursor + 1;
    }
    stage = output;
  }
  return stage;
}

/** Wet-only Schroeder reverb; its tail ends at the caller's allocated frame boundary. */
export function applyReverb(send: StereoBuffer): StereoBuffer {
  const output = createStereo(send.sampleRate, send.left.length);
  if (send.right.length !== send.left.length) throw new Music2Error("E_RENDER", "reverb channel lengths differ");
  output.left.set(reverbChannel(send.left, send.sampleRate, 0));
  output.right.set(reverbChannel(send.right, send.sampleRate, STEREO_SPREAD));
  return output;
}

/** A left impulse first appears on the right after one dotted-eighth interval. */
export function applyDelay(send: StereoBuffer, bpm: number): StereoBuffer {
  if (!Number.isFinite(bpm) || bpm <= 0) throw new Music2Error("E_RENDER", "delay BPM must be positive");
  const output = createStereo(send.sampleRate, send.left.length);
  if (send.right.length !== send.left.length) throw new Music2Error("E_RENDER", "delay channel lengths differ");
  const length = Math.max(1, Math.round(send.sampleRate * 60 / bpm * 0.75));
  for (let i = length; i < send.left.length; i++) {
    const previous = i - length;
    output.left[i] = (send.right[previous] ?? 0) + DELAY_FEEDBACK * (output.right[previous] ?? 0);
    output.right[i] = (send.left[previous] ?? 0) + DELAY_FEEDBACK * (output.left[previous] ?? 0);
  }
  return output;
}

/** A trigger applies the floor at its exact frame, then recovers exponentially. */
export function duckEnvelope(frames: number, onsets: readonly number[], sampleRate: number, amount: number, releaseMs = 180): Float32Array {
  if (!Number.isSafeInteger(frames) || frames < 0 || !Number.isInteger(sampleRate) || sampleRate <= 0 ||
      !Number.isFinite(amount) || amount < 0 || amount > 1 || !Number.isFinite(releaseMs) || releaseMs < 0) {
    throw new Music2Error("E_RENDER", "invalid duck envelope parameters");
  }
  const triggers = new Uint8Array(frames);
  for (const onset of onsets) {
    if (Number.isInteger(onset) && onset >= 0 && onset < frames) triggers[onset] = 1;
  }
  const envelope = new Float32Array(frames);
  const recovery = releaseMs === 0 ? 0 : Math.exp(-1000 / (releaseMs * sampleRate));
  let deficit = 0;
  for (let i = 0; i < frames; i++) {
    deficit = triggers[i] === 1 ? amount : deficit * recovery;
    envelope[i] = 1 - deficit;
  }
  return envelope;
}
