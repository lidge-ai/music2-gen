import type { StereoBuffer } from "../../audio-io/buffer.schema.ts";
import { BAND_EDGES_HZ } from "../analysis.schema.ts";
import { hann, realSpectrum } from "../fft.tool.ts";
import type { FlowFeature, FlowIntervalGrid } from "./flow.schema.ts";

const FFT_SIZE = 4096;
const HOP = 1024;

function median(values: number[]): number {
  if (values.length === 0) return 0;
  values.sort((a, b) => a - b);
  const middle = Math.floor(values.length / 2);
  return values.length % 2 ? values[middle]! : (values[middle - 1]! + values[middle]!) / 2;
}

function onsetPeaks(onset: Float64Array): number[] {
  const candidates: { frame: number; strength: number }[] = [];
  for (let frame = 1; frame < onset.length - 1; frame++) {
    const value = onset[frame]!;
    if (value <= onset[frame - 1]! || value < onset[frame + 1]!) continue;
    const neighborhood = Array.from(onset.subarray(Math.max(0, frame - 50), Math.min(onset.length, frame + 51)));
    const center = median(neighborhood);
    const mad = median(neighborhood.map((item) => Math.abs(item - center)));
    if (value > Math.max(.15, center + 3 * mad)) candidates.push({ frame, strength: value });
  }
  candidates.sort((a, b) => b.strength - a.strength || a.frame - b.frame);
  const accepted: number[] = [];
  for (const candidate of candidates) if (accepted.every((frame) => Math.abs(frame - candidate.frame) >= 5)) accepted.push(candidate.frame);
  return accepted.sort((a, b) => a - b);
}

function normalize(values: Float64Array): void {
  let sum = 0;
  for (const value of values) sum += value * value;
  if (sum > 0) {
    const length = Math.sqrt(sum);
    for (let index = 0; index < values.length; index++) values[index] = values[index]! / length;
  }
}

/** Spectral and onset features assigned by frame center to half-open intervals. */
export function intervalFeatures(pcm: StereoBuffer, grid: FlowIntervalGrid, onset: Float64Array,
  intervalLufs: readonly (number | null)[]): FlowFeature[] {
  const rows = grid.intervals;
  const features = rows.map(() => ({ chroma: new Float64Array(12), bands: new Float64Array(6),
    centroidNumerator: 0, centroidDenominator: 0, count: 0 }));
  const peaks = onsetPeaks(onset);
  const counts = new Uint32Array(rows.length);
  let interval = 0;
  for (const frame of peaks) {
    const time = frame / 100;
    while (interval < rows.length && time >= rows[interval]!.endSeconds) interval++;
    if (interval < rows.length && time >= rows[interval]!.startSeconds) counts[interval] = counts[interval]! + 1;
  }
  const mono = new Float32Array(pcm.left.length);
  for (let index = 0; index < mono.length; index++) mono[index] = pcm.sourceChannels === 1 ? pcm.left[index]! :
    (pcm.left[index]! + pcm.right[index]!) / 2;
  const scratch = { re: new Float64Array(FFT_SIZE), im: new Float64Array(FFT_SIZE), out: new Float64Array(FFT_SIZE / 2 + 1) };
  const window = hann(FFT_SIZE);
  const binHz = pcm.sampleRate / FFT_SIZE;
  const last = Math.floor(Math.min(20000, pcm.sampleRate / 2) / binHz);
  interval = 0;
  for (let offset = 0; offset < mono.length; offset += HOP) {
    const centerSeconds = Math.min(mono.length, offset + FFT_SIZE / 2) / pcm.sampleRate;
    while (interval < rows.length && centerSeconds >= rows[interval]!.endSeconds) interval++;
    if (interval >= rows.length) break;
    if (centerSeconds < rows[interval]!.startSeconds) continue;
    const spectrum = realSpectrum(mono, offset, FFT_SIZE, window, scratch);
    const row = features[interval]!;
    let magnitudeSum = 0, weightedFrequency = 0;
    for (let bin = Math.max(1, Math.ceil(20 / binHz)); bin <= last; bin++) {
      const frequency = bin * binHz;
      const magnitude = spectrum[bin]!;
      magnitudeSum += magnitude;
      weightedFrequency += frequency * magnitude;
      for (let band = 0; band < 6; band++) {
        if (frequency >= BAND_EDGES_HZ[band]! && frequency < BAND_EDGES_HZ[band + 1]!) {
          row.bands[band] = row.bands[band]! + magnitude * magnitude;
          break;
        }
      }
      if (frequency >= 100 && frequency <= 5000 && magnitude > 0) {
        const midi = Math.round(69 + 12 * Math.log2(frequency / 440));
        const pitch = ((midi % 12) + 12) % 12;
        row.chroma[pitch] = row.chroma[pitch]! + magnitude;
      }
    }
    row.centroidNumerator += weightedFrequency;
    row.centroidDenominator += magnitudeSum;
    row.count++;
  }
  return rows.map((entry, index) => {
    const row = features[index]!;
    const duration = entry.endSeconds - entry.startSeconds;
    const onsetCount = counts[index]!;
    const onsetsPerSecond = duration > 0 ? onsetCount / duration : 0;
    const silent = row.centroidDenominator <= 1e-8 && intervalLufs[index] === null;
    const vector = new Float32Array(20);
    if (!silent) {
      for (let band = 0; band < 6; band++) {
        const power = row.count > 0 ? row.bands[band]! / row.count / (FFT_SIZE / 2) ** 2 : 0;
        row.bands[band] = Math.max(0, Math.min(1, (10 * Math.log10(Math.max(power, 1e-8)) + 80) / 80));
      }
      normalize(row.chroma); normalize(row.bands);
      for (let pitch = 0; pitch < 12; pitch++) vector[pitch] = .5 * row.chroma[pitch]!;
      for (let band = 0; band < 6; band++) vector[12 + band] = .3 * row.bands[band]!;
      vector[18] = .1 * Math.min(8, onsetsPerSecond) / 8;
      vector[19] = .1 * Math.max(0, Math.min(1, ((intervalLufs[index] ?? -60) + 60) / 60));
      let norm = 0;
      for (const value of vector) norm += value * value;
      if (norm > 0) for (let position = 0; position < vector.length; position++) vector[position] = vector[position]! / Math.sqrt(norm);
    }
    return { vector, silent, onsetCount, onsetsPerSecond,
      centroidHz: row.centroidDenominator > 1e-8 ? row.centroidNumerator / row.centroidDenominator : null };
  });
}
