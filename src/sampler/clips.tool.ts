import { open, stat } from "node:fs/promises";
import { dirname } from "node:path";
import type { StereoBuffer } from "../audio-io/buffer.schema.ts";
import { readWav } from "../audio-io/wav.tool.ts";
import { confinedRealpath, Music2Error, ticksToSeconds } from "../shared/index.ts";
import type { ResolvedAudioTrack, ResolvedClip } from "../song/song-daw.schema.ts";
import { fft, hann } from "./fft.tool.ts";
import { detectOnsets } from "./onsets.tool.ts";
import { resample } from "./resample.tool.ts";
import { timeStretch } from "./stretch.tool.ts";

const MAX_FRAMES = 1 << 24;
const MAX_PCM_BYTES = 512 * 1024 * 1024;
const FFT_SIZE = 2048;

/** Inspect RIFF chunk headers before readWav allocates decoded stereo channels. */
async function decodedBytes(path: string): Promise<number | null> {
  const file = await open(path, "r");
  try {
    const header = Buffer.alloc(12);
    if ((await file.read(header, 0, 12, 0)).bytesRead !== 12 || header.toString("ascii", 0, 4) !== "RIFF") return null;
    const end = header.readUInt32LE(4) + 8;
    if (end > (await file.stat()).size) return null;
    let channels = 0; let bits = 0; let dataSize = -1;
    for (let offset = 12; offset + 8 <= end;) {
      const chunk = Buffer.alloc(8);
      if ((await file.read(chunk, 0, 8, offset)).bytesRead !== 8) return null;
      const size = chunk.readUInt32LE(4);
      const payload = offset + 8;
      if (payload + size + (size & 1) > end) return null;
      const id = chunk.toString("ascii", 0, 4);
      if (id === "fmt " && size >= 16) {
        const format = Buffer.alloc(16);
        if ((await file.read(format, 0, 16, payload)).bytesRead !== 16) return null;
        channels = format.readUInt16LE(2); bits = format.readUInt16LE(14);
      }
      if (id === "data" && dataSize < 0) dataSize = size;
      offset = payload + size + (size & 1);
    }
    if ((channels !== 1 && channels !== 2) || ![16, 24, 32].includes(bits) || dataSize < 0) return null;
    const count = dataSize / (channels * bits / 8);
    return Number.isInteger(count) ? count * 8 : null;
  } finally { await file.close(); }
}

/** The returned map and canonical-path cache exist only for this load invocation. */
export async function loadClipSources(songPath: string, clips: readonly ResolvedClip[]): Promise<ReadonlyMap<string, StereoBuffer>> {
  const sources = new Map<string, StereoBuffer>();
  const cache = new Map<string, StereoBuffer>();
  let decodedTotal = 0;
  for (const clip of clips) {
    if (sources.has(clip.file)) continue;
    if (!clip.file.endsWith(".wav") || clip.file.startsWith("/") || clip.file.split("/").includes("..") ||
        clip.file.includes("\\") || clip.file.includes("\0")) {
      throw new Music2Error("E_ACCESS", "invalid clip source path", { details: { file: clip.file } });
    }
    const path = await confinedRealpath(dirname(songPath), clip.file);
    let audio = cache.get(path);
    if (!audio) {
      let size: number;
      try { size = (await stat(path)).size; }
      catch (cause) { throw new Music2Error("E_ACCESS", "cannot inspect clip source", { details: { file: clip.file }, cause }); }
      if (size > MAX_PCM_BYTES) throw new Music2Error("E_CAPABILITY", "clip WAV exceeds 512 MiB file limit");
      let required: number | null;
      try { required = await decodedBytes(path); }
      catch (cause) { throw new Music2Error("E_ACCESS", "cannot inspect clip source", { details: { file: clip.file }, cause }); }
      if (required !== null && decodedTotal + required > MAX_PCM_BYTES)
        throw new Music2Error("E_CAPABILITY", "decoded clip sources exceed 512 MiB");
      audio = await readWav(path);
      const bytes = audio.left.byteLength + audio.right.byteLength;
      if (decodedTotal + bytes > MAX_PCM_BYTES)
        throw new Music2Error("E_CAPABILITY", "decoded clip sources exceed 512 MiB");
      decodedTotal += bytes;
      cache.set(path, audio);
    }
    sources.set(clip.file, audio);
  }
  return sources;
}

