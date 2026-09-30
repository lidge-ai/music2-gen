import { createStereo } from "../audio-io/index.ts";
import type { StereoBuffer } from "../audio-io/index.ts";
import { Music2Error } from "../shared/index.ts";
import type { ResolvedSong, Timeline } from "../song/index.ts";
import { applyDelay, applyReverb, duckEnvelope } from "./fx.tool.ts";
import { applyInsertChain, renderDelayBus, renderReverbBus } from "./fx/index.ts";
import { validateResolvedFx } from "./fx/fx-validate.tool.ts";
import { renderKit } from "./kit.tool.ts";
import { isSampleInstrument, loadSampleInstrument, renderSampleInstrument } from "./instrument.tool.ts";
import type { LoadedSampleInstrument } from "./instrument.tool.ts";
import { mixAudioTracks } from "./audio-tracks.tool.ts";
import type { RenderOptions, RenderResult, RenderStem } from "./render.schema.ts";
import { mergeParams, resolveVoice } from "./voices/registry.tool.ts";
import { selectEvents } from "./select.tool.ts";
import { mixDry, mixStereo } from "./mix-static.tool.ts";
import { mixAutomated, prepareTrackCurves, sendActive } from "./mix-automated.tool.ts";
import { createDecodeBudget } from "../sampler/index.ts";
import { processTrackPlugins } from "./plugin.tool.ts";
import { masterAudio } from "./mixer-master.tool.ts";
import { hasLayers, loadLayerInstruments, renderLayeredSource, layerNoteWarnings } from "./layers.tool.ts";
const RIFF_LIMIT = 0xffffffff;
function renderError(message: string, frame?: number): Music2Error {
  return new Music2Error("E_RENDER", message, frame === undefined ? {} : { details: { frame } });
}

