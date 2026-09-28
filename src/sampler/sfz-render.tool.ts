import { open, readFile } from "node:fs/promises";
import { dirname, relative } from "node:path";
import { readWav } from "../audio-io/wav.tool.ts";
import type { StereoBuffer } from "../audio-io/buffer.schema.ts";
import { Music2Error, confinedRealpath, isMusic2Error } from "../shared/index.ts";
import { parseSfz } from "./sfz-parse.tool.ts";
import { selectSfzRegions } from "./sfz-region.tool.ts";
import { resample } from "./resample.tool.ts";
import { createDecodeBudget } from "./decode-budget.tool.ts";
import type { DecodeBudget } from "./decode-budget.tool.ts";
import { SFZ_SOURCE_ORDER, sfzWarning } from "./sfz.schema.ts";
import type { LoadedSfz, SfzEvent, SfzRegion, SfzSelectionState, SfzSmpl, SfzSource, SfzVoice, SfzWarning } from "./sfz.schema.ts";

const MAX_PCM_BYTES = 512 * 1024 * 1024;
const FAST_OFF_SECONDS = 0.006;
const SINE_FRAMES = 48000;
const sampleKey = (region: SfzRegion): string => region.sample.startsWith("*")
  ? region.sample : `${region.control.defaultPath}${region.sample}`;

function smplMetadata(bytes: Buffer, source: SfzSource, warnings: SfzWarning[]): SfzSmpl {
  const empty: SfzSmpl = { unityNote: null, pitchFraction: 0, loop: null };
  if (bytes.length < 12 || bytes.toString("ascii", 0, 4) !== "RIFF") return empty;
  const end = Math.min(bytes.length, bytes.readUInt32LE(4) + 8);
  for (let offset = 12; offset + 8 <= end;) {
    const size = bytes.readUInt32LE(offset + 4);
    const data = offset + 8;
    if (data + size > end) break;
    if (bytes.toString("ascii", offset, offset + 4) === "smpl" && size >= 36) {
      const unity = bytes.readUInt32LE(data + 12);
      const pitchFraction = bytes.readUInt32LE(data + 16);
      const loops = bytes.readUInt32LE(data + 28);
      let loop: SfzSmpl["loop"] = null;
      if (loops > 0 && size >= 60) {
        const type = bytes.readUInt32LE(data + 40);
        if (type === 0) loop = { start: bytes.readUInt32LE(data + 44), end: bytes.readUInt32LE(data + 48) };
        else warnings.push(sfzWarning(source, "smpl", "unsupported loop type; loop disabled"));
      } else if (loops > 0) {
        warnings.push(sfzWarning(source, "smpl", "truncated loop metadata; loop disabled"));
      }
      return { unityNote: unity <= 127 ? unity : null, pitchFraction, loop };
    }
    offset = data + size + (size & 1);
  }
  return empty;
}

function virtualSine(): StereoBuffer {
  const left = new Float32Array(SINE_FRAMES);
  for (let i = 0; i < SINE_FRAMES; i++) left[i] = Math.sin(2 * Math.PI * 440 * i / 48000);
  return { sampleRate: 48000, left, right: left, sourceChannels: 1 };
}

/** Read only RIFF chunk headers to bound decoded stereo PCM before allocation. */
async function decodedSize(path: string, display: string): Promise<number | null> {
  let handle;
  try {
    handle = await open(path, "r");
    const header = Buffer.alloc(12);
    if ((await handle.read(header, 0, 12, 0)).bytesRead !== 12 || header.toString("ascii", 0, 4) !== "RIFF") return null;
    const limit = header.readUInt32LE(4) + 8;
    if (limit > (await handle.stat()).size) return null;
    let channels = 0; let bits = 0; let dataBytes = -1;
    for (let offset = 12; offset + 8 <= limit;) {
      const chunk = Buffer.alloc(8);
      if ((await handle.read(chunk, 0, 8, offset)).bytesRead !== 8) return null;
      const size = chunk.readUInt32LE(4);
      const payload = offset + 8;
      if (payload + size + (size & 1) > limit) return null;
      if (chunk.toString("ascii", 0, 4) === "data" && size > MAX_PCM_BYTES) {
        throw new Music2Error("E_CAPABILITY", "SFZ sample data exceeds 512 MiB");
      }
      if (chunk.toString("ascii", 0, 4) === "fmt " && size >= 16) {
        const format = Buffer.alloc(16);
        if ((await handle.read(format, 0, 16, payload)).bytesRead !== 16) return null;
        channels = format.readUInt16LE(2);
        bits = format.readUInt16LE(14);
      }
      if (chunk.toString("ascii", 0, 4) === "data" && dataBytes < 0) dataBytes = size;
      offset = payload + size + (size & 1);
    }
    if ((channels !== 1 && channels !== 2) || ![16, 24, 32].includes(bits) || dataBytes < 0) return null;
    const frames = dataBytes / (channels * bits / 8);
    return Number.isInteger(frames) ? frames * 8 : null;
  } catch (cause) {
    if (isMusic2Error(cause)) throw cause;
    throw new Music2Error("E_ACCESS", "cannot inspect SFZ sample", { details: { file: display }, cause });
  } finally { await handle?.close(); }
}

