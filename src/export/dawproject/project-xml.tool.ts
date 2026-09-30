import type { UserInstrumentKinds } from "../../sampler/index.ts";
import { exportInstrumentKind, validateExportUserInstruments } from "../user-instruments.tool.ts";
import type { ProjectIR, ProjectTrack } from "../../project/index.ts";
import { drumNoteFor, sfxNoteFor } from "../../midi/gm.tool.ts";
import { Music2Error, packageVersion } from "../../shared/index.ts";
import { element, serializeXml } from "../xml.tool.ts";
import type { DawContent, DawMedia, DawClipRegion } from "./index.ts";

export interface DawView { userInstruments?: UserInstrumentKinds; content: DawContent; media: readonly DawMedia[]; regions: readonly DawClipRegion[];
  kitMaps?: Readonly<Record<string, Readonly<Record<string, number>>>> }
export interface ProjectXmlResult { bytes: Uint8Array; warnings: string[]; tracks: number }
type Node = { tag: string; attrs: [string, string][]; children: (Node | string)[] };
const E = (tag: string, attrs: Record<string, string> = {}, children: (Node | string)[] = []): Node =>
  element(tag, attrs, children) as Node;
const fail = (message: string): never => { throw new Music2Error("E_RENDER", `DAWproject ${message}`); };
export function dawNumber(value: number): string {
  if (!Number.isFinite(value)) return fail("nonfinite number");
  const fixed = value.toFixed(6);
  return fixed === "-0.000000" ? "0.000000" : fixed;
}
const beat = (tick: number): string => dawNumber(tick / 960);
const linear = (db: number): number => Math.min(2, Math.max(0, 10 ** (db / 20)));
const pan = (value: number): number => (value + 1) / 2;

function audioClip(media: DawMedia, time: number, duration: number, start: number, end: number): Node {
  if (!(duration > 0) || !(end > start)) return fail("invalid audio warp region");
  const sourceDuration = media.frames / media.sampleRate;
  const warps = E("Warps", { timeUnit: "beats", contentTimeUnit: "seconds" }, [
    E("Audio", { timeUnit: "seconds", channels: String(media.channels), sampleRate: String(media.sampleRate),
      duration: dawNumber(sourceDuration) }, [E("File", { path: media.path })]),
    E("Warp", { time: dawNumber(0), contentTime: dawNumber(start) }),
    E("Warp", { time: dawNumber(duration), contentTime: dawNumber(end) }),
  ]);
  return E("Clip", { time: dawNumber(time), duration: dawNumber(duration), playStart: dawNumber(0) }, [warps]);
}

function noteKey(track: Extract<ProjectTrack, { type: "notes" | "drums" }>, note: typeof track.notes[number],
  view: DawView, warnings: string[]): number | null {
  if (note.pitch !== null) return note.pitch;
  if (!note.sample) return null;
  const kind = exportInstrumentKind(track.instrument, view.userInstruments);
  const mapped = kind === "kit" ? view.kitMaps?.[track.id]?.[note.sample.name] :
    (sfxNoteFor(note.sample.name) ?? drumNoteFor(note.sample.name, note.sample.index));
  if (mapped === undefined) { warnings.push(`NOTE_MAPPING_OMITTED:${track.id}:${note.sample.name}`); return null; }
  if (kind !== "kit") warnings.push(`NOTE_SOUND_NOT_PORTABLE:${track.id}:${note.sample.name}`);
  return mapped;
}

