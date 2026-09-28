import assert from "node:assert/strict";
import test from "node:test";
import type { StereoBuffer } from "../../audio-io/index.ts";
import type { ReverbBusParams } from "./fx.schema.ts";
import { renderReverbBus } from "./reverb.tool.ts";

function settings(type: ReverbBusParams["type"], overrides: Partial<ReverbBusParams> = {}): ReverbBusParams {
  return { type, decaySeconds: 1.5, preDelayMs: 0, damping: 0.5, lowCutHz: 80, highCutHz: 16000, width: 1, mix: 1, ...overrides };
}
function impulse(fs: number, seconds: number): StereoBuffer {
  const left = new Float32Array(Math.round(fs * seconds));
  left[0] = 1;
  return { sampleRate: fs, left, right: left.slice(), sourceChannels: 2 };
}
function energyDecayTime(buffer: StereoBuffer): number {
  const energy = new Float64Array(buffer.left.length);
  let sum = 0;
  for (let i = energy.length - 1; i >= 0; i--) {
    sum += (buffer.left[i] ?? 0) ** 2 + (buffer.right[i] ?? 0) ** 2;
    energy[i] = sum;
  }
  const first = sum * 10 ** (-5 / 10);
  const last = sum * 10 ** (-35 / 10);
  let at5 = -1, at35 = -1;
  for (let i = 0; i < energy.length; i++) {
    if (at5 < 0 && (energy[i] ?? 0) <= first) at5 = i;
    if (at35 < 0 && (energy[i] ?? 0) <= last) { at35 = i; break; }
  }
  assert.ok(at5 >= 0 && at35 > at5, "EDC reaches -35 dB");
  return 2 * (at35 - at5) / buffer.sampleRate;
}
function firstNonzero(buffer: StereoBuffer): number {
  for (let i = 0; i < buffer.left.length; i++) if (buffer.left[i] !== 0 || buffer.right[i] !== 0) return i;
  return -1;
}

test("antiphase stereo send retains substantial wet energy", () => {
  const fs = 48000;
  const send = impulse(fs, 2);
  send.right[0] = -1;
  for (const type of ["room", "plate", "hall"] as const) {
    const wet = renderReverbBus(send, settings(type), { sampleRate: fs, bpm: 120 });
    let energy = 0;
    for (let i = 0; i < wet.left.length; i++) energy += wet.left[i]! ** 2 + wet.right[i]! ** 2;
    assert.ok(energy > 0.001, `${type} antiphase wet energy=${energy}`);
  }
});

for (const fs of [44100, 48000]) for (const type of ["room", "plate", "hall"] as const) {
  test(`${type} ${fs}: predelay, RT60, width and deterministic bytes`, () => {
    const send = impulse(fs, 5);
    const params = settings(type, { preDelayMs: 37, decaySeconds: 1.5 });
    const wet = renderReverbBus(send, params, { sampleRate: fs, bpm: 120 });
    assert.ok(firstNonzero(wet) >= Math.round(0.037 * fs));
    const rt = energyDecayTime(wet);
    assert.ok(Math.abs(rt - 1.5) <= 0.375, `${type} ${fs}: RT60=${rt}`);
    const repeated = renderReverbBus(send, params, { sampleRate: fs, bpm: 120 });
    assert.deepEqual(wet.left, repeated.left);
    assert.deepEqual(wet.right, repeated.right);
    const narrow = renderReverbBus(send, { ...params, width: 0 }, { sampleRate: fs, bpm: 120 });
    assert.deepEqual(narrow.left, narrow.right);
  });
}

for (const fs of [44100, 48000]) test(`decay range tracks RT60 at ${fs}`, () => {
  const send = impulse(fs, 7);
  for (const type of ["room", "plate", "hall"] as const) {
    const short = renderReverbBus(send, settings(type, { decaySeconds: 0.2 }), { sampleRate: fs, bpm: 120 });
    const long = renderReverbBus(send, settings(type, { decaySeconds: 2.5 }), { sampleRate: fs, bpm: 120 });
    const shortRt = energyDecayTime(short);
    const longRt = energyDecayTime(long);
    assert.ok(Math.abs(shortRt - 0.2) <= 0.05, `${type} short RT60=${shortRt}`);
    assert.ok(Math.abs(longRt - 2.5) <= 0.625, `${type} long RT60=${longRt}`);
    assert.ok(longRt > 1.7 * shortRt, type);
  }
});

test("return low and high cuts attenuate out-of-band tones", () => {
  const fs = 48000;
  const frames = fs * 2;
  const makeTone = (frequency: number): StereoBuffer => {
    const left = Float32Array.from({ length: frames }, (_, i) => 0.4 * Math.sin(2 * Math.PI * frequency * i / fs));
    return { sampleRate: fs, left, right: left.slice(), sourceChannels: 2 };
  };
  const rms = (audio: StereoBuffer): number => {
    let power = 0;
    for (let i = fs; i < frames; i++) power += (audio.left[i] ?? 0) ** 2;
    return Math.sqrt(power / fs);
  };
  const ctx = { sampleRate: fs, bpm: 120 };
  const low = makeTone(100);
  const high = makeTone(9000);
  const base = settings("room", { lowCutHz: 20, highCutHz: 18000 });
  assert.ok(rms(renderReverbBus(low, { ...base, lowCutHz: 1000 }, ctx)) < 0.25 * rms(renderReverbBus(low, base, ctx)));
  assert.ok(rms(renderReverbBus(high, { ...base, highCutHz: 1000 }, ctx)) < 0.25 * rms(renderReverbBus(high, base, ctx)));
});

test("max decay with zero damping stays finite for all types", () => {
  const send = impulse(48000, 4);
  for (const type of ["room", "plate", "hall"] as const) {
    const wet = renderReverbBus(send, settings(type, { decaySeconds: 8, damping: 0, width: 2 }), { sampleRate: 48000, bpm: 120 });
    for (let i = 0; i < wet.left.length; i++) assert.ok(Number.isFinite(wet.left[i]) && Number.isFinite(wet.right[i]));
  }
});

test("bus mix scales only the wet return and preserves the frame count", () => {
  const send = impulse(48000, 1);
  const ctx = { sampleRate: 48000, bpm: 120 };
  for (const type of ["room", "plate", "hall"] as const) {
    const wet = renderReverbBus(send, settings(type), ctx);
    const half = renderReverbBus(send, settings(type, { mix: 0.5 }), ctx);
    const muted = renderReverbBus(send, settings(type, { mix: 0 }), ctx);
    assert.equal(wet.left.length, send.left.length);
    assert.equal(wet.left[0], 0);
    assert.equal(wet.right[0], 0);
    for (let i = 0; i < wet.left.length; i++) {
      assert.equal(half.left[i], Math.fround((wet.left[i] ?? 0) * 0.5));
      assert.equal(half.right[i], Math.fround((wet.right[i] ?? 0) * 0.5));
      assert.equal(muted.left[i], 0);
      assert.equal(muted.right[i], 0);
    }
  }
});
