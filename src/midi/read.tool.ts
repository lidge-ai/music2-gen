import { Music2Error } from "../shared/errors.tool.ts";
import { MAX_SMF_BYTES, type SmfEvent, type SmfFile, type SmfTrack } from "./smf.schema.ts";
import { readVlq } from "./vlq.tool.ts";

function fail(message: string, offset: number, track?: number): never {
  throw new Music2Error("E_PARSE", message, { details: track === undefined ? { offset } : { offset, track } });
}

function u16(bytes: Uint8Array, at: number): number {
  return bytes[at]! * 256 + bytes[at + 1]!;
}

function u32(bytes: Uint8Array, at: number): number {
  return bytes[at]! * 0x1_000000 + bytes[at + 1]! * 65536 + bytes[at + 2]! * 256 + bytes[at + 3]!;
}

function vlq(bytes: Uint8Array, at: number, end: number, track: number): { value: number; next: number } {
  try {
    return readVlq(bytes, at, end);
  } catch (error) {
    if (error instanceof Music2Error && error.code === "E_PARSE") {
      const offset = typeof error.details?.["offset"] === "number" ? error.details["offset"] : at;
      fail(error.message, offset, track);
    }
    throw error;
  }
}

function parseTrack(bytes: Uint8Array, start: number, end: number, sourceIndex: number, warnings: string[]): SmfTrack {
  const events: SmfEvent[] = [];
  let at = start;
  let tick = 0;
  let running = -1;
  let ended = false;
  while (at < end) {
    const delta = vlq(bytes, at, end, sourceIndex);
    at = delta.next;
    tick += delta.value;
    if (!Number.isSafeInteger(tick)) fail("SMF tick exceeds safe integer", at, sourceIndex);
    if (at >= end) fail("missing event status", at, sourceIndex);
    const statusAt = at;
    const first = bytes[at]!;
    let status: number;
    if (first < 0x80) {
      if (running < 0) fail("running status without status", at, sourceIndex);
      status = running;
    } else {
      status = first;
      at++;
    }
    if (status === 0xff) {
      running = -1;
      if (at >= end) fail("truncated meta type", at, sourceIndex);
      const type = bytes[at++]!;
      if (type >= 0x80) fail("invalid meta type", at - 1, sourceIndex);
      const length = vlq(bytes, at, end, sourceIndex);
      at = length.next;
      if (length.value > end - at) fail("meta payload exceeds track chunk", at, sourceIndex);
      const payload = bytes.slice(at, at + length.value);
      at += length.value;
      const required: Record<number, number> = { 0x51: 3, 0x58: 4, 0x59: 2 };
      if (length.value < (required[type] ?? 0)) fail("short standard meta payload", statusAt, sourceIndex);
      if (type === 0x2f) {
        if (length.value !== 0) fail("invalid EOT payload", statusAt, sourceIndex);
        if (at !== end) fail("bytes after EOT", at, sourceIndex);
        ended = true;
        break;
      }
      const standardLength = required[type];
      events.push({ tick, kind: "meta", type, data: standardLength === undefined ? payload : payload.slice(0, standardLength) });
      continue;
    }
    if (status === 0xf0 || status === 0xf7) {
      running = -1;
      const length = vlq(bytes, at, end, sourceIndex);
      at = length.next;
      if (length.value > end - at) fail("SysEx payload exceeds track chunk", at, sourceIndex);
      events.push({ tick, kind: "sysex", status, data: bytes.slice(at, at + length.value) });
      at += length.value;
      continue;
    }
    if (status < 0x80 || status > 0xef) fail("unsupported MIDI status", statusAt, sourceIndex);
    running = status;
    const kind = status >> 4;
    const count = kind === 0xc || kind === 0xd ? 1 : 2;
    if (at + count > end) fail("truncated MIDI event", at, sourceIndex);
    const a = bytes[at]!;
    const b = count === 2 ? bytes[at + 1]! : 0;
    if (a >= 0x80) fail("invalid MIDI data byte", at, sourceIndex);
    if (count === 2 && b >= 0x80) fail("invalid MIDI data byte", at + 1, sourceIndex);
    at += count;
    const channel = status & 15;
    switch (kind) {
      case 0x8: events.push({ tick, kind: "noteOff", channel, key: a, velocity: b }); break;
      case 0x9: events.push({ tick, kind: b === 0 ? "noteOff" : "noteOn", channel, key: a, velocity: b }); break;
      case 0xa: events.push({ tick, kind: "polyPressure", channel, key: a, value: b }); break;
      case 0xb: events.push({ tick, kind: "cc", channel, controller: a, value: b }); break;
      case 0xc: events.push({ tick, kind: "program", channel, value: a }); break;
      case 0xd: events.push({ tick, kind: "channelPressure", channel, value: a }); break;
      case 0xe: events.push({ tick, kind: "pitchBend", channel, value14: a | (b << 7) }); break;
    }
  }
  if (!ended) warnings.push(`MISSING_EOT:track=${sourceIndex}`);
  return { events, endTick: tick, sourceIndex };
}

export function readSmf(bytes: Uint8Array): SmfFile {
  if (!(bytes instanceof Uint8Array)) throw new Music2Error("E_INPUT", "SMF input must be bytes");
  if (bytes.length > MAX_SMF_BYTES) throw new Music2Error("E_INPUT", "SMF input exceeds 16 MiB");
  if (bytes.length < 14) fail("truncated SMF header", bytes.length);
  if (String.fromCharCode(...bytes.subarray(0, 4)) !== "MThd") fail("missing MThd chunk", 0);
  const headerLength = u32(bytes, 4);
  if (headerLength < 6) fail("MThd payload shorter than six bytes", 4);
  if (headerLength > bytes.length - 8) fail("MThd payload exceeds file", 8);
  const format = u16(bytes, 8);
  const declaredTracks = u16(bytes, 10);
  const division = u16(bytes, 12);
  if (format === 2) throw new Music2Error("E_CAPABILITY", "SMF format 2 is unsupported");
  if (format !== 0 && format !== 1) fail("invalid SMF format", 8);
  if ((division & 0x8000) !== 0) throw new Music2Error("E_CAPABILITY", "SMPTE division is unsupported");
  if (division === 0) fail("PPQ division must be 1..32767", 12);
  if (format === 0 && declaredTracks !== 1) fail("format 0 must declare one track", 10);
  const tracks: SmfTrack[] = [];
  const warnings: string[] = [];
  let at = 8 + headerLength;
  while (at < bytes.length) {
    if (bytes.length - at < 8) fail("truncated chunk header", at);
    const id = String.fromCharCode(...bytes.subarray(at, at + 4));
    const length = u32(bytes, at + 4);
    at += 8;
    if (length > bytes.length - at) fail("chunk payload exceeds file", at);
    const end = at + length;
    if (id === "MTrk") tracks.push(parseTrack(bytes, at, end, tracks.length, warnings));
    at = end;
  }
  if (tracks.length !== declaredTracks) fail("MTrk count does not match MThd", 10);
  return { format, ppq: division, tracks, warnings };
}
