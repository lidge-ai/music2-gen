import type { ProjectIR, ProjectNote, ProjectNoteTrack } from "../../project/index.ts";
import { drumNoteFor, kitMidiMap, sfxNoteFor } from "../../midi/index.ts";
import { element as x, value as v, type XmlNode } from "../xml.tool.ts";
import type { AlsIdAllocator } from "./skeleton.tool.ts";

function loop(end: number): XmlNode {
  return x("Loop", [], [v("LoopStart", 0), v("LoopEnd", end), v("StartRelative", 0),
    v("LoopOn", false), v("OutMarker", end), v("HiddenLoopStart", 0), v("HiddenLoopEnd", end)]);
}
function pitch(track: ProjectNoteTrack, note: ProjectNote, kit: Readonly<Record<string, number>> | null): number | null {
  if (track.type === "notes") return note.pitch;
  if (!note.sample) return null;
  if (kit) return kit[note.sample.name] ?? null;
  if (track.instrument.kind === "voice" && track.instrument.id === "sfx") return sfxNoteFor(note.sample.name) ?? null;
  return drumNoteFor(note.sample.name, note.sample.index) ?? null;
}
function clipDefaults(start: number, end: number, name: string, meter: ProjectIR["meter"][number],
  ids: AlsIdAllocator): XmlNode[] {
  return [v("LomId", 0), v("LomIdView", 0), v("CurrentStart", start), v("CurrentEnd", end), loop(end - start),
    v("Name", name), v("Annotation", ""), v("Color", 0), v("LaunchMode", 0), v("LaunchQuantisation", 0),
    x("TimeSignature", [], [x("TimeSignatures", [], [x("RemoteableTimeSignature", { Id: ids.next() }, [
      v("Numerator", meter.numerator), v("Denominator", meter.denominator), v("Time", 0)])])]),
    x("Envelopes"), x("ScrollerTimePreserver"), x("TimeSelection"), v("Legato", false), v("Ram", false),
    x("GrooveSettings"), v("Disabled", false), v("VelocityAmount", 0), x("FollowAction"), x("Grid"),
    v("FreezeStart", 0), v("FreezeEnd", 0), v("IsWarped", false), v("TakeId", 0), v("IsInKey", false),
    x("ScaleInformation")];
}
export function buildMidiClips(track: ProjectNoteTrack, markers: readonly ProjectIR["markers"][number][],
  meter: ProjectIR["meter"][number], ids: AlsIdAllocator, kitExplicit: Readonly<Record<string, number>> = {}): { clips: XmlNode[]; warnings: string[] } {
  const warnings: string[] = [];
  const kit = track.instrument.kind === "kit" ? kitMidiMap([...new Set(track.notes.flatMap((note) =>
    note.sample ? [note.sample.name] : []))], kitExplicit) : null;
  if (kit) warnings.push(...kit.warnings.map((message) => `${message}:${track.id}`));
  if (track.instrument.kind === "voice" && track.instrument.id === "sfx") warnings.push(`ALS_SFX_PRIVATE_NOTES:${track.id}`);
  const placements = [...markers].sort((a, b) => a.tick - b.tick || a.ordinal - b.ordinal);
  const clips: XmlNode[] = [];
  for (const placement of placements) {
    const notes = track.notes.map((note, index) => ({ note, index, key: pitch(track, note, kit?.byName ?? null) }))
      .filter((item) => item.note.tick >= placement.tick && item.note.tick < placement.tick + placement.lengthTicks);
    if (!notes.length) continue;
    const retained = notes.filter((item): item is typeof item & { key: number } => item.key !== null &&
      Number.isInteger(item.key) && item.key >= 0 && item.key <= 127);
    if (retained.length !== notes.length) warnings.push(`ALS_NOTES_OMITTED:${track.id}=${notes.length - retained.length}`);
    if (!retained.length) continue;
    const endTick = Math.max(placement.tick + placement.lengthTicks,
      ...retained.map(({ note }) => note.tick + note.lengthTicks));
    const sorted = retained.sort((a, b) => a.note.tick - b.note.tick || a.key - b.key || a.index - b.index);
    const nextId = new Map<typeof sorted[number], number>();
    sorted.forEach((item, index) => nextId.set(item, index + 1));
    const keys = [...new Set(sorted.map((item) => item.key))].sort((a, b) => a - b);
    const keyTracks = keys.map((key, index) => x("KeyTrack", { Id: index }, [
      x("Notes", [], sorted.filter((item) => item.key === key).map(({ note }, noteIndex) => {
        const item = sorted.find((candidate) => candidate.note === note)!;
        return x("MidiNoteEvent", [["Time", (note.tick - placement.tick) / 960],
          ["Duration", note.lengthTicks / 960], ["Velocity", Math.max(1, Math.min(127, Math.round(note.velocity * 127)))],
          ["OffVelocity", 64], ["NoteId", nextId.get(item) ?? noteIndex + 1]]);
      })), v("MidiKey", key)]));
    const noteStore = x("Notes", [], [x("KeyTracks", [], keyTracks), x("PerNoteEventStore", [], [x("EventLists")]),
      x("NoteProbabilityGroups"), x("ProbabilityGroupIdGenerator", [], [v("NextId", 1)]),
      x("NoteIdGenerator", [], [v("NextId", sorted.length + 1)])]);
    clips.push(x("MidiClip", { Id: ids.next(), Time: placement.tick / 960 }, [
      ...clipDefaults(placement.tick / 960, endTick / 960, placement.name, meter, ids), noteStore,
      v("BankSelectCoarse", -1), v("BankSelectFine", -1), v("ProgramChange", -1),
      v("NoteEditorFoldInZoom", 0), v("NoteEditorFoldInScroll", 0), v("NoteEditorFoldOutZoom", 0),
      v("NoteEditorFoldOutScroll", 0), v("NoteEditorFoldScaleZoom", 0), v("NoteEditorFoldScaleScroll", 0),
      v("NoteSpellingPreference", 0), v("AccidentalSpellingPreference", 0), v("PreferFlatRootNote", false),
      x("ExpressionGrid"),
    ]));
  }
  if (track.type === "drums" && track.notes.some((note) => note.sample && note.sample.index > 0 && note.sample.name !== "tom"))
    warnings.push(`ALS_DRUM_VARIANTS_LOST:${track.id}`);
  return { clips, warnings };
}
export function buildAudioClip(path: string, frames: number, sampleRate: number, bits: 16 | 24,
  bpm: number, ids: AlsIdAllocator, meter: ProjectIR["meter"][number] = { tick: 0, numerator: 4, denominator: 4 }): XmlNode {
  if (!/^Samples\/Imported\/[a-z0-9_-]+\.wav$/.test(path) || !Number.isSafeInteger(frames) || frames <= 0 ||
    (sampleRate !== 44100 && sampleRate !== 48000) || !Number.isFinite(bpm) || bpm <= 0)
    throw new RangeError("invalid ALS frozen audio reference");
  const seconds = frames / sampleRate; const end = seconds * bpm / 60;
  const fileRef = x("FileRef", [], [v("RelativePathType", 3), v("RelativePath", path), v("Path", ""),
    v("Type", 1), v("LivePackName", ""), v("LivePackId", ""),
    v("OriginalFileSize", 44 + frames * 2 * bits / 8), v("OriginalCrc", 0)]);
  const sample = x("SampleRef", [], [fileRef, v("LastModDate", 0), x("SourceContext"),
    v("SampleUsageHint", 0), v("DefaultDuration", frames), v("DefaultSampleRate", sampleRate)]);
  const children = clipDefaults(0, end, path.slice("Samples/Imported/".length), meter, ids);
  children[4] = loop(end);
  children[23] = v("IsWarped", true);
  return x("AudioClip", { Id: ids.next(), Time: 0 }, [...children, sample, x("Onsets"), v("WarpMode", 0),
    v("GranularityTones", 0), v("GranularityTexture", 0), v("FluctuationTexture", 0),
    v("TransientResolution", 0), v("TransientLoopMode", 0), v("TransientEnvelope", 100),
    v("ComplexProFormants", 100), v("ComplexProEnvelope", 128), v("Sync", true), v("HiQ", true),
    v("Fade", false), x("Fades"), v("PitchCoarse", 0), v("PitchFine", 0), v("SampleVolume", 1),
    x("WarpMarkers", [], [x("WarpMarker", { Id: ids.next(), SecTime: 0, BeatTime: 0 }),
      x("WarpMarker", { Id: ids.next(), SecTime: seconds, BeatTime: end })]),
    x("SavedWarpMarkersForStretched"), v("MarkersGenerated", false), v("IsSongTempoLeader", false)]);
}
