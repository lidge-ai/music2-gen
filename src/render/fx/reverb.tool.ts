import { createStereo } from "../../audio-io/index.ts";
import type { StereoBuffer } from "../../audio-io/index.ts";
import type { FxContext, ReverbBusParams } from "./fx.schema.ts";
import { renderPlate } from "./reverb-plate.tool.ts";
import { renderFdn } from "./reverb-fdn.tool.ts";

/** Configured shared return. The send is never mixed into the returned wet signal. */
export function renderReverbBus(send: StereoBuffer, params: ReverbBusParams, ctx: FxContext): StereoBuffer {
  const output = createStereo(ctx.sampleRate, send.left.length);
  if (params.mix === 0 || send.left.length === 0) return output;
  const fs = ctx.sampleRate;
  const preDelay = Math.round(params.preDelayMs * fs / 1000);
  const inputL = new Float32Array(send.left.length);
  const inputR = new Float32Array(send.left.length);
  const lowPole = Math.exp(-2 * Math.PI * params.lowCutHz / fs);
  const highPole = Math.exp(-2 * Math.PI * params.highCutHz / fs);
  let lowL = 0, lowR = 0, highL = 0, highR = 0;
  for (let i = preDelay; i < inputL.length; i++) {
    const j = i - preDelay;
    const l = send.left[j] ?? 0;
    const r = send.right[j] ?? 0;
    lowL = (1 - lowPole) * l + lowPole * lowL;
    lowR = (1 - lowPole) * r + lowPole * lowR;
    highL = (1 - highPole) * (l - lowL) + highPole * highL;
    highR = (1 - highPole) * (r - lowR) + highPole * highR;
    inputL[i] = highL;
    inputR[i] = highR;
  }
  if (params.type === "plate") renderPlate(inputL, inputR, output, params);
  else renderFdn(inputL, inputR, output, params);
  // Apply return cuts and width after the tank, so both early reflections and tail obey them.
  lowL = 0; lowR = 0; highL = 0; highR = 0;
  for (let i = 0; i < inputL.length; i++) {
    const l = output.left[i] ?? 0;
    const r = output.right[i] ?? 0;
    lowL = (1 - lowPole) * l + lowPole * lowL;
    lowR = (1 - lowPole) * r + lowPole * lowR;
    highL = (1 - highPole) * (l - lowL) + highPole * highL;
    highR = (1 - highPole) * (r - lowR) + highPole * highR;
    const mid = (highL + highR) * 0.5 * params.mix;
    const side = (highL - highR) * 0.5 * params.width * params.mix;
    output.left[i] = mid + side;
    output.right[i] = mid - side;
  }
  return output;
}
