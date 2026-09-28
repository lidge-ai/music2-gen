import { Music2Error } from "../shared/errors.tool.ts";

export const MAX_VLQ = 0x0fff_ffff;
export const MAX_SMF_BYTES = 16 * 1024 * 1024;

export type SmfChannelEvent =
  | { tick: number; kind: "noteOn" | "noteOff"; channel: number; key: number; velocity: number }
  | { tick: number; kind: "cc"; channel: number; controller: number; value: number }
  | { tick: number; kind: "program" | "channelPressure"; channel: number; value: number }
  | { tick: number; kind: "polyPressure"; channel: number; key: number; value: number }
  | { tick: number; kind: "pitchBend"; channel: number; value14: number };

export type SmfEvent = SmfChannelEvent
  | { tick: number; kind: "meta"; type: number; data: Uint8Array }
  | { tick: number; kind: "sysex"; status: 0xf0 | 0xf7; data: Uint8Array };

export interface SmfTrack { events: SmfEvent[]; endTick: number; sourceIndex: number }
export interface SmfFile { format: 0 | 1; ppq: number; tracks: SmfTrack[]; warnings: string[] }
export interface SmfParseDiagnostic { offset: number; track?: number }

function input(message: string): never { throw new Music2Error("E_INPUT", message); }

export function assertByte(value: number, name: string): void {
  if (!Number.isInteger(value) || value < 0 || value > 255) input(`${name} must be a byte`);
}

export function assertDataByte(value: number, name: string): void {
  if (!Number.isInteger(value) || value < 0 || value > 127) input(`${name} must be a MIDI data byte`);
}

export function assertTick(value: number, name: string): void {
  if (!Number.isSafeInteger(value) || value < 0) input(`${name} must be a safe nonnegative tick`);
}

/** Validate a caller-built SMF before writing. The reader performs wire-specific checks itself. */
export function assertWritableSmf(file: SmfFile): void {
  if (file.format !== 1 || file.ppq !== 960) input("SMF writer requires format 1 and PPQ 960");
  if (!Array.isArray(file.tracks) || file.tracks.length < 1 || file.tracks.length > 65535) input("SMF track count must be 1..65535");
  for (const [trackIndex, track] of file.tracks.entries()) {
    assertTick(track.endTick, `track ${trackIndex} endTick`);
    if (!Number.isSafeInteger(track.sourceIndex) || track.sourceIndex < 0) input(`track ${trackIndex} sourceIndex is invalid`);
    if (!Array.isArray(track.events)) input(`track ${trackIndex} events must be an array`);
    for (const event of track.events) {
      assertTick(event.tick, "event tick");
      if (event.kind === "meta") {
        assertDataByte(event.type, "meta type");
        if (event.type === 0x2f) input("EOT is synthesized by the SMF writer");
        if (!(event.data instanceof Uint8Array) || event.data.length > MAX_VLQ) input("meta data is invalid or oversized");
        const required: Record<number, number> = { 0x51: 3, 0x58: 4, 0x59: 2 };
        if (required[event.type] !== undefined && event.data.length !== required[event.type]) {
          input("standard SMF meta data has the wrong length");
        }
      } else if (event.kind === "sysex") {
        if (event.status !== 0xf0 && event.status !== 0xf7) input("SysEx status must be F0 or F7");
        if (!(event.data instanceof Uint8Array) || event.data.length > MAX_VLQ) input("SysEx data is invalid or oversized");
      } else {
        if (!Number.isInteger(event.channel) || event.channel < 0 || event.channel > 15) input("MIDI channel must be 0..15");
        switch (event.kind) {
          case "noteOn": case "noteOff":
            assertDataByte(event.key, "note key"); assertDataByte(event.velocity, "note velocity"); break;
          case "cc":
            assertDataByte(event.controller, "controller"); assertDataByte(event.value, "CC value"); break;
          case "program": case "channelPressure":
            assertDataByte(event.value, "event value"); break;
          case "polyPressure":
            assertDataByte(event.key, "poly pressure key"); assertDataByte(event.value, "poly pressure value"); break;
          case "pitchBend":
            if (!Number.isInteger(event.value14) || event.value14 < 0 || event.value14 > 16383) input("pitch bend must be 0..16383");
            break;
          default: input("unsupported SMF event");
        }
      }
    }
  }
}
