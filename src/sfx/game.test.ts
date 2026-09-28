import test from "node:test";
import assert from "node:assert/strict";
import { resolveSfx } from "./sfx.schema.ts";
import { renderGame } from "./game.tool.ts";
import { GAME_PRESETS } from "./presets.tool.ts";

function energy(x: Float32Array, start: number, end: number): number {
  let sum = 0;
  for (let i = start; i < Math.min(end, x.length); i++) sum += x[i]! ** 2;
  return sum;
}
function brightness(x: Float32Array, start: number, end: number): number {
  let change = 0; let power = 0;
  for (let i = start + 1; i < end; i++) {
    change += (x[i]! - x[i - 1]!) ** 2;
    power += x[i]! ** 2;
  }
  return change / Math.max(power, 1e-12);
}
function freq(x: Float32Array, start: number, end: number, rate: number,
  minHz = 88, maxHz = 4410): number {
  let best = -Infinity; let chosen = 0;
  for (let lag = Math.floor(rate / maxHz); lag <= Math.ceil(rate / minHz); lag++) {
    let dot = 0; let norm = 0;
    for (let i = start; i + lag < end; i++) { dot += x[i]! * x[i + lag]!; norm += x[i]! ** 2; }
    if (norm > 0 && dot / norm > best) { best = dot / norm; chosen = lag; }
  }
  return rate / chosen;
}

test("each UI preset is deterministic, finite and bounded at both sample rates", () => {
  for (const preset of GAME_PRESETS) for (const sampleRate of [44100, 48000]) {
    const resolved = resolveSfx({ preset, sampleRate, seed: 2 });
    const a = renderGame(resolved); const b = renderGame(resolved);
    assert.equal(a.length, resolved.frames);
    assert.deepEqual(a, b, preset);
    assert.ok(a.every((sample) => Number.isFinite(sample) && Math.abs(sample) <= 1), preset);
    assert.ok(energy(a, 0, a.length) > 0, preset);
  }
});

test("UI pitch steps and slopes follow the physical controls", () => {
  const rate = 44100;
  for (const preset of ["pickup", "alert", "confirm", "error"] as const) {
    const result = resolveSfx({ preset, seed: 1, sampleRate: rate, params: { wave: 0, fstart: 600 } });
    const x = renderGame(result); const point = result.params.tArp!;
    const early = freq(x, Math.round((point - .018) * rate), Math.round((point - .002) * rate), rate);
    const late = freq(x, Math.round((point + .012) * rate), Math.round((point + .035) * rate), rate);
    if (preset === "error") assert.ok(late < early, `${preset} ${early} ${late}`);
    else assert.ok(late > early, `${preset} ${early} ${late}`);
    assert.ok(Math.abs(x[Math.round(point * rate)]! - x[Math.round(point * rate) - 1]!) < .5, preset);
  }
  const laser = resolveSfx({ preset: "laser", seed: 1, params: { wave: 0, fmin: 700, slide: -14 } });
  const x = renderGame(laser);
  assert.ok(x.some((sample) => sample !== 0));
  const last = x.findLastIndex((sample) => sample !== 0);
  assert.ok(last < x.length - 1000, `laser stop ${last}/${x.length}`);
  assert.ok(freq(x, 100, 800, rate) > freq(x, 1800, 2500, rate));
  const jump = resolveSfx({ preset: "jump", seed: 1, params: { wave: 0 } });
  const j = renderGame(jump);
  assert.ok(freq(j, 300, 1100, rate) < freq(j, 2500, 3300, rate));
  const blip = resolveSfx({ preset: "blip", seed: 1, params: { wave: 0, slide: 0 } });
  const b = renderGame(blip);
  const target = blip.params.fstart!;
  assert.ok(Math.abs(freq(b, 200, 800, rate, target * .9, target * 1.1) -
    freq(b, 900, 1500, rate, target * .9, target * 1.1)) < 30);
  assert.ok(energy(b, Math.round(.065 * rate), b.length) < energy(b, 0, Math.round(.065 * rate)));
});

test("UI temporal and spectral contours", () => {
  const rate = 44100;
  const hit = renderGame(resolveSfx({ preset: "hit", seed: 1 }));
  let peak = 0;
  for (let i = 1; i < hit.length; i++) if (Math.abs(hit[i]!) > Math.abs(hit[peak]!)) peak = i;
  assert.ok(peak < .02 * rate, `hit peak ${peak}`);
  assert.ok(energy(hit, 0, 2000) > energy(hit, 4000, 6000));
  const click = renderGame(resolveSfx({ preset: "click", seed: 1 }));
  assert.ok(energy(click, 0, Math.round(.03 * rate)) / energy(click, 0, click.length) >= .9);
  const explosion = renderGame(resolveSfx({ preset: "explosion", seed: 1 }));
  assert.ok(energy(explosion, 0, 8000) > energy(explosion, 25000, 33000));
  assert.ok(brightness(explosion, 0, 4410) > brightness(explosion, 9000, 13500));
  const powerup = renderGame(resolveSfx({ preset: "powerup", seed: 1,
    params: { wave: 0, vDepth: 0, repeat: .12, slide: 6, fstart: 300 } }));
  assert.ok(powerup.some((sample) => sample !== 0));
  const crossingRate = (start: number, end: number): number => {
    let count = 0;
    for (let i = Math.round(start * rate) + 1; i < Math.round(end * rate); i++) {
      if (powerup[i - 1]! < 0 && powerup[i]! >= 0) count++;
    }
    return count / (end - start);
  };
  assert.ok(crossingRate(.075, .11) > crossingRate(.025, .05));
  assert.ok(crossingRate(.075, .11) > crossingRate(.14, .17));
  assert.ok(crossingRate(.195, .22) > crossingRate(.14, .17));
  const tail = energy(powerup, powerup.length - 500, powerup.length);
  assert.ok(tail < energy(powerup, 500, 1000));
});
