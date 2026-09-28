import type { VoiceSpec } from "../render.schema.ts";
import { renderModal } from "./modal.tool.ts";

export const glockenspielVoice: VoiceSpec = {
  id: "glockenspiel", kind: "notes", monoDefault: false,
  params: {
    decayScale: { default: 1, min: 0.5, max: 2 },
    strike: { default: 0.5, min: 0, max: 1 },
  },
  render(ctx, params) {
    return renderModal(ctx, params["decayScale"]!, {
      ratios: [1, 2.71, 5.15], levels: [1, 0.28, 0.12], seconds: [4, 3, 1],
      gain: 0.46, releaseSeconds: 0.6, strikeSeconds: 0.003,
    }, params["strike"]!);
  },
};
