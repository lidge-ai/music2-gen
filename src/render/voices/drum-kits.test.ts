import assert from "node:assert/strict";
import test from "node:test";
import { buildTimeline, validateSong } from "../../song/index.ts";
import { Music2Error } from "../../shared/index.ts";
import { mixTracks } from "../mixer.tool.ts";
import type { VoiceContext, VoiceEvent } from "../render.schema.ts";
import { drumsVoice } from "./drums.tool.ts";
import { validateVoiceParams } from "./registry.tool.ts";

const NAMES = ["bd", "sd", "cp", "hh", "oh", "rim", "perc", "tom"] as const;
const defaults = { tone: .5, decayMs: 180, noise: .5 };

function context(name: string, rate = 44100, variant = 0, frames = rate): VoiceContext {
  const track = validateSong({ version: 1, bpm: 120,
    tracks: [{ id: "drum", kind: "drums", instrument: "drums", pattern: "bd" }],
    sections: [{ id: "one", bars: 1 }], arrangement: [{ section: "one" }] }).tracks[0]!;
  const event: VoiceEvent = { midi: null, sample: { name, index: variant }, velocity: 1,
    startFrame: 0, gateFrames: rate / 4, stopFrame: frames, eventIndex: 0, seed: 49 };
  return { sampleRate: rate, frames, track, events: [event] };
}

function rms(audio: Float32Array, start: number, end: number): number {
  let sum = 0;
  for (let i = start; i < end; i++) sum += audio[i]! ** 2;
  return Math.sqrt(sum / (end - start));
}

function highpassRms(audio: Float32Array, start: number, end: number, rate: number,
  cutoff = 1500): number {
  let low = 0;
  let sum = 0;
  const coefficient = Math.exp(-2 * Math.PI * cutoff / rate);
  for (let i = 0; i < end; i++) {
    low = (1 - coefficient) * audio[i]! + coefficient * low;
    if (i >= start) sum += (audio[i]! - low) ** 2;
  }
  return Math.sqrt(sum / (end - start));
}

function crossings(audio: Float32Array, start: number, end: number, rate: number): number {
  let count = 0;
  for (let i = start + 1; i < end; i++) {
    if (audio[i - 1]! <= 0 && audio[i]! > 0) count++;
  }
  return count * rate / (end - start);
}

void test("four kits render every name and variant repeatably within the single-hit peak bound at both rates", () => {
  for (const rate of [44100, 48000]) {
    for (const kit of [1, 2, 3, 4]) {
      for (const name of NAMES) {
        const variants: Float32Array[] = [];
        for (let variant = 0; variant < 4; variant++) {
          const ctx = context(name, rate, variant);
          const audio = drumsVoice.render(ctx, { ...defaults, kit });
          assert.equal(audio.length, rate);
          assert.deepEqual(drumsVoice.render(ctx, { ...defaults, kit }), audio);
          assert.ok(audio.every(Number.isFinite), `${rate} kit ${kit} ${name}:${variant}`);
          assert.ok(audio.every((value) => Math.abs(value) <= 1));
          assert.ok(audio.some((value) => Math.abs(value) > .001), `${kit} ${name}:${variant}`);
          variants.push(audio);
        }
        for (let variant = 1; variant < 4; variant++) {
          assert.notDeepEqual(variants[variant], variants[0], `${kit} ${name}:${variant}`);
        }
      }
    }
  }
});

void test("909 kick sweeps from near 200 Hz to about 50 Hz and snare loses early high-band noise", () => {
  for (const rate of [44100, 48000]) {
    const kick = drumsVoice.render(context("bd", rate), { ...defaults, kit: 1 });
    const early = crossings(kick, Math.round(.002 * rate), Math.round(.022 * rate), rate);
    const late = crossings(kick, Math.round(.27 * rate), Math.round(.57 * rate), rate);
    assert.ok(early > 130 && early < 230, `${rate} early ${early}`);
    assert.ok(late > 42 && late < 62, `${rate} late ${late}`);
    const snare = drumsVoice.render(context("sd", rate), { ...defaults, kit: 1 });
    const first = highpassRms(snare, 0, Math.round(.03 * rate), rate);
    const tail = highpassRms(snare, Math.round(.18 * rate), Math.round(.21 * rate), rate);
    assert.ok(first > tail * 5, `${rate}: ${first} vs ${tail}`);
  }
});

