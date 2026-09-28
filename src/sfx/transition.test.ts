import test from "node:test";
import assert from "node:assert/strict";
import { TRANSITION_ATOMS, TRANSITION_KEYS, TRANSITION_PARAMS } from "./presets.tool.ts";
import { renderTransition, transitionTailSeconds } from "./transition.tool.ts";

function rms(x: Float32Array, start: number, end: number): number {
  let energy = 0;
  for (let i = start; i < end; i++) energy += x[i]! ** 2;
  return Math.sqrt(energy / Math.max(1, end - start));
}
function brightness(x: Float32Array, start: number, end: number): number {
  let difference = 0; let energy = 0;
  for (let i = start + 1; i < end; i++) {
    difference += (x[i]! - x[i - 1]!) ** 2;
    energy += x[i]! ** 2;
  }
  return difference / Math.max(1e-12, energy);
}
function pitch(x: Float32Array, start: number, end: number, rate: number): number {
  let crossings = 0;
  for (let i = start + 1; i < end; i++) if (x[i - 1]! < 0 && x[i]! >= 0) crossings++;
  return crossings * rate / (end - start);
}
function periodicPitch(x: Float32Array, start: number, end: number, rate: number,
  minHz: number, maxHz: number): number {
  let bestLag = 0; let best = -Infinity;
  for (let lag = Math.floor(rate / maxHz); lag <= Math.ceil(rate / minHz); lag++) {
    let correlation = 0; let energy = 0;
    for (let i = start; i + lag < end; i++) {
      correlation += x[i]! * x[i + lag]!;
      energy += x[i]! ** 2;
    }
    const score = correlation / energy;
    if (score > best) { best = score; bestLag = lag; }
  }
  return rate / bestLag;
}

test("all transition variants render bounded, repeatable PCM at both rates", () => {
  for (const rate of [44100, 48000]) for (const atom of TRANSITION_ATOMS) for (let variant = 0; variant < 4; variant++) {
    const a = renderTransition(atom, variant, .12, rate, 23, {});
    const b = renderTransition(atom, variant, .12, rate, 23, {});
    assert.equal(a.length, Math.round(Math.max(.12, transitionTailSeconds(atom, {})) * rate), atom);
    assert.deepEqual(a, b, `${atom}:${variant}`);
    assert.ok(a.every((sample) => Number.isFinite(sample) && Math.abs(sample) <= 1), `${atom}:${variant}`);
    if (atom !== "pitchriser" && atom !== "zap" && atom !== "subdrop") {
      assert.notDeepEqual(a, renderTransition(atom, variant, .12, rate, 24, {}), atom);
    }
  }
});

