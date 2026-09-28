import { Music2Error } from "../shared/errors.tool.ts";
import { assertWritableSmf, MAX_VLQ, type SmfEvent, type SmfFile } from "./smf.schema.ts";
import { writeVlq } from "./vlq.tool.ts";

const TEXT_META = new Set([0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07]);
const MAX_CHUNK = 0xffff_ffff;

function rank(event: SmfEvent): number {
  if (event.kind === "meta") {
    const order: Record<number, number> = { 3: 0, 0x58: 1, 0x59: 2, 0x51: 3, 6: 4, 7: 5 };
    return order[event.type] ?? 6;
  }
  switch (event.kind) {
    case "program": return 10;
    case "cc": return 11;
    case "pitchBend": return 12;
    case "noteOff": return 13;
    case "noteOn": return 14;
    default: return 12;
  }
}

function orderEvents(events: SmfEvent[]): SmfEvent[] {
  return events.map((event, index) => ({ event, index })).sort((a, b) => {
    const first = a.event;
    const second = b.event;
    if (first.tick !== second.tick) return first.tick - second.tick;
    const byRank = rank(first) - rank(second);
    if (byRank) return byRank;
    if (first.kind === "cc" && second.kind === "cc" && first.controller !== second.controller) {
      return first.controller - second.controller;
    }
    if ((first.kind === "noteOn" || first.kind === "noteOff") && first.kind === second.kind &&
        (second.kind === "noteOn" || second.kind === "noteOff") && first.key !== second.key) return first.key - second.key;
    return a.index - b.index;
  }).map(({ event }) => event);
}

function appendVlq(out: number[], value: number): void {
  out.push(...writeVlq(value));
}

function appendEvent(out: number[], event: SmfEvent): void {
  if (event.kind === "meta" || event.kind === "sysex") {
    const data = event.data;
    const payload = event.kind === "meta" && TEXT_META.has(event.type)
      ? Uint8Array.from(Array.from(new TextDecoder().decode(data), (char) => {
        const code = char.codePointAt(0)!;
        return code >= 32 && code <= 126 ? code : 63;
      }))
      : data;
    if (event.kind === "meta" && TEXT_META.has(event.type) && payload.length > 255) {
      throw new Music2Error("E_INPUT", "SMF text meta exceeds 255 ASCII bytes");
    }
    if (event.kind === "meta") out.push(0xff, event.type);
    else out.push(event.status);
    appendVlq(out, payload.length);
    for (const byte of payload) out.push(byte);
    return;
  }
  const channel = event.channel;
  switch (event.kind) {
    case "noteOff": out.push(0x80 | channel, event.key, event.velocity); break;
    case "noteOn": out.push(0x90 | channel, event.key, event.velocity); break;
    case "polyPressure": out.push(0xa0 | channel, event.key, event.value); break;
    case "cc": out.push(0xb0 | channel, event.controller, event.value); break;
    case "program": out.push(0xc0 | channel, event.value); break;
    case "channelPressure": out.push(0xd0 | channel, event.value); break;
    case "pitchBend": out.push(0xe0 | channel, event.value14 & 0x7f, event.value14 >> 7); break;
  }
}

function appendU32(out: number[], value: number): void {
  out.push((value >>> 24) & 255, (value >>> 16) & 255, (value >>> 8) & 255, value & 255);
}

export function writeSmf(file: SmfFile): Uint8Array {
  assertWritableSmf(file);
  const out: number[] = [0x4d, 0x54, 0x68, 0x64, 0, 0, 0, 6, 0, 1, file.tracks.length >> 8, file.tracks.length & 255, 3, 0xc0];
  for (const track of file.tracks) {
    const payload: number[] = [];
    let tick = 0;
    for (const event of orderEvents(track.events)) {
      const delta = event.tick - tick;
      if (delta > MAX_VLQ) throw new Music2Error("E_INPUT", "SMF event delta exceeds VLQ limit");
      appendVlq(payload, delta);
      appendEvent(payload, event);
      tick = event.tick;
    }
    const eotDelta = Math.max(track.endTick, tick) - tick;
    if (eotDelta > MAX_VLQ) throw new Music2Error("E_INPUT", "SMF EOT delta exceeds VLQ limit");
    appendVlq(payload, eotDelta);
    payload.push(0xff, 0x2f, 0);
    if (payload.length > MAX_CHUNK) throw new Music2Error("E_INPUT", "SMF track payload exceeds uint32 length");
    out.push(0x4d, 0x54, 0x72, 0x6b);
    appendU32(out, payload.length);
    for (const byte of payload) out.push(byte);
  }
  return Uint8Array.from(out);
}
