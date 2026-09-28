import { Music2Error } from "../shared/index.ts";
import { drumNameFor, instrumentForProgram, sfxNameFor, smfToKey, GM_PROGRAMS } from "./gm.tool.ts";
import type { SmfFile, SmfTrack } from "./smf.schema.ts";

export interface ImportedSong {
  version: 1; title: string; bpm: number; meter: { numerator: number; denominator: 4 }; key?: string;
  tracks: { id: string; kind: "notes" | "drums"; instrument: string;
    notes: ({ start: number; length: number; pitch: number; velocity: number } |
      { start: number; length: number; sample: string; velocity: number })[];
    gain?: number; pan?: number; mono?: boolean }[];
  sections: { id: string; bars: number }[];
  arrangement: { section: string; repeats?: number }[];
}
export interface MidiImport { song: ImportedSong; warnings: string[]; dropped: Record<string, number>; notes: number; bars: number }
interface Paired { start: number; end: number; key: number; velocity: number; source: number; event: number }
interface Group { track: SmfTrack; channel: number; name: string; identity: string | undefined;
  program?: number; cc7?: number; cc10?: number; pairs: Paired[] }
const text = (bytes: Uint8Array): string => String.fromCharCode(...bytes);
const fail = (message: string): never => { throw new Music2Error("E_CAPABILITY", message); };
const count = (dropped: Record<string, number>, key: string): void => { dropped[key] = (dropped[key] ?? 0) + 1; };
const clamp = (x: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, x));
const voices = new Set([...Object.keys(GM_PROGRAMS), "sfx", "drums"]);
const drumVoices = new Set(["drums", "sfx"]);
function safeId(value: string, fallback: string, used: Set<string>): string {
  let base = value.toLowerCase().replace(/[^a-z0-9_-]+/g, "_").replace(/^_+|_+$/g, "");
  if (!base) base = fallback;
  if (!/^[a-z]/.test(base)) base = `track_${base}`;
  base = base.slice(0, 32);
  let result = base; let suffix = 2;
  while (used.has(result)) { const end = `_${suffix++}`; result = base.slice(0, 32 - end.length) + end; }
  used.add(result); return result;
}
function convert(tick: number, ppq: number, quant: { count: number; max: number }): number {
  const exact = tick * 960 / ppq;
  if (!Number.isSafeInteger(tick) || !Number.isFinite(exact) || exact > Number.MAX_SAFE_INTEGER) fail("tick exceeds Song range");
  const result = Math.round(exact); const error = Math.abs(result - exact);
  if (error > 1e-9) { quant.count++; quant.max = Math.max(quant.max, error); }
  return result;
}
function collectMeta(file: SmfFile, type: number, warnings: string[]): { tick: number; data: Uint8Array }[] {
  const primary = file.tracks[0]?.events.filter((e): e is Extract<typeof e, { kind: "meta" }> => e.kind === "meta" && e.type === type)
    .map((e) => ({ tick: e.tick, data: e.data })) ?? [];
  if (primary.length || file.format === 0) return primary;
  const others = file.tracks.slice(1).flatMap((track) => track.events.filter((e): e is Extract<typeof e, { kind: "meta" }> => e.kind === "meta" && e.type === type)
    .map((e) => ({ tick: e.tick, data: e.data })));
  if (others.length) warnings.push(`NONCONDUCTOR_META:${type}`);
  return others.sort((a, b) => a.tick - b.tick);
}
function pair(file: SmfFile, warnings: string[], dropped: Record<string, number>): Group[] {
  const groups: Group[] = [];
  for (const track of file.tracks) {
    const name = track.events.find((e) => e.kind === "meta" && e.type === 3);
    const identity = track.events.find((e) => e.kind === "meta" && e.type === 1 && text(e.data).startsWith("music2:"));
    const byChannel = new Map<number, Group>();
    const open = new Map<string, { tick: number; velocity: number; event: number }[]>();
    for (const [index, event] of track.events.entries()) {
      if (!("channel" in event)) continue;
      let group = byChannel.get(event.channel);
      if (!group) {
        group = { track, channel: event.channel, name: name?.kind === "meta" ? text(name.data) : "",
          identity: identity?.kind === "meta" ? text(identity.data).slice(7) : undefined, pairs: [] };
        byChannel.set(event.channel, group); groups.push(group);
      }
      if (event.kind === "program" && event.tick === 0) group.program ??= event.value;
      if (event.kind === "cc") {
        if (event.tick === 0 && event.controller === 7) group.cc7 ??= event.value;
        if (event.tick === 0 && event.controller === 10) group.cc10 ??= event.value;
        if (event.tick > 0 && (event.controller === 7 || event.controller === 10)) {
          warnings.push(`CC_AUTOMATION_DROPPED:${group.name || track.sourceIndex}.${event.controller}@${event.tick}`);
          count(dropped, "ccAutomationDropped");
        }
      }
      if (event.kind !== "noteOn" && event.kind !== "noteOff") continue;
      const key = `${event.channel}:${event.key}`;
      const queue = open.get(key) ?? [];
      if (event.kind === "noteOn" && event.velocity > 0) {
        queue.push({ tick: event.tick, velocity: event.velocity, event: index }); open.set(key, queue);
      } else {
        const onset = queue.shift();
        if (!onset) { warnings.push(`UNMATCHED_NOTE_OFF:${track.sourceIndex}.${event.channel}.${event.key}@${event.tick}`); count(dropped, "unmatchedOffDropped"); }
        else group.pairs.push({ start: onset.tick, end: event.tick, key: event.key,
          velocity: onset.velocity, source: track.sourceIndex, event: onset.event });
      }
    }
    for (const [key, queue] of open) for (const onset of queue) {
      const [channel, pitch] = key.split(":").map(Number);
      const group = byChannel.get(channel!);
      if (group) group.pairs.push({ start: onset.tick, end: track.endTick, key: pitch!, velocity: onset.velocity,
        source: track.sourceIndex, event: onset.event });
      warnings.push(`UNTERMINATED_NOTE:${track.sourceIndex}.${key}`);
    }
  }
  return groups;
}
function sections(markers: { tick: number; data: Uint8Array }[], bars: number, barTicks: number,
  warnings: string[]): Pick<ImportedSong, "sections" | "arrangement"> {
  const locations = markers.map((m) => ({ tick: m.tick, name: text(m.data) })).sort((a, b) => a.tick - b.tick);
  const invalid = locations.some((m, i) => m.tick < 0 || m.tick >= bars * barTicks || m.tick % barTicks !== 0 ||
    (i > 0 && m.tick === locations[i - 1]!.tick));
  if (invalid) warnings.push("MARKERS_NOT_SECTIONS");
  if (!invalid && locations.length) {
    if (locations[0]!.tick !== 0) locations.unshift({ tick: 0, name: "part_1" });
    const used = new Set<string>(); const parts: { id: string; bars: number }[] = [];
    for (let i = 0; i < locations.length; i++) {
      const length = ((locations[i + 1]?.tick ?? bars * barTicks) - locations[i]!.tick) / barTicks;
      if (length < 1 || length > 256 || parts.length >= 64) { warnings.push("MARKERS_NOT_SECTIONS"); break; }
      parts.push({ id: safeId(locations[i]!.name, `part_${i + 1}`, used), bars: length });
    }
    if (parts.length === locations.length) return { sections: parts, arrangement: parts.map((part) => ({ section: part.id })) };
  }
  if (bars <= 256) return { sections: [{ id: "part_1", bars }], arrangement: [{ section: "part_1" }] };
  if (bars > 256 * 64) fail("arrangement exceeds Song capacity");
  const arrangement: { section: string; repeats?: number }[] = [];
  for (let left = bars; left > 0; left -= 64) arrangement.push({ section: "part_1", repeats: Math.min(left, 64) });
  return { sections: [{ id: "part_1", bars: 1 }], arrangement };
}

