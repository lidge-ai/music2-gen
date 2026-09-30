import { createStereo } from "../audio-io/index.ts";
import type { StereoBuffer } from "../audio-io/index.ts";
import type { DecodeBudget } from "../sampler/index.ts";
import { Music2Error } from "../shared/index.ts";
import type { ResolvedLayer, ResolvedTrack } from "../song/index.ts";
import { applyInsertChain } from "./fx/index.ts";
import { isSampleInstrument, loadSampleInstrument, renderSampleInstrument } from "./instrument.tool.ts";
import type { LoadedSampleInstrument } from "./instrument.tool.ts";
import type { LayerTap, VoiceContext, VoiceEvent } from "./render.schema.ts";
import { limitStops } from "./select.tool.ts";
import { mergeParams, resolveVoice } from "./voices/registry.tool.ts";

export function hasLayers(track: ResolvedTrack): boolean { return (track.layers?.length ?? 0) > 0; }

/** A layer inherits timing and mono policy, but owns its voice parameters and inserts. */
export function layerTrack(track: ResolvedTrack, layer: ResolvedLayer): ResolvedTrack {
  const source = { ...track, instrument: layer.instrument, params: layer.params, fx: layer.fx,
    transpose: track.transpose + layer.transpose, duck: null };
  delete source.layers;
  delete source.automation;
  delete source.plugins;
  return source;
}

export async function loadLayerInstruments(songPath: string, track: ResolvedTrack, rate: number,
  budget: DecodeBudget): Promise<(LoadedSampleInstrument | null)[]> {
  const loaded: (LoadedSampleInstrument | null)[] = [];
  for (const layer of track.layers ?? []) loaded.push(isSampleInstrument(layer.instrument) ?
    await loadSampleInstrument(songPath, layerTrack(track, layer), rate, budget) : null);
  return loaded;
}

export function layerEvents(events: VoiceEvent[], track: ResolvedTrack, layer: ResolvedLayer,
  trackIndex: number, frames: number, sampleRate: number): VoiceEvent[] {
  const selected: VoiceEvent[] = [];
  for (const event of events) {
    if (layer.only && (!event.sample || !layer.only.includes(event.sample.name))) continue;
    const midi = event.midi === null ? null : event.midi + layer.transpose;
    if (midi !== null && (midi < 0 || midi > 127)) continue;
    const copy = { ...event, midi, velocity: Math.min(1, event.velocity * layer.velocity) };
    delete copy.params;
    selected.push(copy);
  }
  limitStops(selected, layerTrack(track, layer), trackIndex, frames, sampleRate);
  return selected;
}

/** One diagnostic per layer, counted from the events actually used by the render path. */
export function layerNoteWarnings(events: VoiceEvent[], track: ResolvedTrack): string[] {
  const warnings: string[] = [];
  for (const layer of track.layers ?? []) {
    const count = events.filter((event) => event.midi !== null &&
      (event.midi + layer.transpose < 0 || event.midi + layer.transpose > 127)).length;
    if (count) warnings.push(`LAYER_NOTES_DROPPED:${track.id}.${layer.id}:${count}`);
  }
  return warnings;
}

function renderSource(ctx: VoiceContext, kit: LoadedSampleInstrument | null,
  params: Record<string, number> | null): StereoBuffer {
  let audio: StereoBuffer;
  if (kit) audio = renderSampleInstrument(ctx, kit);
  else {
    const voice = resolveVoice(ctx.track, 0);
    if (!voice) throw new Music2Error("E_RENDER", `instrument ${ctx.track.instrument} was not loaded`);
    const mono = voice.render(ctx, params ?? mergeParams(voice, ctx.track.params));
    if (mono.length !== ctx.frames) throw new Music2Error("E_RENDER", `voice ${ctx.track.instrument} returned incorrect frame count`);
    audio = createStereo(ctx.sampleRate, ctx.frames);
    audio.left.set(mono); audio.right.set(mono);
  }
  if (audio.left.length !== ctx.frames || audio.right.length !== ctx.frames)
    throw new Music2Error("E_RENDER", `instrument ${ctx.track.instrument} returned incorrect frame count`);
  for (let frame = 0; frame < ctx.frames; frame++) {
    if (!Number.isFinite(audio.left[frame]) || !Number.isFinite(audio.right[frame]))
      throw new Music2Error("E_RENDER", `nonfinite source sample on ${ctx.track.id}`, { details: { frame } });
  }
  return audio;
}

export function renderLayeredSource(input: { ctx: VoiceContext; mainKit: LoadedSampleInstrument | null;
  mainParams: Record<string, number> | null; layerKits: (LoadedSampleInstrument | null)[];
  startSeconds: number; secondsPerBar: number; bpm: number; cropOffset?: number;
  taps?: (tap: LayerTap) => void; windowFrames?: number }): StereoBuffer {
  const { ctx } = input;
  const sum = renderSource(ctx, input.mainKit, input.mainParams);
  const tap = (audio: StereoBuffer, layerId?: string): void => {
    if (!input.taps || !hasLayers(ctx.track)) return;
    const offset = input.cropOffset ?? 0;
    const end = offset + (input.windowFrames ?? ctx.frames - offset);
    // Capture owns its PCM: later track inserts or a callback cannot mutate another source.
    input.taps({ trackId: ctx.track.id, source: layerId === undefined ? "main" : "layer",
      ...(layerId === undefined ? {} : { layerId }),
      audio: { ...audio, left: audio.left.slice(offset, end), right: audio.right.slice(offset, end) } });
  };
  tap(sum);
  for (let index = 0; index < (ctx.track.layers?.length ?? 0); index++) {
    const layer = ctx.track.layers![index]!;
    const track = layerTrack(ctx.track, layer);
    const events = layerEvents(ctx.events, ctx.track, layer, 0, ctx.frames, ctx.sampleRate);
    const kit = input.layerKits[index] ?? null;
    const voice = kit ? null : resolveVoice(track, 0);
    const audio = renderSource({ ...ctx, track, events }, kit, voice ? mergeParams(voice, layer.params) : null);
    if (layer.fx.length) applyInsertChain(audio, layer.fx, { sampleRate: ctx.sampleRate, bpm: input.bpm,
      startSeconds: input.startSeconds, secondsPerBar: input.secondsPerBar }, `${ctx.track.id}.${layer.id}`);
    const gain = 10 ** (layer.gain / 20);
    const leftGain = gain * Math.cos((layer.pan + 1) * Math.PI / 4) * Math.SQRT2;
    const rightGain = gain * Math.sin((layer.pan + 1) * Math.PI / 4) * Math.SQRT2;
    for (let frame = 0; frame < ctx.frames; frame++) {
      audio.left[frame] = audio.left[frame]! * leftGain;
      audio.right[frame] = audio.right[frame]! * rightGain;
      sum.left[frame]! += audio.left[frame]!;
      sum.right[frame]! += audio.right[frame]!;
    }
    tap(audio, layer.id);
  }
  return sum;
}
