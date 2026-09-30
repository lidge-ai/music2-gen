import { Music2Error } from "../shared/index.ts";
import { loadSfz, renderSfz } from "../sampler/sfz-render.tool.ts";
import { readUserManifest } from "../sampler/user-instrument.tool.ts";
import { measureAny } from "./pitch.tool.ts";
import type { VerifyReport } from "./library.schema.ts";

export async function verifyInstrument(id: string, notes = [48, 52, 55, 60]): Promise<VerifyReport> {
  if (!notes.length || notes.some((note) => !Number.isInteger(note) || note < 0 || note > 127)) throw new Music2Error("E_INPUT", "verify notes must be MIDI integers in [0,127]");
  const { root, entryPath, manifest } = await readUserManifest(id);
  if (manifest.kind !== "sfz") throw new Music2Error("E_CAPABILITY", "pitch verification requires an SFZ instrument");
  const rate = 48000;
  const loaded = await loadSfz(entryPath, manifest.entry, rate, undefined, root);
  // Render each one-second slot separately so a previous note's release cannot
  // pollute the next measurement, including with caller-selected long envelopes.
  const results = notes.map((want) => {
    const audio = renderSfz([{ midi: want, velocity: 1, startFrame: 0, gateFrames: rate, stopFrame: rate, eventIndex: 0, seed: 0 }], loaded, rate, rate);
    const mono = new Float32Array(rate);
    for (let i = 0; i < rate; i++) mono[i] = (audio.left[i]! + audio.right[i]!) * 0.5;
    const measured = measureAny(mono, rate, 0.4, 0.4, 0, 127);
    const cents = (measured.midi - want) * 100;
    return { want, got: measured.midi, cents, ok: measured.confidence > 0 && Math.abs(cents) <= 50 };
  });
  return { id, notes: results, ok: results.every((note) => note.ok) };
}
