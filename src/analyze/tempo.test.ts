import assert from "node:assert/strict";
import { test } from "node:test";
import type { StereoBuffer } from "../audio-io/buffer.schema.ts";
import { renderSong } from "../render/index.ts";
import { loadSong } from "../song/index.ts";
import { estimateTempo } from "./tempo.tool.ts";

function mulberry32(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state + 0x6D2B79F5) | 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value ^= value + Math.imul(value ^ (value >>> 7), 61 | value);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

type Drum = "kick" | "snare" | "hat";
function synth(bpm: number, bars: number, rate: number, meter: number,
  events: (bar: number, add: (beat: number, drum: Drum, strength?: number) => void) => void): StereoBuffer {
  const duration = bars * meter * 60 / bpm;
  const left = new Float32Array(Math.ceil(duration * rate));
  const noise = mulberry32(113);
  const add = (bar: number, beat: number, drum: Drum, strength = 1): void => {
    const start = Math.round((bar * meter + beat) * 60 / bpm * rate);
    const length = Math.min(Math.floor(rate * (drum === "kick" ? .12 : drum === "snare" ? .09 : .035)), left.length - start);
    for (let i = 0; i < length; i++) {
      const t = i / rate;
      const value = drum === "kick" ? Math.sin(2 * Math.PI * (65 - 25 * t) * t) * Math.exp(-35 * t)
        : drum === "snare" ? (noise() * 2 - 1) * Math.exp(-45 * t)
          : (noise() * 2 - 1) * Math.exp(-125 * t);
      left[start + i] = Math.max(-1, Math.min(1, left[start + i]! + value * strength));
    }
  };
  for (let bar = 0; bar < bars; bar++) events(bar, (beat, drum, strength) => add(bar, beat, drum, strength));
  return { sampleRate: rate, left, right: Float32Array.from(left), sourceChannels: 2 };
}

function hasCandidate(bpm: number, candidates: { bpm: number }[]): boolean {
  return candidates.some((candidate) => Math.abs(candidate.bpm - bpm) <= 2);
}

for (const rate of [44100, 48000]) {
  test(`140 BPM drill accents and rolls at ${rate} Hz`, () => {
    const pcm = synth(140, 16, rate, 4, (_, add) => {
      for (let beat = 0; beat < 4; beat += .5) add(beat, "hat", .55);
      for (const beat of [1.75, 1.875, 3.75]) add(beat, "hat", .4);
      add(0, "kick", .9); add(2, "snare", .8);
    });
    const result = estimateTempo(pcm);
    assert.ok(result.bpm !== null && result.bpm >= 138 && result.bpm <= 142, JSON.stringify({bpm:result.bpm,candidates:result.candidates}));
    assert.ok(hasCandidate(70, result.candidates));
    assert.ok(Math.abs(result.beatsSeconds[2]! - result.beatsSeconds[1]! - 60 / 140) < .02);
    assert.ok(Math.abs(result.downbeatsSeconds[1]! - result.downbeatsSeconds[0]! - 4 * 60 / 140) < .04);
  });
}

test("loud straight eighth hats keep a 75 BPM backbeat despite a 150 alias", () => {
  const pcm = synth(75, 16, 44100, 4, (_, add) => {
    for (let beat = 0; beat < 4; beat += .5) add(beat, "hat", .8);
    add(0, "kick", .8); add(2, "kick", .8); add(1, "snare", .8); add(3, "snare", .8);
  });
  const result = estimateTempo(pcm);
  assert.ok(result.bpm !== null && result.bpm >= 73 && result.bpm <= 77, JSON.stringify({bpm:result.bpm,candidates:result.candidates}));
  assert.ok(hasCandidate(150, result.candidates));
});

test("140 BPM UK 3+3+2 hat positions do not collapse to 70", () => {
  const pcm = synth(140, 16, 44100, 4, (_, add) => {
    for (const step of [0, 3, 6, 8, 11, 14]) add(step / 4, "hat", .8);
    add(0, "kick", .9); add(9 / 4, "snare", .8);
  });
  const result = estimateTempo(pcm);
  assert.ok(result.bpm !== null && result.bpm >= 138 && result.bpm <= 142, JSON.stringify({bpm:result.bpm,candidates:result.candidates}));
});

test("70 BPM with continuous sixteenths explicitly resolves to 140", () => {
  const pcm = synth(70, 16, 44100, 4, (_, add) => {
    for (let beat = 0; beat < 4; beat += .25) add(beat, "hat", .6);
    add(0, "kick", .9); add(2, "snare", .9);
  });
  const result = estimateTempo(pcm);
  assert.ok(result.bpm !== null && result.bpm >= 138 && result.bpm <= 142, JSON.stringify({bpm:result.bpm,candidates:result.candidates}));
  assert.ok(hasCandidate(70, result.candidates));
  assert.ok(Math.abs(result.candidates[1]!.bpm - 70) <= 2);
});

test("90 BPM four-on-floor", () => {
  const pcm = synth(90, 12, 44100, 4, (_, add) => {
    for (let beat = 0; beat < 4; beat++) add(beat, "kick", .9);
    add(1, "snare", .65); add(3, "snare", .65);
  });
  const result = estimateTempo(pcm);
  assert.ok(result.bpm !== null && result.bpm >= 88 && result.bpm <= 92, JSON.stringify({bpm:result.bpm,candidates:result.candidates}));
});

test("steady tone has no pulse", () => {
  const wave = Float32Array.from({ length: 44100 * 4 }, (_, i) => .2 * Math.sin(2 * Math.PI * 440 * i / 44100));
  const result = estimateTempo({ sampleRate: 44100, left: wave, right: wave, sourceChannels: 2 });
  assert.equal(result.bpm, null);
});

test("silence has no pulse", () => {
  const zeros = new Float32Array(44100 * 3);
  const result = estimateTempo({ sampleRate: 44100, left: zeros, right: zeros, sourceChannels: 2 });
  assert.equal(result.bpm, null); assert.equal(result.confidence, 0);
  assert.deepEqual(result.candidates, []); assert.deepEqual(result.beatsSeconds, []);
});

test("rendered drill fixture estimates 140 from PCM without song metadata", async () => {
  const path = "examples/drill-140.song.json";
  const song = await loadSong(path);
  const render = await renderSong(song, path);
  const result = estimateTempo(render.audio);
  assert.ok(result.bpm !== null && result.bpm >= 138 && result.bpm <= 142, JSON.stringify({bpm:result.bpm,candidates:result.candidates}));
});
