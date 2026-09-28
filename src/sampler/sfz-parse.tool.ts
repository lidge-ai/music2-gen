import { readFile } from "node:fs/promises";
import { relative } from "node:path";
import { Music2Error, confinedRealpath } from "../shared/index.ts";
import { SFZ_ALIASES, SFZ_OPCODES, SFZ_SOURCE_ORDER, sfzWarning } from "./sfz.schema.ts";
import type { SfzControl, SfzInstrument, SfzOpcodeSpec, SfzRegion, SfzSource, SfzWarning } from "./sfz.schema.ts";

type Entry = { value: string | number; source: SfzSource };
type Scope = Map<string, Entry>;
const HEADERS = new Set(["control", "global", "master", "group", "region"]);
const CONDITIONAL = /^(?:lo|hi|sw_|xfin|xfout|on_locc|on_hicc|trigger_)/;
const MAX_INCLUDE_DEPTH = 32;

function parseError(source: SfzSource, opcode: string, message: string): never {
  throw new Music2Error("E_PARSE", message, { details: { ...source, opcode } });
}

function noteNumber(raw: string, source: SfzSource, opcode: string): number {
  if (/^\d+$/.test(raw)) return Number(raw);
  const match = /^([A-Ga-g])([#b]?)(-?\d+)$/.exec(raw);
  if (!match) parseError(source, opcode, `invalid note: ${raw}`);
  const letters: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  return (Number(match[3]) + 1) * 12 + (letters[match[1]!.toUpperCase()] ?? 0)
    + (match[2] === "#" ? 1 : match[2] === "b" ? -1 : 0);
}

function coerce(raw: string, spec: SfzOpcodeSpec, source: SfzSource, opcode: string): string | number {
  const value = raw.trim().replace(/^"(.*)"$/, "$1");
  if (spec.kind === "sample") {
    if (!value) parseError(source, opcode, "empty path");
    return value.replaceAll("\\", "/");
  }
  if (spec.kind === "choice") {
    if (!spec.choices?.includes(value)) parseError(source, opcode, `invalid ${opcode}: ${value}`);
    return value;
  }
  if (spec.kind === "keycenter" && value === "sample") return value;
  const numeric = spec.kind === "note" || spec.kind === "keycenter" ? noteNumber(value, source, opcode) : Number(value);
  if (!value || !Number.isFinite(numeric) || numeric < (spec.min ?? 0) || numeric > (spec.max ?? 127)
    || (spec.kind === "integer" && !Number.isInteger(numeric))) {
    parseError(source, opcode, `invalid ${opcode}: ${value}`);
  }
  return numeric;
}

/** Removes SFZ comments while retaining quoted include paths and line numbers. */
function stripComments(input: string): string {
  let block = false; let quote = false; let output = "";
  for (let i = 0; i < input.length; i++) {
    const c = input[i]; const n = input[i + 1];
    if (block) {
      if (c === "*" && n === "/") { block = false; i++; }
      else if (c === "\n") output += "\n";
    } else if (c === '"') { quote = !quote; output += c; }
    else if (!quote && c === "/" && n === "*") { block = true; i++; }
    else if (!quote && c === "/" && n === "/") {
      while (i < input.length && input[i] !== "\n") i++;
      if (i < input.length) output += "\n";
    } else output += c;
  }
  return output;
}

function entries(...scopes: Scope[]): Scope {
  const merged: Scope = new Map();
  for (const scope of scopes) for (const [key, entry] of scope) merged.set(key, entry);
  return merged;
}

function regionFrom(scope: Scope, control: SfzControl, source: SfzSource): SfzRegion {
  const get = (name: string, fallback: number): number => Number(scope.get(name)?.value ?? fallback);
  const choice = (name: string, fallback: string): string => String(scope.get(name)?.value ?? fallback);
  const curve = new Map<number, number>();
  for (const [name, entry] of scope) if (name.startsWith("amp_velcurve_")) curve.set(Number(name.slice(13)), Number(entry.value));
  const lo = get("lokey", 0); const hi = get("hikey", 127);
  const lovel = get("lovel", 1); const hivel = get("hivel", 127);
  const seqLength = get("seq_length", 1); const seqPosition = get("seq_position", 1);
  const lorand = get("lorand", 0); const hirand = get("hirand", 1);
  if (lo > hi || lovel > hivel || seqPosition > seqLength || lorand >= hirand) {
    const offending = lo > hi ? "hikey" : lovel > hivel ? "hivel" : seqPosition > seqLength ? "seq_position" : "hirand";
    parseError(scope.get(offending)?.source ?? source, offending, `inconsistent ${offending}`);
  }
  return {
    sample: choice("sample", ""), source, control: { ...control }, key: [lo, hi], velocity: [lovel, hivel],
    pitchKeycenter: scope.get("pitch_keycenter")?.value === "sample" ? "sample" : get("pitch_keycenter", 60),
    pitchKeytrack: get("pitch_keytrack", 100), tune: get("tune", 0), transpose: get("transpose", 0),
    volume: get("volume", 0), amplitude: get("amplitude", 100), pan: get("pan", 0),
    offset: get("offset", 0), end: scope.has("end") ? get("end", 0) : null,
    loopMode: scope.has("loop_mode") ? choice("loop_mode", "no_loop") as SfzRegion["loopMode"] : null,
    loopStart: scope.has("loop_start") ? get("loop_start", 0) : null,
    loopEnd: scope.has("loop_end") ? get("loop_end", 0) : null,
    trigger: choice("trigger", "attack") as SfzRegion["trigger"],
    ampeg: { delay: get("ampeg_delay", 0), start: get("ampeg_start", 0), attack: get("ampeg_attack", 0),
      hold: get("ampeg_hold", 0), decay: get("ampeg_decay", 0), sustain: get("ampeg_sustain", 100),
      release: get("ampeg_release", 0.001) },
    ampVeltrack: get("amp_veltrack", 100), ampVelcurve: curve,
    group: get("group", 0), offBy: get("off_by", 0), offMode: choice("off_mode", "fast") as SfzRegion["offMode"],
    rtDecay: get("rt_decay", 0), seqLength, seqPosition, lorand, hirand,
  };
}

export async function parseSfz(path: string, root: string): Promise<SfzInstrument> {
  const rootPath = await confinedRealpath(root, ".");
  const main = await confinedRealpath(rootPath, path);
  const definitions = new Map<string, string>();
  const expand = (value: string): string => {
    for (let depth = 0; depth < 16; depth++) {
      const next = value.replace(/\$[A-Za-z_][\w]*/g, (name) => definitions.get(name) ?? name);
      if (next === value) break;
      value = next;
    }
    return value;
  };
  const warnings: SfzWarning[] = []; const regions: SfzRegion[] = [];
  const control: SfzControl = { defaultPath: "", noteOffset: 0, octaveOffset: 0 };
  let global: Scope = new Map(); let master: Scope = new Map(); let group: Scope = new Map();
  let region: Scope | null = null; let regionSource: SfzSource | null = null;
  let header = "";
  let globalDisabled = false; let masterDisabled = false; let groupDisabled = false; let regionDisabled = false;
  const display = (file: string): string => relative(rootPath, file).replaceAll("\\", "/");
  const warn = (source: SfzSource, opcode: string, message: string): void => {
    warnings.push(sfzWarning(source, opcode, message));
  };
  const emit = (): void => {
    if (!region || !regionSource) return;
    const merged = entries(global, master, group, region);
    const value = regionFrom(merged, control, regionSource);
    if (!value.sample) { warn(regionSource, "sample", "missing sample; region disabled"); return; }
    if (globalDisabled || masterDisabled || groupDisabled || regionDisabled) return;
    if (!value.sample.startsWith("*") && !/\.wav$/i.test(value.sample)) {
      warn(regionSource, "sample", "unsupported codec; region disabled"); return;
    }
    if (value.sample.startsWith("*") && value.sample !== "*silence" && value.sample !== "*sine") {
      warn(regionSource, "sample", "unsupported virtual sample; region disabled"); return;
    }
    regions.push(value);
  };
  const set = (scope: Scope, name: string, raw: string, source: SfzSource): void => {
    const disable = (): void => {
      if (header === "global") globalDisabled = true;
      else if (header === "master") masterDisabled = true;
      else if (header === "group") groupDisabled = true;
      else if (header === "region") regionDisabled = true;
    };
    if (name !== name.toLowerCase()) { warn(source, name, "uppercase opcode unsupported"); disable(); return; }
    const opcode = SFZ_ALIASES[name] ?? name;
    const curve = /^amp_velcurve_(\d+)$/.exec(opcode);
    const spec = curve ? { kind: "number", min: 0, max: 1 } as const : SFZ_OPCODES[opcode];
    if (!spec) { warn(source, name, "unsupported opcode"); if (CONDITIONAL.test(name)) disable(); return; }
    if (curve && Number(curve[1]) > 127) parseError(source, name, "amp_velcurve index out of range");
    const value = coerce(raw, spec, source, name);
    if (header === "control") {
      if (opcode === "default_path") control.defaultPath = String(value);
      else if (opcode === "note_offset") control.noteOffset = Number(value);
      else if (opcode === "octave_offset") control.octaveOffset = Number(value);
      else warn(source, opcode, "opcode ignored in control scope");
    } else if (opcode === "default_path" || opcode === "note_offset" || opcode === "octave_offset") {
      warn(source, opcode, "control opcode outside control scope");
    } else if (opcode === "key") {
      for (const key of ["lokey", "hikey", "pitch_keycenter"]) scope.set(key, { value, source });
    } else scope.set(opcode, { value, source });
  };
  const stack: string[] = [];
  let sourceOrder = 0;
  const visit = async (candidate: string): Promise<void> => {
    const file = await confinedRealpath(rootPath, candidate);
    if (stack.length > MAX_INCLUDE_DEPTH || stack.includes(file)) {
      throw new Music2Error("E_PARSE", "SFZ include cycle or depth exceeded", { details: { file: display(file), line: 1, opcode: "#include" } });
    }
    stack.push(file);
    let bytes: Buffer;
    try { bytes = await readFile(file); }
    catch (cause) {
      throw new Music2Error("E_ACCESS", "cannot read SFZ", { details: { file: display(file) }, cause });
    }
    let input: string;
    try { input = new TextDecoder("utf-8", { fatal: true }).decode(bytes); }
    catch (cause) {
      throw new Music2Error("E_PARSE", "SFZ is not valid UTF-8", { details: { file: display(file), line: 1, opcode: "encoding" }, cause });
    }
    const lines = stripComments(input.replaceAll("\r\n", "\n")).split("\n");
    for (let line = 0; line < lines.length; line++) {
      const source: SfzSource = { file: display(file), line: line + 1 };
      Object.defineProperty(source, SFZ_SOURCE_ORDER, { value: sourceOrder++ });
      let text = lines[line]!.trim();
      if (!text) continue;
      const define = /^#define\s+(\$[A-Za-z_][\w]*)\s+(.+)$/.exec(text);
      if (define) { definitions.set(define[1]!, expand(define[2]!.trim())); continue; }
      // Exact token matching makes $K_RIM distinct from $K, regardless of definition order.
      text = expand(text);
      const include = /^#include\s+"([^"]+)"\s*$/.exec(text);
      if (include) { await visit(include[1]!.replaceAll("\\", "/")); continue; }
      if (text.startsWith("#")) parseError(source, text.split(/\s/)[0]!, "invalid SFZ directive");
      const parts = text.split(/(<[^>]*>)/g);
      for (const part of parts) {
        if (!part.trim()) continue;
        if (part.startsWith("<")) {
          const name = part.slice(1, -1).trim();
          if (name === "region") { emit(); region = new Map(); regionSource = source; regionDisabled = false; }
          else if (name === "global") { emit(); region = null; global = new Map(); master = new Map(); group = new Map(); globalDisabled = false; masterDisabled = false; groupDisabled = false; }
          else if (name === "master") { emit(); region = null; master = new Map(); group = new Map(); masterDisabled = false; groupDisabled = false; }
          else if (name === "group") { emit(); region = null; group = new Map(); groupDisabled = false; }
          else if (name === "control") { emit(); region = null; }
          else { emit(); region = null; warn(source, name, "unsupported header"); }
          header = name;
          continue;
        }
        if (!HEADERS.has(header)) { warn(source, "header", "opcode outside supported header"); continue; }
        const token = /([A-Za-z_][\w]*)\s*=\s*/g;
        const matches = [...part.matchAll(token)];
        if (matches.length === 0) { if (part.trim()) parseError(source, "syntax", "malformed SFZ opcode"); continue; }
        for (let i = 0; i < matches.length; i++) {
          const match = matches[i]!;
          const raw = part.slice(match.index + match[0].length, matches[i + 1]?.index ?? part.length).trim();
          const scope: Scope = header === "global" ? global : header === "master" ? master : header === "group" ? group : region ?? new Map<string, Entry>();
          set(scope, match[1]!, raw, source);
        }
      }
    }
    stack.pop();
  };
  await visit(main);
  emit();
  if (regions.length === 0) throw new Music2Error("E_CAPABILITY", "SFZ has no playable regions", { details: { file: display(main) } });
  warnings.sort((a, b) => (a[SFZ_SOURCE_ORDER] ?? 0) - (b[SFZ_SOURCE_ORDER] ?? 0));
  return { regions, warnings };
}
