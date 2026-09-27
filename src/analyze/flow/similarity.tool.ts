import type { Timeline } from "../../song/index.ts";
import type { FlowFeature, FlowIntervalGrid, FlowNoveltyPeak, FlowRepeat, FlowSimilarityData } from "./flow.schema.ts";

function median(values: number[]): number {
  if (values.length === 0) return 0;
  values.sort((a, b) => a - b);
  const middle = Math.floor(values.length / 2);
  return values.length % 2 ? values[middle]! : (values[middle - 1]! + values[middle]!) / 2;
}

function kernelRadius(grid: FlowIntervalGrid): number {
  const count = grid.intervals.length;
  const cap = Math.max(1, Math.floor(count / 6));
  if (grid.axisKind === "bars") return Math.min(4, cap);
  if (grid.axisKind === "0.5 s") return Math.min(8, cap);
  const durations = grid.intervals.map((row) => row.endSeconds - row.startSeconds);
  const beatSeconds = median(durations);
  return Math.max(1, Math.min(Math.round(4 / beatSeconds), 8, cap));
}

function noveltyMatrix(matrix: Float32Array, count: number, radius: number): Float32Array {
  const novelty = new Float32Array(count + 1);
  const gaussian = Array.from({ length: radius * 2 }, (_, index) => {
    const offset = index - radius;
    return Math.exp(-((offset + .5) ** 2) / (2 * (radius / 2) ** 2));
  });
  let weight = 0;
  for (const a of gaussian) for (const b of gaussian) weight += a * b;
  for (let boundary = radius; boundary + radius <= count; boundary++) {
    let value = 0;
    for (let u = -radius; u < radius; u++) for (let v = -radius; v < radius; v++) {
      const sign = (u < 0) === (v < 0) ? 1 : -1;
      value += sign * gaussian[u + radius]! * gaussian[v + radius]! * matrix[(boundary + u) * count + boundary + v]!;
    }
    novelty[boundary] = Math.max(0, value / weight);
  }
  return novelty;
}

function peaksOf(novelty: Float32Array, grid: FlowIntervalGrid, radius: number,
  timeline?: Timeline): FlowNoveltyPeak[] {
  const scores = Array.from(novelty.subarray(radius, novelty.length - radius));
  const middle = median(scores);
  const threshold = Math.max(.08, middle + 2 * median(scores.map((score) => Math.abs(score - middle))));
  const candidates: { boundary: number; score: number }[] = [];
  for (let boundary = radius; boundary + radius <= grid.intervals.length; boundary++) {
    const score = novelty[boundary]!;
    if (score <= threshold || score <= (novelty[boundary - 1] ?? -1) || score <= (novelty[boundary + 1] ?? -1)) continue;
    candidates.push({ boundary, score });
  }
  candidates.sort((a, b) => b.score - a.score || a.boundary - b.boundary);
  const accepted: typeof candidates = [];
  for (const candidate of candidates) if (accepted.every((peak) => Math.abs(peak.boundary - candidate.boundary) >= radius)) accepted.push(candidate);
  accepted.sort((a, b) => a.boundary - b.boundary);
  return accepted.map(({ boundary, score }) => ({
    atSeconds: grid.intervals[boundary]!.startSeconds,
    atBar: grid.axisKind === "bars" ? boundary + 1 : null,
    score,
    declaredHit: timeline ? timeline.placements.slice(1).some((placement) => Math.abs(placement.startBar - boundary) <= 1) : null,
  }));
}

