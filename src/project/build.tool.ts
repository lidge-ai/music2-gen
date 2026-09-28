import { basename, isAbsolute, win32 } from "node:path";
import { barTicks, fractionToTicks, Fraction, Music2Error, PPQ, secondsToTicks } from "../shared/index.ts";
import type { ResolvedAudioTrack, ResolvedSong, ResolvedTrack, TimedEvent, Timeline } from "../song/index.ts";
import type { ProjectAudioTrack, ProjectBus, ProjectIR, ProjectNote, ProjectNoteTrack,
  ProjectPlugin, ProjectSample, ProjectTrackBase } from "./project.schema.ts";

function internal(message: string): never { throw new Music2Error("E_INTERNAL", message); }
function safeTick(value: number): number {
  if (!Number.isSafeInteger(value) || value < 0) internal("tick overflow");
  return value;
}
function parseFraction(value: string): Fraction {
  const match = /^(\d+)(?:\/(\d+))?$/.exec(value);
  if (!match) internal(`invalid cycleBegin: ${value}`);
  return new Fraction(BigInt(match[1]!), BigInt(match[2] ?? "1"));
}
function projectPattern(event: TimedEvent, song: ResolvedSong, secondsPerBar: number, eventIndex: number,
  quantization: ProjectIR["quantization"]): ProjectNote {
  const onset = parseFraction(event.cycleBegin);
  const fractional = onset.sub(Fraction.of(onset.floor()));
  const position = Fraction.of(event.bar).add(fractional);
  const base = fractionToTicks(position, song.meter.numerator);
  const exactSeconds = (event.bar + Number(fractional)) * secondsPerBar;
  let swingSeconds = event.time - exactSeconds;
  if (swingSeconds < 0 && swingSeconds >= -1e-9) swingSeconds = 0;
  if (swingSeconds < 0) internal("negative pattern swing offset");
  const tick = safeTick(base.ticks + secondsToTicks(swingSeconds, song.bpm));
  const errorTicks = Math.abs(event.time * song.bpm * PPQ / 60 - tick);
  if (!Number.isFinite(errorTicks)) internal("invalid quantization error");
  quantization.events++;
  if (!base.exact || errorTicks > 1e-9) quantization.inexact++;
  quantization.maxErrorTicks = Math.max(quantization.maxErrorTicks, errorTicks);
  return { tick, lengthTicks: Math.max(1, secondsToTicks(event.duration, song.bpm)),
    pitch: event.midi, sample: event.sample, velocity: event.velocity, eventIndex,
    source: "pattern", errorTicks };
}
function projectList(event: TimedEvent, track: ResolvedTrack, eventIndex: number,
  byResolvedIndex: Map<number, NonNullable<ResolvedTrack["notes"]>[number]>): ProjectNote {
  // TimedEvent.order for list notes is the resolved (sorted) note index; see timeline-notes.tool.ts.
  const note = byResolvedIndex.get(event.order);
  if (!note) internal(`list note missing for ${track.id} event ${event.order}`);
  return { tick: note.tick, lengthTicks: note.lengthTicks, pitch: note.pitch, sample: note.sample,
    velocity: event.velocity, eventIndex, source: "list", errorTicks: 0 };
}

