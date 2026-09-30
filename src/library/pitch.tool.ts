import { Music2Error } from "../shared/index.ts";
import type { PitchEstimate } from "./library.schema.ts";

interface Window { values: Float64Array; rate: number; floor: number }
function windowed(mono: Float32Array, rate: number, start: number, length: number): Window | null {
  if (!Number.isFinite(rate) || rate <= 0 || !Number.isFinite(start) || !Number.isFinite(length)) throw new Music2Error("E_INPUT", "invalid pitch window");
  const begin = Math.max(0, Math.floor(start * rate));
  const end = Math.min(mono.length, begin + Math.max(0, Math.floor(length * rate)));
  const stride = Math.max(1, Math.floor(rate / 12000));
  const count = Math.min(8192, Math.floor((end - begin) / stride));
  if (count < 32) return null;
  const values = new Float64Array(count); let energy = 0; let mean = 0;
  for (let i = 0; i < count; i++) mean += mono[begin + i * stride] ?? 0;
  mean /= count;
  for (let i = 0; i < count; i++) {
    const value = (mono[begin + i * stride]! - mean) * (0.5 - 0.5 * Math.cos(2 * Math.PI * i / (count - 1)));
    values[i] = value; energy += value * value;
  }
  if (!Number.isFinite(energy) || energy / count < 1e-10) return null;
  return { values, rate: rate / stride, floor: energy * count * 1e-7 };
}
function power(window: Window, frequency: number): number {
  if (frequency >= window.rate / 2) return 0;
  const coefficient = 2 * Math.cos(2 * Math.PI * frequency / window.rate);
  let last = 0; let before = 0;
  for (const value of window.values) { const next = value + coefficient * last - before; before = last; last = next; }
  return Math.max(0, last * last + before * before - coefficient * last * before);
}
function estimate(window: Window | null, notes: number[], fallback: number): PitchEstimate {
  if (!window) return { midi: fallback, confidence: 0 };
  let best = 0; let runner = 0; let midi = fallback;
  for (const note of notes) {
    const frequency = 440 * 2 ** ((note - 69) / 12);
    const harmonics = [1, 2, 3, 4].map((harmonic) => power(window, frequency * harmonic));
    const fundamental = harmonics[0]!;
    // Suppress subharmonics with no energy at their proposed fundamental. The
    // floor keeps a single-harmonic sine measurable without inventing harmonics.
    const score = fundamental < Math.max(window.floor, ...harmonics) * 0.001 ? 0
      : Math.exp(harmonics.reduce((sum, value) => sum + Math.log(Math.max(window.floor, value)), 0) / 4);
    if (score > best) { runner = best; best = score; midi = note; }
    else if (score > runner) runner = score;
  }
  return { midi, confidence: best > 0 ? best / (best + runner) : 0 };
}

/** Quarter-tone (50-cent) search, with a deterministic Hann/Goertzel four-harmonic product. */
export function measureAny(mono: Float32Array, rate: number, start: number, length: number, lowMidi = 12, highMidi = 108): PitchEstimate {
  if (!Number.isFinite(lowMidi) || !Number.isFinite(highMidi) || lowMidi < 0 || highMidi > 127 || lowMidi > highMidi) throw new Music2Error("E_INPUT", "invalid pitch search range");
  const notes: number[] = [];
  for (let midi = lowMidi; midi <= highMidi; midi += 0.5) notes.push(midi);
  return estimate(windowed(mono, rate, start, length), notes, lowMidi);
}

export function measureRoot(mono: Float32Array, rate: number, namedMidi: number | null, loop: { start: number; end: number } | null): PitchEstimate & { offset: number } {
  const validLoop = loop && loop.start >= 0 && loop.start < loop.end && loop.end < mono.length;
  const start = validLoop ? loop.start / rate : Math.min(0.25, mono.length / rate / 4);
  const length = Math.min(0.5, validLoop ? (loop.end - loop.start + 1) / rate : mono.length / rate - start);
  if (namedMidi === null) {
    const measured = measureAny(mono, rate, start, length);
    return { ...measured, midi: Math.round(measured.midi), offset: 0 };
  }
  const notes: number[] = [];
  const pitchClass = ((namedMidi % 12) + 12) % 12;
  for (let midi = 12 + pitchClass; midi <= 108; midi += 12) notes.push(midi);
  const measured = estimate(windowed(mono, rate, start, length), notes, namedMidi);
  return { ...measured, offset: (measured.midi - namedMidi) / 12 };
}
