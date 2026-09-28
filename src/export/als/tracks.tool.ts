import type { ProjectIR } from "../../project/index.ts";
import { fnv1a32 } from "../../shared/index.ts";
import type { StereoBuffer } from "../../audio-io/index.ts";
import { element as x, type XmlNode } from "../xml.tool.ts";
import { buildAlsEnvelope, gainLinear } from "./automation.tool.ts";
import { buildAudioClip, buildMidiClips } from "./clips.tool.ts";
import { arranger, mixer, trackShell, type AlsIdAllocator } from "./skeleton.tool.ts";

export type AlsContent = "midi" | "audio" | "both";
export interface AlsRendered { stems: readonly { trackId: string; audio: StereoBuffer }[];
  returns: { reverb: StereoBuffer | null; delay: StereoBuffer | null } }
export interface AlsSample { path: string; wav: StereoBuffer; bits: 16 | 24; seed: number }
export interface AlsTracks { nodes: XmlNode[]; samples: AlsSample[]; warnings: string[]; regular: number }
function busPresence(project: ProjectIR, bus: "reverb" | "delay"): boolean {
  return !!project.buses[bus] || project.tracks.some((track) => track.sends[bus] > 0 ||
    track.automation.some((lane) => lane.target === `send.${bus}` && lane.points.some((point) => point.value > 0)));
}
function sequencer(type: "midi" | "audio", clips: XmlNode[]): XmlNode {
  return x("MainSequencer", [], [type === "midi" ? x("ClipTimeable", [], [arranger(clips)]) :
    x("Sample", [], [arranger(clips)])]);
}
export function buildAlsTracks(project: ProjectIR, content: AlsContent, rendered: AlsRendered | null,
  bits: 16 | 24, ids: AlsIdAllocator, kitMaps: Readonly<Record<string, Readonly<Record<string, number>>>> = {}): AlsTracks {
  const buses = (["reverb", "delay"] as const).filter((bus) => busPresence(project, bus));
  const nodes: XmlNode[] = []; const samples: AlsSample[] = []; const warnings: string[] = [];
  const byId = new Map(rendered?.stems.map((stem) => [stem.trackId, stem]));
  for (const track of project.tracks) {
    if (content !== "audio" && track.type !== "audio") {
      const clips = buildMidiClips(track, project.markers, project.meter[0]!, ids, kitMaps[track.id]);
      warnings.push(...clips.warnings);
      const gain = gainLinear(track.gainDb);
      if (track.gainDb > 6) warnings.push(`ALS_GAIN_CLAMPED:${track.id}`);
      const mix = mixer(ids, gain, track.pan, content === "both", track.sends, buses);
      const envelopes: XmlNode[] = [];
      for (const lane of track.automation) {
        if (lane.target === "gain" || lane.target === "pan") {
          if (lane.target === "gain" && lane.points.some((point) => point.value > 6))
            warnings.push(`ALS_GAIN_CLAMPED:${track.id}.gain`);
          envelopes.push(buildAlsEnvelope(lane, lane.target === "gain" ? mix.volumeId : mix.panId,
            lane.target === "gain" ? "volume" : "pan", envelopes.length));
        } else warnings.push(`ALS_AUTOMATION_OMITTED:${track.id}.${lane.target}:${lane.points.length}`);
      }
      nodes.push(trackShell("MidiTrack", track.id, ids, mix.node, envelopes, sequencer("midi", clips.clips)));
    }
    if (content !== "midi") {
      const wav = byId.get(track.id)?.audio;
      if (!wav) throw new RangeError(`missing ALS stem: ${track.id}`);
      const path = `Samples/Imported/track-${track.id}.wav`;
      const clip = buildAudioClip(path, wav.left.length, wav.sampleRate, bits, project.tempo[0]!.bpm, ids, project.meter[0]);
      const mix = mixer(ids, 1, 0, false, { reverb: 0, delay: 0 }, buses);
      nodes.push(trackShell("AudioTrack", `${track.id} (frozen)`, ids, mix.node, [], sequencer("audio", [clip])));
      samples.push({ path, wav, bits, seed: fnv1a32(project.seed, path, "wav") });
      if (track.type === "audio") warnings.push(`ALS_AUDIO_FLATTENED:${track.id}`);
      if (track.type === "audio" && track.automation.length) warnings.push(`ALS_AUTOMATION_BAKED:${track.id}`);
    }
  }
  if (content !== "midi" && rendered) for (const bus of ["reverb", "delay"] as const) {
    const wav = rendered.returns[bus];
    if (!wav) continue;
    const path = `Samples/Imported/return-${bus}.wav`;
    const clip = buildAudioClip(path, wav.left.length, wav.sampleRate, bits, project.tempo[0]!.bpm, ids, project.meter[0]);
    const mix = mixer(ids, 1, 0, false, { reverb: 0, delay: 0 }, buses);
    nodes.push(trackShell("AudioTrack", `music2 ${bus} print`, ids, mix.node, [], sequencer("audio", [clip])));
    samples.push({ path, wav, bits, seed: fnv1a32(project.seed, path, "wav") });
  }
  const regular = nodes.length;
  for (const bus of buses) {
    const mix = mixer(ids, 1, 0, true, { reverb: 0, delay: 0 }, buses);
    nodes.push(trackShell("ReturnTrack", `music2 ${bus === "reverb" ? "Reverb" : "Delay"}`, ids, mix.node, []));
  }
  if (buses.length) warnings.push("ALS_RETURN_EFFECTS_ABSENT");
  return { nodes, samples, warnings, regular };
}