/** Load one SFZ and its WAVs, with decode cache scoped to this invocation. */
export async function loadSfz(songPath: string, ref: string, sampleRate: number,
  budget: DecodeBudget = createDecodeBudget()): Promise<LoadedSfz> {
  if (!Number.isInteger(sampleRate) || sampleRate < 8000 || sampleRate > 192000) {
    throw new Music2Error("E_INPUT", "invalid SFZ output rate");
  }
  const songDir = dirname(songPath);
  const main = await confinedRealpath(songDir, ref);
  const root = dirname(main);
  const instrument = await parseSfz(relative(root, main), root);
  const warnings = [...instrument.warnings];
  const samples = new Map<string, StereoBuffer>();
  const smpl = new Map<string, SfzSmpl>();
  const cache = new Map<string, SfzSmpl>();
  for (const region of instrument.regions) {
    const key = sampleKey(region);
    if (samples.has(key)) continue;
    if (region.sample === "*silence") continue;
    if (region.sample === "*sine") {
      const sine = virtualSine();
      samples.set(key, sine);
      smpl.set(key, { unityNote: 69, pitchFraction: 0, loop: { start: 0, end: SINE_FRAMES - 1 } });
      continue;
    }
    const path = await confinedRealpath(root, key);
    const audio = await budget.load(path, () => decodedSize(path, key), async () => {
      try { return await readWav(path); }
      catch (cause) {
        if (isMusic2Error(cause) && (cause.code === "E_INPUT" || cause.code === "E_ACCESS")) {
          throw new Music2Error(cause.code, cause.code === "E_INPUT" ? "invalid SFZ sample WAV" : "cannot read SFZ sample",
            { details: { file: key, ...cause.code === "E_INPUT" && cause.details?.["chunk"] ? { chunk: cause.details["chunk"] } : {} }, cause });
        }
        throw cause;
      }
    });
    let meta = cache.get(path);
    if (!meta) {
      let bytes: Buffer;
      try { bytes = await readFile(path); }
      catch (cause) { throw new Music2Error("E_ACCESS", "cannot read SFZ sample", { details: { file: key }, cause }); }
      meta = smplMetadata(bytes, region.source, warnings);
      cache.set(path, meta);
    }
    samples.set(key, audio);
    smpl.set(key, meta);
  }
  for (const region of instrument.regions) {
    const key = sampleKey(region);
    const meta = smpl.get(key);
    if (region.pitchKeycenter === "sample" && (!meta || meta.unityNote === null)) {
      warnings.push(sfzWarning(region.source, "pitch_keycenter", "sample has no valid unity note; using 60"));
    }
    const audio = samples.get(key);
    const loop = region.loopStart === null && region.loopEnd === null ? meta?.loop : {
      start: region.loopStart ?? meta?.loop?.start ?? 0,
      end: region.loopEnd ?? meta?.loop?.end ?? (audio?.left.length ?? 0) - 1,
    };
    if (loop && audio && (loop.start >= loop.end || loop.end >= audio.left.length || loop.end > (region.end ?? audio.left.length - 1))) {
      warnings.push(sfzWarning(region.source, "loop_end", "invalid loop; loop disabled"));
    }
  }
  warnings.sort((a, b) => (a[SFZ_SOURCE_ORDER] ?? 0) - (b[SFZ_SOURCE_ORDER] ?? 0));
  return { instrument: { ...instrument, warnings }, samples, smpl };
}

