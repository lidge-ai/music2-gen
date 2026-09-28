import type { VoiceSpec } from "../render.schema.ts";

const TAU = 2 * Math.PI;
const T60 = Math.log(1000);

export const epianoVoice: VoiceSpec = {
  id: "epiano", kind: "notes", monoDefault: false,
  params: {
    bodyIndex: { default: 2, min: 1, max: 4 },
    tineIndex: { default: 0.5, min: 0.1, max: 1.2 },
    releaseMs: { default: 180, min: 80, max: 400 },
  },
  render(ctx, params) {
    const output = new Float32Array(ctx.frames);
    const rate = ctx.sampleRate;
    const releaseFrames = params["releaseMs"]! * rate / 1000;
    const releaseFactor = Math.exp(-T60 * 100 / 60 / releaseFrames);
    const bodyFactor = Math.exp(-T60 / (3 * rate));
    const bodyIndexFactor = Math.exp(-T60 / (1.2 * rate));
    const tineIndexFactor = Math.exp(-T60 / (0.22 * rate));
    const attackFrames = Math.max(1, 0.003 * rate);
    for (const event of ctx.events) {
      if (event.midi === null || event.velocity <= 0) continue;
      const frequency = 440 * 2 ** ((event.midi - 69) / 12);
      if (frequency >= 0.45 * rate) continue;
      const step = TAU * frequency / rate;
      // FM has infinite formal sidebands: constrain index and omit the 14:1 branch
      // when its third useful upper sideband would exceed the partial ceiling.
      const harmonics = Math.floor(0.45 * rate / frequency);
      const bodyIndex = Math.min(params["bodyIndex"]! * event.velocity,
        Math.max(0, (harmonics - 1) / 3));
      const tineIndex = 43 * frequency < 0.45 * rate
        ? params["tineIndex"]! * event.velocity : 0;
      let bodyAmplitude = 1;
      let bodyModulation = bodyIndex;
      let tineModulation = tineIndex;
      let release = 1;
      let phase = step * Math.max(0, -event.startFrame);
      const start = Math.max(0, event.startFrame);
      const end = Math.min(ctx.frames, event.stopFrame,
        event.startFrame + Math.ceil(5 * rate),
        event.startFrame + event.gateFrames + Math.ceil(releaseFrames));
      for (let frame = start; frame < end; frame++) {
        const age = frame - event.startFrame;
        const attack = Math.min(1, (age + 1) / attackFrames);
        const body = Math.sin(phase + bodyModulation * Math.sin(phase));
        const tine = Math.sin(phase + tineModulation * Math.sin(14 * phase));
        if (age > event.gateFrames) release *= releaseFactor;
        output[frame]! += 0.52 * event.velocity * attack * bodyAmplitude * release *
          (body + 0.25 * tine);
        phase += step;
        bodyAmplitude *= bodyFactor;
        bodyModulation *= bodyIndexFactor;
        tineModulation *= tineIndexFactor;
      }
    }
    return output;
  },
};