function frames(value: number, label: string): number {
  if (!Number.isSafeInteger(value) || value < 0) throw new Music2Error("E_RENDER", `invalid ${label} frame count`);
  if (value > MAX_FRAMES) throw new Music2Error("E_CAPABILITY", `${label} exceeds the frame limit`);
  return value;
}

function absoluteFrame(value: number, label: string): number {
  if (!Number.isSafeInteger(value) || value < 0) throw new Music2Error("E_RENDER", `invalid ${label} frame position`);
  return value;
}

function empty(sampleRate: number, count: number): StereoBuffer {
  return { sampleRate, sourceChannels: 2, left: new Float32Array(count), right: new Float32Array(count) };
}

function averageFlatness(audio: StereoBuffer): number {
  const window = hann(FFT_SIZE);
  const real = new Float64Array(FFT_SIZE);
  const imag = new Float64Array(FFT_SIZE);
  let flatness = 0;
  const centers = [Math.floor(audio.left.length / 4), Math.floor(audio.left.length / 2), Math.floor(audio.left.length * 3 / 4)];
  for (const center of centers) {
    imag.fill(0);
    for (let i = 0; i < FFT_SIZE; i++) {
      const at = center + i - FFT_SIZE / 2;
      real[i] = at < 0 || at >= audio.left.length ? 0 :
        (audio.left[at]! + audio.right[at]!) * 0.5 * window[i]!;
    }
    fft(real, imag);
    let arithmetic = 0; let logarithmic = 0;
    for (let k = 1; k < FFT_SIZE / 2; k++) {
      const magnitude = Math.hypot(real[k]!, imag[k]!) + 1e-12;
      arithmetic += magnitude;
      logarithmic += Math.log(magnitude);
    }
    const bins = FFT_SIZE / 2 - 1;
    flatness += arithmetic === 0 ? 1 : Math.exp(logarithmic / bins) / (arithmetic / bins);
  }
  return flatness / centers.length;
}

function stretchMethod(audio: StereoBuffer): "pv" | "wsola" {
  const seconds = audio.left.length / audio.sampleRate;
  if (seconds < 2 || averageFlatness(audio) >= 0.15) return "wsola";
  return detectOnsets(audio, { maxOnsets: Math.floor(2 * seconds) + 1 }).length / seconds <= 2 ? "pv" : "wsola";
}

function sourceOffset(clip: ResolvedClip, source: StereoBuffer): number {
  const offset = Math.round(clip.offsetSeconds * source.sampleRate);
  if (!Number.isSafeInteger(offset) || offset < 0 || offset >= source.left.length)
    throw new Music2Error("E_INPUT", "clip source offset is at or beyond EOF", { details: { file: clip.file } });
  return offset;
}

function availableSource(source: StereoBuffer, start: number): StereoBuffer {
  return { sampleRate: source.sampleRate, sourceChannels: source.sourceChannels,
    left: source.left.subarray(start), right: source.right.subarray(start) };
}

function nativeRegion(source: StereoBuffer, start: number, end: number, sampleRate: number): StereoBuffer {
  const count = frames(Math.ceil((end - start) * sampleRate / source.sampleRate), "clip source");
  if (source.sampleRate === sampleRate) return {
    sampleRate, sourceChannels: source.sourceChannels,
    left: source.left.slice(start, end), right: source.right.slice(start, end),
  };
  const region: StereoBuffer = { sampleRate: source.sampleRate, sourceChannels: source.sourceChannels,
    left: source.left.subarray(start, end), right: source.right.subarray(start, end) };
  const converted = resample(region, source.sampleRate / sampleRate, { frames: count });
  return { ...converted, sampleRate };
}

function pitchedStretch(source: StereoBuffer, clip: ResolvedClip, sampleRate: number,
  bpm: number, targetFrames: number): StereoBuffer {
  const start = sourceOffset(clip, source);
  const end = clip.stretch.mode === "fit" ? start + Math.round(clip.stretch.sourceSeconds * source.sampleRate) : source.left.length;
  if (end > source.left.length || end <= start)
    throw new Music2Error("E_INPUT", "clip source region exceeds EOF", { details: { file: clip.file } });
  const native = nativeRegion(source, start, end, sampleRate);
  const pitchRatio = 2 ** (clip.pitchSemitones / 12);
  const baseAlpha = clip.stretch.mode === "tempo" ? clip.stretch.sourceBpm / bpm : targetFrames / native.left.length;
  if (!Number.isFinite(baseAlpha) || baseAlpha < 0.25 || baseAlpha > 4)
    throw new Music2Error("E_INPUT", "clip stretch factor must be in 0.25..4");
  const extendedAlpha = baseAlpha * pitchRatio;
  const method = stretchMethod(native);
  const stretched = extendedAlpha >= 0.25 && extendedAlpha <= 4
    ? timeStretch(native, extendedAlpha, { method })
    : timeStretch(timeStretch(native, baseAlpha, { method }), pitchRatio, { method });
  if (pitchRatio === 1) return stretched;
  const pitched = resample(stretched, pitchRatio, { frames: targetFrames });
  return { ...pitched, sampleRate };
}