test("transition envelope, spectral and pitch trajectories", () => {
  const rate = 44100;
  const riser = renderTransition("riser", 0, 2, rate, 1, {});
  assert.ok(rms(riser, 1, 4410) * 2.5 < rms(riser, 2 * rate - 5500, 2 * rate - 1100));
  assert.ok(brightness(riser, 1, 4410) < brightness(riser, 2 * rate - 5500, 2 * rate - 1100));
  const pitchriser = renderTransition("pitchriser", 0, 2, rate, 1, {});
  assert.ok(rms(pitchriser, rate, rate + 4410) > rms(pitchriser, 1, 4410));
  const terminal = periodicPitch(pitchriser, Math.round(1.95 * rate), Math.round(1.995 * rate), rate, 600, 750);
  assert.ok(Math.abs(terminal - 220 * 2 ** (19 / 12)) / terminal < .02, String(terminal));
  const down = renderTransition("downlifter", 0, 2, rate, 1, {});
  assert.ok(rms(down, 1, 4410) > rms(down, 2 * rate - 5500, 2 * rate - 1100));
  assert.ok(brightness(down, 1, 4410) > brightness(down, 2 * rate - 5500, 2 * rate - 1100));
  const whoosh = renderTransition("whoosh", 0, .7, rate, 1, {});
  assert.ok(brightness(whoosh, 13000, 17000) > brightness(whoosh, 3000, 7000));
  assert.ok(brightness(whoosh, 13000, 17000) > brightness(whoosh, 24000, 28000));
  const cymbal = renderTransition("revcymbal", 0, 1, rate, 1, {});
  assert.ok(rms(cymbal, 1, 4410) * 3.16 < rms(cymbal, 38000, 43000));
  const build = renderTransition("noisebuild", 0, 1, rate, 1, {});
  assert.ok(rms(build, 1, 4410) < rms(build, 38000, 43000));
  assert.ok(brightness(build, 1, 4410) < brightness(build, 38000, 43000));
  const boom = renderTransition("impact", 0, .05, rate, 1, {});
  assert.ok(pitch(boom, 1, 880, rate) > 90);
  assert.ok(Math.abs(pitch(boom, 7000, 11000, rate) - 40) < 8);
  assert.ok(rms(boom, 1000, 4000) > rms(boom, 22000, 26000));
  const sub = renderTransition("subdrop", 0, .05, rate, 1, {});
  assert.ok(pitch(sub, 1, 2200, rate) > pitch(sub, 7000, 11000, rate));
  const zap = renderTransition("zap", 0, .14, rate, 1, {});
  assert.ok(pitch(zap, 1, 440, rate) > pitch(zap, 3500, 5500, rate));
  for (const [start, end] of [[0, .01], [.095, .125]] as const) {
    const measured = pitch(zap, Math.round(start * rate), Math.round(end * rate), rate);
    const analytic = 180 + 1620 * Math.exp(-(start + end) / 2 / .035);
    assert.ok(Math.abs(measured - analytic) / analytic < .1, `${measured} vs ${analytic}`);
  }
  assert.equal(renderTransition("riser", 0, .05, rate, 1, {}).length, 2205);
});

test("crackle click arrivals are seeded and statistically bounded", () => {
  const rate = 44100; const ratePerSecond = 8;
  const x = renderTransition("crackle", 0, 60, rate, 31, { crackleRate: ratePerSecond });
  let count = 0; let last = -rate;
  for (let i = 1; i < x.length; i++) if (Math.abs(x[i]! - x[i - 1]!) > .1 && i - last > .001 * rate) {
    count++; last = i;
  }
  assert.ok(Math.abs(count - 60 * ratePerSecond) < 5 * Math.sqrt(60 * ratePerSecond), `click count ${count}`);
  assert.notDeepEqual(x.subarray(0, 44100), renderTransition("crackle", 0, 1, rate, 32, {}).subarray(0, 44100));
});

test("maxFrames caps synthesis without changing the event's timing", () => {
  for (const atom of TRANSITION_ATOMS) {
    const full = renderTransition(atom, 0, 0.5, 44100, 9, {});
    const capped = renderTransition(atom, 0, 0.5, 44100, 9, {}, 1, 300);
    assert.equal(capped.length, Math.min(300, full.length), atom);
    assert.deepEqual([...capped], [...full.subarray(0, capped.length)], atom);
  }
});

test("every allowlisted control audibly changes its preset", () => {
  for (const atom of TRANSITION_ATOMS) {
    const base = renderTransition(atom, 0, 0.4, 44100, 5, {});
    for (const key of TRANSITION_KEYS[atom]) {
      const rule = TRANSITION_PARAMS[key]!;
      const value = rule.default === rule.max ? rule.min : rule.max;
      const changed = renderTransition(atom, 0, 0.4, 44100, 5, { [key]: value });
      const same = changed.length === base.length && changed.every((sample, i) => sample === base[i]);
      assert.ok(!same, atom + "." + key + " has an effect");
    }
  }
});

test("noiseColor switches white and pink noise on every variant", () => {
  for (const atom of TRANSITION_ATOMS) {
    if (!TRANSITION_KEYS[atom].includes("noiseColor")) continue;
    for (let variant = 0; variant < 4; variant++) {
      const white = renderTransition(atom, variant, 0.3, 44100, 5, { noiseColor: 0 });
      const pink = renderTransition(atom, variant, 0.3, 44100, 5, { noiseColor: 1 });
      assert.ok(white.some((sample, i) => sample !== pink[i]), atom + ":" + variant);
    }
  }
});
