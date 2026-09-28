import type { StereoBuffer } from "../../audio-io/index.ts";
import { Music2Error } from "../../shared/index.ts";
import type { FxContext, InsertType, ResolvedInsert } from "./fx.schema.ts";
import { processEq } from "./eq.tool.ts";
import { processFilter } from "./filter.tool.ts";
import { processCompressor } from "./compressor.tool.ts";
import { processDrive } from "./drive.tool.ts";
import { processChorus } from "./chorus.tool.ts";
import { processPhaser } from "./phaser.tool.ts";
import { processDelay, renderDelayBus } from "./tempo-delay.tool.ts";
import { processWidth } from "./width.tool.ts";
import { processCrush } from "./crush.tool.ts";
import { processTremolo } from "./tremolo.tool.ts";
import { processTapeStop } from "./tapestop.tool.ts";
export { renderDelayBus };
export { renderReverbBus } from "./reverb.tool.ts";

const processors: Record<InsertType, (buffer: StereoBuffer, params: never, ctx: FxContext) => void> = {
  eq: processEq, filter: processFilter, compressor: processCompressor, drive: processDrive,
  chorus: processChorus, phaser: processPhaser, delay: processDelay, width: processWidth,
  crush: processCrush, tremolo: processTremolo, tapestop: processTapeStop,
};

/** Process one stereo buffer in declared order, retaining no per-insert full-length buffers. */
export function applyInsertChain(buffer: StereoBuffer, inserts: readonly ResolvedInsert[], ctx: FxContext, track: string): void {
  for (let effect = 0; effect < inserts.length; effect++) {
    const insert = inserts[effect]!;
    // The discriminant selects the matching processor and parameter shape.
    const curves = ctx.insertCurves?.[effect];
    processors[insert.type](buffer, insert as never, curves ? { ...ctx, curves } : ctx);
    for (let frame = 0; frame < buffer.left.length; frame++) {
      if (!Number.isFinite(buffer.left[frame]) || !Number.isFinite(buffer.right[frame])) {
        throw new Music2Error("E_RENDER", `nonfinite ${insert.type} output on ${track} at frame ${frame}`, {
          details: { track, effect: insert.type, effectIndex: effect, frame },
        });
      }
    }
  }
}
