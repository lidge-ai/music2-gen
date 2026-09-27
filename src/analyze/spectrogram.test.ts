import assert from "node:assert/strict";
import test from "node:test";
import { inflateSync } from "node:zlib";
import type { StereoBuffer } from "../audio-io/index.ts";
import type { Timeline } from "../song/index.ts";
import { INFERNO_RGB } from "./colormap.ts";
import { renderSpectrogram } from "./spectrogram.tool.ts";

function decode(bytes: Buffer): { width: number; height: number; rgb: Uint8Array } {
  assert.equal(bytes.toString("hex", 0, 8), "89504e470d0a1a0a");
  const width = bytes.readUInt32BE(16), height = bytes.readUInt32BE(20);
  const pos = bytes.indexOf("IDAT");
  const length = bytes.readUInt32BE(pos - 4);
  const raw = inflateSync(bytes.subarray(pos + 4, pos + 4 + length));
  const rgb = new Uint8Array(width * height * 3);
  for (let y = 0; y < height; y++) {
    assert.equal(raw[y * (width * 3 + 1)], 0);
    rgb.set(raw.subarray(y * (width * 3 + 1) + 1, (y + 1) * (width * 3 + 1)), y * width * 3);
  }
  return { width, height, rgb };
}

function pcm(frames: number, sampleRate = 44100, value: (i: number) => number = () => 0): StereoBuffer {
  const left = Float32Array.from({ length: frames }, (_, i) => value(i));
  return { sampleRate, left, right: left, sourceChannels: 1 };
}

function light(rgb: Uint8Array, width: number, x: number, y: number): number {
  const i = (y * width + x) * 3;
  return rgb[i]! * 0.2126 + rgb[i + 1]! * 0.7152 + rgb[i + 2]! * 0.0722;
}

test("Inferno LUT has published anchors", () => {
  assert.equal(INFERNO_RGB.length, 768);
  assert.deepEqual(INFERNO_RGB.slice(0, 3), [0, 0, 4]);
  assert.deepEqual(INFERNO_RGB.slice(-3), [252, 255, 164]);
});

test("1 kHz sine draws a persistent horizontal ridge at logarithmic row", () => {
  const image = decode(renderSpectrogram(pcm(44100, 44100, (i) => 0.8 * Math.sin(2 * Math.PI * 1000 * i / 44100))));
  assert.equal(image.height, 536);
  const expected = Math.round((1 - Math.log(1000 / 30) / Math.log(20000 / 30)) * 511);
  for (const x of [54, Math.floor((image.width + 48) / 2), image.width - 5]) {
    let best = -1, bestY = -1;
    for (let y = 20; y < 500; y++) {
      const value = light(image.rgb, image.width, x, y);
      if (value > best) { best = value; bestY = y; }
    }
    assert.ok(Math.abs(bestY - expected) <= 2, `${bestY} versus ${expected}`);
  }
});

test("impulse makes a narrow vertical stripe", () => {
  const image = decode(renderSpectrogram(pcm(44100, 44100, (i) => i === 20000 ? 1 : 0)));
  const brightness: number[] = [];
  for (let x = 48; x < image.width; x++) {
    let sum = 0;
    for (let y = 50; y < 450; y += 10) sum += light(image.rgb, image.width, x, y);
    brightness.push(sum);
  }
  assert.ok(Math.max(...brightness) > brightness[0]! * 3);
  assert.ok(brightness.filter((v) => v > Math.max(...brightness) * 0.5).length < brightness.length / 3);
});

test("width tracks frames, caps at 2400 data columns, and timeline adds bar grid", () => {
  const tenSeconds = pcm(441000);
  const image = decode(renderSpectrogram(tenSeconds));
  assert.equal(image.width, 48 + Math.ceil((441000 - 4096) / 1024) + 1);
  const timeline: Timeline = { bars: 5, secondsPerBar: 2, durationSeconds: 10, placements: [], events: [] };
  const withBars = decode(renderSpectrogram(tenSeconds, timeline));
  const x = 48 + Math.round(2 / 10 * (image.width - 48));
  assert.notDeepEqual([...image.rgb.subarray(x * 3, x * 3 + 3)], [...withBars.rgb.subarray(x * 3, x * 3 + 3)]);
  const long = decode(renderSpectrogram(pcm(4096 + 2401 * 1024)));
  assert.equal(long.width, 2448);
});
