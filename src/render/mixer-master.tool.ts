import { integratedLoudness, peakLinear } from "../audio-io/index.ts";
import type { StereoBuffer } from "../audio-io/index.ts";
import { Music2Error } from "../shared/index.ts";
import type { ResolvedSong } from "../song/index.ts";
import type { RenderOptions } from "./render.schema.ts";

const SOFT_DRIVE = 1.2;
const SOFT_NORM = Math.tanh(SOFT_DRIVE);
const LOOKAHEAD_MS = 5;
const RELEASE_MS = 50;
function db(linear: number): number { return linear === 0 ? -Infinity : 20 * Math.log10(linear); }
function renderError(message: string, frame?: number): Music2Error {
  return new Music2Error("E_RENDER", message, frame === undefined ? {} : { details: { frame } });
}

/** Monotone deque gives the maximum sample magnitude in the next 5 ms without per-frame allocations. */
function limitLookahead(audio: StereoBuffer, ceiling: number): void {
  const frames = audio.left.length;
  const lookahead = Math.max(1, Math.round(audio.sampleRate * LOOKAHEAD_MS / 1000));
  const release = Math.exp(-1000 / (RELEASE_MS * audio.sampleRate));
  const magnitudes = new Float32Array(frames);
  const deque = new Int32Array(frames);
  let samplePeak = 0;
  for (let i = 0; i < frames; i++) {
    const magnitude = Math.max(Math.abs(audio.left[i]!), Math.abs(audio.right[i]!));
    magnitudes[i] = magnitude;
    samplePeak = Math.max(samplePeak, magnitude);
  }
  if (samplePeak === 0) return;
  // Add 8x intersample peaks only where the 10-tap core cannot prove a phase is safe.
  const coefficients = phases(audio.sampleRate);
  for (const channel of [audio.left, audio.right]) {
    for (let i = 0; i < frames - 1; i++) {
      for (const { taps, outerBound } of coefficients) {
        let core = 0;
        for (let j = CORE_FIRST; j < CORE_END; j++) core += (channel[i + j - 15] ?? 0) * taps[j]!;
        if (Math.abs(core) + samplePeak * outerBound + 1e-12 <= ceiling) continue;
        let value = 0;
        for (let j = 0; j < TAP_COUNT; j++) value += (channel[i + j - 15] ?? 0) * taps[j]!;
        magnitudes[i] = Math.max(magnitudes[i]!, Math.abs(value));
      }
    }
  }
  let head = 0; let tail = 0; let entered = 0; let gain = 1;
  for (let i = 0; i < frames; i++) {
    const end = Math.min(frames, i + lookahead + 1);
    while (entered < end) {
      while (tail > head && magnitudes[deque[tail - 1]!]! <= magnitudes[entered]!) tail--;
      deque[tail++] = entered++;
    }
    while (head < tail && deque[head]! < i) head++;
    const windowPeak = magnitudes[deque[head]!]!;
    const needed = windowPeak > ceiling ? ceiling / windowPeak : 1;
    gain = needed < gain ? needed : Math.min(1, needed + (gain - needed) * release);
    audio.left[i] = audio.left[i]! * gain;
    audio.right[i] = audio.right[i]! * gain;
  }
}

const TAP_COUNT = 32;
const CORE_FIRST = 11;
const CORE_END = 21;
const phaseCache = new Map<number, { taps: Float64Array; outerBound: number }[]>();

function phases(rate: number): { taps: Float64Array; outerBound: number }[] {
  const cached = phaseCache.get(rate);
  if (cached) return cached;
  const result: { taps: Float64Array; outerBound: number }[] = [];
  for (let phase = 1; phase < 8; phase++) {
    const taps = new Float64Array(TAP_COUNT);
    let total = 0;
    for (let j = 0; j < TAP_COUNT; j++) {
      const x = j - 15 - phase / 8;
      const sinc = x === 0 ? 1 : Math.sin(Math.PI * x) / (Math.PI * x);
      const hann = .5 - .5 * Math.cos(2 * Math.PI * j / (TAP_COUNT - 1));
      taps[j] = sinc * hann;
      total += taps[j]!;
    }
    let outerBound = 0;
    for (let j = 0; j < TAP_COUNT; j++) {
      taps[j] = taps[j]! / total;
      if (j < CORE_FIRST || j >= CORE_END) outerBound += Math.abs(taps[j]!);
    }
    result.push({ taps, outerBound });
  }
  phaseCache.set(rate, result);
  return result;
}