void test("808 open hat rings longer and a later closed hat chokes its tail", () => {
  for (const rate of [44100, 48000]) {
    const opened = context("oh", rate);
    const open = drumsVoice.render(opened, { ...defaults, kit: 2 });
    const closed = drumsVoice.render(context("hh", rate), { ...defaults, kit: 2 });
    assert.ok(rms(open, Math.round(.12 * rate), Math.round(.18 * rate)) >
      rms(closed, Math.round(.12 * rate), Math.round(.18 * rate)) * 8);
    const closeFrame = Math.round(.1 * rate);
    const closeEvent: VoiceEvent = { ...opened.events[0]!, sample: { name: "hh", index: 0 },
      startFrame: closeFrame, eventIndex: 1, seed: 113 };
    opened.events.push(closeEvent);
    const both = drumsVoice.render(opened, { ...defaults, kit: 2 });
    const isolatedClose = context("hh", rate);
    isolatedClose.events[0] = closeEvent;
    const closeOnly = drumsVoice.render(isolatedClose, { ...defaults, kit: 2 });
    let residual = 0;
    for (let i = Math.round(.17 * rate); i < Math.round(.2 * rate); i++) {
      residual += (both[i]! - closeOnly[i]!) ** 2;
    }
    residual = Math.sqrt(residual / Math.round(.03 * rate));
    assert.ok(residual < rms(open, Math.round(.17 * rate), Math.round(.2 * rate)) * .02,
      `${rate}: residual ${residual}`);
  }
});

void test("acoustic kick has less bend, tom descends, and cymbal retains a longer tail", () => {
  const rate = 44100;
  const kick = drumsVoice.render(context("bd", rate), { ...defaults, kit: 3 });
  const early = crossings(kick, Math.round(.005 * rate), Math.round(.045 * rate), rate);
  const late = crossings(kick, Math.round(.2 * rate), Math.round(.4 * rate), rate);
  assert.ok(early > late && early - late < 90, `${early}, ${late}`);
  const tom = drumsVoice.render(context("tom", rate), { ...defaults, kit: 3 });
  assert.ok(crossings(tom, 0, Math.round(.04 * rate), rate) >
    crossings(tom, Math.round(.18 * rate), Math.round(.3 * rate), rate));
  const acoustic = drumsVoice.render(context("oh", rate), { ...defaults, kit: 3 });
  const electronic = drumsVoice.render(context("oh", rate), { ...defaults, kit: 1 });
  assert.ok(rms(acoustic, Math.round(.45 * rate), Math.round(.5 * rate)) >
    rms(electronic, Math.round(.45 * rate), Math.round(.5 * rate)));
});

void test("lo-fi kit holds and quantizes to at most 256 output levels and softens high-band transients", () => {
  for (const rate of [44100, 48000]) {
    const classic = drumsVoice.render(context("sd", rate), defaults);
    const lofi = drumsVoice.render(context("sd", rate), { ...defaults, kit: 4 });
    assert.ok(new Set(lofi).size <= 256, `${rate} unique ${new Set(lofi).size}`);
    assert.ok(highpassRms(lofi, 0, Math.round(.08 * rate), rate) <
      highpassRms(classic, 0, Math.round(.08 * rate), rate));
  }
});

