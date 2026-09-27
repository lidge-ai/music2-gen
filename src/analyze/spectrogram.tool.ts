import type { StereoBuffer } from "../audio-io/index.ts";
import type { Timeline } from "../song/index.ts";
import { Music2Error } from "../shared/index.ts";
import { INFERNO_RGB } from "./colormap.ts";
import { hann, realSpectrum } from "./fft.tool.ts";
import { drawText } from "./font.tool.ts";
import { encodeRgbPng } from "./png.tool.ts";

const FFT_SIZE = 4096;
const HOP = 1024;
const DATA_HEIGHT = 512;
const LEFT = 48;
const BOTTOM = 24;
const LABEL = [220, 230, 239] as const;

function pixel(rgb: Uint8Array, width: number, x: number, y: number, color: readonly number[]): void {
  const i = (y * width + x) * 3;
  rgb[i] = color[0]!; rgb[i + 1] = color[1]!; rgb[i + 2] = color[2]!;
}

/** Log-frequency, -80..0 dBFS spectrogram with optional musical bar grid. */
export function renderSpectrogram(pcm: StereoBuffer, timeline?: Timeline): Buffer {
  const { left, right, sampleRate, sourceChannels } = pcm;
  if (!Number.isFinite(sampleRate) || sampleRate <= 4000 || left.length === 0 ||
      left.length !== right.length || (sourceChannels !== 1 && sourceChannels !== 2)) {
    throw new Music2Error("E_INPUT", "invalid PCM for spectrogram");
  }
  const mono = new Float32Array(left.length);
  for (let i = 0; i < mono.length; i++) {
    const l = left[i]!; const r = right[i]!;
    if (!Number.isFinite(l) || !Number.isFinite(r)) throw new Music2Error("E_INPUT", "nonfinite PCM sample");
    mono[i] = sourceChannels === 1 ? l : (l + r) / 2;
  }
  const frames = Math.max(1, Math.ceil((mono.length - FFT_SIZE) / HOP) + 1);
  const dataWidth = Math.min(2400, frames);
  const width = dataWidth + LEFT;
  const height = DATA_HEIGHT + BOTTOM;
  const rgb = new Uint8Array(width * height * 3);
  const window = hann(FFT_SIZE);
  const normalizer = window.reduce((sum, v) => sum + v, 0) / 2;
  const maxHz = Math.max(30, Math.min(20000, sampleRate / 2));
  const bins = new Float64Array(DATA_HEIGHT);
  for (let y = 0; y < DATA_HEIGHT; y++) {
    const frequency = 30 * (maxHz / 30) ** (1 - y / (DATA_HEIGHT - 1));
    bins[y] = Math.min(FFT_SIZE / 2, frequency * FFT_SIZE / sampleRate);
  }
  const accum = new Float64Array(DATA_HEIGHT);
  const scratch = { re: new Float64Array(FFT_SIZE), im: new Float64Array(FFT_SIZE), out: new Float64Array(FFT_SIZE / 2 + 1) };
  let column = 0;
  let count = 0;
  function flush(): void {
    if (!count) return;
    for (let y = 0; y < DATA_HEIGHT; y++) {
      const db = 10 * Math.log10(Math.max(1e-16, accum[y]! / count));
      const index = Math.round(Math.max(0, Math.min(1, (db + 80) / 80)) * 255) * 3;
      const target = (y * width + LEFT + column) * 3;
      rgb[target] = INFERNO_RGB[index]!;
      rgb[target + 1] = INFERNO_RGB[index + 1]!;
      rgb[target + 2] = INFERNO_RGB[index + 2]!;
      accum[y] = 0;
    }
    count = 0;
  }
  for (let frame = 0; frame < frames; frame++) {
    const target = Math.floor(frame * dataWidth / frames);
    if (target !== column) { flush(); column = target; }
    const magnitudes = realSpectrum(mono, frame * HOP, FFT_SIZE, window, scratch);
    for (let y = 0; y < DATA_HEIGHT; y++) {
      const at = bins[y]!;
      const low = Math.floor(at);
      const upper = Math.min(low + 1, FFT_SIZE / 2);
      const mix = at - low;
      const a = magnitudes[low]! / normalizer;
      const b = magnitudes[upper]! / normalizer;
      accum[y] = accum[y]! + a * a * (1 - mix) + b * b * mix;
    }
    count++;
  }
  flush();

  const ticks: readonly [number, string][] = [[30, "30"], [100, "100"], [1000, "1K"], [10000, "10K"], [20000, "20K"]];
  for (const [hz, label] of ticks) {
    if (hz > maxHz) continue;
    const y = Math.round((1 - Math.log(hz / 30) / Math.log(maxHz / 30)) * (DATA_HEIGHT - 1));
    for (let x = LEFT - 4; x < LEFT; x++) pixel(rgb, width, x, y, LABEL);
    drawText(rgb, width, height, 2, Math.max(0, Math.min(DATA_HEIGHT - 7, y - 3)), label, LABEL);
  }
  drawText(rgb, width, height, 1, DATA_HEIGHT + 3, "HZ", LABEL);
  drawText(rgb, width, height, LEFT + 4, DATA_HEIGHT + 3, "-80", LABEL);
  drawText(rgb, width, height, Math.max(LEFT + 28, width - 43), DATA_HEIGHT + 3, "0 DBFS", LABEL);
  if (timeline && timeline.secondsPerBar > 0) {
    const duration = mono.length / sampleRate;
    for (let bar = 0; bar <= timeline.bars; bar++) {
      const x = LEFT + Math.round(bar * timeline.secondsPerBar / duration * dataWidth);
      if (x < LEFT || x >= width) continue;
      for (let y = 0; y < DATA_HEIGHT; y++) {
        const i = (y * width + x) * 3;
        rgb[i] = Math.max(rgb[i]!, 115); rgb[i + 1] = Math.max(rgb[i + 1]!, 140);
        rgb[i + 2] = Math.max(rgb[i + 2]!, 160);
      }
      if (bar < timeline.bars) drawText(rgb, width, height, x + 2, DATA_HEIGHT + 13, `B${bar + 1}`, LABEL);
    }
  }
  return encodeRgbPng(width, height, rgb);
}
