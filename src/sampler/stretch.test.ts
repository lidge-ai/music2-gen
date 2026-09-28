import assert from "node:assert/strict";
import { test } from "node:test";
import type { StereoBuffer } from "../audio-io/buffer.schema.ts";
import { Music2Error } from "../shared/index.ts";
import { timeStretch } from "./stretch.tool.ts";

const RATE = 48000;

function tone(seconds: number): StereoBuffer {
  const length = Math.round(seconds * RATE);
  const left = Float32Array.from({ length }, (_, i) => {
    let value = 0;
    for (let harmonic = 1; harmonic <= 5; harmonic++) value += Math.sin(2 * Math.PI * 220 * harmonic * i / RATE) / harmonic;
    return value / 2;
  });
  return { sampleRate: RATE, left, right: Float32Array.from(left, (v) => v * 0.5), sourceChannels: 2 };
}

function rms(samples: Float32Array, from: number, to: number): number {
  let sum = 0;
  for (let i = from; i < to; i++) sum += samples[i]! ** 2;
  return Math.sqrt(sum / (to - from));
}

function fundamental(samples: Float32Array): number {
  const crossings: number[] = [];
  const from = Math.floor(samples.length / 4);
  const to = Math.floor(samples.length * 3 / 4);
  for (let i = from + 1; i < to; i++) {
    const a = samples[i - 1]!;
    const b = samples[i]!;
    if (a < 0 && b >= 0) crossings.push(i - 1 - a / (b - a));
  }
  return (crossings.length - 1) * RATE / (crossings[crossings.length - 1]! - crossings[0]!);
}

test("alpha is output/input duration for both methods, with exact ceil lengths", () => {
  const source = tone(0.25);
  for (const method of ["wsola", "pv"] as const) {
    for (const alpha of [0.5, 0.75, 1.25, 1.5, 2]) {
      const result = timeStretch(source, alpha, { method });
      assert.equal(result.left.length, Math.ceil(alpha * source.left.length));
      assert.equal(result.right.length, result.left.length);
      assert.ok(result.left.every(Number.isFinite));
      assert.ok(result.right.every(Number.isFinite));
    }
  }
});

test("alpha one bypasses exactly and returns independent channels", () => {
  const source = tone(0.1);
  for (const method of ["wsola", "pv"] as const) {
    const output = timeStretch(source, 1, { method });
    assert.deepEqual(output.left, source.left);
    assert.deepEqual(output.right, source.right);
    assert.notEqual(output.left, source.left);
  }
  const empty: StereoBuffer = { sampleRate: RATE, left: new Float32Array(), right: new Float32Array(), sourceChannels: 2 };
  assert.equal(timeStretch(empty, 1.5).left.length, 0);
});

test("220 Hz harmonic tone retains pitch, middle level and stereo balance", () => {
  const source = tone(2);
  const reference = rms(source.left, RATE / 2, RATE * 1.5);
  for (const method of ["wsola", "pv"] as const) {
    for (const alpha of [0.5, 0.75, 1.25, 1.5, 2]) {
      const output = timeStretch(source, alpha, { method });
      const measured = fundamental(output.left);
      assert.ok(Math.abs(1200 * Math.log2(measured / 220)) <= 1, `${method}/${alpha}: ${measured} Hz`);
      const middle = rms(output.left, Math.floor(output.left.length / 4), Math.floor(output.left.length * 3 / 4));
      assert.ok(Math.abs(20 * Math.log10(middle / reference)) <= 0.5, `${method}/${alpha}: ${middle}`);
      const checkAt = Math.floor(output.left.length / 2);
      for (let i = checkAt; i < checkAt + 1024; i++) assert.ok(Math.abs(output.right[i]! - output.left[i]! * 0.5) < 2e-6);
    }
  }
});

test("anchors set the final length and map a two-segment timeline", () => {
  const source = tone(1);
  const anchors = [[0, 0], [24000, 19200], [48000, 49200]] as const;
  for (const method of ["wsola", "pv"] as const) {
    const output = timeStretch(source, 1, { method, anchors });
    assert.equal(output.left.length, 49200);
    assert.ok(output.left.every(Number.isFinite));
  }
});

test("a click at an anchor stays within half a synthesis hop", () => {
  const left = new Float32Array(RATE);
  left[24000] = 1;
  const source: StereoBuffer = { sampleRate: RATE, left, right: left.slice(), sourceChannels: 2 };
  const output = timeStretch(source, 1, {
    anchors: [[0, 0], [24000, 19200], [48000, 49200]],
  });
  let peak = 0;
  for (let i = 1; i < output.left.length; i++) {
    if (Math.abs(output.left[i]!) > Math.abs(output.left[peak]!)) peak = i;
  }
  assert.ok(Math.abs(peak - 19200) <= 512, `click landed at ${peak}`);
});

test("eight separated transients retain their scaled timing when lengthened", () => {
  const left = new Float32Array(Math.round(2.1 * RATE));
  const starts = Array.from({ length: 8 }, (_, i) => Math.round((0.1 + i * 0.25) * RATE));
  for (const start of starts) left[start] = 1;
  const source: StereoBuffer = { sampleRate: RATE, left, right: left.slice(), sourceChannels: 2 };
  for (const method of ["wsola", "pv"] as const) {
    for (const alpha of [1.5, 2]) {
      const output = timeStretch(source, alpha, { method });
      for (const start of starts) {
        const expected = Math.round(alpha * start);
        let peak = expected - Math.round(0.05 * RATE);
        const end = expected + Math.round(0.05 * RATE);
        for (let i = peak + 1; i <= end; i++) {
          if (Math.abs(output.left[i]!) > Math.abs(output.left[peak]!)) peak = i;
        }
        const toleranceMs = method === "wsola" ? 15 : 10;
        assert.ok(Math.abs(peak - expected) <= toleranceMs * RATE / 1000,
          `${method}/${alpha}: transient at ${start} landed at ${peak}`);
        assert.ok(Math.abs(output.left[peak]!) > 0.01);
      }
    }
  }
});

test("hard range, anchor ordering and quality warning are explicit", () => {
  const source = tone(0.05);
  assert.throws(() => timeStretch(source, 0.2), (error: unknown) => error instanceof Music2Error && error.code === "E_INPUT");
  assert.throws(() => timeStretch(source, 1, { anchors: [[0, 0], [2400, 0]] }),
    (error: unknown) => error instanceof Music2Error && error.code === "E_INPUT");
  const warnings: string[] = [];
  const output = timeStretch(source, 2.5, { warnings });
  assert.equal(output.left.length, 6000);
  assert.equal(warnings.length, 1);
});
