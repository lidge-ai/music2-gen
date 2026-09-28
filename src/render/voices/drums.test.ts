import assert from "node:assert/strict";
import test from "node:test";
import { createHash } from "node:crypto";
import { validateSong } from "../../song/index.ts";
import { Music2Error } from "../../shared/index.ts";
import type { VoiceContext, VoiceEvent } from "../render.schema.ts";
import { drumsVoice } from "./drums.tool.ts";

const rate = 44100;
const params = { tone: .5, decayMs: 180, noise: .5 };

function context(name: string, index = 0, startFrame = 0, frames = rate): VoiceContext {
  const track = validateSong({ version: 1, bpm: 120,
    tracks: [{ id: "drum", kind: "drums", instrument: "drums", pattern: name }],
    sections: [{ id: "one", bars: 1 }], arrangement: [{ section: "one" }] }).tracks[0]!;
  const event: VoiceEvent = { midi: null, sample: { name, index }, velocity: .8,
    startFrame, gateFrames: rate / 4, stopFrame: frames, eventIndex: 0, seed: 42 };
  return { sampleRate: rate, frames, track, events: [event] };
}

void test("unknown drum reports schema error at the originating track pattern", () => {
  assert.throws(() => drumsVoice.render(context("cowbell"), params), (error: unknown) => {
    assert.ok(error instanceof Music2Error);
    assert.equal(error.code, "E_SCHEMA");
    assert.deepEqual(error.details?.["issues"], [
      { path: "tracks.drum.pattern", message: "unknown drum sample cowbell" },
    ]);
    return true;
  });
});

void test("variant indexes wrap before timbre and noise seeding", () => {
  for (const name of ["bd", "sd", "cp", "hh", "oh", "rim", "perc", "tom"]) {
    const variants = [0, 1, 2, 3].map((index) => drumsVoice.render(context(name, index), params));
    assert.deepEqual(drumsVoice.render(context(name, 4), params), variants[0], name);
    for (let index = 1; index < 4; index++) assert.notDeepEqual(variants[index], variants[0], name);
  }
});

void test("all eight drum names produce deterministic nonzero finite output", () => {
  for (const name of ["bd", "sd", "cp", "hh", "oh", "rim", "perc", "tom"]) {
    const ctx = context(name);
    const audio = drumsVoice.render(ctx, params);
    assert.deepEqual(drumsVoice.render(ctx, params), audio, name);
    assert.ok(audio.some((value) => Math.abs(value) > .01), name);
    assert.ok(audio.every(Number.isFinite), name);
  }
});

void test("snare is below 1e-3 at one second and writes clamp at buffer end", () => {
  const audio = drumsVoice.render(context("sd", 0, 0, rate * 2), params);
  assert.ok(Math.abs(audio[rate] ?? 0) < .001);
  const short = drumsVoice.render(context("oh", 0, 150, 200), params);
  assert.equal(short.length, 200);
  assert.ok(short.some((value, index) => index >= 150 && value !== 0));
  assert.ok(short.slice(0, 150).every((value) => value === 0));
});

void test("velocity scales an isolated drum linearly", () => {
  const full = context("perc");
  full.events[0]!.velocity = 1;
  const half = context("perc");
  half.events[0]!.velocity = .5;
  const a = drumsVoice.render(full, params);
  const b = drumsVoice.render(half, params);
  for (let i = 0; i < 1000; i++) assert.ok(Math.abs((a[i] ?? 0) * .5 - (b[i] ?? 0)) < 1e-7);
});

void test("omitted and explicit classic kit keep identical PCM for every name and variant", () => {
  for (const rate of [44100, 48000]) {
    for (const name of ["bd", "sd", "cp", "hh", "oh", "rim", "perc", "tom"]) {
      for (let variant = 0; variant < 4; variant++) {
        const ctx = context(name, variant);
        ctx.sampleRate = rate;
        ctx.frames = rate;
        ctx.events[0]!.stopFrame = rate;
        const omitted = drumsVoice.render(ctx, params);
        const explicit = drumsVoice.render(ctx, { ...params, kit: 0 });
        const digest = (audio: Float32Array): string => createHash("sha256")
          .update(Buffer.from(audio.buffer)).digest("hex");
        assert.equal(digest(omitted), digest(explicit), `${rate} ${name}:${variant}`);
      }
    }
  }
});