function renderClip(clip: ResolvedClip, source: StereoBuffer, sampleRate: number,
  bpm: number, targetFrames: number): StereoBuffer {
  if (clip.stretch.mode === "tempo" || clip.stretch.mode === "fit")
    return pitchedStretch(source, clip, sampleRate, bpm, targetFrames);
  const start = sourceOffset(clip, source);
  const speed = clip.stretch.mode === "varispeed" ? clip.stretch.ratio : 1;
  const pitch = 2 ** (clip.pitchSemitones / 12);
  const ratio = source.sampleRate / sampleRate * speed * pitch;
  if (ratio === 1) {
    const audio = empty(sampleRate, targetFrames);
    audio.left.set(source.left.subarray(start, start + targetFrames));
    audio.right.set(source.right.subarray(start, start + targetFrames));
    return audio;
  }
  const region = availableSource(source, start);
  const rendered = resample(region, ratio, { frames: targetFrames });
  return { ...rendered, sampleRate };
}

function fade(i: number, length: number, fadeIn: number, fadeOut: number): number {
  let value = 1;
  if (fadeIn > 0 && i < fadeIn) value *= fadeIn === 1 ? 0 : i / (fadeIn - 1);
  if (fadeOut > 0 && i >= length - fadeOut) value *= fadeOut === 1 ? 0 : (length - 1 - i) / (fadeOut - 1);
  return value;
}

/** Render absolute clip positions, then copy only their intersection with the requested window. */
export function renderClips(track: ResolvedAudioTrack, sources: ReadonlyMap<string, StereoBuffer>,
  window: { sampleRate: number; bpm: number; startFrame: number; frames: number }): StereoBuffer {
  if (!Number.isSafeInteger(window.sampleRate) || window.sampleRate < 8000 || window.sampleRate > 192000 ||
      !Number.isFinite(window.bpm) || window.bpm <= 0) throw new Music2Error("E_INPUT", "invalid clip render rate or tempo");
  const count = frames(window.frames, "clip render");
  absoluteFrame(window.startFrame, "clip window start");
  if (!Number.isSafeInteger(window.startFrame + count)) throw new Music2Error("E_RENDER", "clip window overflows frame range");
  const output = empty(window.sampleRate, count);
  const windowEnd = window.startFrame + count;
  for (const clip of track.clips) {
    const onset = absoluteFrame(Math.round(ticksToSeconds(clip.tick, window.bpm) * window.sampleRate), "clip onset");
    const length = frames(Math.round(ticksToSeconds(clip.lengthTicks, window.bpm) * window.sampleRate), "clip length");
    if (!Number.isSafeInteger(onset + length)) throw new Music2Error("E_RENDER", "clip end overflows frame range");
    if (length === 0 || onset >= windowEnd || onset + length <= window.startFrame) continue;
    const source = sources.get(clip.file);
    if (!source) throw new Music2Error("E_INPUT", "clip source was not loaded", { details: { file: clip.file } });
    const audio = renderClip(clip, source, window.sampleRate, window.bpm, length);
    const first = Math.max(0, window.startFrame - onset);
    const last = Math.min(length, windowEnd - onset);
    const fadeIn = Math.min(Math.round(clip.fadeInSeconds * window.sampleRate), Math.floor(length / 2));
    const fadeOut = Math.min(Math.round(clip.fadeOutSeconds * window.sampleRate), Math.floor(length / 2));
    const gain = 10 ** (clip.gainDb / 20);
    for (let i = first; i < last; i++) {
      const destination = onset + i - window.startFrame;
      const level = fade(i, length, fadeIn, fadeOut) * gain;
      output.left[destination] = output.left[destination]! + (audio.left[i] ?? 0) * level;
      output.right[destination] = output.right[destination]! + (audio.right[i] ?? 0) * level;
    }
  }
  return output;
}