function projectedNotes(song: ResolvedSong, timeline: Timeline, quantization: ProjectIR["quantization"]): ProjectNote[][] {
  const buckets: ProjectNote[][] = song.tracks.map(() => []);
  const indexed: { note: ProjectNote; time: number }[][] = song.tracks.map(() => []);
  const listLookups = song.tracks.map((track) => new Map(track.notes?.map((note, resolvedIndex) => [resolvedIndex, note])));
  const counts = new Array<number>(song.tracks.length).fill(0);
  for (const event of timeline.events) {
    const track = song.tracks[event.trackIndex];
    if (!track) internal(`timeline track index ${event.trackIndex} is missing`);
    const eventIndex = counts[event.trackIndex]!++;
    const note = track.notes !== undefined ? projectList(event, track, eventIndex, listLookups[event.trackIndex]!) :
      projectPattern(event, song, timeline.secondsPerBar, eventIndex, quantization);
    indexed[event.trackIndex]!.push({ note, time: event.time });
  }
  for (let index = 0; index < song.tracks.length; index++) {
    const track = song.tracks[index]!;
    const entries = indexed[index]!;
    // Timeline is time ordered; stable eventIndex resolves rounded-tick ties.
    entries.sort((a, b) => a.note.tick - b.note.tick || a.note.eventIndex - b.note.eventIndex);
    const laterTicks = Array.from({ length: entries.length }, (): number | undefined => undefined);
    let nextLater: number | undefined;
    for (let i = entries.length - 1; i >= 0; i--) {
      if (i + 1 < entries.length && entries[i + 1]!.note.tick > entries[i]!.note.tick)
        nextLater = entries[i + 1]!.note.tick;
      laterTicks[i] = nextLater;
    }
    for (let i = 0; i < entries.length; i++) {
      const { note, time } = entries[i]!;
      if (track.mono) {
        const next = entries[i + 1];
        if (next && next.note.tick === note.tick && next.time !== time) {
          // Two distinct onsets rounded to one tick: the earlier note cannot have a positive mono length.
          quantization.inexact++;
          continue;
        }
        if (laterTicks[i] !== undefined) note.lengthTicks = Math.min(note.lengthTicks, laterTicks[i]! - note.tick);
      }
      buckets[index]!.push(note);
    }
  }
  return buckets;
}

function projectPlugins(plugins: NonNullable<ResolvedTrack["plugins"]>, trackId: string,
  warnings: string[]): ProjectPlugin[] {
  return plugins.map((plugin) => {
    // Song v1 resolves only id/params. Keep future resolved identifiers without copying host paths.
    const resolved = plugin as ProjectPlugin;
    const ref = resolved.ref;
    const absolute = ref !== undefined && (isAbsolute(ref) || win32.isAbsolute(ref));
    if (absolute) warnings.push(`PLUGIN_REF_BASENAME:${trackId}:${plugin.id}`);
    return { id: plugin.id, ...(resolved.format === undefined ? {} : { format: resolved.format }),
      ...(ref === undefined ? {} : { ref: absolute ? win32.isAbsolute(ref) ? win32.basename(ref) : basename(ref) : ref }),
      ...(plugin.params === undefined ? {} : { params: plugin.params }) };
  });
}
function base(track: ResolvedTrack | ResolvedAudioTrack, index: number, warnings: string[]): ProjectTrackBase {
  return { id: track.id, index, gainDb: track.gain, pan: track.pan, sends: track.sends,
    inserts: track.fx ?? [], duck: track.duck, automation: track.automation ?? [],
    ...("instrument" in track && track.plugins !== undefined ?
      { plugins: projectPlugins(track.plugins, track.id, warnings) } : {}) };
}
function instrument(track: ResolvedTrack): ProjectNoteTrack["instrument"] {
  if (track.instrument.startsWith("kit:")) return { kind: "kit", ref: track.instrument.slice(4) };
  if (track.instrument.startsWith("sfz:")) return { kind: "sfz", ref: track.instrument.slice(4) };
  return { kind: "voice", id: track.instrument, params: track.params };
}
function sampleKey(sample: ProjectSample): string { return `${sample.role}\0${sample.ref}`; }
function bus(song: ResolvedSong, kind: "reverb" | "delay"): ProjectBus | null {
  // A send lane replaces the static send level, so the bus exists when the lane ever rises above zero.
  const active = [...song.tracks, ...(song.audioTracks ?? [])].some((track) => {
    const lane = track.automation?.find((candidate) => candidate.target === `send.${kind}`);
    return lane ? lane.points.some((point) => point.value > 0) : track.sends[kind] > 0;
  });
  const params = song.fx?.[kind] ?? null;
  if (!active && params === null) return null;
  return { kind, legacy: params === null, params };
}

