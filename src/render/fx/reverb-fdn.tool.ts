import type { StereoBuffer } from "../../audio-io/index.ts";
import type { ReverbBusParams } from "./fx.schema.ts";

const ROOM_MS = [11.3, 14.1, 17.9, 21.7, 25.9, 29.3, 34.7, 39.1];
const HALL_MS = [43.1, 52.3, 61.7, 72.1, 83.9, 94.3, 107.9, 119.3];
const INPUT_SIGNS = [1, -1, 1, 1, -1, 1, -1, -1];
const LEFT_SIGNS = [1, 1, -1, 1, -1, -1, 1, -1];
const RIGHT_SIGNS = [1, -1, 1, -1, -1, 1, 1, 1];
const NORM = 1 / Math.sqrt(8);

function primeAtLeast(n: number): number {
  let value = Math.max(2, n);
  for (;;) {
    let prime = true;
    for (let d = 2; d * d <= value; d++) if (value % d === 0) { prime = false; break; }
    if (prime) return value;
    value++;
  }
}

/** Eight prime-length lines, orthogonal Hadamard feedback and two-band line loss. */
export function renderFdn(inputL: Float32Array, inputR: Float32Array, output: StereoBuffer, params: ReverbBusParams): void {
  const fs = output.sampleRate;
  const room = params.type === "room";
  const milliseconds = room ? ROOM_MS : HALL_MS;
  const lengths = milliseconds.map(ms => primeAtLeast(Math.round(ms * fs / 1000)));
  const lines = lengths.map(n => new Float64Array(n));
  const cursor = new Int32Array(8);
  const lowState = new Float64Array(8);
  const pole = new Float64Array(8);
  const feed = new Float64Array(8);
  const mixed = new Float64Array(8);
  for (let k = 0; k < 8; k++) {
    const length = lengths[k] ?? 1;
    const g0 = Math.pow(10, -3 * length / (fs * params.decaySeconds));
    // At very short RT, ease the treble shelf so the full-band energy slope
    // stays close to the requested time while damping still absorbs more HF.
    const highRt = params.decaySeconds / (1 + 2 * params.damping * Math.min(1, params.decaySeconds / 0.7));
    const gHigh = Math.pow(10, -3 * length / (fs * highRt));
    pole[k] = (g0 - gHigh) / (g0 + gHigh);
    feed[k] = 2 * g0 * gHigh / (g0 + gHigh);
  }
  const earlyMs = [5.3, 9.7, 14.9, 22.1, 31.7];
  const early = room ? earlyMs.map(ms => Math.round(ms * fs / 1000)) : [];
  for (let i = 0; i < inputL.length; i++) {
    let left = 0, right = 0;
    for (let k = 0; k < 8; k++) {
      const value = (lines[k]?.[cursor[k] ?? 0]) ?? 0;
      mixed[k] = value;
      left += value * (LEFT_SIGNS[k] ?? 0);
      right += value * (RIGHT_SIGNS[k] ?? 0);
    }
    // In-place Walsh-Hadamard butterflies, normalized once after three passes.
    for (let span = 1; span < 8; span *= 2) {
      for (let base = 0; base < 8; base += span * 2) {
        for (let j = 0; j < span; j++) {
          const a = mixed[base + j] ?? 0;
          const b = mixed[base + j + span] ?? 0;
          mixed[base + j] = a + b;
          mixed[base + j + span] = a - b;
        }
      }
    }
    const uL = inputL[i] ?? 0;
    const uR = inputR[i] ?? 0;
    for (let k = 0; k < 8; k++) {
      const filtered = (feed[k] ?? 0) * (mixed[k] ?? 0) * NORM + (pole[k] ?? 0) * (lowState[k] ?? 0);
      lowState[k] = filtered;
      const line = lines[k];
      if (line) line[cursor[k] ?? 0] = filtered + (INPUT_SIGNS[k] ?? 0) * (k % 2 === 0 ? uL : uR) * NORM;
      const next = (cursor[k] ?? 0) + 1;
      cursor[k] = next === (lengths[k] ?? 1) ? 0 : next;
    }
    if (room) {
      // Feed-forward room reflections are deliberately short and do not alter RT60.
      left += 0.24 * (inputL[i - (early[0] ?? 0)] ?? 0) - 0.16 * (inputL[i - (early[2] ?? 0)] ?? 0) + 0.12 * (inputL[i - (early[4] ?? 0)] ?? 0);
      right += 0.21 * (inputR[i - (early[1] ?? 0)] ?? 0) - 0.14 * (inputR[i - (early[3] ?? 0)] ?? 0);
    }
    output.left[i] = left * NORM * 0.42;
    output.right[i] = right * NORM * 0.42;
  }
}
