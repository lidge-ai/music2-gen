import type { VoiceSpec } from "../render.schema.ts";
import { renderModal } from "./modal.tool.ts";

export const marimbaVoice: VoiceSpec = {
  id: "marimba", kind: "notes", monoDefault: false,
  params: {
    decayScale: { default: 1, min: 0.5, max: 2 },
    strike: { default: 0.5, min: 0, max: 1 },
  },
  render(ctx, params) {
    return renderModal(ctx, params["decayScale"]!, {
      ratios: [1, 3.9, 9.23], levels: [1, 0.28, 0.12], seconds: [0.8, 0.35, 0.12],
      gain: 0.48, releaseSeconds: 0.18, strikeSeconds: 0.006,
    }, params["strike"]!);
  },
};
