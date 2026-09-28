import type { VoiceSpec } from "../render.schema.ts";
import { renderModal } from "./modal.tool.ts";

export const vibraphoneVoice: VoiceSpec = {
  id: "vibraphone", kind: "notes", monoDefault: false,
  params: {
    decayScale: { default: 1, min: 0.5, max: 2 },
    tremoloHz: { default: 4, min: 0, max: 7 },
  },
  render(ctx, params) {
    const requested = params["tremoloHz"]!;
    const tremolo = requested > 0 ? Math.max(2, requested) : 0;
    return renderModal(ctx, params["decayScale"]!, {
      ratios: [1, 4, 10], levels: [1, 0.28, 0.12], seconds: [5, 2, 1],
      gain: 0.44, releaseSeconds: 0.65, strikeSeconds: 0.006,
    }, 0.5, tremolo);
  },
};
