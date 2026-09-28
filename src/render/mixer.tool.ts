import { createStereo, measureLoudness, peakLinear } from "../audio-io/index.ts";
import type { StereoBuffer } from "../audio-io/index.ts";
import { fnv1a32, Music2Error } from "../shared/index.ts";
import type { ResolvedSong, Timeline } from "../song/index.ts";
import { applyDelay, applyReverb, duckEnvelope } from "./fx.tool.ts";
import { applyInsertChain, renderDelayBus, renderReverbBus } from "./fx/index.ts";
import { validateResolvedFx } from "./fx/fx-validate.tool.ts";
import { loadKit, renderKit } from "./kit.tool.ts";
import type { LoadedKit, RenderOptions, RenderResult, RenderStem, VoiceEvent } from "./render.schema.ts";
import { mergeParams, resolveVoice } from "./voices/registry.tool.ts";

const RIFF_LIMIT = 0xffffffff;
const SOFT_DRIVE = 1.2;
const SOFT_NORM = Math.tanh(SOFT_DRIVE);
const PAN_SCALE = Math.SQRT2;
const LOOKAHEAD_MS = 5;
const RELEASE_MS = 50;

function db(linear: number): number { return linear === 0 ? -Infinity : 20 * Math.log10(linear); }
function renderError(message: string, frame?: number): Music2Error {
  return new Music2Error("E_RENDER", message, frame === undefined ? {} : { details: { frame } });
}

function selectEvents(song: ResolvedSong, timeline: Timeline, start: number, end: number, frames: number): VoiceEvent[][] {
  const rate = song.sampleRate;
  const offset = start * timeline.secondsPerBar;
  const counters = new Uint32Array(song.tracks.length);
  const selected: VoiceEvent[][] = song.tracks.map(() => []);
  for (const event of timeline.events) {
    const eventIndex = counters[event.trackIndex] ?? 0;
    counters[event.trackIndex] = eventIndex + 1;
    if (event.bar < start || event.bar >= end) continue;
    const track = song.tracks[event.trackIndex]!;
    const startFrame = Math.round((event.time - offset) * rate);
    if (startFrame < 0 || startFrame >= frames) continue;
    selected[event.trackIndex]!.push({
      midi: event.midi, sample: event.sample, velocity: event.velocity,
      startFrame, gateFrames: Math.max(0, Math.round(event.duration * rate)),
      stopFrame: frames, eventIndex, seed: fnv1a32(song.seed, track.id, eventIndex),
    });
  }
  for (let index = 0; index < selected.length; index++) {
    const track = song.tracks[index]!;
    const events = selected[index]!;
    if (track.mono) {
      for (let i = 0; i < events.length; i++) {
        const next = events[i + 1];
        if (next) events[i]!.stopFrame = Math.min(frames, next.startFrame);
      }
    } else if (track.kind === "notes" && !track.instrument.startsWith("kit:")) {
      const voice = resolveVoice(track, index)!;
      const params = mergeParams(voice, track.params);
      const releaseMs = voice.id === "bell" ? 120 : voice.id === "pluck" ? 80 : params["releaseMs"];
      if (releaseMs !== undefined) {
        // Voice envelopes reach about -120 dB after twice their release time.
        const tailFrames = Math.ceil(2 * releaseMs * rate / 1000);
        for (const event of events) event.stopFrame = Math.min(frames, event.startFrame + event.gateFrames + tailFrames);
      }
    }
  }
  return selected;
}

