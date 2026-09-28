import type { VoiceSpec } from "../render.schema.ts";
import { renderModal } from "./modal.tool.ts";

export const kalimbaVoice: VoiceSpec = {
  id: "kalimba", kind: "notes", monoDefault: false,
  params: {
    decayScale: { default: 1, min: 0.5, max: 2 },
    overtoneRatio: { default: 6.3, min: 5.9, max: 6.8 },
  },
  render(ctx, params) {
    return renderModal(ctx, params["decayScale"]!, {
      ratios: [1, params["overtoneRatio"]!], levels: [1, 0.28], seconds: [1.8, 0.12],
      gain: 0.47, releaseSeconds: 0.22, strikeSeconds: 0.008,
    }, 0.5);
  },
};