function curveGain(region: SfzRegion, velocity: number): number {
  const curve = region.ampVelcurve;
  let amplitude = (velocity / 127) ** 2;
  if (curve.size > 0) {
    const points = new Map([[0, 0], [127, 1], ...curve]);
    const ordered = [...points].sort((a, b) => a[0] - b[0]);
    for (let i = 1; i < ordered.length; i++) {
      const a = ordered[i - 1]!; const b = ordered[i]!;
      if (velocity <= b[0]) { amplitude = a[1] + (b[1] - a[1]) * (velocity - a[0]) / (b[0] - a[0]); break; }
    }
  }
  const track = region.ampVeltrack / 100;
  return track >= 0 ? 1 - track + track * amplitude : 1 + track * amplitude;
}

function envelope(region: SfzRegion, age: number, released: number | null, sampleRate: number): number {
  const e = region.ampeg;
  const delay = Math.round(e.delay * sampleRate);
  const attack = Math.round(e.attack * sampleRate);
  const hold = Math.round(e.hold * sampleRate);
  const decay = Math.round(e.decay * sampleRate);
  const sustain = e.sustain / 100;
  const levelAt = (frame: number): number => {
    if (frame < delay) return 0;
    if (attack && frame < delay + attack) return e.start / 100 + (1 - e.start / 100) * (frame - delay) / attack;
    if (frame < delay + attack + hold) return 1;
    const elapsed = frame - delay - attack - hold;
    return decay ? Math.max(sustain, Math.exp(-8 * elapsed / decay)) : sustain;
  };
  if (released === null || age < released) return levelAt(age);
  const release = Math.round(e.release * sampleRate);
  const elapsed = age - released;
  if (!release || elapsed >= release) return 0;
  return levelAt(released) * Math.exp(-8 * elapsed / release);
}

function loopFor(region: SfzRegion, audio: StereoBuffer, meta: SfzSmpl | undefined): { start: number; end: number } | null {
  const candidate = region.loopStart === null && region.loopEnd === null ? meta?.loop : {
    start: region.loopStart ?? meta?.loop?.start ?? 0,
    end: region.loopEnd ?? meta?.loop?.end ?? audio.left.length - 1,
  };
  return candidate && candidate.start < candidate.end && candidate.end < audio.left.length
    && candidate.end <= (region.end ?? audio.left.length - 1) ? candidate : null;
}