/** Build ordered XML, then allocate every ID in final document order and resolve typed references. */
export function buildProjectXml(project: ProjectIR, view: DawView): ProjectXmlResult {
  if (project.ppq !== 960 || project.tempo.length !== 1 || project.meter.length !== 1 ||
    project.tempo[0]?.tick !== 0 || project.meter[0]?.tick !== 0)
    throw new Music2Error("E_CAPABILITY", "DAWproject supports one tick-zero tempo and meter");
  validateExportUserInstruments(project, view.userInstruments);
  const bpm = project.tempo[0].bpm;
  if (!Number.isFinite(bpm) || bpm < 20 || bpm > 999 || project.meter[0].denominator !== 4 ||
    !Number.isInteger(project.meter[0].numerator)) return fail("invalid transport values");
  const named = new Map<string, { node: Node; kind: string }>();
  const node = (tag: string, key: string, attrs: Record<string, string> = {}, children: Node[] = []): Node => {
    if (named.has(key)) return fail(`duplicate logical ID ${key}`);
    const made = E(tag, { id: "", ...attrs }, children);
    named.set(key, { node: made, kind: tag });
    return made;
  };
  const warnings: string[] = [];
  if (view.content !== "audio") for (const track of project.tracks)
    if (track.type !== "audio" && (track.instrument.kind === "lib" || track.instrument.kind === "user"))
      warnings.push(`NOTE_SOUND_NOT_PORTABLE:${track.id}:${track.instrument.kind}:${track.instrument.id}`);
  const structure: Node[] = [];
  const lanes: Node[] = [];
  const mediaBySource = new Map(view.media.filter((entry) => entry.owner.kind === "source")
    .map((entry) => [(entry.owner as { sampleIndex: number }).sampleIndex, entry]));
  const mediaByStem = new Map(view.media.filter((entry) => entry.owner.kind === "stem")
    .map((entry) => [(entry.owner as { trackId: string }).trackId, entry]));
  const mediaByReturn = new Map(view.media.filter((entry) => entry.owner.kind === "return")
    .map((entry) => [(entry.owner as { bus: string }).bus, entry]));
  const native = view.content !== "audio";
  const frozen = view.content !== "midi";
  const trackSpec: { key: string; name: string; source?: ProjectTrack; media?: DawMedia; editable: boolean }[] = [];
  if (native) for (const track of project.tracks)
    trackSpec.push({ key: `native.${track.index}`, name: track.id, source: track, editable: true });
  if (frozen) {
    for (const track of project.tracks) {
      const media = mediaByStem.get(track.id);
      if (!media) return fail(`missing stem ${track.id}`);
      trackSpec.push({ key: `stem.${track.index}`, name: `${track.id} (frozen)`, media, editable: false });
    }
    for (const bus of ["reverb", "delay"] as const) {
      const media = mediaByReturn.get(bus);
      if (media) trackSpec.push({ key: `return.${bus}`, name: `${bus} return`, media, editable: false });
    }
  }
  const effect = (bus: "reverb" | "delay") => project.buses[bus] && native;
  for (const spec of trackSpec) {
    const track = spec.source;
    const key = spec.key;
    const channelChildren: Node[] = [node("Mute", `${key}.mute`, { value: spec.editable && frozen ? "true" : "false" })];
    const channelAttrs = { role: "regular", audioChannels: "2", destination: "@master.channel", solo: "false" };
    if (track) {
      channelChildren.push(node("Pan", `${key}.pan`, { unit: "normalized", value: dawNumber(pan(track.pan)),
        min: dawNumber(0), max: dawNumber(1) }));
      const sends: Node[] = [];
      for (const bus of ["reverb", "delay"] as const) if (track.sends[bus] > 0 && effect(bus)) {
        sends.push(node("Send", `${key}.send.${bus}`, { destination: `@effect.${bus}`, type: "post" },
          [node("Volume", `${key}.send.${bus}.volume`, { unit: "linear", value: dawNumber(track.sends[bus]),
            min: dawNumber(0), max: dawNumber(1) })]));
      }
      if (sends.length) channelChildren.push(E("Sends", {}, sends));
      if (track.gainDb > 20 * Math.log10(2)) warnings.push(`DAW_VOLUME_CLAMPED:${track.id}`);
    }
    channelChildren.push(node("Volume", `${key}.volume`, { unit: "linear", value: dawNumber(track ? linear(track.gainDb) : 1),
      min: dawNumber(0), max: dawNumber(2) }));
    structure.push(node("Track", `${key}.track`, { name: spec.name,
      contentType: track && track.type !== "audio" ? "notes" : "audio", loaded: "true" },
    [node("Channel", `${key}.channel`, channelAttrs, channelChildren)]));

    const laneChildren: Node[] = [];
    if (track?.type === "audio") {
      const clips: Node[] = [];
      for (let index = 0; index < track.clips.length; index++) {
        const clip = track.clips[index]!;
        const media = mediaBySource.get(clip.sample);
        const region = view.regions.find((entry) => entry.trackId === track.id && entry.clipIndex === index);
        if (!media || !region) return fail(`missing native clip media/region ${track.id}:${index}`);
        const sourceDuration = media.frames / media.sampleRate;
        const end = Math.min(region.endSeconds, sourceDuration);
        if (region.startSeconds >= sourceDuration || end <= region.startSeconds) {
          warnings.push(`NATIVE_AUDIO_CLIP_OMITTED:${track.id}:${index}`); continue;
        }
        const requested = clip.lengthTicks / 960;
        const duration = clip.stretch.mode === "none" ?
          Math.min(requested, (end - region.startSeconds) * bpm / 60) : requested;
        if (duration < requested || end < region.endSeconds) warnings.push(`NATIVE_AUDIO_CLIP_CLAMPED:${track.id}:${index}`);
        if (clip.stretch.mode !== "none" || clip.pitchSemitones || clip.gainDb || clip.fadeInSeconds || clip.fadeOutSeconds || track.duck)
          warnings.push(`EDITABLE_AUDIO_APPROXIMATION:${track.id}:${index}`);
        clips.push(audioClip(media, clip.tick / 960, duration, region.startSeconds, end));
      }
      if (clips.length) laneChildren.push(node("Clips", `${key}.clips`, {}, clips));
    } else if (track) {
      const notes: Node[] = [];
      const ordered = [...track.notes].sort((a, b) => a.tick - b.tick || (a.pitch ?? 0) - (b.pitch ?? 0) || a.eventIndex - b.eventIndex);
      for (const entry of ordered) {
        const keyNumber = noteKey(track, entry, view, warnings);
        if (keyNumber === null) continue;
        if (!Number.isInteger(keyNumber) || keyNumber < 0 || keyNumber > 127) return fail("invalid mapped note key");
        notes.push(E("Note", { time: beat(entry.tick), duration: beat(Math.max(1, entry.lengthTicks)),
          channel: "0", key: String(keyNumber), vel: dawNumber(entry.velocity) }));
      }
      if (notes.length) {
        const length = Math.max(project.lengthTicks, ...ordered.map((entry) => entry.tick + Math.max(1, entry.lengthTicks)));
        laneChildren.push(node("Clips", `${key}.clips`, {}, [E("Clip", { time: dawNumber(0), duration: beat(length),
          playStart: dawNumber(0) }, [node("Notes", `${key}.notes`, {}, notes)])]));
      }
    } else if (spec.media) {
      const media = spec.media;
      const duration = media.frames / media.sampleRate;
      laneChildren.push(node("Clips", `${key}.clips`, {}, [audioClip(media, 0, duration * bpm / 60, 0, duration)]));
    }
    if (track) for (const [index, automation] of track.automation.entries()) {
      if (automation.target !== "gain" && automation.target !== "pan") {
        warnings.push(`AUTOMATION_OMITTED:${track.id}:${automation.target}`); continue;
      }
      const values = automation.points.map((point) => E("RealPoint", { time: beat(point.tick),
        value: dawNumber(automation.target === "gain" ? linear(point.value) : pan(point.value)),
        interpolation: point.curve }));
      const param = automation.target === "gain" ? "volume" : "pan";
      laneChildren.push(node("Points", `${key}.points.${index}`, { timeUnit: "beats",
        unit: automation.target === "gain" ? "linear" : "normalized" },
      [E("Target", { parameter: `@${key}.${param}` }), ...values]));
      if (automation.target === "gain" && automation.points.some((point, i) => i > 0 && automation.points[i - 1]!.curve === "linear" &&
        point.value !== automation.points[i - 1]!.value)) warnings.push(`GAIN_CURVE_LAW_DIFFERENCE:${track.id}`);
    }
    lanes.push(node("Lanes", `${key}.lanes`, { track: `@${key}.track` }, laneChildren));
  }
  for (const bus of ["reverb", "delay"] as const) if (effect(bus))
    structure.push(node("Channel", `effect.${bus}`, { name: bus === "reverb" ? "Reverb" : "Delay",
      role: "effect", audioChannels: "2", destination: "@master.channel" }));
  structure.push(node("Track", "master.track", { name: "Master", contentType: "audio notes", loaded: "true" },
    [node("Channel", "master.channel", { role: "master", audioChannels: "2" }, [
      node("Mute", "master.mute", { value: "false" }),
      node("Pan", "master.pan", { unit: "normalized", value: dawNumber(0.5), min: dawNumber(0), max: dawNumber(1) }),
      node("Volume", "master.volume", { unit: "linear", value: dawNumber(linear(project.master.gainDb)),
        min: dawNumber(0), max: dawNumber(2) }),
    ])]));
  const arrangement: Node[] = [node("Lanes", "arrangement.lanes", { timeUnit: "beats" }, lanes)];
  if (project.markers.length) arrangement.push(node("Markers", "arrangement.markers", {},
    project.markers.map((marker) => E("Marker", { time: beat(marker.tick), name: marker.name }))));
  const root = E("Project", { version: "1.0" }, [
    E("Application", { name: "music2", version: packageVersion() }),
    E("Transport", {}, [
      node("Tempo", "transport.tempo", { name: "Tempo", unit: "bpm", value: dawNumber(bpm),
        min: dawNumber(20), max: dawNumber(999) }),
      node("TimeSignature", "transport.meter", { numerator: String(project.meter[0].numerator), denominator: "4" }),
    ]), E("Structure", {}, structure), node("Arrangement", "arrangement", {}, arrangement), E("Scenes"),
  ]);
  const resolved = new Map<Node, string>();
  let next = 0;
  const walk = (entry: Node): void => {
    const id = entry.attrs.find(([key]) => key === "id");
    if (id) { id[1] = `id${next++}`; resolved.set(entry, id[1]); }
    for (const child of entry.children) if (typeof child !== "string") walk(child);
  };
  walk(root);
  const allowed = new Map<string, string[]>([["track", ["Track"]], ["destination", ["Channel"]],
    ["parameter", ["Pan", "Volume"]]]);
  const refs = (entry: Node): void => {
    for (const attr of entry.attrs) if (attr[1].startsWith("@")) {
      const target = named.get(attr[1].slice(1));
      if (!target || !allowed.get(attr[0])?.includes(target.kind)) return fail(`invalid ${attr[0]} reference ${attr[1]}`);
      const id = resolved.get(target.node);
      if (!id) return fail(`unassigned reference ${attr[1]}`);
      attr[1] = id;
    }
    for (const child of entry.children) if (typeof child !== "string") refs(child);
  };
  refs(root);
  return { bytes: serializeXml(root, { declaration: "xmlStandalone" }), warnings: [...new Set(warnings)], tracks: trackSpec.length };
}
export function projectXml(project: ProjectIR, view: DawView): Uint8Array { return buildProjectXml(project, view).bytes; }