void test("tone, decay and noise controls change their corresponding sound traits", () => {
  const rate = 44100;
  const lowTone = drumsVoice.render(context("bd", rate), { ...defaults, kit: 1, tone: 0 });
  const highTone = drumsVoice.render(context("bd", rate), { ...defaults, kit: 1, tone: 1 });
  assert.ok(crossings(highTone, Math.round(.2 * rate), Math.round(.5 * rate), rate) >
    crossings(lowTone, Math.round(.2 * rate), Math.round(.5 * rate), rate));
  const short = drumsVoice.render(context("bd", rate), { ...defaults, kit: 1, decayMs: 60 });
  const long = drumsVoice.render(context("bd", rate), { ...defaults, kit: 1, decayMs: 600 });
  assert.ok(rms(long, Math.round(.4 * rate), Math.round(.5 * rate)) >
    rms(short, Math.round(.4 * rate), Math.round(.5 * rate)) * 10);
  const quiet = drumsVoice.render(context("sd", rate), { ...defaults, kit: 1, noise: 0 });
  const noisy = drumsVoice.render(context("sd", rate), { ...defaults, kit: 1, noise: 1 });
  assert.ok(highpassRms(noisy, 0, Math.round(.03 * rate), rate) >
    highpassRms(quiet, 0, Math.round(.03 * rate), rate));
});

void test("changing the event seed changes attack noise without moving the kick's late pitch", () => {
  for (const rate of [44100, 48000]) {
    const ctx = context("bd", rate);
    const first = drumsVoice.render(ctx, { ...defaults, kit: 1 });
    ctx.events[0]!.seed = 50;
    const second = drumsVoice.render(ctx, { ...defaults, kit: 1 });
    assert.notDeepEqual(first.subarray(0, Math.round(.01 * rate)),
      second.subarray(0, Math.round(.01 * rate)));
    assert.equal(crossings(first, Math.round(.25 * rate), Math.round(.55 * rate), rate),
      crossings(second, Math.round(.25 * rate), Math.round(.55 * rate), rate));
  }
});

void test("kit selector accepts only integers 0 through 4 and keeps the eight sample names", () => {
  assert.deepEqual(drumsVoice.sampleNames, NAMES);
  for (const kit of [0, 1, 2, 3, 4]) {
    const song = validateSong({ version: 1, bpm: 120, tracks: [{ id: "drum", kind: "drums",
      instrument: "drums", pattern: "bd", params: { kit } }],
    sections: [{ id: "one", bars: 1 }], arrangement: [{ section: "one" }] });
    assert.doesNotThrow(() => validateVoiceParams(song));
  }
  for (const kit of [-1, .5, 5]) {
    const song = validateSong({ version: 1, bpm: 120, tracks: [{ id: "drum", kind: "drums",
      instrument: "drums", pattern: "bd", params: { kit } }],
    sections: [{ id: "one", bars: 1 }], arrangement: [{ section: "one" }] });
    assert.throws(() => validateVoiceParams(song), (error: unknown) => {
      assert.ok(error instanceof Music2Error);
      assert.equal(error.code, "E_SCHEMA");
      assert.deepEqual(error.details?.["issues"], [{ path: "tracks[0].params.kit",
        message: kit === .5 ? "must be an integer" : "must be in [0,4]" }]);
      return true;
    });
  }
  assert.throws(() => drumsVoice.render(context("cowbell"), { ...defaults, kit: 2 }),
    (error: unknown) => error instanceof Music2Error && error.code === "E_SCHEMA");
});

void test("selector 4 preserves the requested output sample rate through the mixer", async () => {
  for (const rate of [44100, 48000]) {
    const song = validateSong({ version: 1, bpm: 120, sampleRate: rate, tailSeconds: 0,
      tracks: [{ id: "drum", kind: "drums", instrument: "drums", pattern: "bd ~ hh ~",
        params: { kit: 4 } }], sections: [{ id: "one", bars: 1 }],
      arrangement: [{ section: "one" }] });
    validateVoiceParams(song);
    const result = await mixTracks(song, buildTimeline(song), "fixture.song.json");
    assert.equal(result.audio.sampleRate, rate);
    assert.equal(result.audio.left.length, 2 * rate);
    assert.ok(result.audio.left.every(Number.isFinite));
  }
});
