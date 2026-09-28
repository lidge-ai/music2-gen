import { mulberry32 } from "../shared/prng.tool.ts";
import type { SfzEvent, SfzInstrument, SfzRegion, SfzSelectionState, SfzVoice } from "./sfz.schema.ts";

/** One call handles either a note-on or a velocity-zero note-off at event.startFrame. */
export function selectSfzRegions(instrument: SfzInstrument, event: SfzEvent, state: SfzSelectionState): readonly SfzRegion[] {
  const off = event.velocity === 0;
  const held = state.held ?? (state.held = new Map<number, { eventIndex: number; velocity: number; startFrame: number }[]>());
  const heldNotes = held.get(event.midi) ?? [];
  const priorIndex = heldNotes.findIndex((note) => note.eventIndex === event.eventIndex);
  const prior = heldNotes[priorIndex];
  if (off && !prior) return [];
  const velocity = off ? prior!.velocity : Math.max(1, Math.min(127, Math.round(127 * event.velocity)));
  const legato = state.heldKeys.size > 0;
  const draw = mulberry32(event.seed)();
  const positions = new Map<string, number>();
  const candidates: { region: SfzRegion; index: number }[] = [];
  for (let i = 0; i < instrument.regions.length; i++) {
    const region = instrument.regions[i]!;
    const key = event.midi + region.control.noteOffset + 12 * region.control.octaveOffset;
    if (key < 0 || key > 127 || key < region.key[0] || key > region.key[1]
      || velocity < region.velocity[0] || velocity > region.velocity[1]
      || draw < region.lorand || draw >= region.hirand) continue;
    if (off ? region.trigger !== "release" && region.trigger !== "release_key"
      : region.trigger === "release" || region.trigger === "release_key"
        || region.trigger === "first" && legato || region.trigger === "legato" && !legato) continue;
    const counterKey = `${key}:${region.seqLength}`;
    if (!positions.has(counterKey)) positions.set(counterKey, state.counters.get(counterKey) ?? 1);
    if (positions.get(counterKey) === region.seqPosition) candidates.push({ region, index: i });
  }
  for (const [key, position] of positions) {
    const length = Number(key.slice(key.lastIndexOf(":") + 1));
    state.counters.set(key, position === length ? 1 : position + 1);
  }
  if (off) {
    heldNotes.splice(priorIndex, 1);
    if (heldNotes.length === 0) { state.heldKeys.delete(event.midi); held.delete(event.midi); }
    for (const voice of state.active) if (voice.eventIndex === event.eventIndex && voice.releaseFrame === null) {
      voice.releaseFrame = event.startFrame;
      voice.heldFrames = event.startFrame - voice.startFrame;
    }
  } else {
    state.heldKeys.add(event.midi);
    heldNotes.push({ eventIndex: event.eventIndex, velocity, startFrame: event.startFrame });
    held.set(event.midi, heldNotes);
  }
  const earlier = [...state.active];
  for (const { region } of candidates) {
    if (region.group !== 0) {
      for (const voice of earlier) {
        const previous = instrument.regions[voice.regionIndex];
        if (previous?.offBy !== region.group) continue;
        if (previous.offMode === "fast") voice.fastOffFrame = event.startFrame;
        else { voice.releaseFrame = event.startFrame; voice.choked = true; }
      }
    }
  }
  for (const { region, index } of candidates) {
    const voice: SfzVoice = {
      regionIndex: index, key: event.midi, velocity, startFrame: event.startFrame,
      releaseFrame: null, sourcePosition: region.offset, stopFrame: event.stopFrame, eventIndex: event.eventIndex,
    };
    if (off) voice.heldFrames = event.startFrame - prior!.startFrame;
    state.active.push(voice);
  }
  return candidates.map(({ region }) => region);
}
