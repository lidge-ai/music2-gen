import { Music2Error } from "../../shared/index.ts";
import type { VoiceContext, VoiceEvent, VoiceSpec } from "../render.schema.ts";

/** Output level of a full-velocity note: sustained 808s carry far more energy than short voices, so they sit near the other voices' 0.3-0.6 peaks. */
export const EIGHT_O_EIGHT_LEVEL = 0.45;

function frequency(ctx: VoiceContext, event: VoiceEvent): number {
  const midi = event.midi;
  if (midi === null || !Number.isFinite(midi) || midi < 0 || midi > 127) {
    throw new Music2Error("E_SCHEMA", `invalid MIDI on track ${ctx.track.id}`, {
      details: { issues: [{ path: `tracks.${ctx.track.id}.pattern`, message: "MIDI must be 0..127" }] },
    });
  }
  return 440 * 2 ** ((midi - 69) / 12);
}

function renderMono(ctx: VoiceContext, drive: number, decayMs: number, attackMs: number): Float32Array {
  const out = new Float32Array(ctx.frames);
  const rate = ctx.sampleRate;
  const glideSeconds = ctx.track.glide / 1000;
  const attackFrames = attackMs * rate / 1000;
  const releaseFrames = Math.max(1, Math.round(.008 * rate));
  const decay = Math.exp(-1 / (decayMs * rate / 1000));
  let phase = 0;
  let previousHz: number | null = null;
  for (let eventIndex = 0; eventIndex < ctx.events.length; eventIndex++) {
    const event = ctx.events[eventIndex]!;
    const next = ctx.events[eventIndex + 1];
    // At identical onsets Timeline order makes the last event the audible one.
    if (next?.startFrame === event.startFrame) continue;
    const targetHz = frequency(ctx, event);
    const fromHz = previousHz ?? targetHz;
    const end = Math.min(ctx.frames, event.stopFrame, next?.startFrame ?? ctx.frames);
    let envelope = 1;
    for (let frame = Math.max(0, event.startFrame); frame < end; frame++) {
      const offset = frame - event.startFrame;
      const hz = glideSeconds > 0 ?
        targetHz + (fromHz - targetHz) * Math.exp(-offset / (rate * glideSeconds)) : targetHz;
      phase += 2 * Math.PI * hz / rate;
      if (phase >= 2 * Math.PI) phase %= 2 * Math.PI;
      const attack = attackFrames > 0 ? Math.min(1, (offset + 1) / attackFrames) : 1;
      const release = Math.min(1, (end - frame) / releaseFrames);
      out[frame] = EIGHT_O_EIGHT_LEVEL * Math.tanh(Math.sin(phase) * drive) / Math.tanh(drive) *
        envelope * attack * release * event.velocity;
      envelope *= decay;
    }
    previousHz = targetHz;
  }
  return out;
}

export const eightOhEightVoice: VoiceSpec = {
  id: "808", kind: "notes", monoDefault: true,
  params: {
    drive: { default: 2.2, min: 1, max: 8 },
    decayMs: { default: 1100, min: 100, max: 5000 },
    attackMs: { default: 3, min: 0, max: 50 },
  },
  render(ctx, params) {
    return renderMono(ctx, params["drive"] ?? 2.2,
      params["decayMs"] ?? 1100, params["attackMs"] ?? 3);
  },
};
