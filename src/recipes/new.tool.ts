import { midiToName, noteToMidi, parseMini } from "../pattern/index.ts";
import type { Atom, Node } from "../pattern/index.ts";
import { Music2Error } from "../shared/index.ts";
import { validateSong } from "../song/index.ts";
import type { Section, Song } from "../song/index.ts";
import type { RecipeArrangementBlock, RecipeCard } from "./recipe.schema.ts";
import { getRecipe } from "./recipes.tool.ts";

export interface NewSongOptions { genre: RecipeCard["id"]; arrangement?: string; bpm?: number; key?: string; seed?: number; title?: string }

const ROOTS: Readonly<Record<string, number>> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const KEY = /^([A-G])(#|b)? (major|minor)$/;
const MIDI_MIN = 0;
const MIDI_MAX = 127;

function input(message: string, fix?: string): never {
  throw new Music2Error("E_INPUT", message, fix === undefined ? {} : { fix });
}

function keyParts(value: string): { root: number; mode: string } {
  const match = KEY.exec(value);
  if (!match) return input(`invalid key: ${value}`, "use a key such as C minor or F# major");
  const base = ROOTS[match[1]!];
  if (base === undefined) return input(`invalid key: ${value}`);
  return { root: (base + (match[2] === "#" ? 1 : match[2] === "b" ? -1 : 0) + 12) % 12, mode: match[3]! };
}

function visitAtoms(node: Node, visit: (atom: Atom) => void): void {
  switch (node.type) {
    case "atom": visit(node.atom); break;
    case "seq": node.steps.forEach((step) => visitAtoms(step.node, visit)); break;
    case "stack": node.branches.forEach((branch) => visitAtoms(branch, visit)); break;
    case "alt": node.items.forEach((item) => visitAtoms(item, visit)); break;
    case "choose": node.options.forEach((option) => visitAtoms(option, visit)); break;
    case "fast": case "slow": case "euclid": case "degrade": visitAtoms(node.node, visit); break;
    case "rest": break;
  }
}

/** Internal pattern operation, exported for direct boundary verification; omitted from the feature barrel. */
export function transposePattern(pattern: string, delta: number): string {
  const replacements = new Map<number, { raw: string; shifted: string }>();
  visitAtoms(parseMini(pattern), (atom) => {
    if (replacements.has(atom.offset)) return; // repeated AST nodes retain the same source span
    const numeric = atom.num !== null;
    const midi = numeric ? atom.num! : noteToMidi(atom.raw);
    const shifted = midi + delta;
    if (!Number.isInteger(shifted) || shifted < MIDI_MIN || shifted > MIDI_MAX) {
      input(`transposed MIDI pitch ${shifted} is outside ${MIDI_MIN}..${MIDI_MAX}`, "choose a closer key or edit the source pattern");
    }
    replacements.set(atom.offset, { raw: atom.raw, shifted: numeric ? String(shifted) : midiToName(shifted) });
  });
  let result = pattern;
  for (const [offset, replacement] of [...replacements].sort((a, b) => b[0] - a[0])) {
    result = result.slice(0, offset) + replacement.shifted + result.slice(offset + replacement.raw.length);
  }
  return result;
}

/** Rebuild both song structures from one block list, retaining starter patterns. */
export function buildSongArrangement(song: Song, blocks: RecipeArrangementBlock[]): Song {
  const source = structuredClone(song.sections);
  const sections = new Map<string, Section>();
  const arrangement: Song["arrangement"] = [];
  const bassIds = song.tracks.filter((track) => track.id === "bass" || track.instrument === "808" || track.instrument === "bass").map((track) => track.id);
  const kickIds = song.tracks.filter((track) => track.id === "kick").map((track) => track.id);
  const snareIds = song.tracks.filter((track) => track.id === "snare").map((track) => track.id);
  const hatsIds = song.tracks.filter((track) => track.id === "hats").map((track) => track.id);
  const leadIds = song.tracks.filter((track) => track.id === "melody" || track.instrument === "lead").map((track) => track.id);
  for (const block of blocks) {
    if (!Number.isSafeInteger(block.bars) || block.bars < 1) input(`invalid ${block.role} bar count`);
    const exact = source.find((section) => section.role === block.role && section.bars === block.bars);
    const sameRole = exact ?? source.find((section) => section.role === block.role);
    const fallbackRole = block.role === "hook" ? ["groove", "verse"]
      : block.role === "bridge" ? ["groove", "verse"]
      : block.role === "build" || block.role === "breakdown" ? ["verse", "groove"]
      : ["groove", "verse", "hook", "intro", "outro"];
    const basis = sameRole ?? fallbackRole.map((role) => source.find((section) => section.role === role)).find(Boolean)
      ?? source.find((section) => song.tracks.some((track) => track.pattern || section.patterns?.[track.id]));
    if (!basis) input(`cannot derive ${block.role} section`);
    const id = song.genre === "drill_ny" && block.role === "build" && block.bars === 4 ? "prehook"
      : exact ? exact.id : `${block.role}_${block.bars}`;
    if (!sections.has(id)) {
      const section: Section = { ...structuredClone(basis), id, role: block.role, bars: block.bars,
        patterns: { ...basis.patterns } };
      const mute = (ids: string[]) => { for (const trackId of ids) section.patterns![trackId] = null; };
      if (block.role === "build") mute(bassIds);
      if (block.role === "breakdown") mute([...kickIds, ...bassIds]);
      if (block.role === "bridge") mute([...hatsIds, ...bassIds]);
      if ((block.role === "intro" || block.role === "outro") && !sameRole) mute([...bassIds, ...leadIds]);
      if (song.genre === "house" && block.role === "breakdown") mute(snareIds);
      if (song.genre === "lofi_hiphop" && block.bars === 2 &&
        (block.role === "intro" || block.role === "outro" || block.role === "breakdown")) {
        for (const trackId of [...kickIds, ...bassIds]) delete section.patterns![trackId];
        mute(leadIds);
      }
      if (song.genre === "techno") {
        if (block.role === "groove" && block.bars === 32) mute(leadIds);
        if (block.role === "intro" && block.bars === 8) {
          mute([...snareIds, ...hatsIds, ...bassIds]);
          for (const trackId of leadIds) delete section.patterns![trackId];
        }
        if (block.role === "build" && block.bars === 8) mute(snareIds);
        if (block.role === "bridge" || block.role === "breakdown") {
          mute([...snareIds, ...hatsIds, ...bassIds]);
          for (const trackId of [...kickIds, ...leadIds]) delete section.patterns![trackId];
        }
      }
      sections.set(id, section);
    }
    arrangement.push({ section: id, repeats: 1 });
  }
  song.sections = [...sections.values()];
  song.arrangement = arrangement;
  return song;
}

export function newSong(options: NewSongOptions): Song {
  const card = getRecipe(options.genre);
  const bpm = options.bpm ?? card.bpm.default;
  if (!Number.isInteger(bpm) || bpm < Math.max(40, card.bpm.min) || bpm > Math.min(240, card.bpm.max)) {
    input(`bpm must be an integer in ${card.bpm.min}..${card.bpm.max}`);
  }
  const seed = options.seed ?? 1;
  if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff) input("seed must be a uint32 integer");
  const title = options.title ?? card.starterSong.title ?? `${card.title} Starter`;
  if (typeof title !== "string" || title.length > 120) input("title must be a string of at most 120 characters");
  const defaultKey = card.keyDefaults[0];
  if (!defaultKey) input(`recipe ${card.id} has no default key`);
  const key = options.key ?? defaultKey;
  const source = keyParts(defaultKey);
  const target = keyParts(key);
  if (source.mode !== target.mode) input(`key mode must be ${source.mode}`, `choose a ${source.mode} key`);
  const delta = ((target.root - source.root + 18) % 12) - 6;
  const song = structuredClone(card.starterSong);
  const ids = card.arrangements.map((variant) => variant.id).sort();
  const selected = options.arrangement ?? card.defaultArrangement;
  const variant = card.arrangements.find((candidate) => candidate.id === selected);
  if (!variant) input(`unknown arrangement ${selected} for ${card.id}; valid choices: ${ids.join(", ")}`);
  buildSongArrangement(song, variant.blocks);
  song.title = title;
  song.genre = card.id;
  song.bpm = bpm;
  song.key = key;
  song.seed = seed;
  if (delta !== 0) {
    for (const track of song.tracks) {
      if (track.kind !== "notes") continue;
      if (track.pattern !== undefined) track.pattern = transposePattern(track.pattern, delta);
      for (const section of song.sections) {
        const pattern = section.patterns?.[track.id];
        if (typeof pattern === "string") section.patterns![track.id] = transposePattern(pattern, delta);
      }
    }
  }
  try { validateSong(song); }
  catch (cause) { throw new Music2Error("E_INPUT", `recipe ${card.id} produced an invalid song`, { cause, fix: "report the recipe card as invalid" }); }
  return song;
}
