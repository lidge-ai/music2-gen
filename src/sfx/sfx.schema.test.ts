import test from "node:test";
import assert from "node:assert/strict";
import { Music2Error } from "../shared/index.ts";
import { parseParamsFlag, resolveSfx } from "./sfx.schema.ts";

function inputFailure(run: () => unknown): void {
  assert.throws(run, (error: unknown) => error instanceof Music2Error && error.code === "E_INPUT" && error.exit === 2);
}

test("frame realization and uint32 boundaries", () => {
  const min = resolveSfx({ preset: "riser", seconds: .05, seed: 0 });
  assert.equal(min.frames, 2205);
  assert.equal(min.seconds, 2205 / 44100);
  assert.equal(resolveSfx({ preset: "riser", seconds: .050001 }).seconds, 2205 / 44100);
  assert.equal(resolveSfx({ preset: "click", seed: 0xffffffff }).seed, 0xffffffff);
  for (const seed of [-1, 0x100000000, 1.5, NaN]) inputFailure(() => resolveSfx({ preset: "riser", seed }));
  for (const seconds of [NaN, Infinity, 0, 30.001, "2" as unknown as number]) {
    inputFailure(() => resolveSfx({ preset: "riser", seconds }));
  }
  for (const sampleRate of [44099, 96000, 44100.5]) inputFailure(() => resolveSfx({ preset: "riser", sampleRate }));
});

test("strict params parser and per-preset bounds", () => {
  assert.deepEqual(parseParamsFlag("sweepFromHz=250,sweepToHz=8000"), { sweepFromHz: 250, sweepToHz: 8000 });
  for (const text of ["", "a=1,", "a=1,,b=2", "a", "a=1=2", "a=1,a=2", "a=NaN", "a=Infinity", "a=1e309"]) {
    inputFailure(() => parseParamsFlag(text));
  }
  inputFailure(() => resolveSfx({ preset: "riser", params: { unknown: 1 } }));
  inputFailure(() => resolveSfx({ preset: "riser", params: { impactDecay: 1 } }));
  inputFailure(() => resolveSfx({ preset: "riser", params: { noiseColor: .5 } }));
  inputFailure(() => resolveSfx({ preset: "pickup", params: { repeat: .1 } }));
  inputFailure(() => resolveSfx({ preset: "laser", params: { slide: -14.001 } }));
  inputFailure(() => resolveSfx({ preset: "pickup", params: { sustain: .001 } }));
  inputFailure(() => resolveSfx({ preset: "laser", params: { wave: 1.5 } }));
  inputFailure(() => resolveSfx({ preset: "powerup", params: { repeat: .001 } }));
  inputFailure(() => resolveSfx({ preset: "explosion", params: { lpHz: 21601 } }));
  assert.equal(resolveSfx({ preset: "laser", params: { slide: -14 } }).params.slide, -14);
  assert.equal(resolveSfx({ preset: "riser", params: { noiseColor: 1 } }).params.noiseColor, 1);
  assert.equal(resolveSfx({ preset: "riser", params: { noiseColor: 0 } }).params.noiseColor, 0);
});

test("canonical order ignores input insertion order", () => {
  const a = resolveSfx({ preset: "pitchriser", params: { pitchHz: 180, riserSemitones: 12 } });
  const b = resolveSfx({ preset: "pitchriser", params: { riserSemitones: 12, pitchHz: 180 } });
  assert.equal(JSON.stringify(a), JSON.stringify(b));
  assert.deepEqual(Object.keys(a.params), ["riserSemitones", "pitchHz"]);
  inputFailure(() => resolveSfx({ preset: "nonesuch" }));
});
