import { test } from "node:test";
import assert from "node:assert/strict";
import { measureAny, measureRoot } from "./pitch.tool.ts";
function tone(midi: number, harmonics = 4, rate = 48000): Float32Array {
  return Float32Array.from({ length: rate }, (_, i) => {
    const phase = 2 * Math.PI * 440 * 2 ** ((midi - 69) / 12) * i / rate;
    let value = 0; for (let h = 1; h <= harmonics; h++) value += (h === 2 ? 0.4 : 0.2 / h) * Math.sin(phase * h);
    return value;
  });
}
test("root corrects each octave independently even with a dominant second harmonic", () => {
  for (const [actual, named, offset] of [[48, 60, -1], [72, 60, 1], [36, 60, -2]]) {
    const result = measureRoot(tone(actual!), 48000, named!, null);
    assert.equal(result.midi, actual); assert.equal(result.offset, offset); assert.ok(result.confidence > 0.6);
  }
});
test("single harmonic sine and loop windows retain the fundamental", () => {
  assert.equal(measureRoot(tone(57, 1), 48000, 69, { start: 12000, end: 40000 }).midi, 57);
  const result = measureAny(tone(60.5, 1), 48000, 0.4, 0.4);
  assert.equal(result.midi, 60.5); assert.ok(result.confidence > 0.6);
  assert.equal(measureRoot(tone(64), 48000, null, null).midi, 64);
});
test("silence and tiny windows have low confidence", () => {
  assert.equal(measureRoot(new Float32Array(48000), 48000, 60, null).confidence, 0);
  assert.equal(measureAny(new Float32Array(3), 48000, 0, 1).confidence, 0);
});
