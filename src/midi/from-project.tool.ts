import type { UserInstrumentKinds } from "../sampler/index.ts";
import type { ProjectIR, ProjectNote, ProjectNoteTrack } from "../project/index.ts";
import { Music2Error } from "../shared/index.ts";
import { gainDbToCc7, panToCc10, laneToCcEvents, gainCcClippedWarning,
  midiAutomationOmittedWarning } from "../automation/index.ts";
import { drumNoteFor, keyToSmf, kitMidiMap, programForInstrument, sfxNoteFor } from "./gm.tool.ts";
import type { SmfEvent, SmfFile, SmfTrack } from "./smf.schema.ts";

export interface MidiProjection {
  file: SmfFile; warnings: string[]; notes: number;
  channels: Record<string, number>; dropped: Record<string, number>;
}
const melodic = [0, 1, 2, 3, 4, 5, 6, 7, 8, 10, 11, 12, 13, 14, 15];
const ascii = (value: string): Uint8Array => Uint8Array.from([...value].slice(0, 255).map((c) => {
  const code = c.codePointAt(0)!; return code >= 32 && code <= 126 ? code : 63;
}));
const meta = (tick: number, type: number, value: Uint8Array): SmfEvent => ({ tick, kind: "meta", type, data: value });
const count = (dropped: Record<string, number>, key: string): void => { dropped[key] = (dropped[key] ?? 0) + 1; };
const clamp = (value: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, value));
function rank(event: SmfEvent): number {
  if (event.kind === "meta") return ({ 3: 0, 88: 1, 89: 2, 81: 3, 6: 4, 1: 5 } as Record<number, number>)[event.type] ?? 6;
  if (event.kind === "program") return 7;
  if (event.kind === "cc") return 8 + event.controller / 128;
  if (event.kind === "pitchBend") return 9;
  if (event.kind === "noteOff") return 10 + event.key / 128;
  if (event.kind === "noteOn") return 11 + event.key / 128;
  return 12;
}
function ordered(events: SmfEvent[]): SmfEvent[] {
  return events.map((event, index) => ({ event, index }))
    .sort((a, b) => a.event.tick - b.event.tick || rank(a.event) - rank(b.event) || a.index - b.index)
    .map(({ event }) => event);
}
function instrumentId(track: ProjectNoteTrack): string {
  if (track.instrument.kind === "voice") return track.instrument.id;
  if (track.instrument.kind === "lib" || track.instrument.kind === "user") return `${track.instrument.kind}:${track.instrument.id}`;
  return `${track.instrument.kind}:${track.instrument.ref}`;
}
function noteKey(track: ProjectNoteTrack, note: ProjectNote, kit: Record<string, number> | undefined): number | undefined {
  if (track.type === "notes") return note.pitch ?? undefined;
  const name = note.sample?.name;
  if (!name) return undefined;
  if (kit) return kit[name];
  if (track.instrument.kind === "voice" && track.instrument.id === "sfx") return sfxNoteFor(name);
  return drumNoteFor(name, note.sample?.index ?? 0);
}
function addNotes(track: ProjectNoteTrack, channel: number, keys: Record<string, number> | undefined,
  events: SmfEvent[], dropped: Record<string, number>, warnings: string[]): number {
  const notes = track.notes.map((note, index) => ({ note, index, key: noteKey(track, note, keys) }))
    .sort((a, b) => a.note.tick - b.note.tick || a.note.eventIndex - b.note.eventIndex);
  const retained: { tick: number; end: number; key: number; velocity: number; index: number }[] = [];
  let unknown = 0;
  for (const { note, index, key } of notes) {
    if (key === undefined || !Number.isInteger(key) || key < 0 || key > 127) {
      count(dropped, "unknownNotesDropped"); unknown++; continue;
    }
    if (track.type === "drums" && note.sample && note.sample.index !== 0 && note.sample.name !== "tom")
      count(dropped, "drumVariantsDropped");
    const rawVelocity = Math.round(127 * note.velocity);
    if (rawVelocity < 1 || rawVelocity > 127) count(dropped, "velocityClamped");
    const velocity = clamp(rawVelocity, 1, 127);
    const previous = [...retained].reverse().find((other) => other.key === key && other.end > note.tick);
    if (previous) {
      if (previous.tick === note.tick) {
        previous.end = previous.tick;
        count(dropped, "zeroLengthDropped");
      } else { previous.end = note.tick; count(dropped, "overlapTruncated"); }
    }
    retained.push({ tick: note.tick, end: Math.max(note.tick + 1, note.tick + note.lengthTicks), key, velocity, index });
  }
  for (const item of retained) {
    if (item.end <= item.tick) continue;
    events.push({ tick: item.tick, kind: "noteOn", channel, key: item.key, velocity: item.velocity },
      { tick: item.end, kind: "noteOff", channel, key: item.key, velocity: 64 });
  }
  if (unknown > 0) warnings.push(`UNKNOWN_NOTES_DROPPED:${track.id}=${unknown}`);
  return retained.filter((item) => item.end > item.tick).length;
}