function renderVoice(output: StereoBuffer, voice: SfzVoice, region: SfzRegion, loaded: LoadedSfz): void {
  const key = sampleKey(region);
  const audio = loaded.samples.get(key);
  if (!audio || region.end === -1) return;
  const meta = loaded.smpl.get(key);
  const pkc = region.pitchKeycenter === "sample" ? meta?.unityNote ?? 60 : region.pitchKeycenter;
  const cents = (voice.key + region.control.noteOffset + 12 * region.control.octaveOffset - pkc) * region.pitchKeytrack
    + 100 * region.transpose + region.tune + 100 * (meta?.pitchFraction ?? 0) / 4294967296;
  const step = 2 ** (cents / 1200) * audio.sampleRate / output.sampleRate;
  const loop = loopFor(region, audio, meta);
  const mode = region.loopMode ?? (region.trigger === "release" || region.trigger === "release_key"
    ? "one_shot" : loop ? "loop_continuous" : "no_loop");
  const last = Math.min(region.end ?? audio.left.length - 1, audio.left.length - 1);
  let finish = Math.min(output.left.length, voice.stopFrame ?? output.left.length, voice.fastOffFrame === undefined
    ? output.left.length : voice.fastOffFrame + Math.ceil(FAST_OFF_SECONDS * output.sampleRate));
  if (!loop || mode === "no_loop" || mode === "one_shot") {
    finish = Math.min(finish, voice.startFrame + Math.max(0, Math.floor((last - region.offset) / step) + 1));
  }
  const releaseFrame = !voice.choked && (region.trigger === "release" || region.trigger === "release_key" || mode === "one_shot")
    ? null : voice.releaseFrame;
  if (releaseFrame !== null) finish = Math.min(finish, releaseFrame + Math.ceil(region.ampeg.release * output.sampleRate) + 1);
  const split = releaseFrame === null ? finish : Math.min(finish, releaseFrame);
  const gain = 10 ** ((region.volume - (region.trigger === "release" || region.trigger === "release_key"
    ? region.rtDecay * (voice.heldFrames ?? 0) / output.sampleRate : 0)) / 20)
    * region.amplitude / 100 * curveGain(region, voice.velocity);
  const angle = (region.pan + 100) * Math.PI / 400;
  const leftGain = Math.SQRT2 * Math.cos(angle) * gain;
  const rightGain = Math.SQRT2 * Math.sin(angle) * gain;
  const wrap = (position: number): number => loop && position > loop.end
    ? loop.start + ((position - loop.start) % (loop.end - loop.start + 1)) : position;
  const chunks: { begin: number; end: number; looping: boolean; releaseFromLoop: boolean; start: number }[] = [];
  if (split > voice.startFrame) chunks.push({ begin: voice.startFrame, end: split,
    looping: loop !== null && (mode === "loop_continuous" || mode === "loop_sustain"), releaseFromLoop: false, start: region.offset });
  if (releaseFrame !== null && finish > split) {
    const start = mode === "loop_sustain" ? wrap(region.offset + (split - voice.startFrame) * step)
      : region.offset + (split - voice.startFrame) * step;
    const releaseEnd = mode === "loop_sustain" ? Math.min(finish, split + Math.max(0, Math.floor((last - start) / step) + 1)) : finish;
    if (releaseEnd > split) chunks.push({ begin: split, end: releaseEnd,
      looping: loop !== null && mode === "loop_continuous", releaseFromLoop: loop !== null && mode === "loop_sustain", start });
  }
  for (const chunk of chunks) {
    const read = (channel: 0 | 1, index: number): number => {
      const pos = chunk.looping ? Math.floor(wrap(index))
        : chunk.releaseFromLoop && loop && index < loop.start
          ? loop.end - ((loop.start - 1 - index) % (loop.end - loop.start + 1)) : index;
      if (pos < 0 || pos > last) return 0;
      return (channel === 0 ? audio.left[pos] : audio.right[pos]) ?? 0;
    };
    const sampled = step === 1 ? null : resample(audio, step, { start: chunk.start, frames: chunk.end - chunk.begin, read });
    for (let frame = chunk.begin; frame < chunk.end; frame++) {
      const age = frame - voice.startFrame;
      const p = chunk.start + (frame - chunk.begin) * step;
      if (!chunk.looping && p > last) break;
      const env = envelope(region, age, releaseFrame === null ? null : releaseFrame - voice.startFrame, output.sampleRate);
      const offGain = voice.fastOffFrame === undefined || frame < voice.fastOffFrame ? 1
        : Math.max(0, 1 - (frame - voice.fastOffFrame) / (FAST_OFF_SECONDS * output.sampleRate));
      const index = frame - chunk.begin;
      const left = output.left[frame]! + (sampled ? sampled.left[index]! : read(0, Math.floor(p))) * leftGain * env * offGain;
      const right = output.right[frame]! + (sampled ? sampled.right[index]! : read(1, Math.floor(p))) * rightGain * env * offGain;
      if (!Number.isFinite(left) || !Number.isFinite(right)) throw new Music2Error("E_RENDER", "nonfinite SFZ output");
      output.left[frame] = left; output.right[frame] = right;
    }
  }
}

/** Render Timeline-ordered note on/off events into bounded stereo PCM. */
export function renderSfz(events: readonly SfzEvent[], loaded: LoadedSfz, sampleRate: number, frames: number,
  _budget: DecodeBudget = createDecodeBudget()): StereoBuffer {
  void _budget;
  if (!Number.isInteger(sampleRate) || sampleRate < 8000 || sampleRate > 192000
    || !Number.isSafeInteger(frames) || frames < 0 || frames > 1 << 26) {
    throw new Music2Error("E_RENDER", "invalid SFZ render window");
  }
  const output: StereoBuffer = { sampleRate, left: new Float32Array(frames), right: new Float32Array(frames), sourceChannels: 2 };
  const state: SfzSelectionState = { counters: new Map(), heldKeys: new Set(), active: [] };
  const timeline = events.filter((event) => event.velocity > 0).flatMap((event) => [
    { frame: event.startFrame, off: false, event },
    { frame: event.startFrame + event.gateFrames, off: true, event },
  ]).sort((a, b) => a.frame - b.frame || a.event.eventIndex - b.event.eventIndex || Number(a.off) - Number(b.off));
  for (const item of timeline) {
    if (item.frame >= frames) break;
    if (item.frame < 0) continue;
    selectSfzRegions(loaded.instrument, { ...item.event, velocity: item.off ? 0 : item.event.velocity,
      startFrame: item.frame }, state);
  }
  for (const voice of state.active) {
    const region = loaded.instrument.regions[voice.regionIndex];
    if (region) renderVoice(output, voice, region, loaded);
  }
  return output;
}
