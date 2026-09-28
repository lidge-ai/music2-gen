import type { StereoBuffer } from "../audio-io/buffer.schema.ts";

/** Symbol metadata preserves include-expanded warning order without entering JSON diagnostics. */
export const SFZ_SOURCE_ORDER = Symbol("sfz-source-order");
export interface SfzWarning { file: string; line: number; opcode?: string; message: string; [SFZ_SOURCE_ORDER]?: number }
export interface SfzSource { file: string; line: number; [SFZ_SOURCE_ORDER]?: number }
export function sfzWarning(source: SfzSource, opcode: string, message: string): SfzWarning {
  const warning: SfzWarning = { file: source.file, line: source.line, opcode, message };
  if (source[SFZ_SOURCE_ORDER] !== undefined) Object.defineProperty(warning, SFZ_SOURCE_ORDER, { value: source[SFZ_SOURCE_ORDER] });
  return warning;
}
export interface SfzControl { defaultPath: string; noteOffset: number; octaveOffset: number }
export interface SfzRegion {
  sample: string; source: SfzSource; control: SfzControl;
  key: [number, number]; velocity: [number, number];
  pitchKeycenter: number | "sample"; pitchKeytrack: number; tune: number; transpose: number;
  volume: number; amplitude: number; pan: number; offset: number; end: number | null;
  loopMode: "no_loop" | "one_shot" | "loop_continuous" | "loop_sustain" | null;
  loopStart: number | null; loopEnd: number | null;
  trigger: "attack" | "release" | "release_key" | "first" | "legato";
  ampeg: { delay: number; start: number; attack: number; hold: number; decay: number; sustain: number; release: number };
  ampVeltrack: number; ampVelcurve: ReadonlyMap<number, number>;
  group: number; offBy: number; offMode: "fast" | "normal"; rtDecay: number;
  seqLength: number; seqPosition: number; lorand: number; hirand: number;
}
export interface SfzInstrument { regions: readonly SfzRegion[]; warnings: readonly SfzWarning[] }
export interface SfzEvent { midi: number; velocity: number; startFrame: number; gateFrames: number; stopFrame: number; eventIndex: number; seed: number }
export interface SfzVoice {
  regionIndex: number; key: number; velocity: number; startFrame: number;
  releaseFrame: number | null; sourcePosition: number;
  /** Internal note-off/choke bookkeeping stays invocation-local. */
  fastOffFrame?: number; heldFrames?: number; choked?: boolean;
  stopFrame?: number; eventIndex?: number;
}
export interface SfzSelectionState {
  counters: Map<string, number>; heldKeys: Set<number>; active: SfzVoice[];
  held?: Map<number, { eventIndex: number; velocity: number; startFrame: number; positions: Map<string, number> }[]>;
}
export interface SfzSmpl { unityNote: number | null; pitchFraction: number; loop: { start: number; end: number } | null }
export interface LoadedSfz {
  instrument: SfzInstrument; samples: ReadonlyMap<string, StereoBuffer>; smpl: ReadonlyMap<string, SfzSmpl>;
}

export type SfzValueKind = "number" | "integer" | "note" | "choice" | "sample" | "keycenter";
export interface SfzOpcodeSpec { kind: SfzValueKind; min?: number; max?: number; choices?: readonly string[] }
const number = (min: number, max: number): SfzOpcodeSpec => ({ kind: "number", min, max });
const integer = (min: number, max: number): SfzOpcodeSpec => ({ kind: "integer", min, max });
const note: SfzOpcodeSpec = { kind: "note", min: 0, max: 127 };
const u32 = integer(0, 0xffffffff);
export const SFZ_OPCODES: Readonly<Record<string, SfzOpcodeSpec>> = {
  sample: { kind: "sample" }, key: note, lokey: note, hikey: note,
  lovel: integer(1, 127), hivel: integer(1, 127),
  pitch_keycenter: { kind: "keycenter" }, pitch_keytrack: integer(-1200, 1200),
  tune: number(-100, 100), transpose: integer(-127, 127),
  volume: number(-144, 6), amplitude: number(0, 100), pan: number(-100, 100),
  offset: u32, end: integer(-1, 0xffffffff), loop_start: u32, loop_end: u32,
  loop_mode: { kind: "choice", choices: ["no_loop", "one_shot", "loop_continuous", "loop_sustain"] },
  trigger: { kind: "choice", choices: ["attack", "release", "release_key", "first", "legato"] },
  ampeg_delay: number(0, 100), ampeg_start: number(0, 100), ampeg_attack: number(0, 100),
  ampeg_hold: number(0, 100), ampeg_decay: number(0, 100), ampeg_sustain: number(0, 100),
  ampeg_release: number(0, 100), amp_veltrack: number(-100, 100),
  group: integer(-2147483648, 2147483647), off_by: integer(-2147483648, 2147483647),
  off_mode: { kind: "choice", choices: ["fast", "normal"] }, rt_decay: number(0, 200),
  seq_length: integer(1, 100), seq_position: integer(1, 100),
  lorand: number(0, 1), hirand: number(0, 1),
  default_path: { kind: "sample" }, note_offset: integer(-127, 127), octave_offset: integer(-10, 10),
};
export const SFZ_ALIASES: Readonly<Record<string, string>> = {
  pitch: "tune", polyphony_group: "group", loopmode: "loop_mode",
  loopstart: "loop_start", loopend: "loop_end", offby: "off_by",
};