/** Shared channel-10 and reused melodic channels must not leave a later onset under an earlier off. */
function clipSharedChannels(tracks: SmfTrack[], dropped: Record<string, number>): number {
  const pairs = new Map<string, { on: SmfEvent; off: SmfEvent; track: SmfTrack; order: number }[]>();
  for (const [trackIndex, track] of tracks.entries()) {
    const open = new Map<string, SmfEvent[]>();
    for (const event of track.events) {
      if (event.kind !== "noteOn" && event.kind !== "noteOff") continue;
      const key = `${event.channel}:${event.key}`;
      const queue = open.get(key) ?? [];
      if (event.kind === "noteOn") { queue.push(event); open.set(key, queue); continue; }
      const on = queue.shift();
      if (on) {
        const group = pairs.get(key) ?? [];
        group.push({ on, off: event, track, order: trackIndex }); pairs.set(key, group);
      }
    }
  }
  const remove = new Set<SmfEvent>(); let removed = 0;
  for (const group of pairs.values()) {
    group.sort((a, b) => a.on.tick - b.on.tick || a.order - b.order);
    for (let i = 0; i + 1 < group.length; i++) {
      const prior = group[i]!; const next = group[i + 1]!;
      if (remove.has(prior.on)) continue;
      if (prior.off.tick <= next.on.tick) continue;
      if (prior.on.tick === next.on.tick) {
        remove.add(prior.on); remove.add(prior.off); removed++; count(dropped, "zeroLengthDropped");
      } else { prior.off.tick = next.on.tick; count(dropped, "overlapTruncated"); }
    }
  }
  if (remove.size) for (const track of tracks) track.events = track.events.filter((event) => !remove.has(event));
  for (const track of tracks) track.events = ordered(track.events);
  return removed;
}

