import type { StereoBuffer } from "../audio-io/buffer.schema.ts";
import { Music2Error } from "../shared/index.ts";
import { BAND_EDGES_HZ, type BandMetrics, type BandValue } from "./analysis.schema.ts";
import { hann, realSpectrum } from "./fft.tool.ts";

const FFT_SIZE = 8192;
const HOP = 2048;
const BAND_NAMES = ["sub", "low", "lowMid", "mid", "presence", "air"] as const;

/** Energy shares use one-sided, unnormalized Hann-window FFT power. */
export function measureBands(pcm: StereoBuffer): BandMetrics {
  const { left, right, sampleRate, sourceChannels } = pcm;
  if (!Number.isFinite(sampleRate) || sampleRate <= 4000 ||
      !(left instanceof Float32Array) || !(right instanceof Float32Array) ||
      left.length === 0 || left.length !== right.length ||
      (sourceChannels !== 1 && sourceChannels !== 2)) {
    throw new Music2Error("E_INPUT", "invalid PCM for band analysis");
  }

  const mono = new Float32Array(left.length);
  for (let i = 0; i < left.length; i++) {
    const l = left[i]!;
    const r = right[i]!;
    if (!Number.isFinite(l) || !Number.isFinite(r)) throw new Music2Error("E_INPUT", "nonfinite PCM sample");
    mono[i] = sourceChannels === 1 ? l : (l + r) / 2;
  }

  const powers = new Float64Array(BAND_NAMES.length);
  const upperHz = Math.min(BAND_EDGES_HZ[6], sampleRate / 2);
  const binHz = sampleRate / FFT_SIZE;
  const firstBin = Math.ceil(BAND_EDGES_HZ[0] / binHz);
  const lastBin = Math.min(FFT_SIZE / 2, Math.floor(upperHz / binHz));
  const binBand = new Int8Array(FFT_SIZE / 2 + 1).fill(-1);
  for (let k = firstBin; k <= lastBin; k++) {
    const frequency = k * binHz;
    for (let band = 0; band < BAND_NAMES.length; band++) {
      const end = Math.min(BAND_EDGES_HZ[band + 1]!, upperHz);
      if (frequency >= BAND_EDGES_HZ[band]! &&
          (band === BAND_NAMES.length - 1 ? frequency <= end : frequency < end)) {
        binBand[k] = band;
        break;
      }
    }
  }

  const scratch = {
    re: new Float64Array(FFT_SIZE), im: new Float64Array(FFT_SIZE),
    out: new Float64Array(FFT_SIZE / 2 + 1),
  };
  const window = hann(FFT_SIZE);
  for (let offset = 0; offset < mono.length; offset += HOP) {
    const magnitudes = realSpectrum(mono, offset, FFT_SIZE, window, scratch);
    for (let k = firstBin; k <= lastBin; k++) {
      const band = binBand[k]!;
      if (band >= 0) powers[band] = powers[band]! + magnitudes[k]! ** 2;
    }
  }

  const total = powers.reduce((sum, value) => sum + value, 0);
  const bands: BandValue[] = BAND_NAMES.map((name, band) => {
    const share = total > 0 ? powers[band]! / total : 0;
    return {
      name, fromHz: Math.min(BAND_EDGES_HZ[band]!, upperHz),
      toHz: Math.min(BAND_EDGES_HZ[band + 1]!, upperHz),
      share, dbRelative: share > 0 ? 10 * Math.log10(share) : null,
    };
  });
  return { bands };
}