/** Exact shared 8x/32-tap estimator; a 10-tap core plus a strict outer-tap bound skips safe phases. */
function truePeakBounded(audio: StereoBuffer): number {
  let best = peakLinear(audio);
  if (best === 0 || audio.left.length < 2) return best;
  const boundPeak = best;
  const coefficients = phases(audio.sampleRate);
  for (const channel of [audio.left, audio.right]) {
    const length = channel.length;
    for (let i = 0; i < length - 1; i++) {
      for (const { taps, outerBound } of coefficients) {
        let core = 0;
        for (let j = CORE_FIRST; j < CORE_END; j++) {
          core += (channel[i + j - 15] ?? 0) * taps[j]!;
        }
        if (Math.abs(core) + boundPeak * outerBound + 1e-12 <= best) continue;
        let value = 0;
        for (let j = 0; j < TAP_COUNT; j++) {
          value += (channel[i + j - 15] ?? 0) * taps[j]!;
        }
        best = Math.max(best, Math.abs(value));
      }
    }
  }
  return best;
}

export function masterAudio(audio: StereoBuffer, song: ResolvedSong, mastering: RenderOptions["mastering"]): { peakDbfs: number; truePeakDbtp: number } {
  const mode = mastering ?? (song.master.targetLufs === null ? "peak" : "lufs");
  const measured = mode === "lufs" && song.master.targetLufs !== null ? integratedLoudness(audio) : null;
  const loudnessGainDb = measured === null ? 0 : song.master.targetLufs! - measured;
  const gain = 10 ** ((song.master.gainDb + loudnessGainDb) / 20);
  const ceiling = 10 ** (song.master.ceilingDb / 20);
  const softNorm = mode === "lufs" ? SOFT_DRIVE : SOFT_NORM;
  let peak = 0;
  for (let i = 0; i < audio.left.length; i++) {
    const left = audio.left[i]! * gain;
    const right = audio.right[i]! * gain;
    if (!Number.isFinite(left) || !Number.isFinite(right)) throw renderError("nonfinite master sample", i);
    audio.left[i] = Math.tanh(SOFT_DRIVE * left) / softNorm;
    audio.right[i] = Math.tanh(SOFT_DRIVE * right) / softNorm;
    peak = Math.max(peak, Math.abs(audio.left[i]!), Math.abs(audio.right[i]!));
  }
  if (peak === 0) return { peakDbfs: -Infinity, truePeakDbtp: -Infinity };
  if (mode !== "lufs") {
    const target = 10 ** ((song.master.ceilingDb - 0.5) / 20);
    const scale = target / peak;
    for (let i = 0; i < audio.left.length; i++) {
      audio.left[i] = audio.left[i]! * scale;
      audio.right[i] = audio.right[i]! * scale;
    }
  }
  limitLookahead(audio, ceiling);
  for (let i = 0; i < audio.left.length; i++) {
    audio.left[i] = Math.max(-ceiling, Math.min(ceiling, audio.left[i]!));
    audio.right[i] = Math.max(-ceiling, Math.min(ceiling, audio.right[i]!));
  }
  // The shared 8x interpolator is the final oracle. A uniform correction preserves limiter dynamics.
  let truePeak = truePeakBounded(audio);
  if (truePeak > ceiling) {
    const correction = ceiling / truePeak;
    for (let i = 0; i < audio.left.length; i++) {
      audio.left[i] = audio.left[i]! * correction;
      audio.right[i] = audio.right[i]! * correction;
    }
    truePeak = truePeakBounded(audio);
  }
  const samplePeak = peakLinear(audio);
  if (samplePeak > ceiling + 1e-6 || truePeak > 10 ** ((song.master.ceilingDb + .1) / 20)) {
    throw renderError("master exceeds peak ceiling");
  }
  return { peakDbfs: db(samplePeak), truePeakDbtp: db(truePeak) };
}