/** ProjectIR to deterministic format-1, 960-PPQ SMF without changing render timing. */
export function projectToSmf(project: ProjectIR, options: { userInstruments?: UserInstrumentKinds; kitMaps?: Readonly<Record<string, Readonly<Record<string, number>>>> } = {}): MidiProjection {
  if (project.ppq !== 960) throw new Music2Error("E_INPUT", "ProjectIR must use 960 PPQ");
  const warnings = (project.warnings ?? []).filter((warning) => warning.startsWith("LAYERS_FLATTENED:"));
  const dropped: Record<string, number> = { drumVariantsDropped: 0, zeroLengthDropped: 0 };
  const conductor: SmfEvent[] = [meta(0, 3, ascii(project.title))];
  if ([...project.title].some((c) => c.codePointAt(0)! < 32 || c.codePointAt(0)! > 126)) warnings.push("TEXT_REPLACED:title");
  for (const meter of project.meter) conductor.push(meta(meter.tick, 0x58, Uint8Array.of(meter.numerator, 2, 24, 8)));
  if (project.key) {
    const key = `${project.key.tonic} ${project.key.mode}`;
    const mapped = keyToSmf(key);
    if (mapped) conductor.push(meta(0, 0x59, Uint8Array.of(mapped.sf & 255, mapped.mi)));
    else warnings.push(`KEY_SIGNATURE_OMITTED:${key}`);
  }
  for (const tempo of project.tempo) {
    const micros = Math.round(60_000_000 / tempo.bpm);
    if (micros < 1 || micros > 0xffffff) throw new Music2Error("E_CAPABILITY", "tempo exceeds SMF range");
    conductor.push(meta(tempo.tick, 0x51, Uint8Array.of(micros >> 16, micros >> 8, micros)));
  }
  for (const marker of project.markers) conductor.push(meta(marker.tick, 6, ascii(marker.name)));
  const tracks: SmfTrack[] = [{ events: ordered(conductor), endTick: project.lengthTicks, sourceIndex: 0 }];
  const channels: Record<string, number> = {}; let melodicIndex = 0; let drumMix: { gain: number; pan: number } | undefined;
  let notes = 0;
  for (const track of project.tracks) {
    for (const lane of track.automation) if (track.type === "audio" || (lane.target !== "gain" && lane.target !== "pan"))
      warnings.push(midiAutomationOmittedWarning(track.id, lane));
    if (track.type === "audio") { count(dropped, "audioTracksDropped"); warnings.push(`AUDIO_TRACK_DROPPED:${track.id}`); continue; }
    const id = instrumentId(track);
    const kind = track.instrument.kind === "user" ?
      (options.userInstruments && Object.hasOwn(options.userInstruments, track.instrument.id) ?
        options.userInstruments[track.instrument.id] : undefined) : track.instrument.kind;
    if (!kind) throw new Music2Error("E_CAPABILITY", `user instrument ${track.instrument.kind === "user" ? track.instrument.id : id} is not imported`);
    if (track.instrument.kind === "user" && kind === "sfz" && track.type !== "notes")
      throw new Music2Error("E_SCHEMA", `user SFZ ${track.instrument.id} requires notes track`);
    if (track.instrument.kind === "lib" || track.instrument.kind === "user") warnings.push(`MIDI_SOUND_NOT_PORTABLE:${track.id}:${id}`);
    if (track.instrument.kind === "voice" && Object.keys(track.instrument.params).length > 0) {
      count(dropped, "voiceParamsDropped"); warnings.push(`VOICE_PARAMS_DROPPED:${track.id}`);
    }
    const drum = track.type === "drums" || id === "sfx" || kind === "kit";
    const channel = drum ? 9 : melodic[melodicIndex++ % melodic.length]!;
    channels[track.id] = channel + 1;
    if (!drum && melodicIndex > melodic.length) { warnings.push(`CHANNEL_REUSED:${track.id}`); warnings.push(`DAW_CHANNEL_MERGE:${track.id}`); }
    if (drum && drumMix) warnings.push(`DAW_CHANNEL_MERGE:${track.id}`);
    const events: SmfEvent[] = [meta(0, 3, ascii(track.id)), meta(0, 1, ascii(`music2:${id}`))];
    if ([...id].some((c) => c.codePointAt(0)! < 32 || c.codePointAt(0)! > 126))
      warnings.push(`TEXT_REPLACED:${track.id}.instrument`);
    if (!drum) {
      const program = programForInstrument(id);
      if (program !== undefined) events.push({ tick: 0, kind: "program", channel, value: program });
      else warnings.push(`PROGRAM_FALLBACK:${track.id}`);
    }
    const gainLane = track.automation.find((lane) => lane.target === "gain");
    const panLane = track.automation.find((lane) => lane.target === "pan");
    const gain = gainLane?.points[0]?.value ?? track.gainDb;
    const pan = panLane?.points[0]?.value ?? track.pan;
    if (!drum || !drumMix) {
      const clipped = gainCcClippedWarning(track.id, gainLane ?? gain);
      if (clipped) warnings.push(clipped);
      for (const cc of gainLane ? laneToCcEvents(gainLane, project.lengthTicks) : [{ tick: 0, controller: 7 as const, value: gainDbToCc7(gain) }])
        events.push({ ...cc, kind: "cc", channel });
      for (const cc of panLane ? laneToCcEvents(panLane, project.lengthTicks) : [{ tick: 0, controller: 10 as const, value: panToCc10(pan) }])
        events.push({ ...cc, kind: "cc", channel });
    } else {
      if (drumMix.gain !== gain || drumMix.pan !== pan || gainLane || panLane) warnings.push(`DRUM_MIX_LOSS:${track.id}`);
      if (gainLane) warnings.push(midiAutomationOmittedWarning(track.id, gainLane));
      if (panLane) warnings.push(midiAutomationOmittedWarning(track.id, panLane));
    }
    if (drum && !drumMix) drumMix = { gain, pan };
    let kit: Record<string, number> | undefined;
    if (kind === "kit") {
      const names = [...new Set(track.notes.flatMap((note) => note.sample ? [note.sample.name] : []))];
      const supplied = options.kitMaps?.[track.id];
      const relevant = Object.fromEntries(names.filter((name) => supplied?.[name] !== undefined)
        .map((name) => [name, supplied![name]!]));
      const mapping = kitMidiMap(names, relevant);
      kit = mapping.byName;
      warnings.push(...mapping.warnings.map((message) => `${message}:${track.id}`));
    }
    if (id === "sfx") warnings.push(`SFX_PRIVATE_NOTES:${track.id}`);
    notes += addNotes(track, channel, kit, events, dropped, warnings);
    if (track.inserts.length) { count(dropped, "insertsDropped"); warnings.push(`INSERTS_DROPPED:${track.id}`); }
    if (track.duck) { count(dropped, "ducksDropped"); warnings.push(`DUCK_DROPPED:${track.id}`); }
    if (track.sends.reverb || track.sends.delay) { count(dropped, "sendsDropped"); warnings.push(`SENDS_DROPPED:${track.id}`); }
    tracks.push({ events: ordered(events), endTick: project.lengthTicks, sourceIndex: tracks.length });
  }
  notes -= clipSharedChannels(tracks, dropped);
  if (project.quantization.inexact > 0) warnings.push(`QUANTIZED_PATTERN_EVENTS: inexact=${project.quantization.inexact}, maxErrorTicks=${project.quantization.maxErrorTicks}`);
  if (project.buses.reverb || project.buses.delay) { count(dropped, "busesDropped"); warnings.push("BUSES_DROPPED"); }
  if (project.master.inserts.length) { count(dropped, "masterInsertsDropped"); warnings.push("MASTER_INSERTS_DROPPED"); }
  if (project.master.gainDb !== 0 || project.master.ceilingDb !== -1 || project.master.targetLufs !== null) {
    count(dropped, "masterMixDropped"); warnings.push("MASTER_MIX_DROPPED");
  }
  for (const [key, label] of [["drumVariantsDropped", "DRUM_VARIANTS_DROPPED"],
    ["velocityClamped", "VELOCITY_CLAMPED"], ["overlapTruncated", "OVERLAP_TRUNCATED"],
    ["zeroLengthDropped", "ZERO_LENGTH_DROPPED"]] as const) {
    if ((dropped[key] ?? 0) > 0) warnings.push(`${label}:${dropped[key]}`);
  }
  const endTick = Math.max(project.lengthTicks, ...tracks.flatMap((track) => track.events.map((event) => event.tick)));
  for (const track of tracks) track.endTick = endTick;
  return { file: { format: 1, ppq: 960, tracks, warnings: [] }, warnings, notes, channels, dropped };
}
