import { Music2Error } from "../shared/index.ts";
import { parseMini, parseSampleRef } from "../pattern/index.ts";
import type { Node } from "../pattern/index.ts";
import { buildTimeline } from "../song/index.ts";
import type { ResolvedSong } from "../song/index.ts";
import { mixTracks } from "./mixer.tool.ts";
import type { RenderOptions, RenderResult } from "./render.schema.ts";
import { createDecodeBudget, readUserManifest } from "../sampler/index.ts";
import { loadKitMidiMap } from "./kit.tool.ts";
import { declaredSampleNames, validateDawVoiceLanes, validateVoiceParams } from "./voices/registry.tool.ts";

function visitAtoms(node: Node, visit: (raw: string) => void): void {
  switch (node.type) {
    case "atom": visit(node.atom.raw); break;
    case "seq": node.steps.forEach((step) => visitAtoms(step.node, visit)); break;
    case "stack": node.branches.forEach((child) => visitAtoms(child, visit)); break;
    case "alt": node.items.forEach((child) => visitAtoms(child, visit)); break;
    case "choose": node.options.forEach((child) => visitAtoms(child, visit)); break;
    case "fast": case "slow": case "euclid": case "degrade": visitAtoms(node.node, visit); break;
    case "rest": break;
  }
}

function checkSample(name: string, names: readonly string[], path: string): void {
  if (names.includes(name)) return;
  throw new Music2Error("E_SCHEMA", `unknown drum sample ${name}`, {
    details: { issues: [{ path, message: `unknown drum sample ${name}` }] },
  });
}

function validatePatterns(song: ResolvedSong, trackIndex: number, names: readonly string[],
  only: readonly string[] | null = null, layerPath?: string): void {
  const track = song.tracks[trackIndex]!;
  const validatePattern = (pattern: string | null, path: string): void => {
    if (pattern === null) return;
    visitAtoms(parseMini(pattern), (raw) => {
      const name = parseSampleRef(raw).name;
      if (only === null || only.includes(name)) checkSample(name, names, layerPath ?? path);
    });
  };
  if (layerPath) track.notes?.forEach((note) => {
    if (note.sample && (only === null || only.includes(note.sample.name)))
      checkSample(note.sample.name, names, layerPath);
  });
  validatePattern(track.pattern, `tracks[${trackIndex}].pattern`);
  song.sections.forEach((section, sectionIndex) => {
    if (Object.hasOwn(section.patterns, track.id))
      validatePattern(section.patterns[track.id] ?? null, `sections[${sectionIndex}].patterns.${track.id}`);
  });
}

async function validateDeclaredSamples(song: ResolvedSong, songPath: string): Promise<void> {
  for (const [trackIndex, track] of song.tracks.entries()) {
    const mainNames = declaredSampleNames(track.instrument);
    if (mainNames) validatePatterns(song, trackIndex, mainNames);
    if (track.kind !== "drums") continue;
    for (const [layerIndex, layer] of (track.layers ?? []).entries()) {
      const path = `$.tracks[${trackIndex}].layers[${layerIndex}]`;
      let names = declaredSampleNames(layer.instrument);
      if (layer.instrument.startsWith("kit:")) names = (await loadKitMidiMap(songPath, layer.instrument)).names;
      if (layer.instrument.startsWith("user:")) {
        const { root, manifest } = await readUserManifest(layer.instrument.slice(5));
        if (manifest.kind !== "kit") throw new Music2Error("E_SCHEMA", "user SFZ requires notes layer", {
          details: { issues: [{ path: `${path}.instrument`, message: "user SFZ requires notes layer" }] },
        });
        names = (await loadKitMidiMap(songPath, layer.instrument, root)).names;
      }
      if (!names) continue;
      layer.only?.forEach((name, index) => checkSample(name, names, `${path}.only[${index}]`));
      validatePatterns(song, trackIndex, names, layer.only, `${path}.instrument`);
    }
  }
}

/** Render a validated, resolved song to deterministic stereo PCM. */
export async function renderSong(song: ResolvedSong, songPath: string,
  options: RenderOptions = {}): Promise<RenderResult> {
  if (song.tracks.some((track) => track.plugins?.length) && !options.external)
    throw new Music2Error("E_CAPABILITY", "external plugin audio requires --allow-plugins and --plugin-host or MUSIC2_PLUGIN_HOST");
  validateVoiceParams(song);
  validateDawVoiceLanes(song);
  await validateDeclaredSamples(song, songPath);
  const timeline = buildTimeline(song);
  for (const event of timeline.events) {
    const track = song.tracks[event.trackIndex]!;
    const sourcePath = track.notes === undefined ? `tracks[${event.trackIndex}].pattern` :
      `tracks[${event.trackIndex}].notes[${track.notes[event.order]!.inputIndex}]`;
    const names = declaredSampleNames(track.instrument);
    if (names && event.sample) checkSample(event.sample.name, names,
      track.notes === undefined ? sourcePath : `${sourcePath}.sample`);
    if (event.midi !== null && (!Number.isFinite(event.midi) || event.midi < 0 || event.midi > 127)) {
      throw new Music2Error("E_SCHEMA", `invalid MIDI on track ${track.id}`, {
        details: { issues: [{ path: track.notes === undefined ? sourcePath : `${sourcePath}.pitch`, message: "MIDI must be 0..127" }] },
      });
    }
  }
  return mixTracks(song, timeline, songPath, { ...options, decodeBudget: options.decodeBudget ?? createDecodeBudget() });
}