/** Deterministic, filesystem-free projection from the validated song and its full Timeline. */
export function buildProject(song: ResolvedSong, timeline: Timeline): ProjectIR {
  const perBar = barTicks(song.meter.numerator);
  const quantization = { events: 0, inexact: 0, maxErrorTicks: 0 };
  const warnings: string[] = [];
  const notes = projectedNotes(song, timeline, quantization);
  const sampleMap = new Map<string, ProjectSample>();
  const addSample = (sample: ProjectSample): void => { sampleMap.set(sampleKey(sample), sample); };
  const noteTracks: ProjectNoteTrack[] = song.tracks.map((track, index) => {
    const resolvedInstrument = instrument(track);
    if (resolvedInstrument.kind === "kit" || resolvedInstrument.kind === "sfz")
      addSample({ role: resolvedInstrument.kind, ref: resolvedInstrument.ref });
    return { ...base(track, index, warnings), type: track.kind, instrument: resolvedInstrument,
      mono: track.mono, notes: notes[index]! };
  });
  for (const track of song.audioTracks ?? []) for (const clip of track.clips)
    addSample({ role: "clip", ref: clip.file });
  const samples = [...sampleMap.values()].sort((a, b) =>
    a.role < b.role ? -1 : a.role > b.role ? 1 : a.ref < b.ref ? -1 : a.ref > b.ref ? 1 : 0);
  const sampleIndices = new Map(samples.map((sample, index) => [sampleKey(sample), index]));
  const audioTracks: ProjectAudioTrack[] = (song.audioTracks ?? []).map((track, audioIndex) => ({
    ...base(track, song.tracks.length + audioIndex, warnings), type: "audio",
    clips: track.clips.map((clip) => ({ tick: clip.tick, lengthTicks: clip.lengthTicks,
      sample: sampleIndices.get(sampleKey({ role: "clip", ref: clip.file }))!,
      offsetSeconds: clip.offsetSeconds, gainDb: clip.gainDb, pitchSemitones: clip.pitchSemitones,
      stretch: clip.stretch, fadeInSeconds: clip.fadeInSeconds, fadeOutSeconds: clip.fadeOutSeconds })),
  }));
  const keyMatch = song.key === null ? null : /^(.+) (major|minor)$/.exec(song.key);
  if (song.key !== null && !keyMatch) internal(`invalid resolved key: ${song.key}`);
  return {
    version: 1, ppq: PPQ, title: song.title, seed: song.seed, sampleRate: song.sampleRate,
    tailSeconds: song.tailSeconds, loop: song.loop, lengthTicks: safeTick(timeline.bars * perBar),
    tempo: [{ tick: 0, bpm: song.bpm }],
    meter: [{ tick: 0, numerator: song.meter.numerator, denominator: 4 }],
    key: keyMatch ? { tonic: keyMatch[1]!, mode: keyMatch[2] as "major" | "minor" } : null,
    markers: timeline.placements.map((placement) => ({
      tick: safeTick(placement.startBar * perBar), lengthTicks: safeTick(placement.bars * perBar),
      name: placement.occurrence === 0 ? placement.section : `${placement.section} (${placement.occurrence + 1})`,
      section: placement.section, role: placement.role, ordinal: placement.ordinal, occurrence: placement.occurrence,
    })),
    tracks: [...noteTracks, ...audioTracks],
    buses: { reverb: bus(song, "reverb"), delay: bus(song, "delay") },
    master: { gainDb: song.master.gainDb, ceilingDb: song.master.ceilingDb,
      targetLufs: song.master.targetLufs, inserts: song.master.fx },
    samples, quantization, ...(warnings.length ? { warnings } : {}),
  };
}
