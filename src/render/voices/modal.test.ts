import test from "node:test";
import assert from "node:assert/strict";
import type { VoiceContext, VoiceSpec } from "../render.schema.ts";
import { marimbaVoice } from "./marimba.tool.ts";
import { vibraphoneVoice } from "./vibraphone.tool.ts";
import { glockenspielVoice } from "./glockenspiel.tool.ts";
import { kalimbaVoice } from "./kalimba.tool.ts";

const voices = [marimbaVoice, vibraphoneVoice, glockenspielVoice, kalimbaVoice];
function render(voice: VoiceSpec, rate: number, gateFrames: number, seed: number): Float32Array {
  const frames = rate;
  const ctx: VoiceContext = { sampleRate: rate, frames,
    track: { id: "modal", kind: "notes", instrument: voice.id, params: {} } as VoiceContext["track"],
    events: [{ midi: 57, sample: null, velocity: 1, startFrame: 0, gateFrames,
      stopFrame: frames, eventIndex: 0, seed }] };
  return voice.render(ctx, Object.fromEntries(Object.entries(voice.params).map(([k, v]) => [k, v.default])));
}
test("modal voices preserve note-off level, seed addressing, and finite bounded output", () => {
  for (const voice of voices) for (const rate of [44100, 48000]) {
    const gate = Math.floor(0.2 * rate);
    const short = render(voice, rate, gate, 7);
    const held = render(voice, rate, rate, 7);
    assert.equal(short.length, rate);
    assert.deepEqual(short, render(voice, rate, gate, 7));
    assert.notDeepEqual(short, render(voice, rate, gate, 8));
    assert.equal(short[gate], held[gate]);
    assert.ok(short.every(Number.isFinite));
    assert.ok(short.every(x => Math.abs(x) <= 1));
  }
});
