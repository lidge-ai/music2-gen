import type { ResolvedInsert, ResolvedLane, ResolvedSong, ResolvedStretch, Section } from "../song/index.ts";

export interface ProjectIR {
  version: 1; ppq: 960; title: string; seed: number; sampleRate: 44100 | 48000;
  tailSeconds: number; loop: boolean; lengthTicks: number;
  tempo: { tick: number; bpm: number }[];
  meter: { tick: number; numerator: number; denominator: 4 }[];
  key: { tonic: string; mode: "major" | "minor" } | null;
  markers: ProjectMarker[]; tracks: ProjectTrack[];
  buses: { reverb: ProjectBus | null; delay: ProjectBus | null };
  master: { gainDb: number; ceilingDb: number; targetLufs: number | null; inserts: ResolvedInsert[] };
  samples: ProjectSample[];
  quantization: { events: number; inexact: number; maxErrorTicks: number };
  warnings?: string[];
}
export interface ProjectMarker {
  tick: number; lengthTicks: number; name: string; section: string;
  role: Section["role"] | null; ordinal: number; occurrence: number;
}
export interface ProjectBus {
  kind: "reverb" | "delay"; legacy: boolean;
  params: NonNullable<ResolvedSong["fx"]>["reverb"] | NonNullable<ResolvedSong["fx"]>["delay"];
}
export interface ProjectTrackBase {
  id: string; index: number; gainDb: number; pan: number;
  sends: { reverb: number; delay: number }; inserts: ResolvedInsert[];
  duck: { by: string; amount: number; releaseMs: number } | null; automation: ResolvedLane[];
  plugins?: ProjectPlugin[];
}
export interface ProjectPlugin {
  id: string; format?: string; ref?: string;
  params?: Readonly<Record<string, number | string | boolean>>;
}
export type ProjectInstrument =
  | { kind: "voice"; id: string; params: Record<string, number> }
  | { kind: "kit"; ref: string }
  | { kind: "sfz"; ref: string }
  | { kind: "lib"; id: string }
  | { kind: "user"; id: string };
export interface ProjectNoteTrack extends ProjectTrackBase {
  type: "notes" | "drums"; instrument: ProjectInstrument; mono: boolean; notes: ProjectNote[];
}
export interface ProjectAudioTrack extends ProjectTrackBase { type: "audio"; clips: ProjectClip[] }
export type ProjectTrack = ProjectNoteTrack | ProjectAudioTrack;
export interface ProjectNote {
  tick: number; lengthTicks: number; pitch: number | null; sample: { name: string; index: number } | null;
  velocity: number; eventIndex: number; source: "pattern" | "list"; errorTicks: number;
}
export interface ProjectClip {
  tick: number; lengthTicks: number; sample: number; offsetSeconds: number; gainDb: number;
  pitchSemitones: number; stretch: ResolvedStretch; fadeInSeconds: number; fadeOutSeconds: number;
}
export interface ProjectSample { ref: string; role: "clip" | "kit" | "sfz" }