function mixDry(master: StereoBuffer, reverb: StereoBuffer, delay: StereoBuffer,
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

function mixStereo(master: StereoBuffer, reverb: StereoBuffer, delay: StereoBuffer,
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

function masterAudio(audio: StereoBuffer, song: ResolvedSong, mastering: RenderOptions["mastering"]): { peakDbfs: number; truePeakDbtp: number } {
  const mode = mastering ?? (song.master.targetLufs === null ? "peak" : "lufs");
  const measured = mode === "lufs" && song.master.targetLufs !== null ? measureLoudness(audio).integratedLufs : null;
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

export async function mixTracks(song: ResolvedSong, timeline: Timeline, songPath: string,
  options: RenderOptions = {}): Promise<RenderResult> {
  validateResolvedFx(song);
  if (song.loop && options.bars) throw new Music2Error("E_INPUT", "--bars cannot render part of a loop song");
  const start = options.bars?.start ?? 0;
  const end = options.bars?.end ?? timeline.bars;
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || start >= end || end > timeline.bars) {
    throw new Music2Error("E_INPUT", `bar range must be within 0:${timeline.bars}`);
  }
  const bars = end - start;
  const bodyFrames = Math.ceil(bars * timeline.secondsPerBar * song.sampleRate);
  const frames = Math.ceil((bars * timeline.secondsPerBar + song.tailSeconds) * song.sampleRate);
  if (!Number.isSafeInteger(frames) || frames < 0 || frames * 6 + 36 > RIFF_LIMIT) {
    throw renderError("render exceeds 24-bit RIFF size limit");
  }
  const selected = selectEvents(song, timeline, start, end, frames);
  const kits: (LoadedKit | null)[] = [];
  for (const track of song.tracks) kits.push(track.instrument.startsWith("kit:") ? await loadKit(songPath, track.instrument, song.sampleRate) : null);
  const audio = createStereo(song.sampleRate, frames);
  const reverbSend = createStereo(song.sampleRate, frames);
  const delaySend = createStereo(song.sampleRate, frames);
  const stems: RenderStem[] = [];
  let scratch: StereoBuffer | null = null;
  for (let index = 0; index < song.tracks.length; index++) {
    const track = song.tracks[index]!;
    const events = selected[index]!;
    const ctx = { sampleRate: song.sampleRate, frames, track, events };
    const kit = kits[index];
    const voice = kit ? null : resolveVoice(track, index);
    const mono = kit ? renderKit(ctx, kit) : voice!.render(ctx, mergeParams(voice!, track.params));
    if (mono.length !== frames) throw renderError(`voice ${track.instrument} returned incorrect frame count`);
    const sourceIndex = track.duck ? song.tracks.findIndex((candidate) => candidate.id === track.duck!.by) : -1;
    const duck = track.duck && sourceIndex >= 0 ? duckEnvelope(frames,
      selected[sourceIndex]!.map((event) => event.startFrame), song.sampleRate,
      track.duck.amount, track.duck.releaseMs) : null;
    const stem = options.stems ? createStereo(song.sampleRate, frames) : null;
    if (track.fx?.length) {
      scratch ??= createStereo(song.sampleRate, frames);
      for (let frame = 0; frame < frames; frame++) {
        if (!Number.isFinite(mono[frame])) throw new Music2Error("E_RENDER", `nonfinite voice sample on ${track.id} at frame ${frame}`,
          { details: { track: track.id, frame } });
      }
      scratch.left.set(mono); scratch.right.set(mono);
      applyInsertChain(scratch, track.fx, { sampleRate: song.sampleRate, bpm: song.bpm }, track.id);
      mixStereo(audio, reverbSend, delaySend, scratch, 10 ** (track.gain / 20), track.pan,
        duck, track.sends.reverb, track.sends.delay, stem, track.id);
    } else {
      mixDry(audio, reverbSend, delaySend, mono, 10 ** (track.gain / 20), track.pan,
        duck, track.sends.reverb, track.sends.delay, stem);
    }
    if (stem) stems.push({ trackId: track.id, audio: stem });
  }
  if (song.tracks.some((track) => track.sends.reverb > 0)) {
    const wet = song.fx?.reverb ? renderReverbBus(reverbSend, song.fx.reverb,
      { sampleRate: song.sampleRate, bpm: song.bpm }) : applyReverb(reverbSend);
    for (let i = 0; i < frames; i++) { audio.left[i]! += wet.left[i]!; audio.right[i]! += wet.right[i]!; }
  }
  if (song.tracks.some((track) => track.sends.delay > 0)) {
    const wet = song.fx?.delay ? renderDelayBus(delaySend, song.fx.delay,
      { sampleRate: song.sampleRate, bpm: song.bpm }) : applyDelay(delaySend, song.bpm);
    for (let i = 0; i < frames; i++) { audio.left[i]! += wet.left[i]!; audio.right[i]! += wet.right[i]!; }
  }
  let output = audio;
  if (song.loop) {
    for (let i = bodyFrames; i < frames; i++) {
      const at = (i - bodyFrames) % bodyFrames;
      audio.left[at]! += audio.left[i]!;
      audio.right[at]! += audio.right[i]!;
    }
    output = { ...audio, left: audio.left.subarray(0, bodyFrames), right: audio.right.subarray(0, bodyFrames) };
    for (const stem of stems) stem.audio = { ...stem.audio,
      left: stem.audio.left.subarray(0, bodyFrames), right: stem.audio.right.subarray(0, bodyFrames) };
  }
  if (song.master.fx?.length) applyInsertChain(output, song.master.fx,
    { sampleRate: song.sampleRate, bpm: song.bpm }, "master");
  const levels = masterAudio(output, song, options.mastering);
  return { audio: output, stems, bars, durationSeconds: output.left.length / song.sampleRate,
    peakDbfs: levels.peakDbfs, truePeakDbtp: levels.truePeakDbtp,
    ceilingDb: song.master.ceilingDb, events: selected.reduce((sum, group) => sum + group.length, 0),
    loop: song.loop ? { startSample: 0, endSample: bodyFrames } : null };
}
