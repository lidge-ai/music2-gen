import test from "node:test";
import assert from "node:assert/strict";
import type { VoiceContext } from "../render.schema.ts";
import { guitarVoice } from "./guitar.tool.ts";

function render(rate: number, midi: number, type = 0, gate = 1.5, seed = 41,
  pickPosition = 0.22): Float32Array {
  const frames = Math.floor(rate * 2);
  return guitarVoice.render({ sampleRate: rate, frames,
    track: { id: "g", kind: "notes", instrument: "guitar", params: {} } as VoiceContext["track"],
    events: [{ midi, sample: null, velocity: 0.8, startFrame: 0,
      gateFrames: Math.floor(gate * rate), stopFrame: frames, eventIndex: 0, seed }] },
  { type, pickPosition, releaseMs: 150 });
}
function pitch(x: Float32Array, rate: number, expected: number): number {
  const start = Math.floor(0.1 * rate), span = Math.floor(0.22 * rate);
  const period = rate / expected;
  let bestLag = 0, best = -Infinity;
  for (let lag = Math.floor(period * 0.98); lag <= Math.ceil(period * 1.02); lag++) {
    let sum = 0, e1 = 0, e2 = 0;
    for (let i = start; i < start + span; i++) {
      const a = x[i]!, b = x[i + lag]!;
      sum += a * b; e1 += a * a; e2 += b * b;
    }
    const correlation = sum / Math.sqrt(e1 * e2);
    if (correlation > best) { best = correlation; bestLag = lag; }
  }
  return rate / bestLag;
}
function rms(x: Float32Array, rate: number, begin: number, duration: number): number {
  const start = Math.floor(begin * rate), count = Math.floor(duration * rate);
  let sum = 0;
  for (let i = start; i < start + count; i++) sum += x[i]! ** 2;
  return Math.sqrt(sum / count);
}
function highBand(x: Float32Array, rate: number): number {
  const count = Math.floor(0.08 * rate);
  let energy = 0;
  for (let hz = 4200; hz <= 10000; hz += 200) {
    let re = 0, im = 0;
    for (let i = 0; i < count; i++) {
      const phase = 2 * Math.PI * hz * i / rate;
      re += x[i]! * Math.cos(phase);
      im += x[i]! * Math.sin(phase);
    }
    energy += re * re + im * im;
  }
  return Math.sqrt(energy) / count;
}

test("guitar tuning, type timbre, deterministic excitation and note-off", () => {
  for (const rate of [44100, 48000]) {
    for (const midi of [40, 64]) {
      const expected = 440 * 2 ** ((midi - 69) / 12);
      const nylon = render(rate, midi), steel = render(rate, midi, 1);
      assert.ok(Math.abs(pitch(nylon, rate, expected) / expected - 1) < 0.01);
      assert.ok(Math.abs(pitch(steel, rate, expected) / expected - 1) < 0.01);
      assert.deepEqual(nylon, render(rate, midi));
      assert.notDeepEqual(nylon, render(rate, midi, 0, 1.5, 42));
      assert.ok(nylon.every(Number.isFinite));
      assert.ok(nylon.every(value => Math.abs(value) <= 1));
      assert.ok(rms(steel, rate, 1, 0.1) > rms(nylon, rate, 1, 0.1));
      for (const audio of [nylon, steel]) {
        assert.ok(rms(audio, rate, 0.1, 0.1) > rms(audio, rate, 0.5, 0.1));
        assert.ok(rms(audio, rate, 0.5, 0.1) > rms(audio, rate, 1, 0.1));
      }
      const off = render(rate, midi, 0, 0.2);
      assert.ok(rms(off, rate, 0.5, 0.1) < 0.01 * rms(off, rate, 0.1, 0.1));
    }
    const nylon = render(rate, 64), steel = render(rate, 64, 1);
    assert.ok(highBand(steel, rate) > highBand(nylon, rate));
    assert.notDeepEqual(render(rate, 64, 0, 1.5, 41, 0.12), render(rate, 64, 0, 1.5, 41, 0.35));
  }
});
