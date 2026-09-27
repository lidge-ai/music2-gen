import type { Timeline } from "../../song/index.ts";
import type { BeatMap } from "../analysis.schema.ts";
import type { FlowIntervalGrid } from "./flow.schema.ts";

/** Choose exact declared bars, reliable measured beats, or half-second audio frames. */
export function flowIntervals(durationSeconds: number, beatMap?: BeatMap, timeline?: Timeline): FlowIntervalGrid {
  if (timeline) {
    return { axisKind: "bars", durationSeconds: timeline.durationSeconds,
      intervals: Array.from({ length: timeline.bars }, (_, index) => ({
        index, startSeconds: index * timeline.secondsPerBar,
        endSeconds: (index + 1) * timeline.secondsPerBar, barNumber: index + 1, beatNumber: null,
      })) };
  }
  const beats = beatMap?.beatsSeconds;
  if (beatMap?.source === "audio" && beatMap.confidence >= .6 && beats && beats.length >= 4 &&
      beats.every((time, index) => Number.isFinite(time) && time >= 0 && time < durationSeconds &&
        (index === 0 || time > beats[index - 1]!))) {
    return { axisKind: "beats", durationSeconds,
      intervals: beats.slice(0, -1).map((startSeconds, index) => ({
        index, startSeconds, endSeconds: beats[index + 1]!, barNumber: null, beatNumber: index + 1,
      })) };
  }
  const count = Math.ceil(durationSeconds / .5);
  return { axisKind: "0.5 s", durationSeconds,
    intervals: Array.from({ length: count }, (_, index) => ({
      index, startSeconds: index * .5, endSeconds: Math.min(durationSeconds, (index + 1) * .5),
      barNumber: null, beatNumber: null,
    })) };
}