function repeated(matrix: Float32Array, grid: FlowIntervalGrid): FlowRepeat[] {
  const count = grid.intervals.length;
  const candidates: { first: number; second: number; length: number; mean: number }[] = [];
  for (let lag = 8; lag < count; lag++) {
    let begin = -1, sum = 0;
    for (let index = 0; index <= count - lag; index++) {
      const score = index < count - lag ? matrix[index * count + index + lag]! : 0;
      if (score >= .85 && index < count - lag && index - (begin < 0 ? index : begin) < lag) {
        if (begin < 0) begin = index;
        sum += score;
      } else if (begin >= 0) {
        const length = index - begin;
        if (length >= 8 && sum / length >= .90) candidates.push({ first: begin, second: begin + lag, length, mean: sum / length });
        begin = -1; sum = 0;
        if (score >= .85 && index < count - lag) { begin = index; sum = score; }
      }
    }
  }
  candidates.sort((a, b) => b.length - a.length || b.mean - a.mean || a.first - b.first || a.second - b.second);
  const selected: typeof candidates = [];
  for (const candidate of candidates) {
    if (selected.some((other) => candidate.first < other.first + other.length && other.first < candidate.first + candidate.length &&
      candidate.second < other.second + other.length && other.second < candidate.second + candidate.length)) continue;
    selected.push(candidate);
  }
  selected.sort((a, b) => a.first - b.first || a.second - b.second);
  return selected.map(({ first, second, length, mean }) => ({
    firstStartSeconds: grid.intervals[first]!.startSeconds, firstEndSeconds: grid.intervals[first + length - 1]!.endSeconds,
    secondStartSeconds: grid.intervals[second]!.startSeconds, secondEndSeconds: grid.intervals[second + length - 1]!.endSeconds,
    firstStartBar: grid.axisKind === "bars" ? first + 1 : null,
    firstEndBar: grid.axisKind === "bars" ? first + length : null,
    secondStartBar: grid.axisKind === "bars" ? second + 1 : null,
    secondEndBar: grid.axisKind === "bars" ? second + length : null,
    meanSimilarity: mean,
  }));
}

/**
 * Mean-center nonsilent feature vectors and renormalize them. Features that stay constant across the whole song
 * (a looped chord, the overall band balance) otherwise push every cosine toward 1 and hide section changes.
 * A vector equal to the song mean returns null ("flat").
 */
function centeredVectors(features: readonly FlowFeature[]): (Float64Array | null)[] {
  const mean = new Float64Array(20);
  let count = 0;
  for (const feature of features) {
    if (feature.silent) continue;
    count++;
    for (let component = 0; component < 20; component++) mean[component]! += feature.vector[component]!;
  }
  if (count > 0) for (let component = 0; component < 20; component++) mean[component]! /= count;
  return features.map((feature) => {
    if (feature.silent) return null;
    const out = new Float64Array(20);
    let norm = 0;
    for (let component = 0; component < 20; component++) {
      out[component] = feature.vector[component]! - mean[component]!;
      norm += out[component]! ** 2;
    }
    if (norm < 1e-12) return null;
    const scale = 1 / Math.sqrt(norm);
    for (let component = 0; component < 20; component++) out[component]! *= scale;
    return out;
  });
}

/** Similarity of two intervals in [0,1]: (1 + cosine of mean-centered features) / 2; silent pairs are 0. */
function pairScore(a: FlowFeature, b: FlowFeature, ca: Float64Array | null, cb: Float64Array | null): number {
  if (a.silent || b.silent) return 0;
  if (ca === null && cb === null) return 1;
  if (ca === null || cb === null) return .5;
  if (ca === cb) return 1;
  let dot = 0;
  for (let component = 0; component < 20; component++) dot += ca[component]! * cb[component]!;
  return Math.max(0, Math.min(1, (1 + dot) / 2));
}

/** Full-resolution mean-centered cosine SSM, checkerboard novelty and maximal diagonal repeats. */
export function flowSimilarity(features: readonly FlowFeature[], grid: FlowIntervalGrid, timeline?: Timeline): FlowSimilarityData {
  const size = features.length;
  const matrix = new Float32Array(size * size);
  const centered = centeredVectors(features);
  for (let row = 0; row < size; row++) for (let column = row; column < size; column++) {
    const score = pairScore(features[row]!, features[column]!, centered[row]!, centered[column]!);
    matrix[row * size + column] = matrix[column * size + row] = score;
  }
  const radius = kernelRadius(grid);
  const novelty = noveltyMatrix(matrix, size, radius);
  return { matrix, size, novelty, peaks: peaksOf(novelty, grid, radius, timeline), repeats: repeated(matrix, grid) };
}
