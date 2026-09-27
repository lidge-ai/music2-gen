import assert from "node:assert/strict";
import test from "node:test";
import { inflateSync } from "node:zlib";
import type { AnalysisJson } from "../analysis.schema.ts";
import type { FlowRenderData } from "../flow/flow.schema.ts";
import type { Timeline } from "../../song/timeline.tool.ts";
import { renderOverview } from "./overview.tool.ts";

function fixture(count: number, matrixSize = 16): { analysis: AnalysisJson; flow: FlowRenderData; timeline: Timeline } {
  const placements = Array.from({ length: count }, (_, i) => ({ section: i === 1 ? "hook" : `part${i}`,
    entry: i, repeat: 0, ordinal: i, occurrence: 0, startBar: i * 4, bars: 4,
    role: i === 1 ? "hook" as const : "verse" as const }));
  const timeline: Timeline = { bars: count * 4, secondsPerBar: 1, durationSeconds: count * 4,
    placements, events: [] };
  const matrix = new Float32Array(matrixSize * matrixSize);
  for (let i = 0; i < matrixSize; i++) matrix[i * matrixSize + i] = 1;
  const flow = {
    analysis: { axisKind: "bars", intervals: Array.from({ length: count * 4 }, (_, i) => ({ index: i,
      startSeconds: i, endSeconds: i + 1, barNumber: i + 1, beatNumber: null,
      lufs: -20, onsetCount: 0, onsetsPerSecond: 0, centroidHz: 1000 })),
      shortTermLufs1Hz: [], sectionMeans: [], sectionDeltas: [], noveltyPeaks: [], repeats: [],
      verdicts: ["NO FLAGS", "SECTION GAP N/A", "FIRST HOOK HOOK#0 AT B05"], annotations: [] },
    waveform: [], loudness: { intervalLufs: [], sectionMeans: [], sectionDeltas: [], momentary10Hz: [], shortTerm10Hz: [], shortTermLufs1Hz: [] },
    similarity: { matrix, size: matrixSize, novelty: new Float32Array(count * 4), peaks: [], repeats: [] },
  } as FlowRenderData;
  const analysis = {
    durationSeconds: count * 4, declaredBpm: 120, estimatedBpm: 120, declaredKey: "C MINOR",
    estimatedKey: null, integratedLufs: -14.1, truePeakEstimateDbtp: -1.3, bands: [],
    sections: placements.map((p, i) => ({ id: `${p.section}#0`, role: p.role, integratedLufs: -20 + i,
      startSeconds: p.startBar, endSeconds: p.startBar + 4 })),
  } as unknown as AnalysisJson;
  return { analysis, flow, timeline };
}

function decoded(png: Buffer): { width: number; height: number; pixel: (x: number, y: number) => number[] } {
  const width = png.readUInt32BE(16); const height = png.readUInt32BE(20);
  const chunks: Buffer[] = [];
  let cursor = 8;
  while (cursor < png.length) {
    const length = png.readUInt32BE(cursor);
    if (png.toString("ascii", cursor + 4, cursor + 8) === "IDAT") chunks.push(png.subarray(cursor + 8, cursor + 8 + length));
    cursor += length + 12;
  }
  const raw = inflateSync(Buffer.concat(chunks));
  return { width, height, pixel: (x, y) => {
    const at = y * (width * 3 + 1) + 1 + x * 3;
    return [raw[at]!, raw[at + 1]!, raw[at + 2]!];
  } };
}

test("20 and 21 occurrence IHDR sizes, deterministic bytes, background and hook border", () => {
  const first = fixture(20);
  const png = renderOverview(first.analysis, first.flow, undefined, first.timeline);
  assert.deepEqual(png, renderOverview(first.analysis, first.flow, undefined, first.timeline));
  const pixels = decoded(png);
  assert.equal(pixels.width, 1600); assert.equal(pixels.height, 1400);
  assert.deepEqual(pixels.pixel(0, 0), [15, 23, 34]);
  assert.deepEqual(pixels.pixel(1196, 230), [230, 159, 0]);
  assert.deepEqual(pixels.pixel(900, 1034), [255, 240, 150]);
  const overflow = fixture(21);
  assert.equal(decoded(renderOverview(overflow.analysis, overflow.flow, undefined, overflow.timeline)).height, 1450);
});

test("257-cell SSM is averaged into a 256-square inset without changing source cells", () => {
  const input = fixture(3, 257);
  const before = input.flow.similarity.matrix.slice();
  const pixels = decoded(renderOverview(input.analysis, input.flow, undefined, input.timeline));
  assert.ok(pixels.pixel(900, 1034)[0]! > 20);
  assert.deepEqual(input.flow.similarity.matrix, before);
  assert.deepEqual(pixels.pixel(1136, 1270), [15, 23, 34]);
});

test("WAV rail spells out missing declared sections and null loudness", () => {
  const input = fixture(3);
  input.flow.analysis.axisKind = "0.5 s";
  input.flow.analysis.intervals[0]!.lufs = null;
  const pixels = decoded(renderOverview(input.analysis, input.flow));
  assert.deepEqual(pixels.pixel(1200, 230), [241, 245, 249]); // N of NO DECLARED SECTIONS
  assert.equal(pixels.height, 1400);
});
