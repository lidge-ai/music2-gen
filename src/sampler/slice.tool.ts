import type { StereoBuffer } from "../audio-io/buffer.schema.ts";
import { validateStereo } from "../audio-io/buffer.tool.ts";
import { Music2Error } from "../shared/errors.tool.ts";
import { detectOnsets } from "./onsets.tool.ts";

export interface AudioSlice {
  index: number;
  name: string;
  startSample: number;
  endSample: number;
  audio: StereoBuffer;
}

export interface SliceOptions {
  sensitivity?: number;
  minGapMs?: number;
  maxSlices?: number;
  /** Pure reconstruction oracle; production slices use the 10 ms default. */
  fadeOutMs?: number;
}

const DEFAULT_MAX_SLICES = 64;
const HARD_MAX_SLICES = 128;
const DEFAULT_FADE_MS = 10;

function validateInput(audio: StereoBuffer): void {
  validateStereo(audio);
  if (audio.left.length === 0) throw new Music2Error("E_INPUT", "cannot slice empty audio");
}

function validateOptions(opts: SliceOptions): { maxSlices: number; fadeOutMs: number } {
  const maxSlices = opts.maxSlices ?? DEFAULT_MAX_SLICES;
  const fadeOutMs = opts.fadeOutMs ?? DEFAULT_FADE_MS;
  if (!Number.isInteger(maxSlices) || maxSlices < 1 || maxSlices > HARD_MAX_SLICES) {
    throw new Music2Error("E_INPUT", "maxSlices must be an integer in 1..128");
  }
  if (!Number.isFinite(fadeOutMs) || fadeOutMs < 0) {
    throw new Music2Error("E_INPUT", "fadeOutMs must be nonnegative and finite");
  }
  return { maxSlices, fadeOutMs };
}

function materialize(audio: StereoBuffer, boundaries: readonly number[], fadeOutMs: number): AudioSlice[] {
  const slices: AudioSlice[] = [];
  for (let index = 0; index < boundaries.length - 1; index++) {
    const startSample = boundaries[index]!;
    const endSample = boundaries[index + 1]!;
    const left = audio.left.slice(startSample, endSample);
    const right = audio.right.slice(startSample, endSample);
    const fadeFrames = Math.min(Math.round(fadeOutMs * audio.sampleRate / 1000), Math.floor(left.length / 2));
    for (let j = 0; j < fadeFrames; j++) {
      const position = left.length - fadeFrames + j;
      const gain = fadeFrames === 1 ? 0 : 0.5 * (1 + Math.cos(Math.PI * j / (fadeFrames - 1)));
      left[position] = gain === 0 ? 0 : left[position]! * gain;
      right[position] = gain === 0 ? 0 : right[position]! * gain;
    }
    slices.push({ index, name: `slice-${String(index).padStart(2, "0")}.wav`, startSample, endSample,
      audio: { sampleRate: audio.sampleRate, sourceChannels: audio.sourceChannels, left, right } });
  }
  return slices;
}

/** Contiguous, sample-exact transient regions. maxSlices includes the leading region. */
export function sliceTransients(audio: StereoBuffer, opts: SliceOptions = {}): AudioSlice[] {
  validateInput(audio);
  const { maxSlices, fadeOutMs } = validateOptions(opts);
  const onsets = detectOnsets(audio, {
    ...(opts.sensitivity === undefined ? {} : { sensitivity: opts.sensitivity }),
    ...(opts.minGapMs === undefined ? {} : { minGapMs: opts.minGapMs }),
    maxOnsets: maxSlices - 1,
  });
  const boundaries = [0, ...onsets.filter((frame) => frame > 0 && frame < audio.left.length), audio.left.length];
  return materialize(audio, boundaries, fadeOutMs);
}

/** Equal partitions use floor(k*L/N), including non-divisible frame counts. */
export function sliceRegions(audio: StereoBuffer, count: number, opts: Pick<SliceOptions, "fadeOutMs"> = {}): AudioSlice[] {
  validateInput(audio);
  const { fadeOutMs } = validateOptions({ maxSlices: count, ...opts });
  if (count > audio.left.length) throw new Music2Error("E_INPUT", "regions exceed audio frames");
  const boundaries = Array.from({ length: count + 1 }, (_, k) => Math.floor(k * audio.left.length / count));
  return materialize(audio, boundaries, fadeOutMs);
}