/** Convert bounded SMF events into Song v1 absolute note lists. */
export function smfToSong(file: SmfFile, options: { title?: string; strict?: boolean;
  kitMaps?: Readonly<Record<string, Readonly<Record<number, string>>>> } = {}): MidiImport {
  const warnings = [...file.warnings]; const dropped: Record<string, number> = {};
  const tempos = collectMeta(file, 0x51, warnings);
  const tempo = tempos[0]?.data;
  const micros = tempo ? (tempo[0]! << 16) | (tempo[1]! << 8) | tempo[2]! : 500000;
  if (micros <= 0) fail("invalid tempo");
  const bpm = Math.round(60_000_000 / micros * 1000) / 1000;
  if (bpm < 40 || bpm > 240) fail("tempo outside Song range");
  if (tempos.length > 1) { if (options.strict) fail("tempo change cannot be represented"); warnings.push("TEMPO_CHANGE_DROPPED"); }
  const meters = collectMeta(file, 0x58, warnings);
  const raw = meters[0]?.data;
  const numerator = raw ? raw[0]! * 4 / (2 ** raw[1]!) : 4;
  if (!Number.isInteger(numerator) || numerator < 2 || numerator > 12) fail("meter cannot be represented");
  if (raw && raw[1] !== 2) warnings.push("METER_REWRITTEN");
  if (meters.length > 1) { if (options.strict) fail("meter change cannot be represented"); warnings.push("METER_CHANGE_DROPPED"); }
  const keys = collectMeta(file, 0x59, warnings);
  let key: string | undefined;
  if (keys.length) {
    const sf = (keys[0]!.data[0]! << 24) >> 24; const mi = keys[0]!.data[1]!;
    if (sf >= -7 && sf <= 7 && (mi === 0 || mi === 1)) key = smfToKey(sf, mi);
    else warnings.push("KEY_SIGNATURE_DROPPED");
    if (keys.length > 1) warnings.push("KEY_CHANGE_DROPPED");
  }
  const groups = pair(file, warnings, dropped);
  if (groups.length > 32) fail("more than 32 Song tracks");
  const quant = { count: 0, max: 0 }; const used = new Set<string>();
  let totalNotes = 0; let furthest = Math.max(...file.tracks.map((t) => t.endTick), 0);
  const tracks: ImportedSong["tracks"] = groups.map((group, index) => {
    const id = safeId(group.name || `track_${index + 1}`, `track_${index + 1}`, used);
    let instrument: string;
    const identity = group.identity;
    if (identity?.startsWith("kit:") && group.channel === 9) {
      instrument = options.kitMaps?.[identity] ? identity : "drums";
      if (instrument === "drums") warnings.push(`KIT_IDENTITY_DROPPED:${id}`);
    } else if (identity && voices.has(identity) &&
        (group.channel === 9 ? drumVoices.has(identity) : !drumVoices.has(identity))) instrument = identity;
    else {
      if (identity) warnings.push(`IDENTITY_DROPPED:${id}`);
      instrument = group.channel === 9 ? "drums" : instrumentForProgram(group.program ?? 0) ?? "piano";
      if (group.channel !== 9 && group.program !== undefined && instrumentForProgram(group.program) === undefined)
        warnings.push(`PROGRAM_FALLBACK:${id}`);
    }
    const drum = group.channel === 9 || instrument === "sfx" || instrument === "drums" || instrument.startsWith("kit:");
    const notes: ImportedSong["tracks"][number]["notes"] = [];
    group.pairs.sort((a, b) => a.start - b.start || a.key - b.key || a.source - b.source || a.event - b.event);
    for (const item of group.pairs) {
      furthest = Math.max(furthest, item.end);
      const startTick = convert(item.start, file.ppq, quant);
      const endTick = convert(item.end, file.ppq, quant);
      const duration = Math.max(1, endTick - startTick);
      if (endTick <= startTick) warnings.push(`ZERO_LENGTH_EXTENDED:${id}@${startTick}`);
      const common = { start: startTick / 960, length: duration / 960, velocity: item.velocity / 127 };
      if (drum) {
        const sample = instrument.startsWith("kit:") ? options.kitMaps?.[instrument]?.[item.key] :
          instrument === "sfx" ? sfxNameFor(item.key) : drumNameFor(item.key);
        if (!sample) { warnings.push(`UNKNOWN_DRUM_NOTE:${id}.${item.key}`); count(dropped, "unknownDrumNotesDropped"); continue; }
        notes.push({ ...common, sample });
      } else notes.push({ ...common, pitch: item.key });
    }
    if (notes.length > 20_000) fail("more than 20000 notes on a track");
    totalNotes += notes.length;
    const result: ImportedSong["tracks"][number] = { id, kind: drum ? "drums" : "notes", instrument, notes };
    if (instrument === "bass" || instrument === "808") result.mono = true;
  if (group.cc7 !== undefined) {
      result.gain = group.cc7 === 0 ? -60 : clamp(40 * Math.log10(group.cc7 / 127), -60, 12);
      if (group.cc7 < 4) warnings.push(`MIDI_CC_CLAMPED:${id}.7@0=${group.cc7}`);
    }
    if (group.cc10 !== undefined) {
      result.pan = clamp((group.cc10 - 64) / 63, -1, 1);
      if (group.cc10 === 0) warnings.push(`MIDI_CC_CLAMPED:${id}.10@0=0`);
    }
    return result;
  });
  if (!tracks.length) tracks.push({ id: "track_1", kind: "notes", instrument: "piano", notes: [] });
  if (quant.count) warnings.push(`IMPORT_QUANTIZED: count=${quant.count}, maxErrorTicks=${quant.max}`);
  const barTicks = numerator * file.ppq;
  const bars = Math.max(1, Math.ceil(furthest / barTicks));
  const markers = collectMeta(file, 6, warnings);
  const structure = sections(markers, bars, barTicks, warnings);
  const conductorName = file.tracks[0]?.events.find((event) => event.kind === "meta" && event.type === 3);
  const name = options.title ?? (conductorName?.kind === "meta" ? text(conductorName.data) : "imported");
  const title = (name || "imported").slice(0, 120);
  return { song: { version: 1, title, bpm, meter: { numerator, denominator: 4 }, ...(key ? { key } : {}),
    tracks, ...structure }, warnings, dropped, notes: totalNotes, bars };
}
