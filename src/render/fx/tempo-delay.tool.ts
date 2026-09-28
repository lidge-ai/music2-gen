import type { StereoBuffer } from "../../audio-io/index.ts";
import { DelayLine } from "./delayline.tool.ts";
import { divisionSeconds } from "./fx.schema.ts";
import type { DelayBusParams, FxContext, InsertProcessor } from "./fx.schema.ts";

/** Wet echo core shared by insert and bus. Input is never copied into the wet output. */
function delayWet(input: StereoBuffer, params: DelayBusParams, ctx: FxContext): StereoBuffer {
  const frames = input.left.length;
  const wet: StereoBuffer = { sampleRate: input.sampleRate, sourceChannels: 2,
    left: new Float32Array(frames), right: new Float32Array(frames) };
  if (params.mix === 0) return wet;
  const rate = ctx.sampleRate;
  const length = Math.max(1, Math.round(divisionSeconds(params.time, ctx.bpm) * rate));
  const lineL = new DelayLine(length);
  const lineR = new DelayLine(length);
  const hpDecay = Math.exp(-2 * Math.PI * params.lowCutHz / rate);
  const lpDecay = Math.exp(-2 * Math.PI * params.highCutHz / rate);
  let hpStateL = 0;
  let hpStateR = 0;
  let lpStateL = 0;
  let lpStateR = 0;
  for (let i = 0; i < frames; i++) {
    const echoL = lineL.read(length);
    const echoR = lineR.read(length);
    wet.left[i] = echoL * params.mix;
    wet.right[i] = echoR * params.mix;
    hpStateL = (1 - hpDecay) * echoL + hpDecay * hpStateL;
    hpStateR = (1 - hpDecay) * echoR + hpDecay * hpStateR;
    lpStateL = (1 - lpDecay) * (echoL - hpStateL) + lpDecay * lpStateL;
    lpStateR = (1 - lpDecay) * (echoR - hpStateR) + lpDecay * lpStateR;
    if (params.pingPong) {
      lineL.write(input.right[i]! + params.feedback * lpStateR);
      lineR.write(input.left[i]! + params.feedback * lpStateL);
    } else {
      lineL.write(input.left[i]! + params.feedback * lpStateL);
      lineR.write(input.right[i]! + params.feedback * lpStateR);
    }
  }
  return wet;
}

export const processDelay: InsertProcessor<"delay"> = (buffer, params, ctx) => {
  const curve = ctx.curves?.["mix"];
  if (curve) {
    const wet = delayWet(buffer, { ...params, mix: 1 }, ctx);
    for (let i = 0; i < buffer.left.length; i++) {
      const mix = curve[i]!;
      buffer.left[i] = (1 - mix) * buffer.left[i]! + mix * wet.left[i]!;
      buffer.right[i] = (1 - mix) * buffer.right[i]! + mix * wet.right[i]!;
    }
    return;
  }
  if (params.mix === 0) return;
  const wet = delayWet(buffer, params, ctx);
  const dry = 1 - params.mix;
  for (let i = 0; i < buffer.left.length; i++) {
    buffer.left[i] = dry * buffer.left[i]! + wet.left[i]!;
    buffer.right[i] = dry * buffer.right[i]! + wet.right[i]!;
  }
};

export function renderDelayBus(send: StereoBuffer, params: DelayBusParams, ctx: FxContext): StereoBuffer {
  return delayWet(send, params, ctx);
}