export async function mixTracks(song: ResolvedSong, timeline: Timeline, songPath: string,
  options: RenderOptions = {}): Promise<RenderResult> {
  const decodeBudget = options.decodeBudget ?? createDecodeBudget();
  if (song.tracks.some((track) => track.plugins?.length) && !options.external)
    throw new Music2Error("E_CAPABILITY", "external plugin audio requires --allow-plugins and --plugin-host or MUSIC2_PLUGIN_HOST");
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
  const needsPreRoll = start > 0 && song.tracks.some((track) => track.fx?.some((fx) => fx.type === "tapestop") ||
    track.layers?.some((layer) => layer.fx.some((fx) => fx.type === "tapestop")) || track.automation?.length);
  const preRollFrames = needsPreRoll ? Math.max(
    Math.ceil((end * timeline.secondsPerBar + song.tailSeconds) * song.sampleRate),
    Math.round(start * timeline.secondsPerBar * song.sampleRate) + frames) : 0;
  if (needsPreRoll && (!Number.isSafeInteger(preRollFrames) || preRollFrames * 6 + 36 > RIFF_LIMIT)) {
    throw renderError("render exceeds 24-bit RIFF size limit");
  }
  const preRollEvents = needsPreRoll ? selectEvents(song, timeline, 0, end, preRollFrames) : null;
  const kits: (LoadedSampleInstrument | null)[] = [];
  for (const track of song.tracks) kits.push(isSampleInstrument(track.instrument) ? await loadSampleInstrument(songPath, track, song.sampleRate, decodeBudget) : null);
  const layerKits: (LoadedSampleInstrument | null)[][] = [];
  for (const track of song.tracks) layerKits.push(await loadLayerInstruments(songPath, track, song.sampleRate, decodeBudget));
  const layerWarnings: string[] = [];
  const audio = createStereo(song.sampleRate, frames);
  const reverbSend = createStereo(song.sampleRate, frames);
  const delaySend = createStereo(song.sampleRate, frames);
  const stems: RenderStem[] = [];
  const returns: { reverb: StereoBuffer | null; delay: StereoBuffer | null } | undefined =
    options.returns ? { reverb: null, delay: null } : undefined;
  let scratch: StereoBuffer | null = null;
  let pluginRan = false;
  for (let index = 0; index < song.tracks.length; index++) {
    const track = song.tracks[index]!;
    const events = selected[index]!;
    const layerTape = track.layers?.some((layer) => layer.fx.some((fx) => fx.type === "tapestop"));
    const tapePreRoll = preRollEvents !== null && (track.fx?.some((fx) => fx.type === "tapestop") || layerTape);
    layerWarnings.push(...layerNoteWarnings((track.automation?.length || tapePreRoll) ? preRollEvents?.[index] ?? events : events, track));
    const layeredSource = (ctx: Parameters<typeof renderLayeredSource>[0]["ctx"], mainParams: Record<string, number> | null,
      startSeconds: number, cropOffset = 0): StereoBuffer => renderLayeredSource({
      ctx, mainKit: kits[index] ?? null, mainParams, layerKits: layerKits[index]!, startSeconds,
      secondsPerBar: timeline.secondsPerBar, bpm: song.bpm, cropOffset, windowFrames: frames,
      ...(options.layerTaps ? { taps: options.layerTaps } : {}),
    });
    if (track.automation?.length) {
      const total = preRollEvents ? preRollFrames : frames;
      const fullEvents = preRollEvents?.[index] ?? events;
      const kit = kits[index];
      const voice = kit ? null : resolveVoice(track, index);
      const ctx = { sampleRate: song.sampleRate, frames: total, track, events: fullEvents };
      const rendered = hasLayers(track) ? layeredSource(ctx, voice ? mergeParams(voice, track.params) : null,
        0, Math.round(start * timeline.secondsPerBar * song.sampleRate)) :
        kit ? renderSampleInstrument(ctx, kit) : voice!.render(ctx, mergeParams(voice!, track.params));
      const curves = prepareTrackCurves(track, total, song.sampleRate, song.bpm);
      let processed: StereoBuffer | Float32Array = rendered;
      if (track.fx?.length && rendered instanceof Float32Array) {
        const stereo = createStereo(song.sampleRate, total);
        stereo.left.set(rendered); stereo.right.set(rendered);
        processed = stereo;
      }
      if (track.fx?.length && !(processed instanceof Float32Array)) applyInsertChain(processed, track.fx,
        { sampleRate: song.sampleRate, bpm: song.bpm, startSeconds: 0,
          secondsPerBar: timeline.secondsPerBar, insertCurves: curves.inserts }, track.id);
      if (track.plugins?.length) {
        processed = await processTrackPlugins(track, processed, options.external,
          { bpm: song.bpm, seed: song.seed, startSeconds: 0 }, song.sampleRate);
        pluginRan = true;
      }
      const sourceIndex = track.duck ? song.tracks.findIndex((candidate) => candidate.id === track.duck!.by) : -1;
      const offset = Math.round(start * timeline.secondsPerBar * song.sampleRate);
      const duck = track.duck && sourceIndex >= 0 ? duckEnvelope(offset + frames,
        timeline.events.filter((event) => event.trackIndex === sourceIndex).map((event) => Math.round(event.time * song.sampleRate)),
        song.sampleRate, track.duck.amount, track.duck.releaseMs).subarray(offset, offset + frames) : null;
      const stem = options.stems ? createStereo(song.sampleRate, frames) : null;
      mixAutomated({ master: audio, reverb: reverbSend, delay: delaySend }, processed,
        offset, frames, track, curves, duck, stem);
      if (stem) stems.push({ trackId: track.id, audio: stem });
      continue;
    }
    if (tapePreRoll) {
      const kit = kits[index];
      const voice = kit ? null : resolveVoice(track, index);
      const preCtx = { sampleRate: song.sampleRate, frames: preRollFrames, track, events: preRollEvents[index]! };
      const rendered = hasLayers(track) ? layeredSource(preCtx, voice ? mergeParams(voice, track.params) : null,
        0, Math.round(start * timeline.secondsPerBar * song.sampleRate)) :
        kit ? renderSampleInstrument(preCtx, kit) : voice!.render(preCtx, mergeParams(voice!, track.params));
      const processed = createStereo(song.sampleRate, preRollFrames);
      if (rendered instanceof Float32Array) {
        if (rendered.length !== preRollFrames) throw renderError(`voice ${track.instrument} returned incorrect frame count`);
        for (let frame = 0; frame < preRollFrames; frame++) if (!Number.isFinite(rendered[frame])) throw renderError("nonfinite voice sample", frame);
        processed.left.set(rendered); processed.right.set(rendered);
      } else {
        if (rendered.left.length !== preRollFrames || rendered.right.length !== preRollFrames) throw renderError(`instrument ${track.instrument} returned incorrect frame count`);
        processed.left.set(rendered.left); processed.right.set(rendered.right);
      }
      if (track.fx?.length) applyInsertChain(processed, track.fx, { sampleRate: song.sampleRate, bpm: song.bpm,
        startSeconds: 0, secondsPerBar: timeline.secondsPerBar }, track.id);
      const plugged = await processTrackPlugins(track, processed, options.external,
        { bpm: song.bpm, seed: song.seed, startSeconds: 0 }, song.sampleRate);
      if (track.plugins?.length) pluginRan = true;
      const offset = Math.round(start * timeline.secondsPerBar * song.sampleRate);
      const cropped = createStereo(song.sampleRate, frames);
      if (plugged instanceof Float32Array) throw renderError("plugin pre-roll returned mono audio");
      cropped.left.set(plugged.left.subarray(offset, offset + frames));
      cropped.right.set(plugged.right.subarray(offset, offset + frames));
      const sourceIndex = track.duck ? song.tracks.findIndex((candidate) => candidate.id === track.duck!.by) : -1;
      const duck = track.duck && sourceIndex >= 0 ? duckEnvelope(frames,
        selected[sourceIndex]!.map((event) => event.startFrame), song.sampleRate,
        track.duck.amount, track.duck.releaseMs) : null;
      const stem = options.stems ? createStereo(song.sampleRate, frames) : null;
      mixStereo(audio, reverbSend, delaySend, cropped, 10 ** (track.gain / 20), track.pan,
        duck, track.sends.reverb, track.sends.delay, stem, track.id);
      if (stem) stems.push({ trackId: track.id, audio: stem });
      continue;
    }
    const ctx = { sampleRate: song.sampleRate, frames, track, events };
    const kit = kits[index];
    const voice = kit ? null : resolveVoice(track, index);
    if (hasLayers(track) || kit?.kind === "sfz") {
      let stereo = hasLayers(track) ? layeredSource(ctx, voice ? mergeParams(voice, track.params) : null,
        start * timeline.secondsPerBar) : renderSampleInstrument(ctx, kit!);
      if (track.fx?.length) applyInsertChain(stereo, track.fx, { sampleRate: song.sampleRate, bpm: song.bpm,
        startSeconds: start * timeline.secondsPerBar, secondsPerBar: timeline.secondsPerBar }, track.id);
      if (track.plugins?.length) {
        const plugged = await processTrackPlugins(track, stereo, options.external,
          { bpm: song.bpm, seed: song.seed, startSeconds: start * timeline.secondsPerBar }, song.sampleRate);
        if (plugged instanceof Float32Array) throw renderError("plugin returned mono audio");
        stereo = plugged; pluginRan = true;
      }
      const sourceIndex = track.duck ? song.tracks.findIndex((candidate) => candidate.id === track.duck!.by) : -1;
      const duck = track.duck && sourceIndex >= 0 ? duckEnvelope(frames,
        selected[sourceIndex]!.map((event) => event.startFrame), song.sampleRate,
        track.duck.amount, track.duck.releaseMs) : null;
      const stem = options.stems ? createStereo(song.sampleRate, frames) : null;
      mixStereo(audio, reverbSend, delaySend, stereo, 10 ** (track.gain / 20), track.pan,
        duck, track.sends.reverb, track.sends.delay, stem, track.id);
      if (stem) stems.push({ trackId: track.id, audio: stem });
      continue;
    }
    const mono = kit ? renderKit(ctx, kit.resource) : voice!.render(ctx, mergeParams(voice!, track.params));
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
      applyInsertChain(scratch, track.fx, { sampleRate: song.sampleRate, bpm: song.bpm,
        startSeconds: start * timeline.secondsPerBar, secondsPerBar: timeline.secondsPerBar }, track.id);
      const plugged = await processTrackPlugins(track, scratch, options.external,
        { bpm: song.bpm, seed: song.seed, startSeconds: start * timeline.secondsPerBar }, song.sampleRate);
      if (plugged instanceof Float32Array) throw renderError("plugin returned mono audio");
      if (track.plugins?.length) pluginRan = true;
      mixStereo(audio, reverbSend, delaySend, plugged, 10 ** (track.gain / 20), track.pan,
        duck, track.sends.reverb, track.sends.delay, stem, track.id);
    } else {
      if (track.plugins?.length) {
        const plugged = await processTrackPlugins(track, mono, options.external,
          { bpm: song.bpm, seed: song.seed, startSeconds: start * timeline.secondsPerBar }, song.sampleRate);
        if (plugged instanceof Float32Array) throw renderError("plugin returned mono audio");
        pluginRan = true;
        mixStereo(audio, reverbSend, delaySend, plugged, 10 ** (track.gain / 20), track.pan,
          duck, track.sends.reverb, track.sends.delay, stem, track.id);
      } else mixDry(audio, reverbSend, delaySend, mono, 10 ** (track.gain / 20), track.pan,
        duck, track.sends.reverb, track.sends.delay, stem);
    }
    if (stem) stems.push({ trackId: track.id, audio: stem });
  }
  const audioFlags = song.audioTracks?.length ? await mixAudioTracks(song, songPath,
    { startFrame: Math.round(start * timeline.secondsPerBar * song.sampleRate), frames },
    { master: audio, reverb: reverbSend, delay: delaySend }, stems, timeline, options.stems === true, decodeBudget) : null;
  const fullReturns = start > 0 && (song.audioTracks?.length || song.tracks.some((track) => track.automation?.length)) &&
    (song.tracks.some((track) => sendActive(track, "reverb") || sendActive(track, "delay")) || audioFlags?.reverbActive || audioFlags?.delayActive)
    ? (await mixTracks(song, timeline, songPath, { bars: { start: 0, end }, returns: true, decodeBudget,
      ...(options.external ? { external: options.external } : {}), ...(options.mastering ? { mastering: options.mastering } : {}) })).returns : null;
  const cropReturn = (wet: StereoBuffer): StereoBuffer => {
    const crop = createStereo(song.sampleRate, frames);
    const offset = Math.round(start * timeline.secondsPerBar * song.sampleRate);
    crop.left.set(wet.left.subarray(offset, offset + frames)); crop.right.set(wet.right.subarray(offset, offset + frames));
    return crop;
  };
  if (song.tracks.some((track) => sendActive(track, "reverb")) || audioFlags?.reverbActive) {
    const wet = fullReturns?.reverb ? cropReturn(fullReturns.reverb) : song.fx?.reverb ? renderReverbBus(reverbSend, song.fx.reverb,
      { sampleRate: song.sampleRate, bpm: song.bpm }) : applyReverb(reverbSend);
    if (returns) returns.reverb = wet;
    for (let i = 0; i < frames; i++) { audio.left[i]! += wet.left[i]!; audio.right[i]! += wet.right[i]!; }
  }
  if (song.tracks.some((track) => sendActive(track, "delay")) || audioFlags?.delayActive) {
    const wet = fullReturns?.delay ? cropReturn(fullReturns.delay) : song.fx?.delay ? renderDelayBus(delaySend, song.fx.delay,
      { sampleRate: song.sampleRate, bpm: song.bpm }) : applyDelay(delaySend, song.bpm);
    if (returns) returns.delay = wet;
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
    if (returns) {
      for (const component of [...stems.map((stem) => stem.audio), returns.reverb, returns.delay]) {
        if (!component) continue;
        for (let i = bodyFrames; i < frames; i++) {
          const at = (i - bodyFrames) % bodyFrames;
          component.left[at]! += component.left[i]!;
          component.right[at]! += component.right[i]!;
        }
      }
      for (const id of ["reverb", "delay"] as const) {
        const component = returns[id];
        if (component) returns[id] = { ...component,
          left: component.left.subarray(0, bodyFrames), right: component.right.subarray(0, bodyFrames) };
      }
    }
    for (const stem of stems) stem.audio = { ...stem.audio,
      left: stem.audio.left.subarray(0, bodyFrames), right: stem.audio.right.subarray(0, bodyFrames) };
  }
  const premaster = options.premaster ? { ...output, left: output.left.slice(), right: output.right.slice() } : undefined;
  if (returns && options.stems) {
    const components = [...stems.map((stem) => stem.audio), returns.reverb, returns.delay].filter(
      (component): component is StereoBuffer => component !== null);
    let maxAbsolute = 0, maxNormalized = 0, worstFrame = 0, worstChannel: "left" | "right" = "left";
    for (const channel of ["left", "right"] as const) for (let frame = 0; frame < output[channel].length; frame++) {
      let sum = 0; let magnitude = 0;
      for (const component of components) {
        const sample = component[channel][frame]!;
        if (!Number.isFinite(sample)) throw renderError("nonfinite stem component", frame);
        sum += sample; magnitude += Math.abs(sample);
      }
      const expected = output[channel][frame]!;
      if (!Number.isFinite(expected)) throw renderError("nonfinite pre-master sample", frame);
      const absolute = Math.abs(sum - expected), normalized = absolute / Math.max(1, magnitude);
      if (absolute > maxAbsolute) maxAbsolute = absolute;
      if (normalized > maxNormalized) { maxNormalized = normalized; worstFrame = frame; worstChannel = channel; }
    }
    if (maxNormalized > 1e-6) throw new Music2Error("E_RENDER", "stem sum exceeds pre-master tolerance", {
      details: { maxAbsolute, maxNormalized, frame: worstFrame, channel: worstChannel, sources: components.length },
    });
  }
  if (song.master.fx?.length) applyInsertChain(output, song.master.fx,
    { sampleRate: song.sampleRate, bpm: song.bpm }, "master");
  const levels = masterAudio(output, song, options.mastering);
  return { audio: output, stems, ...(returns ? { returns } : {}), ...(premaster ? { premaster } : {}),
    ...(pluginRan ? { deterministic: false as const } : {}),
    bars, durationSeconds: output.left.length / song.sampleRate,
    peakDbfs: levels.peakDbfs, truePeakDbtp: levels.truePeakDbtp,
    ceilingDb: song.master.ceilingDb, events: selected.reduce((sum, group) => sum + group.length, 0),
    loop: song.loop ? { startSample: 0, endSample: bodyFrames } : null,
    ...((pluginRan || layerWarnings.length || [...kits, ...layerKits.flat()].some((kit) => kit?.warnings.length)) ? { warnings: [
      ...layerWarnings,
      ...[...kits, ...layerKits.flat()].flatMap((kit) => kit?.warnings.map((warning) =>
        `${warning.file}:${warning.line}: ${warning.opcode ? `${warning.opcode}: ` : ""}${warning.message}`) ?? []),
      ...(pluginRan ? ["external plugin audio may vary between renders", ...(options.external?.warnings ?? [])] : []),
    ] } : {}) };
}
