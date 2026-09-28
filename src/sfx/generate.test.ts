import test from "node:test";
import assert from "node:assert/strict";
import { generateSfx } from "./generate.tool.ts";
import { SFX_PRESETS } from "./presets.tool.ts";
import { resolveSfx } from "./sfx.schema.ts";

test("standalone generator delivers exact-length stereo for all 21 presets", () => {
  for (const preset of SFX_PRESETS) {
    const resolved = resolveSfx({ preset, seconds: .05, sampleRate: 48000 });
    const { left, right } = generateSfx(resolved);
    assert.equal(left.length, 2400, preset);
    assert.deepEqual(left, right, preset);
    assert.ok(left.every((x) => Number.isFinite(x) && Math.abs(x) <= 1), preset);
  }
});

test("canonical input order yields identical output bytes", () => {
  const a = resolveSfx({ preset: "pitchriser", seed: 4, params: { pitchHz: 180, riserSemitones: 12 } });
  const b = resolveSfx({ preset: "pitchriser", seed: 4, params: { riserSemitones: 12, pitchHz: 180 } });
  assert.deepEqual(generateSfx(a), generateSfx(b));
});

test("48 kHz maximum controls remain finite and bounded", () => {
  const game = resolveSfx({ preset: "powerup", sampleRate: 48000, seconds: .2, params: {
    fstart: 4000, slide: 8, vDepth: 100, vRate: 12,
    lpHz: 21600, hpHz: 8000, repeat: .03, dutySlope: 2,
  } });
  const transition = resolveSfx({ preset: "riser", sampleRate: 48000, seconds: .2,
    params: { sweepFromHz: 2000, sweepToHz: 16000, noiseColor: 1 } });
  for (const resolved of [game, transition]) {
    const { left } = generateSfx(resolved);
    assert.ok(left.every((x) => Number.isFinite(x) && Math.abs(x) <= 1));
  }
});
