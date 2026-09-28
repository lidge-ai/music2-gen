import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { renderTransition } from "../../sfx/index.ts";
import type { TransitionAtom } from "../../sfx/index.ts";
import type { ResolvedTrack } from "../../song/index.ts";
import type { VoiceContext, VoiceEvent } from "../render.schema.ts";
import { mergeParams } from "./registry.tool.ts";
import { sfxVoice } from "./sfx.tool.ts";

const RATE = 44100;
const track = { id: "fx", kind: "drums", instrument: "sfx", params: {} } as unknown as ResolvedTrack;
function event(name: string, index: number, startFrame: number, gateFrames: number, seed = 7): VoiceEvent {
  return { midi: null, sample: { name, index }, velocity: 1, startFrame, gateFrames, stopFrame: startFrame + gateFrames,
    eventIndex: 0, seed };
}
function render(events: VoiceEvent[], frames: number, params: Record<string, number> = {}): Float32Array {
  const ctx: VoiceContext = { sampleRate: RATE, frames, track, events };
  return sfxVoice.render(ctx, mergeParams(sfxVoice, params));
}
function digest(pcm: Float32Array): string {
  return createHash("sha256").update(Buffer.from(pcm.buffer, pcm.byteOffset, pcm.byteLength)).digest("hex");
}
function rms(pcm: Float32Array, from: number, to: number): number {
  let sum = 0;
  for (let i = from; i < to; i++) sum += pcm[i]! ** 2;
  return Math.sqrt(sum / Math.max(1, to - from));
}

test("sfx voice declares the ten transition atoms as drum-kind sample names", () => {
  assert.equal(sfxVoice.kind, "drums");
  assert.deepEqual([...sfxVoice.sampleNames!], ["riser", "pitchriser", "downlifter", "impact", "whoosh", "revcymbal",
    "noisebuild", "subdrop", "zap", "crackle"]);
});

test("every atom and variant renders finite bounded audio inside its slot", () => {
  const slot = Math.round(0.5 * RATE);
  for (const name of sfxVoice.sampleNames!) {
    for (let variant = 0; variant < 4; variant++) {
      const pcm = render([event(name, variant, 100, slot)], 100 + slot + 4 * RATE);
      let peak = 0;
      for (const sample of pcm) { assert.ok(Number.isFinite(sample)); peak = Math.max(peak, Math.abs(sample)); }
      assert.ok(peak > 1e-3, `${name}:${variant} is audible`);
      assert.ok(peak <= 1, `${name}:${variant} peak ${peak}`);
      for (let i = 0; i < 100; i++) assert.equal(pcm[i], 0, "nothing before onset");
      if (name !== "impact" && name !== "subdrop") {
        assert.equal(rms(pcm, 100 + slot, pcm.length), 0, `${name} stops at the slot end`);
      }
    }
  }
});

test("variant index wraps modulo four and seed addressing is stable", () => {
  const slot = Math.round(0.3 * RATE);
  const one = render([event("riser", 1, 0, slot)], slot);
  const five = render([event("riser", 5, 0, slot)], slot);
  assert.equal(digest(one), digest(five));
  assert.equal(digest(render([event("riser", 1, 0, slot)], slot)), digest(one));
  assert.notEqual(digest(render([event("riser", 1, 0, slot, 8)], slot)), digest(one));
});

test("impact rings past its slot but stops at the render frame count", () => {
  const slot = Math.round(0.1 * RATE);
  const long = render([event("impact", 0, 0, slot)], 3 * RATE, { impactDecay: 0.8 });
  assert.ok(rms(long, slot, slot + Math.round(0.1 * RATE)) > 1e-4, "impact decays beyond the slot");
  const clipped = render([event("impact", 0, 0, slot)], slot + 10);
  assert.equal(clipped.length, slot + 10);
});

test("events at or beyond the last frame write at most one frame", () => {
  const frames = RATE;
  assert.equal(rms(render([event("riser", 0, frames, RATE)], frames), 0, frames), 0);
  const tail = render([event("impact", 0, frames - 1, RATE)], frames);
  for (let i = 0; i < frames - 1; i++) assert.equal(tail[i], 0);
});

test("unknown atoms are schema errors", () => {
  assert.throws(() => render([event("bd", 0, 0, 100)], 200), /unknown sfx atom bd/);
});

test("overlapping events stay within full scale", () => {
  const slot = Math.round(0.2 * RATE);
  const pcm = render([event("impact", 0, 0, slot, 1), event("impact", 1, 0, slot, 2), event("subdrop", 2, 0, slot, 3)], RATE);
  let peak = 0;
  for (const sample of pcm) peak = Math.max(peak, Math.abs(sample));
  assert.ok(peak <= 1, "summed peak " + peak);
  assert.ok(peak > 0.8, "overlap is still louder than one event");
});

test("a lone event keeps the kernel's exact samples", () => {
  const slot = Math.round(0.5 * RATE);
  for (const name of sfxVoice.sampleNames!) {
    const pcm = render([event(name, 3, 0, slot)], slot);
    const kernel = renderTransition(name as TransitionAtom, 3, slot / RATE, RATE, 7, mergeParams(sfxVoice, {}), 1, slot);
    assert.equal(pcm.length, kernel.length, name);
    assert.ok(pcm.every((sample, i) => sample === kernel[i]), name);
  }
});
